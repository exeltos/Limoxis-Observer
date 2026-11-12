import { supabase as configuredClient, type Cloud } from '../../core/supabase/client'
import type { AnyRecord } from '../../types/featureTypes'
import { hasSupabaseConfig } from '../../core/config/env'
import { isOwnerPreview,previewAuditEvents,previewLoginAttempts,previewLoginLocks,previewLoginSessions } from '../../core/preview/ownerPreview'

// The calls below run with a configured client: the demo and an unconfigured build return before them.
const supabase = configuredClient as Cloud

export async function listPlatformAuditEvents({limit=500}={}){
  if(isOwnerPreview())return previewAuditEvents()
  if(!hasSupabaseConfig||!supabase)return []
  const safeLimit=Math.min(Math.max(Number(limit)||500,1),1000)
  const {data,error}=await supabase
    .from('system_audit_log')
    .select('id,organization_id,actor_user_id,actor_role,event_type,entity_type,entity_id,metadata,created_at')
    .order('created_at',{ascending:false})
    .limit(safeLimit)
  if(error)throw error
  const rows=data||[]
  const actorIds=[...new Set(rows.map(row=>row.actor_user_id).filter(Boolean))]
  let actors: Record<string,AnyRecord>={}
  if(actorIds.length){
    const {data:profiles}=await supabase.from('profiles').select('id,full_name,username').in('id',actorIds)
    actors=Object.fromEntries((profiles||[]).map(profile=>[profile.id,profile]))
  }
  return rows.map(row=>({
    id:row.id,
    organizationId:row.organization_id||'',
    actorId:row.actor_user_id||'',
    actorName:actors[row.actor_user_id as string]?.full_name||actors[row.actor_user_id as string]?.username||'—',
    actorRole:row.actor_role||'',
    eventType:row.event_type||'',
    entityType:row.entity_type||'',
    entityId:row.entity_id||'',
    metadata:row.metadata&&typeof row.metadata==='object'?row.metadata:{},
    createdAt:row.created_at,
  }))
}

// Sign-ins (Ιστορικό & Υγεία › Συνδέσεις). Readable only by the Platform Owner (RLS + RPC checks).
export async function listLoginSessions({days=30}={}){
  if(isOwnerPreview())return previewLoginSessions()
  if(!hasSupabaseConfig||!supabase)return []
  const {data,error}=await supabase.rpc('platform_login_sessions_list',{p_days:days,p_limit:2000})
  if(error)throw error
  return (data||[]).map(row=>({sessionId:row.session_id,userId:row.user_id,fullName:row.full_name||'',username:row.username||'',email:row.email||'',isPlatformOwner:Boolean(row.is_platform_owner),organizations:row.organizations||'',ip:row.ip||'',lastIp:row.last_ip||'',userAgent:row.user_agent||'',startedAt:row.started_at,lastSeenAt:row.last_seen_at,endedAt:row.ended_at,endedReason:row.ended_reason||'',active:Boolean(row.active),online:Boolean(row.online)}))
}

export async function listLoginAttempts({days=30}={}){
  if(isOwnerPreview())return {attempts:previewLoginAttempts(),locks:previewLoginLocks()}
  if(!hasSupabaseConfig||!supabase)return {attempts:[],locks:[]}
  const since=new Date(Date.now()-days*86400000).toISOString()
  const [attempts,locks]=await Promise.all([
    supabase.from('platform_login_attempts').select('id,identifier,ip,user_agent,success,reason,created_at').gte('created_at',since).order('created_at',{ascending:false}).limit(2000),
    supabase.from('platform_login_locks').select('id,kind,subject,failures,locked_until,created_at,released_at').gte('created_at',since).order('created_at',{ascending:false}).limit(500),
  ])
  if(attempts.error)throw attempts.error
  if(locks.error)throw locks.error
  return {
    attempts:(attempts.data||[]).map(row=>({id:row.id,identifier:row.identifier,ip:row.ip||'',userAgent:row.user_agent||'',success:row.success,reason:row.reason||'',createdAt:row.created_at})),
    locks:(locks.data||[]).map(row=>({id:row.id,kind:row.kind,subject:row.subject,failures:row.failures,lockedUntil:row.locked_until,createdAt:row.created_at,releasedAt:row.released_at})),
  }
}

export async function endLoginSessions({sessionId=null,userId=null}: {sessionId?: string|null,userId?: string|null}){
  if(isOwnerPreview())return 1
  const {data,error}=await supabase.rpc('platform_end_login_sessions',{p_session_id:sessionId as string|undefined,p_user_id:userId as string|undefined})
  if(error)throw error
  return data||0
}

export async function releaseLoginLock(lockId: number){
  if(isOwnerPreview())return true
  const {data,error}=await supabase.rpc('platform_release_login_lock',{p_lock_id:lockId})
  if(error)throw error
  return Boolean(data)
}
