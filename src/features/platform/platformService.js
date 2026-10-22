import { mergeDomainMetrics } from '../analysis/analysisDomainMerge'
import { supabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'
import { loadActiveClustersAsync } from '../surveillance/outbreakClusterService'
import { buildLiraMetrics,buildPpsMetrics } from '../analysis/analysisAddonMetrics'
import { keepPerCategory } from '../analysis/microbiologyLabels'

const localKey='limoxis.platform.center.v1'
const NO_EXPIRATION_DATE='9999-12-31'
const ANALYTICS_TIMEOUT_MS=15000
const seed={organizations:[{id:'demo-hospital',name:'Demo Hospital',code:'DEMO',type:'hospital',status:'active',region:'Thessaly',city:'Larissa',created_at:'2026-08-30T10:00:00Z'}],members:[{id:'demo-admin',organization_id:'demo-hospital',full_name:'Demo Administrator',email:'demo@limoxis-observer.local',role:'hospital_admin',status:'active'}],entitlements:[{id:'demo-entitlement',organization_id:'demo-hospital',scope_type:'organization',scope_id:'demo-hospital',valid_from:'2026-08-01',valid_until:'2026-09-30',status:'active',notes:'Platform demo access'}]}

function localRead(){try{return {...seed,...JSON.parse(localStorage.getItem(localKey)||'{}')}}catch{return seed}}
function localWrite(value){localStorage.setItem(localKey,JSON.stringify(value));return value}
function withTimeout(promise,ms=ANALYTICS_TIMEOUT_MS){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('ANALYTICS_LOAD_TIMEOUT')),ms)})]).finally(()=>clearTimeout(timer))}

export async function loadPlatformSnapshot(){
  if(!hasSupabaseConfig||!supabase)return localRead()
  const [orgs,members,ents]=await Promise.all([
    supabase.from('organizations').select('id,parent_id,name,code,type,status,region,city,created_at,updated_at').order('name'),
    supabase.from('organization_members').select('id,organization_id,user_id,role,status,created_at').order('created_at',{ascending:false}),
    supabase.from('platform_demo_entitlements').select('*').order('created_at',{ascending:false}),
  ])
  const error=orgs.error||members.error||ents.error
  if(error)throw error
  return {organizations:orgs.data||[],members:(members.data||[]).map(x=>({...x,full_name:x.user_id,email:''})),entitlements:ents.data||[]}
}

function normalizeDemoEntitlement(input){
  const validFrom=input.valid_from?.trim()
  const validUntil=input.valid_until?.trim()||NO_EXPIRATION_DATE
  if(!validFrom)throw new Error('DEMO_VALID_FROM_REQUIRED')
  if(validUntil<validFrom)throw new Error('DEMO_INVALID_DATE_RANGE')
  return {organization_id:input.organization_id||null,label:(input.label||input.scope_id||'Demo access').trim(),contact_name:input.contact_name?.trim()||null,contact_email:input.contact_email?.trim().toLowerCase()||null,valid_from:validFrom,valid_until:validUntil,status:input.status==='suspended'?'paused':(input.status||'active')}
}

export async function saveDemoEntitlement(input){
  const payload=normalizeDemoEntitlement(input)
  if(!hasSupabaseConfig||!supabase){const state=localRead();const row={id:crypto.randomUUID(),created_at:new Date().toISOString(),...payload};state.entitlements=[row,...state.entitlements];localWrite(state);return row}
  const {data,error}=await supabase.from('platform_demo_entitlements').insert(payload).select().single()
  if(error)throw error
  return data
}

