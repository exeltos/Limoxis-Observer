import { supabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { answerCommitteeMembershipAsync } from './committeeWorkflowService'

export async function loadMyPendingCommitteeMembershipsAsync(organizationId,userId){
  if(isDemoDataEnvironment()||!organizationId||!userId)return []
  if(!hasSupabaseConfig||!supabase)throw new Error('PRODUCTION_COMMITTEES_SUPABASE_REQUIRED:member.inbox')
  const {data,error}=await supabase.from('committee_members').select('id,committee_id,user_id,member_name,title,responsibilities,member_type,has_vote,approval_status,started_at,committee:committees!committee_members_tenant_fk(id,code,name,short_name,status)').eq('organization_id',organizationId).eq('user_id',userId).eq('approval_status','pending').is('ended_at',null).order('started_at',{ascending:false})
  if(error)throw error
  return (data||[]).map(row=>({
    id:`COMMITTEE-MEMBERSHIP-${row.id}`,
    type:'committee_membership',
    memberDbId:row.id,
    committeeDbId:row.committee_id,
    committeeId:row.committee?.code||null,
    committeeName:row.committee?.name||'',
    committeeShortName:row.committee?.short_name||'',
    memberName:row.member_name||'',
    committeeTitle:row.title||'',
    responsibilities:row.responsibilities||'',
    memberType:row.member_type||'regular',
    voting:row.has_vote!==false,
    approvalStatus:row.approval_status,
    startedAt:row.started_at||null,
  }))
}

export async function answerMyCommitteeMembershipAsync(item,status){
  if(!item?.memberDbId)throw new Error('PRODUCTION_COMMITTEE_MEMBER_DB_ID_REQUIRED:member.inbox.answer')
  return answerCommitteeMembershipAsync({dbId:item.memberDbId,approvalStatus:item.approvalStatus},status)
}
