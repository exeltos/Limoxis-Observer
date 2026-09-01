import { supabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'

export async function cancelCommitteeMeetingAsync(organizationId,committee,meeting,reason){
  if(isDemoDataEnvironment())throw new Error('DEMO_COMMITTEE_MEETING_CANCELLATION_LOCAL_ONLY')
  if(!hasSupabaseConfig||!supabase)throw new Error('PRODUCTION_COMMITTEES_SUPABASE_REQUIRED:meeting.cancel')
  if(!organizationId)throw new Error('PRODUCTION_COMMITTEES_ORGANIZATION_REQUIRED:meeting.cancel')
  if(!committee?.dbId)throw new Error('PRODUCTION_COMMITTEE_DB_ID_REQUIRED:meeting.cancel')
  if(!meeting?.dbId)throw new Error('PRODUCTION_COMMITTEE_MEETING_DB_ID_REQUIRED:meeting.cancel')
  const cleanReason=String(reason||'').trim()
  if(!cleanReason)throw new Error('COMMITTEE_MEETING_CANCELLATION_REASON_REQUIRED')

  const {data,error}=await supabase
    .from('committee_meetings')
    .update({status:'cancelled',cancellation_reason:cleanReason,updated_at:new Date().toISOString()})
    .eq('organization_id',organizationId)
    .eq('committee_id',committee.dbId)
    .eq('id',meeting.dbId)
    .in('status',['draft','planned','in_progress'])
    .select('id,client_key,status,cancellation_reason,cancelled_at,cancelled_by,updated_at')
    .single()
  if(error)throw error

  const {error:historyError}=await supabase.from('committee_history').insert({
    organization_id:organizationId,
    committee_id:committee.dbId,
    action:'Ακύρωση συνεδρίασης',
    reason:cleanReason,
    event_data:{meeting_id:meeting.dbId,client_key:meeting.id||meeting.clientKey||null},
  })
  if(historyError)throw historyError

  return {
    ...meeting,
    status:data.status,
    cancellationReason:data.cancellation_reason||cleanReason,
    cancelledAt:data.cancelled_at||null,
    cancelledBy:data.cancelled_by||null,
  }
}