function monthKey(value){return String(value||'').slice(0,7)}
function countBy(rows,keyFn){const out={};for(const row of rows){const key=keyFn(row);if(!key)continue;out[key]=(out[key]||0)+1}return out}
function sortedEntries(map,limit=10){return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,limit)}
function mergeEntryRows(snapshots,key,limit=12){const merged={};for(const snapshot of snapshots){for(const [label,value] of snapshot?.microbiology?.[key]||[]){merged[label]=(merged[label]||0)+(Number(value)||0)}}return sortedEntries(merged,limit)}
function sumSummary(snapshots){const result={};for(const snapshot of snapshots){for(const [key,value] of Object.entries(snapshot?.summary||{})){const n=Number(value);if(Number.isFinite(n))result[key]=(result[key]||0)+n}}return result}
function mergeMonthly(snapshots){const merged={};for(const snapshot of snapshots){for(const [month,value] of snapshot?.microbiology?.monthly||[]){merged[month]=(merged[month]||0)+(Number(value)||0)}}return Object.entries(merged).sort((a,b)=>a[0].localeCompare(b[0])).slice(-12)}
function mergeNationalRows(snapshots){const grouped=new Map();for(const snapshot of snapshots){for(const [organism,resistanceClass,department,source,count,lastDate,sampleType] of snapshot?.microbiology?.nationalRows||[]){const key=[organism,resistanceClass,department,source,sampleType].join('|||');const current=grouped.get(key)||{organism,resistanceClass,department,source,sampleType,count:0,lastDate:''};current.count+=Number(count)||0;if(lastDate>current.lastDate)current.lastDate=lastDate;grouped.set(key,current)}}return [...grouped.values()].sort((a,b)=>b.count-a.count||b.lastDate.localeCompare(a.lastDate)).map(row=>[row.organism,row.resistanceClass,row.department,row.source,row.count,row.lastDate,row.sampleType]).filter(keepPerCategory(80))}

async function loadMicrobiologyAnalytics({organizationId='',from='',to='',departmentId=''}){
  let departmentQuery=supabase.from('departments').select('id,organization_id,name').eq('is_active',true).order('name')
  if(organizationId)departmentQuery=departmentQuery.eq('organization_id',organizationId)
  let organizationQuery=supabase.from('organizations').select('id,name')
  if(organizationId)organizationQuery=organizationQuery.eq('id',organizationId)
  const [{data,error},{data:departmentRows,error:departmentError},{data:organizationRows,error:organizationError}]=await Promise.all([
    supabase.rpc('analysis_microbiology_findings',{p_organization_id:organizationId||null,p_from:from||null,p_to:to||null,p_department_id:departmentId||null}),
    departmentQuery,
    organizationQuery.order('name'),
  ])
  if(error)throw error
  if(departmentError)throw departmentError
  const departments=departmentRows||[]
  const enriched=(data||[]).map(row=>({resultId:row.microbiology_result_id,organization_id:row.organization_id,organism:row.organism,resistance_class:row.resistance_class,is_critical:row.is_critical,departmentId:row.department_id||'',department:row.department_name||'—',source:row.source||'—',sampleType:row.sample_type||'—',eventDate:String(row.event_date||'').slice(0,10)}))
  const resultRows=[...new Map(enriched.map((row,index)=>[row.resultId||`row-${index}`,row])).values()]
  const microorganisms=sortedEntries(countBy(enriched,row=>row.organism?.trim()),12)
  const resistance=sortedEntries(countBy(resultRows,row=>row.resistance_class),5)
  const monthly=Object.entries(countBy(resultRows,row=>monthKey(row.eventDate))).sort((a,b)=>a[0].localeCompare(b[0])).slice(-12)
  const byDepartment=sortedEntries(countBy(resultRows,row=>row.department),12)
  const bySource=sortedEntries(countBy(resultRows,row=>row.source),12)
  const bySite=sortedEntries(countBy(resultRows,row=>row.sampleType),12)
  const grouped=new Map()
  for(const row of enriched){const key=[row.organism?.trim()||'—',row.resistance_class||'—',row.department,row.source,row.sampleType].join('|||');const current=grouped.get(key)||{organism:row.organism?.trim()||'—',resistanceClass:row.resistance_class||'—',department:row.department,source:row.source,sampleType:row.sampleType,count:0,lastDate:''};current.count+=1;if(row.eventDate>current.lastDate)current.lastDate=row.eventDate;grouped.set(key,current)}
  const nationalRows=[...grouped.values()].sort((a,b)=>b.count-a.count||b.lastDate.localeCompare(a.lastDate)).map(row=>[row.organism,row.resistanceClass,row.department,row.source,row.count,row.lastDate,row.sampleType]).filter(keepPerCategory(80))
  if(organizationError)throw organizationError
  const names=new Map((organizationRows||[]).map(row=>[row.id,row.name]))
  const orgTotals=countBy(resultRows,row=>row.organization_id)
  const orgResistant=countBy(resultRows.filter(row=>['MDR','XDR','PDR'].includes(row.resistance_class)),row=>row.organization_id)
  const byOrganization=Object.entries(orgTotals).map(([id,total])=>[names.get(id)||id,total,orgResistant[id]||0]).sort((a,b)=>b[1]-a[1]).slice(0,12)
  return {microorganisms,resistance,monthly,byOrganization,byDepartment,bySource,bySite,nationalRows,totalPositive:resultRows.length,totalCritical:resultRows.filter(row=>row.is_critical).length,departmentCount:new Set(resultRows.map(row=>row.department).filter(name=>name&&name!=='—')).size,departments:departments.map(row=>({id:row.id,organizationId:row.organization_id,name:row.name}))}
}

