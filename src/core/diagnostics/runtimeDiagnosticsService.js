import { supabase } from '../supabase/client'
import { hasSupabaseConfig } from '../config/env'
import { isDemoDataEnvironment } from '../data/dataEnvironment'
import { APP_VERSION } from '../version'

const MAX_MESSAGE=500
const MAX_CODE=120

function cleanText(value,max=120){
  const text=String(value??'').replace(/[\r\n\t]+/g,' ').replace(/\s{2,}/g,' ').trim()
  return text?text.slice(0,max):null
}

export function moduleFromRoute(route=''){
  const first=String(route).split('?')[0].split('#')[0].split('/').filter(Boolean)[0]||'dashboard'
  const known=new Set(['platform','surveillance','laboratory','prevention','controls','quality','indicators','training','committees','documents','patients','employees','pharmacy','occupational-health','lira','management','analysis','account','my-department','my-profile'])
  return known.has(first)?first:'dashboard'
}

export function diagnosticCodeFromError(error){
  const explicit=cleanText(error?.code||'',MAX_CODE)
  if(explicit)return explicit
  const message=String(error?.message||'')
  const internal=message.match(/\b(?:PRODUCTION|AUTH|ORG|DUPLICATE|PERMISSION|ACCESS|NETWORK|SERVICE)[A-Z0-9_:.-]*/i)?.[0]
  return cleanText(internal||'',MAX_CODE)
}

export async function recordRuntimeEvent({organizationId,severity='info',eventType='ui_feedback',module=null,route=null,operation=null,userMessage,diagnosticCode=null}={}){
  if(isDemoDataEnvironment())return null
  if(!hasSupabaseConfig||!supabase||!organizationId||!userMessage)return null
  const safeRoute=cleanText(route||globalThis?.location?.pathname,240)
  const {data,error}=await supabase.rpc('record_runtime_event',{
    target_organization_id:organizationId,
    event_severity:['info','success','warning','error','blocked'].includes(severity)?severity:'info',
    event_type:cleanText(eventType,80)||'ui_feedback',
    event_module:cleanText(module,80)||moduleFromRoute(safeRoute),
    event_route:safeRoute,
    event_operation:cleanText(operation,80),
    event_user_message:cleanText(userMessage,MAX_MESSAGE),
    event_diagnostic_code:cleanText(diagnosticCode,MAX_CODE),
    event_app_version:APP_VERSION,
  })
  if(error)throw error
  return data
}

export async function listRuntimeEvents(organizationId,{limit=300,severity='all'}={}){
  if(!hasSupabaseConfig||!supabase||!organizationId)return []
  let query=supabase.from('platform_runtime_events')
    .select('id,organization_id,actor_id,role,severity,event_type,module,route,operation,user_message,diagnostic_code,app_version,occurred_at')
    .eq('organization_id',organizationId)
    .order('occurred_at',{ascending:false})
    .limit(Math.min(Math.max(Number(limit)||300,1),1000))
  if(severity!=='all')query=query.eq('severity',severity)
  const {data,error}=await query
  if(error)throw error
  const rows=data||[]
  const actorIds=[...new Set(rows.map(x=>x.actor_id).filter(Boolean))]
  let actors={}
  if(actorIds.length){
    const {data:profiles}=await supabase.from('profiles').select('id,full_name,username,job_title').in('id',actorIds)
    actors=Object.fromEntries((profiles||[]).map(p=>[p.id,p]))
  }
  return rows.map(row=>({
    id:row.id,
    organizationId:row.organization_id,
    actorId:row.actor_id,
    actorName:actors[row.actor_id]?.full_name||actors[row.actor_id]?.username||'—',
    actorJobTitle:actors[row.actor_id]?.job_title||'',
    role:row.role||'',
    severity:row.severity,
    eventType:row.event_type,
    module:row.module||'',
    route:row.route||'',
    operation:row.operation||'',
    message:row.user_message,
    diagnosticCode:row.diagnostic_code||'',
    appVersion:row.app_version||'',
    occurredAt:row.occurred_at,
  }))
}
