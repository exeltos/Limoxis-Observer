import { supabase } from '../../core/supabase/client'

export async function linkLaboratorySampleToSurveillance(organizationId,sampleRecordId,surveillanceCaseId){
  if(!supabase)throw new Error('Supabase is not configured.')
  if(!organizationId||!sampleRecordId||!surveillanceCaseId)return
  const {data,error}=await supabase.auth.getUser()
  if(error)throw error
  const actorId=data?.user?.id||null
  const {error:updateError}=await supabase
    .from('laboratory_samples')
    .update({surveillance_case_id:surveillanceCaseId,updated_by:actorId,updated_at:new Date().toISOString()})
    .eq('organization_id',organizationId)
    .eq('id',sampleRecordId)
  if(updateError)throw updateError
}
