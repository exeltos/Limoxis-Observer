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
      totalPositive:57,
      totalCritical:8,
    }
  }

  let query=supabase.from('microbiology_results').select('organization_id,result_status,organism,resistance_class,is_critical,resulted_at').order('resulted_at',{ascending:true}).limit(5000)
  if(organizationId)query=query.eq('organization_id',organizationId)
  if(from)query=query.gte('resulted_at',`${from}T00:00:00`)
  if(to)query=query.lte('resulted_at',`${to}T23:59:59.999`)
  const {data,error}=await query
  if(error)throw error
  const rows=data||[]
  const positive=rows.filter(row=>row.result_status==='positive')
  const microorganisms=sortedEntries(countBy(positive,row=>row.organism?.trim()),12)
  const resistance=sortedEntries(countBy(positive,row=>row.resistance_class),5)
  const monthly=Object.entries(countBy(positive,row=>monthKey(row.resulted_at))).sort((a,b)=>a[0].localeCompare(b[0])).slice(-12)
  const organizations=(await loadPlatformSnapshot()).organizations||[]
  const names=new Map(organizations.map(row=>[row.id,row.name]))
  const orgTotals=countBy(positive,row=>row.organization_id)
  const resistantRows=positive.filter(row=>['MDR','XDR','PDR'].includes(row.resistance_class))
  const orgResistant=countBy(resistantRows,row=>row.organization_id)
  const byOrganization=Object.entries(orgTotals).map(([id,total])=>[names.get(id)||id,total,orgResistant[id]||0]).sort((a,b)=>b[1]-a[1]).slice(0,12)
  return {
    source:'production',
    microorganisms,
    resistance,
    monthly,
    byOrganization,
    totalPositive:positive.length,
    totalCritical:positive.filter(row=>row.is_critical).length,
  }
}
