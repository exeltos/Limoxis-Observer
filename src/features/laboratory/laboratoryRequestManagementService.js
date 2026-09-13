import { supabase } from '../../core/supabase/client'

const assertCloud=()=>{if(!supabase)throw new Error('Supabase is not configured.')}
async function currentUserId(){assertCloud();const {data,error}=await supabase.auth.getUser();if(error)throw error;const id=data?.user?.id;if(!id)throw new Error('Authenticated user is required.');return id}

async function assertEditableRequest(organizationId,sampleRecordId){
  assertCloud()
  const {data:sample,error}=await supabase.from('laboratory_samples').select('id,status,received_at,finalized_at').eq('organization_id',organizationId).eq('id',sampleRecordId).single()
  if(error)throw error
  if(sample.status!=='requested'||sample.received_at||sample.finalized_at)throw new Error('LAB_REQUEST_LOCKED')
  const {count,error:resultError}=await supabase.from('microbiology_results').select('id',{count:'exact',head:true}).eq('organization_id',organizationId).eq('sample_id',sampleRecordId)
  if(resultError)throw resultError
  if((count||0)>0)throw new Error('LAB_REQUEST_HAS_RESULT')
  return sample
}

export async function updateLaboratoryRequest(organizationId,sampleRecordId,patch={}){
  await assertEditableRequest(organizationId,sampleRecordId)
  const actorId=await currentUserId()
  const payload={updated_by:actorId,updated_at:new Date().toISOString()}
  if(patch.source!==undefined)payload.source_site=patch.source?.trim()||null
  if(patch.priority!==undefined)payload.priority=patch.priority||'routine'
  if(patch.sampleType!==undefined)payload.sample_type=patch.sampleType||'surveillance'
  const {error}=await supabase.from('laboratory_samples').update(payload).eq('organization_id',organizationId).eq('id',sampleRecordId)
  if(error)throw error
  return true
}

export async function cancelLaboratoryRequest(organizationId,sampleRecordId){
  await assertEditableRequest(organizationId,sampleRecordId)
  const actorId=await currentUserId()
  const {error}=await supabase.from('laboratory_samples').update({status:'cancelled',updated_by:actorId,updated_at:new Date().toISOString()}).eq('organization_id',organizationId).eq('id',sampleRecordId)
  if(error)throw error
  return true
}

export async function deleteLaboratoryRequest(organizationId,sampleRecordId){
  await assertEditableRequest(organizationId,sampleRecordId)
  const {error}=await supabase.from('laboratory_samples').delete().eq('organization_id',organizationId).eq('id',sampleRecordId)
  if(error)throw error
  return true
}

export function laboratoryRequestEditable(sample){
  return Boolean(sample?.recordId&&sample.status==='requested'&&!sample.receivedAt&&!sample.finalizedAt&&!sample.result)
}
