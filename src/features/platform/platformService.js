import { supabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'

const localKey='limoxis.platform.center.v1'
const NO_EXPIRATION_DATE='9999-12-31'
const seed={organizations:[{id:'demo-hospital',name:'Demo Hospital',code:'DEMO',type:'hospital',status:'active',region:'Thessaly',city:'Larissa',created_at:'2026-08-30T10:00:00Z'}],members:[{id:'demo-admin',organization_id:'demo-hospital',full_name:'Demo Administrator',email:'demo@limoxis-observer.local',role:'hospital_admin',status:'active'}],entitlements:[{id:'demo-entitlement',organization_id:'demo-hospital',scope_type:'organization',scope_id:'demo-hospital',valid_from:'2026-08-01',valid_until:'2026-09-30',status:'active',notes:'Platform demo access'}]}

function localRead(){try{return {...seed,...JSON.parse(localStorage.getItem(localKey)||'{}')}}catch{return seed}}
function localWrite(value){localStorage.setItem(localKey,JSON.stringify(value));return value}

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

export async function createOrganization(input){
  if(hasSupabaseConfig&&supabase&&input.adminEmail){
    const {data,error}=await supabase.functions.invoke('platform-create-hospital',{body:input})
    if(error)throw error
    return data?.organization
  }
  if(!hasSupabaseConfig||!supabase){
    const state=localRead();const row={id:crypto.randomUUID(),status:'active',created_at:new Date().toISOString(),...input}
    state.organizations=[...state.organizations,row];localWrite(state);return row
  }
  const organization={...input};delete organization.adminEmail;delete organization.adminName
  const {data,error}=await supabase.from('organizations').insert(organization).select().single()
  if(error)throw error
  return data
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
function mergeNationalRows(snapshots){const grouped=new Map();for(const snapshot of snapshots){for(const [organism,resistanceClass,department,source,count,lastDate] of snapshot?.microbiology?.nationalRows||[]){const key=[organism,resistanceClass,department,source].join('|||');const current=grouped.get(key)||{organism,resistanceClass,department,source,count:0,lastDate:''};current.count+=Number(count)||0;if(lastDate>current.lastDate)current.lastDate=lastDate;grouped.set(key,current)}}return [...grouped.values()].sort((a,b)=>b.count-a.count||b.lastDate.localeCompare(a.lastDate)).slice(0,80).map(row=>[row.organism,row.resistanceClass,row.department,row.source,row.count,row.lastDate])}

async function loadMicrobiologyAnalytics({organizationId='',from='',to='',departmentId=''}){
  let query=supabase.from('microbiology_results').select('organization_id,sample_id,result_status,organism,resistance_class,is_critical,resulted_at').order('resulted_at',{ascending:true}).limit(5000)
  if(organizationId)query=query.eq('organization_id',organizationId)
  if(from)query=query.gte('resulted_at',`${from}T00:00:00`)
  if(to)query=query.lte('resulted_at',`${to}T23:59:59.999`)
  const {data,error}=await query
  if(error)throw error
  const positive=(data||[]).filter(row=>row.result_status==='positive')
  const sampleIds=[...new Set(positive.map(row=>row.sample_id).filter(Boolean))]
  const samples=[]
  for(let i=0;i<sampleIds.length;i+=200){
    const {data:batch,error:sampleError}=await supabase.from('laboratory_samples').select('id,organization_id,department_id,sample_type,source_site,collected_at').in('id',sampleIds.slice(i,i+200))
    if(sampleError)throw sampleError
    samples.push(...(batch||[]))
  }
  let departmentQuery=supabase.from('departments').select('id,organization_id,name').eq('is_active',true).order('name')
  if(organizationId)departmentQuery=departmentQuery.eq('organization_id',organizationId)
  const {data:departmentRows,error:departmentError}=await departmentQuery
  if(departmentError)throw departmentError
  const departments=departmentRows||[]
  const sampleMap=new Map(samples.map(row=>[row.id,row]))
  const departmentMap=new Map(departments.map(row=>[row.id,row.name]))
  const enriched=positive.map(row=>{const sample=sampleMap.get(row.sample_id)||{};return {...row,departmentId:sample.department_id||'',department:departmentMap.get(sample.department_id)||'—',source:(sample.source_site||sample.sample_type||'—').trim?.()||sample.source_site||sample.sample_type||'—',sampleType:sample.sample_type||'—',eventDate:String(row.resulted_at||sample.collected_at||'').slice(0,10)}}).filter(row=>!departmentId||row.departmentId===departmentId)
  const microorganisms=sortedEntries(countBy(enriched,row=>row.organism?.trim()),12)
  const resistance=sortedEntries(countBy(enriched,row=>row.resistance_class),5)
  const monthly=Object.entries(countBy(enriched,row=>monthKey(row.resulted_at))).sort((a,b)=>a[0].localeCompare(b[0])).slice(-12)
  const byDepartment=sortedEntries(countBy(enriched,row=>row.department),12)
  const bySource=sortedEntries(countBy(enriched,row=>row.source),12)
  const grouped=new Map()
  for(const row of enriched){const key=[row.organism?.trim()||'—',row.resistance_class||'—',row.department,row.source].join('|||');const current=grouped.get(key)||{organism:row.organism?.trim()||'—',resistanceClass:row.resistance_class||'—',department:row.department,source:row.source,count:0,lastDate:''};current.count+=1;if(row.eventDate>current.lastDate)current.lastDate=row.eventDate;grouped.set(key,current)}
  const nationalRows=[...grouped.values()].sort((a,b)=>b.count-a.count||b.lastDate.localeCompare(a.lastDate)).slice(0,80).map(row=>[row.organism,row.resistanceClass,row.department,row.source,row.count,row.lastDate])
  const {data:organizationRows,error:organizationError}=await supabase.from('organizations').select('id,name').order('name')
  if(organizationError)throw organizationError
  const names=new Map((organizationRows||[]).map(row=>[row.id,row.name]))
  const orgTotals=countBy(enriched,row=>row.organization_id)
  const orgResistant=countBy(enriched.filter(row=>['MDR','XDR','PDR'].includes(row.resistance_class)),row=>row.organization_id)
  const byOrganization=Object.entries(orgTotals).map(([id,total])=>[names.get(id)||id,total,orgResistant[id]||0]).sort((a,b)=>b[1]-a[1]).slice(0,12)
  return {microorganisms,resistance,monthly,byOrganization,byDepartment,bySource,nationalRows,totalPositive:enriched.length,totalCritical:enriched.filter(row=>row.is_critical).length,departmentCount:new Set(enriched.map(row=>row.department).filter(name=>name&&name!=='—')).size,departments:departments.map(row=>({id:row.id,organizationId:row.organization_id,name:row.name}))}
}

async function loadSingleAnalysisSnapshot({organizationId='',from='',to='',departmentId=''}){
  const [summaryResult,microbiology]=await Promise.all([
    supabase.rpc('platform_report_summary',{p_organization_id:organizationId||null,p_from:from||null,p_to:to||null,p_department_id:departmentId||null}),
    loadMicrobiologyAnalytics({organizationId,from,to,departmentId}),
  ])
  if(summaryResult.error)throw summaryResult.error
  return {source:'production',summary:summaryResult.data||{},microbiology}
}

function mergeAnalysisSnapshots(snapshots){
  const departments=[];const seenDepartments=new Set();const byOrganization=[]
  for(const snapshot of snapshots){for(const item of snapshot?.microbiology?.departments||[]){if(seenDepartments.has(item.id))continue;seenDepartments.add(item.id);departments.push(item)}for(const row of snapshot?.microbiology?.byOrganization||[])byOrganization.push(row)}
  const totalPositive=snapshots.reduce((sum,item)=>sum+(Number(item?.microbiology?.totalPositive)||0),0)
  const totalCritical=snapshots.reduce((sum,item)=>sum+(Number(item?.microbiology?.totalCritical)||0),0)
  return {source:'production',summary:sumSummary(snapshots),microbiology:{microorganisms:mergeEntryRows(snapshots,'microorganisms'),resistance:mergeEntryRows(snapshots,'resistance',5),monthly:mergeMonthly(snapshots),byOrganization:byOrganization.sort((a,b)=>Number(b[1]||0)-Number(a[1]||0)),byDepartment:mergeEntryRows(snapshots,'byDepartment'),bySource:mergeEntryRows(snapshots,'bySource'),nationalRows:mergeNationalRows(snapshots),totalPositive,totalCritical,departmentCount:new Set(snapshots.flatMap(item=>(item?.microbiology?.byDepartment||[]).map(([name])=>name))).size,departments}}
}

export async function loadAnalysisSnapshot({organizationId='',organizationIds=[],from='',to='',departmentId=''}={}){
  if(!hasSupabaseConfig||!supabase)throw new Error('SUPABASE_REQUIRED_FOR_PRODUCTION_ANALYTICS')
  const scopedIds=[...new Set((organizationIds||[]).filter(Boolean))]
  if(!scopedIds.length)return loadSingleAnalysisSnapshot({organizationId,from,to,departmentId})
  if(scopedIds.length===1)return loadSingleAnalysisSnapshot({organizationId:scopedIds[0],from,to,departmentId})
  const snapshots=await Promise.all(scopedIds.map(id=>loadSingleAnalysisSnapshot({organizationId:id,from,to,departmentId:''})))
  return mergeAnalysisSnapshots(snapshots)
}
