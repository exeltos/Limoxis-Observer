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
export async function createOrganization(input){if(hasSupabaseConfig&&supabase&&input.adminEmail){const {data,error}=await supabase.functions.invoke('platform-create-hospital',{body:input});if(error)throw error;return data?.organization}if(!hasSupabaseConfig||!supabase){const state=localRead();const row={id:crypto.randomUUID(),status:'active',created_at:new Date().toISOString(),...input};state.organizations=[...state.organizations,row];localWrite(state);return row}const organization={...input};delete organization.adminEmail;delete organization.adminName;const {data,error}=await supabase.from('organizations').insert(organization).select().single();if(error)throw error;return data}
function normalizeDemoEntitlement(input){
  const validFrom=input.valid_from?.trim()
  const validUntil=input.valid_until?.trim()||NO_EXPIRATION_DATE
  if(!validFrom)throw new Error('DEMO_VALID_FROM_REQUIRED')
  if(validUntil<validFrom)throw new Error('DEMO_INVALID_DATE_RANGE')
  return {
    organization_id:input.organization_id||null,
    label:(input.label||input.scope_id||'Demo access').trim(),
    contact_name:input.contact_name?.trim()||null,
    contact_email:input.contact_email?.trim().toLowerCase()||null,
    valid_from:validFrom,
    valid_until:validUntil,
    status:input.status==='suspended'?'paused':(input.status||'active'),
  }
}
export async function saveDemoEntitlement(input){
  const payload=normalizeDemoEntitlement(input)
  if(!hasSupabaseConfig||!supabase){const state=localRead();const row={id:crypto.randomUUID(),created_at:new Date().toISOString(),...payload};state.entitlements=[row,...state.entitlements];localWrite(state);return row}
  const {data,error}=await supabase.from('platform_demo_entitlements').insert(payload).select().single()
  if(error)throw error
  return data
}
export async function loadGlobalReportSummary({organizationId='',from='',to=''}={}){if(!hasSupabaseConfig||!supabase)return {surveillance:24,laboratory:41,prevention:87,controls:34,quality:12,training:56,documents:18,committees:7,antimicrobial:15,occupationalHealth:29,waste:22,handHygiene:64};const {data,error}=await supabase.rpc('platform_report_summary',{p_organization_id:organizationId||null,p_from:from||null,p_to:to||null});if(error)throw error;return data||{}}

function monthKey(value){return String(value||'').slice(0,7)}
function countBy(rows,keyFn){const out={};for(const row of rows){const key=keyFn(row);if(!key)continue;out[key]=(out[key]||0)+1}return out}
function sortedEntries(map,limit=10){return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,limit)}

