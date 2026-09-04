import { supabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'

export async function listPlatformAuditEvents({limit=500}={}){
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
  let actors={}
  if(actorIds.length){
    const {data:profiles}=await supabase.from('profiles').select('id,full_name,username').in('id',actorIds)
    actors=Object.fromEntries((profiles||[]).map(profile=>[profile.id,profile]))
  }
  return rows.map(row=>({
    id:row.id,
    organizationId:row.organization_id||'',
    actorId:row.actor_user_id||'',
    actorName:actors[row.actor_user_id]?.full_name||actors[row.actor_user_id]?.username||'—',
    actorRole:row.actor_role||'',
    eventType:row.event_type||'',
    entityType:row.entity_type||'',
    entityId:row.entity_id||'',
    metadata:row.metadata&&typeof row.metadata==='object'?row.metadata:{},
    createdAt:row.created_at,
  }))
}
