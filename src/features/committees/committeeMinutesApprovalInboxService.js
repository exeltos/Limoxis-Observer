import { supabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { answerCommitteeMinutesApprovalAsync } from './committeeWorkflowService'

export async function loadMyPendingCommitteeMinutesApprovalsAsync(organizationId,userId){
  if(isDemoDataEnvironment()||!organizationId||!userId)return []
  if(!hasSupabaseConfig||!supabase)throw new Error('PRODUCTION_COMMITTEES_SUPABASE_REQUIRED:minutes.approval.inbox')
  const {data,error}=await supabase
    .from('committee_minutes_approvals')
    .select(`id,committee_id,meeting_id,status,requested_at,
      committee:committees!committee_minutes_approvals_committee_id_fkey(id,name),
      meeting:committee_meetings!committee_minutes_approvals_meeting_id_fkey(id,title,scheduled_at,status)`)
    .eq('organization_id',organizationId)
    .eq('approver_id',userId)
    .eq('status','pending')
    .order('requested_at',{ascending:false})
  if(error)throw error
  return (data||[]).map(row=>({
    id:row.id,
    type:'committee_minutes_approval',
    committeeId:row.committee_id,
    committeeName:row.committee?.name||'',
    meetingId:row.meeting_id,
    meetingTitle:row.meeting?.title||'',
    scheduledAt:row.meeting?.scheduled_at||null,
    requestedAt:row.requested_at,
    status:row.status,
    to:row.committee_id?`/committees/${row.committee_id}`:'/committees'
  }))
}

export async function answerMyCommitteeMinutesApprovalAsync(item,status,comment=''){
  if(!item?.id)throw new Error('COMMITTEE_APPROVAL_ID_REQUIRED')
  return answerCommitteeMinutesApprovalAsync(item.id,status,comment)
}