export async function loadPlatformAnalyticsDetails({organizationId='',from='',to=''}={}){
  if(!hasSupabaseConfig||!supabase){
    return {
      source:'local-demo',
      microorganisms:[['Klebsiella pneumoniae',19],['Acinetobacter baumannii',12],['Pseudomonas aeruginosa',11],['Escherichia coli',9],['Staphylococcus aureus',6]],
      resistance:[['MDR',29],['XDR',13],['PDR',2]],
      monthly:[['2026-03',9],['2026-04',12],['2026-05',14],['2026-06',17],['2026-07',21],['2026-08',24]],
      byOrganization:[['Demo Hospital',41,17]],
      byDepartment:[['ΜΕΘ',24],['Παθολογική',15],['Χειρουργική',10],['ΤΕΠ',8]],
      bySource:[['Αίμα / αιμοκαλλιέργεια',21],['Ούρα',16],['Αναπνευστικό',13],['Τραύμα / έκκριμα',7]],
      bySampleType:[['Αίμα',21],['Ούρα',16],['Αναπνευστικό',13],['Άλλο',7]],
      departments:['ΜΕΘ','Παθολογική','Χειρουργική','ΤΕΠ'],
      nationalRows:[['Klebsiella pneumoniae','MDR','ΜΕΘ','Αίμα / αιμοκαλλιέργεια',12,'2026-08-27'],['Acinetobacter baumannii','XDR','ΜΕΘ','Αναπνευστικό',10,'2026-08-26'],['Pseudomonas aeruginosa','XDR','ΜΕΘ','Αναπνευστικό',8,'2026-08-26']],
      totalPositive:57,totalCritical:8,departmentCount:4,
    }
  }

  let query=supabase.from('microbiology_results').select('organization_id,sample_id,result_status,organism,resistance_class,is_critical,resulted_at').order('resulted_at',{ascending:true}).limit(5000)
  if(organizationId)query=query.eq('organization_id',organizationId)
  if(from)query=query.gte('resulted_at',`${from}T00:00:00`)
  if(to)query=query.lte('resulted_at',`${to}T23:59:59.999`)
  const {data,error}=await query
  if(error)throw error
  const rows=data||[]
  const positive=rows.filter(row=>row.result_status==='positive')
  const sampleIds=[...new Set(positive.map(row=>row.sample_id).filter(Boolean))]
  const samples=[]
  for(let i=0;i<sampleIds.length;i+=200){
    const {data:batch,error:sampleError}=await supabase.from('laboratory_samples').select('id,organization_id,department_id,sample_type,source_site,collected_at').in('id',sampleIds.slice(i,i+200))
    if(sampleError)throw sampleError
    samples.push(...(batch||[]))
  }
  let departmentQuery=supabase.from('departments').select('id,organization_id,name').eq('is_active',true)
  if(organizationId)departmentQuery=departmentQuery.eq('organization_id',organizationId)
  const {data:departmentRows,error:departmentError}=await departmentQuery
  if(departmentError)throw departmentError
  const sampleMap=new Map(samples.map(row=>[row.id,row]))
  const departmentMap=new Map((departmentRows||[]).map(row=>[row.id,row.name]))
  const enriched=positive.map(row=>{
    const sample=sampleMap.get(row.sample_id)||{}
    const department=departmentMap.get(sample.department_id)||'—'
    const source=(sample.source_site||sample.sample_type||'—').trim?.()||sample.source_site||sample.sample_type||'—'
    return {...row,department,source,sampleType:sample.sample_type||'—',eventDate:String(row.resulted_at||sample.collected_at||'').slice(0,10)}
  })
  const microorganisms=sortedEntries(countBy(enriched,row=>row.organism?.trim()),12)
  const resistance=sortedEntries(countBy(enriched,row=>row.resistance_class),5)
  const monthly=Object.entries(countBy(enriched,row=>monthKey(row.resulted_at))).sort((a,b)=>a[0].localeCompare(b[0])).slice(-12)
  const byDepartment=sortedEntries(countBy(enriched,row=>row.department),12)
  const bySource=sortedEntries(countBy(enriched,row=>row.source),12)
  const bySampleType=sortedEntries(countBy(enriched,row=>row.sampleType),12)
  const grouped=new Map()
  for(const row of enriched){
    const organism=row.organism?.trim()||'—'
    const resistanceClass=row.resistance_class||'—'
    const key=[organism,resistanceClass,row.department,row.source].join('|||')
    const current=grouped.get(key)||{organism,resistanceClass,department:row.department,source:row.source,count:0,lastDate:''}
    current.count+=1
    if(row.eventDate>current.lastDate)current.lastDate=row.eventDate
    grouped.set(key,current)
  }
  const nationalRows=[...grouped.values()].sort((a,b)=>b.count-a.count||b.lastDate.localeCompare(a.lastDate)).slice(0,80).map(row=>[row.organism,row.resistanceClass,row.department,row.source,row.count,row.lastDate])
  const organizations=(await loadPlatformSnapshot()).organizations||[]
  const names=new Map(organizations.map(row=>[row.id,row.name]))
  const orgTotals=countBy(enriched,row=>row.organization_id)
  const resistantRows=enriched.filter(row=>['MDR','XDR','PDR'].includes(row.resistance_class))
  const orgResistant=countBy(resistantRows,row=>row.organization_id)
  const byOrganization=Object.entries(orgTotals).map(([id,total])=>[names.get(id)||id,total,orgResistant[id]||0]).sort((a,b)=>b[1]-a[1]).slice(0,12)
  return {
    source:'production',microorganisms,resistance,monthly,byOrganization,byDepartment,bySource,bySampleType,
    departments:byDepartment.map(([name])=>name).filter(name=>name&&name!=='—'),
    nationalRows,totalPositive:enriched.length,totalCritical:enriched.filter(row=>row.is_critical).length,
    departmentCount:new Set(enriched.map(row=>row.department).filter(name=>name&&name!=='—')).size,
  }
}
