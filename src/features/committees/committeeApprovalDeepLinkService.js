import { supabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { answerCommitteeMinutesApprovalAsync } from './committeeWorkflowService'

export async function loadCommitteeApprovalDeepLinkAsync(organizationId,userId,approvalId){
  if(isDemoDataEnvironment()||!organizationId||!userId||!approvalId)return null
  if(!hasSupabaseConfig||!supabase)throw new Error('PRODUCTION_COMMITTEES_SUPABASE_REQUIRED:minutes.approval.deep_link')
  const {data:own,error:ownError}=await supabase
    .from('committee_minutes_approvals')
    .select(`id,committee_id,meeting_id,approver_id,member_id,status,comment,requested_at,decided_at,
      committee:committees!committee_minutes_approvals_committee_id_fkey(id,code,name),
      meeting:committee_meetings!committee_minutes_approvals_meeting_id_fkey(id,client_key,title,scheduled_at,location,status,minutes_number,quorum_met,agenda,minutes,finalized_at)`)
    .eq('organization_id',organizationId)
    .eq('id',approvalId)
    .eq('approver_id',userId)
    .maybeSingle()
  if(ownError)throw ownError
  if(!own)return null

  const {data:approvals,error:approvalsError}=await supabase
    .from('committee_minutes_approvals')
    .select(`id,approver_id,member_id,status,comment,requested_at,decided_at,
      member:committee_members!committee_minutes_approvals_member_id_fkey(member_name)`)
    .eq('organization_id',organizationId)
    .eq('meeting_id',own.meeting_id)
    .order('requested_at',{ascending:true})
  if(approvalsError)throw approvalsError

  return {
    approval:{id:own.id,status:own.status,comment:own.comment||'',requestedAt:own.requested_at,decidedAt:own.decided_at||null},
    committee:{id:own.committee?.id||own.committee_id,code:own.committee?.code||'',name:own.committee?.name||''},
    meeting:{
      id:own.meeting?.client_key||own.meeting_id,
      dbId:own.meeting_id,
      title:own.meeting?.title||'',
      scheduledAt:own.meeting?.scheduled_at||null,
      location:own.meeting?.location||'',
      status:own.meeting?.status||'',
      minutesNo:own.meeting?.minutes_number||'',
      quorum:own.meeting?.quorum_met,
      topics:Array.isArray(own.meeting?.agenda)?own.meeting.agenda:[],
      generalNotes:own.meeting?.minutes||'',
      finalizedAt:own.meeting?.finalized_at||null,
      approvals:(approvals||[]).map(row=>({id:row.id,approverId:row.approver_id,memberId:row.member_id||null,approverName:row.member?.member_name||'',status:row.status,comment:row.comment||'',requestedAt:row.requested_at,decidedAt:row.decided_at||null}))
    }
  }
}

export function decideCommitteeApprovalDeepLinkAsync(approvalId,status,comment=''){
  return answerCommitteeMinutesApprovalAsync(approvalId,status,comment)
}