async function loadAmrSusceptibility({organizationId='',from='',to='',departmentId=''}){
  const {data,error}=await supabase.rpc('analysis_amr_susceptibility',{p_organization_id:organizationId||null,p_from:from||null,p_to:to||null,p_department_id:departmentId||null})
  if(error)throw error
  return (data||[]).map(row=>[row.organism_group,Number(row.tested)||0,Number(row.resistant)||0])
}

function mergeAmrRows(snapshots){const merged={};for(const snapshot of snapshots){for(const [organism,tested,resistant] of snapshot?.amrSusceptibility||[]){const current=merged[organism]||{tested:0,resistant:0};current.tested+=Number(tested)||0;current.resistant+=Number(resistant)||0;merged[organism]=current}}return Object.entries(merged).map(([organism,{tested,resistant}])=>[organism,tested,resistant]).sort((a,b)=>b[1]-a[1])}
async function readAddonTable(organizationId,table,columns){const query=supabase.from(table).select(columns);const {data,error}=await (organizationId?query.eq('organization_id',organizationId):query);if(error)throw error;return data||[]}
const ADDON_READS={pps:({organizationId,from,to})=>readAddonTable(organizationId,'point_prevalence_surveys','survey_date,patients_total,patients_with_hai,patients_on_antibiotics').then(rows=>buildPpsMetrics(rows.map(row=>({surveyDate:row.survey_date,patientsTotal:row.patients_total,patientsWithHai:row.patients_with_hai,patientsOnAntibiotics:row.patients_on_antibiotics})),{from,to})).catch(()=>null),lira:({organizationId,from,to})=>readAddonTable(organizationId,'lira_outbreak_investigations','status,organism,created_at,closed_at').then(rows=>buildLiraMetrics(rows,{from,to})).catch(()=>null)}
function withCrosstabs(domains,crosstabs){if(!domains||!crosstabs||typeof crosstabs!=='object')return domains;const out={...domains};for(const [section,values] of Object.entries(crosstabs))if(out[section]&&values&&typeof values==='object')out[section]={...out[section],...values};return out}
export const ANALYSIS_PARTS=['summary','domains','people','crosstab','qualityFood','microbiology','amr','clusters','pps','lira']
const BASE_PARTS=['summary','domains','microbiology']
const TAB_PARTS={surveillance:['crosstab'],laboratory:['amr','clusters'],antimicrobials:['crosstab'],controls:['crosstab'],quality:['crosstab'],occupational:['people'],training:['people'],governance:['people'],qualityfood:['qualityFood'],pps:['pps'],lira:['lira','clusters']}
export function analysisPartsForTab(tab){return [...BASE_PARTS,...(TAB_PARTS[tab]||[])]}
const partCache=new Map()
function rpcPart(call,{organizationId,from,to,departmentId}){return Promise.resolve().then(()=>call({p_organization_id:organizationId||null,p_from:from||null,p_to:to||null,p_department_id:departmentId||null})).catch(error=>({data:null,error}))}
const PART_READS={summary:args=>rpcPart(params=>supabase.rpc('platform_report_summary',params),args),domains:args=>rpcPart(params=>supabase.rpc('analysis_domain_metrics',params),args),people:args=>rpcPart(params=>supabase.rpc('analysis_people_metrics',params),args),crosstab:args=>rpcPart(params=>supabase.rpc('analysis_crosstab_metrics',params),args),qualityFood:args=>rpcPart(params=>supabase.rpc('analysis_quality_food_metrics',params),args),microbiology:args=>loadMicrobiologyAnalytics(args),amr:args=>loadAmrSusceptibility(args),clusters:({organizationId})=>organizationId?loadActiveClustersAsync(organizationId).catch(()=>[]):Promise.resolve([]),pps:args=>ADDON_READS.pps(args),lira:args=>ADDON_READS.lira(args)}
function readPart(part,{organizationId='',from='',to='',departmentId=''}){const args={organizationId,from,to,departmentId};const key=JSON.stringify([part,organizationId,part==='clusters'?'':from,part==='clusters'?'':to,['clusters','pps','lira'].includes(part)?'':departmentId]);const now=Date.now();for(const [cachedKey,entry] of partCache)if(entry.expires<=now)partCache.delete(cachedKey);const cached=partCache.get(key);if(cached)return cached.promise;const promise=Promise.resolve().then(()=>PART_READS[part](args));partCache.set(key,{promise,expires:now+SNAPSHOT_TTL_MS});const forget=()=>{if(partCache.get(key)?.promise===promise)partCache.delete(key)};promise.then(result=>{if(result?.error)forget()},forget);return promise}
async function loadSingleAnalysisSnapshot({organizationId='',from='',to='',departmentId='',parts=null}){const wanted=new Set(parts||ANALYSIS_PARTS);const scope={organizationId,from,to,departmentId};const read=part=>wanted.has(part)?readPart(part,scope):Promise.resolve(undefined);const [summaryResult,microbiology,amrSusceptibility,clusters,domainsResult,peopleResult,pps,lira,crosstabResult,qualityFoodResult]=await withTimeout(Promise.all(['summary','microbiology','amr','clusters','domains','people','pps','lira','crosstab','qualityFood'].map(read)));if(summaryResult?.error)throw summaryResult.error;const addonDomains={...(pps?{pps:{...pps}}:{}),...(lira?{lira:{...lira}}:{})};if(addonDomains.lira)addonDomains.lira.clusters=Array.isArray(clusters)?clusters.length:0;const missing=result=>!result||result.error||!result.data;const domains=missing(domainsResult)&&missing(peopleResult)?null:{...(domainsResult?.error?{}:(domainsResult?.data||{})),...(peopleResult?.error?{}:(peopleResult?.data||{})),...(qualityFoodResult?.error?{}:(qualityFoodResult?.data||{})),...addonDomains};const scopedDomains=withCrosstabs(domains,crosstabResult?.error?null:crosstabResult?.data);return {source:'production',summary:summaryResult?.data||{},microbiology:microbiology||{},amrSusceptibility:amrSusceptibility||[],clusters:clusters||[],domains:mergeDomainMetrics(scopedDomains?[scopedDomains]:[])}}
function hospitalRows(snapshots,ids,names){return snapshots.map((snapshot,index)=>{const d=snapshot?.domains||{},s=d.surveillance||{},hh=d.handHygiene||{},b=d.bundles||{},micro=snapshot?.microbiology||{};const mdro=(micro.resistance||[]).filter(([key])=>['MDR','XDR','PDR'].includes(key)).reduce((sum,[,n])=>sum+(Number(n)||0),0);const hand=Number(hh.observations)?Math.round(Number(hh.compliant)/Number(hh.observations)*1000)/10:null;return {organizationId:ids[index],name:names?.[ids[index]]||ids[index],episodes:Number(s.total)||0,hai:Number(s.haiConfirmed)||0,positives:Number(micro.totalPositive)||0,mdro,hand,bundles:b.averageScore??null}})}
function mergeAnalysisSnapshots(snapshots){const departments=[];const seenDepartments=new Set();const byOrganization=[];for(const snapshot of snapshots){for(const item of snapshot?.microbiology?.departments||[]){if(seenDepartments.has(item.id))continue;seenDepartments.add(item.id);departments.push(item)}for(const row of snapshot?.microbiology?.byOrganization||[])byOrganization.push(row)}const totalPositive=snapshots.reduce((sum,item)=>sum+(Number(item?.microbiology?.totalPositive)||0),0);const totalCritical=snapshots.reduce((sum,item)=>sum+(Number(item?.microbiology?.totalCritical)||0),0);return {source:'production',summary:sumSummary(snapshots),domains:mergeDomainMetrics(snapshots.map(item=>item?.domains)),microbiology:{microorganisms:mergeEntryRows(snapshots,'microorganisms'),resistance:mergeEntryRows(snapshots,'resistance',5),monthly:mergeMonthly(snapshots),byOrganization:byOrganization.sort((a,b)=>Number(b[1]||0)-Number(a[1]||0)),byDepartment:mergeEntryRows(snapshots,'byDepartment'),bySource:mergeEntryRows(snapshots,'bySource'),bySite:mergeEntryRows(snapshots,'bySite'),nationalRows:mergeNationalRows(snapshots),totalPositive,totalCritical,departmentCount:new Set(snapshots.flatMap(item=>(item?.microbiology?.byDepartment||[]).map(([name])=>name))).size,departments},amrSusceptibility:mergeAmrRows(snapshots),clusters:snapshots.flatMap(item=>item?.clusters||[]).sort((a,b)=>b.count-a.count||String(b.lastDate).localeCompare(String(a.lastDate)))}}
const SNAPSHOT_TTL_MS=60000
const snapshotCache=new Map()
export function clearAnalysisSnapshotCache(){snapshotCache.clear();partCache.clear()}
export async function loadAnalysisSnapshot(options={}){const {organizationId='',organizationIds=null,organizationNames=null,from='',to='',departmentId='',parts=null}=options;const key=JSON.stringify([organizationId,Array.isArray(organizationIds)?[...organizationIds].sort():null,organizationNames,from,to,departmentId,parts?[...new Set(parts)].sort():null]);const now=Date.now();for(const [cachedKey,entry] of snapshotCache)if(entry.expires<=now)snapshotCache.delete(cachedKey);const cached=snapshotCache.get(key);if(cached)return cached.promise;const promise=readAnalysisSnapshot(options);snapshotCache.set(key,{promise,expires:now+SNAPSHOT_TTL_MS});promise.catch(()=>{if(snapshotCache.get(key)?.promise===promise)snapshotCache.delete(key)});return promise}
async function readAnalysisSnapshot({organizationId='',organizationIds=null,organizationNames=null,from='',to='',departmentId='',parts=null}={}){if(!hasSupabaseConfig||!supabase)throw new Error('SUPABASE_REQUIRED_FOR_PRODUCTION_ANALYTICS');if(!Array.isArray(organizationIds))return loadSingleAnalysisSnapshot({organizationId,from,to,departmentId,parts});const scopedIds=[...new Set(organizationIds.filter(Boolean))];if(!scopedIds.length)return {source:'production',summary:{},domains:null,microbiology:{},amrSusceptibility:[],clusters:[]};if(scopedIds.length===1)return loadSingleAnalysisSnapshot({organizationId:scopedIds[0],from,to,departmentId,parts});const snapshots=await withTimeout(Promise.all(scopedIds.map(id=>loadSingleAnalysisSnapshot({organizationId:id,from,to,departmentId:'',parts}))));return {...mergeAnalysisSnapshots(snapshots),hospitals:hospitalRows(snapshots,scopedIds,organizationNames)}}
export function loadAnalysisSections({organizationId='',from='',to='',departmentId=''}={}){if(!hasSupabaseConfig||!supabase)throw new Error('SUPABASE_REQUIRED_FOR_PRODUCTION_ANALYTICS');const scope={organizationId,from,to,departmentId};const rpc=part=>withTimeout(readPart(part,scope).then(({data,error})=>{if(error)throw error;return data||{}}));return {domains:rpc('domains'),people:rpc('people'),qualityFood:rpc('qualityFood'),microbiology:withTimeout(readPart('microbiology',scope)),clusters:readPart('clusters',scope)}}