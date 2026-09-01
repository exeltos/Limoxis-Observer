import { supabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'

export async function answerCommitteeMembershipAsync(memberId,status){
  if(isDemoDataEnvironment())throw new Error('DEMO_COMMITTEE_MEMBERSHIP_APPROVAL_LOCAL_ONLY')
  if(!hasSupabaseConfig||!supabase)throw new Error('PRODUCTION_COMMITTEES_SUPABASE_REQUIRED:membership.approval')
  if(!memberId)throw new Error('COMMITTEE_MEMBER_DB_ID_REQUIRED')
  if(!['approved','rejected'].includes(status))throw new Error('COMMITTEE_MEMBERSHIP_APPROVAL_STATUS_INVALID')

  const {data,error}=await supabase.rpc('answer_committee_membership',{
    p_member_id:memberId,
    p_status:status,
  })
  if(error)throw error
  return data
}
