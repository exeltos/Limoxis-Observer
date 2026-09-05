import { supabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'

function requireProduction(organizationId,committee){
  if(isDemoDataEnvironment())throw new Error('DEMO_COMMITTEE_DETAILS_LOCAL_ONLY')
  if(!hasSupabaseConfig||!supabase)throw new Error('PRODUCTION_COMMITTEES_SUPABASE_REQUIRED:details.update')
  if(!organizationId)throw new Error('PRODUCTION_COMMITTEES_ORGANIZATION_REQUIRED:details.update')
  if(!committee?.dbId)throw new Error('PRODUCTION_COMMITTEE_DB_ID_REQUIRED:details.update')
}

export async function updateCommitteeDetailsAsync(organizationId,committee,patch={}){
  requireProduction(organizationId,committee)
  const next={...committee,...patch}
  const payload={
    name:String(next.name||'').trim(),
    short_name:String(next.shortName||'').trim()||null,
    status:next.status==='inactive'?'inactive':'active',
    decision_number:String(next.decisionNumber||'').trim()||null,
    term_start:next.termStart||null,
    term_end:next.termEnd||null,
    meeting_frequency:next.meetingFrequency||null,
    quorum_rule:next.quorumRule||null,
    notes:String(next.notes||'').trim()||null,
    updated_at:new Date().toISOString(),
  }
  const {data,error}=await supabase.from('committees').update(payload).eq('organization_id',organizationId).eq('id',committee.dbId).select('id,name,short_name,status,decision_number,term_start,term_end,meeting_frequency,quorum_rule,notes,updated_at').single()
  if(error)throw error
  const {error:historyError}=await supabase.from('committee_history').insert({organization_id:organizationId,committee_id:committee.dbId,action:'Επεξεργασία βασικών στοιχείων επιτροπής',reason:data.name,event_data:{status:data.status,term_start:data.term_start,term_end:data.term_end,meeting_frequency:data.meeting_frequency,quorum_rule:data.quorum_rule}})
  if(historyError)throw historyError
  return {...committee,name:data.name,shortName:data.short_name||'',status:data.status,decisionNumber:data.decision_number||'',termStart:data.term_start||'',termEnd:data.term_end||'',meetingFrequency:data.meeting_frequency||'quarterly',quorumRule:data.quorum_rule||'simple_majority',notes:data.notes||'',updatedAt:data.updated_at}
}
