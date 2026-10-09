import { supabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'

// Minutes approval by members without an account: the public page opened from
// the e-mailed single-use link, and the secretariat's actions on a request.
function client(operation){if(!hasSupabaseConfig||!supabase)throw new Error(`COMMITTEE_MINUTES_SUPABASE_REQUIRED:${operation}`);return supabase}

export async function loadExternalMinutesAsync(token){
  const {data,error}=await client('external.load').rpc('committee_minutes_external_access',{p_token:token});if(error)throw error;return data
}
export async function decideExternalMinutesAsync(token,decision,comment=''){
  const {data,error}=await client('external.decide').rpc('committee_minutes_external_decide',{p_token:token,p_decision:decision,p_comment:comment||null});if(error)throw error;return data
}
export async function externalMinutesActionAsync(organizationId,approvalId,action){
  const {data,error}=await client('external.action').rpc('committee_minutes_external_action',{p_id:approvalId,p_action:action});if(error)throw error
  if(action==='resend')void supabase.functions.invoke('process-notification-outbox',{body:{organizationId}}).catch(()=>{})
  return data
}

// Present voting members who will need an e-mail link or a paper signature.
export function membersWithoutAccount(attendanceRecords=[],members=[]){
  const byKey=new Map(members.map(m=>[m.id,m]))
  return attendanceRecords
    .filter(x=>x.status==='present'&&x.voting!==false)
    .map(x=>({record:x,member:byKey.get(x.memberId)||null}))
    .filter(({member})=>member&&!member.userId)
    .map(({record,member})=>({memberId:member.id,memberDbId:member.dbId||record.memberDbId||null,name:member.name||record.name,email:member.email||''}))
}
export const EMAIL_PATTERN=/^[^\s@]+@[^\s@]+\.[^\s@]+$/
