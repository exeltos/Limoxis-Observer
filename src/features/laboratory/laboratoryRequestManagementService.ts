import { cloudClient } from '../../core/supabase/cloudContext'
import type { TablesUpdate } from '../../core/supabase/database.types'
import type { AnyRecord } from '../../types/featureTypes'

async function currentUserId(){const supabase=cloudClient();const {data,error}=await supabase.auth.getUser();if(error)throw error;const id=data?.user?.id;if(!id)throw new Error('Authenticated user is required.');return id}

async function assertEditableRequest(organizationId: string,sampleRecordId: string){
  const supabase=cloudClient()
  const {data:sample,error}=await supabase.from('laboratory_samples').select('id,status,received_at,finalized_at').eq('organization_id',organizationId).eq('id',sampleRecordId).single()
  if(error)throw error
  if(sample.status!=='requested'||sample.received_at||sample.finalized_at)throw new Error('LAB_REQUEST_LOCKED')
  const {count,error:resultError}=await supabase.from('microbiology_results').select('id',{count:'exact',head:true}).eq('organization_id',organizationId).eq('sample_id',sampleRecordId)
  if(resultError)throw resultError
  if((count||0)>0)throw new Error('LAB_REQUEST_HAS_RESULT')
  return sample
}

export async function updateLaboratoryRequest(organizationId: string,sampleRecordId: string,patch: AnyRecord={}){
  await assertEditableRequest(organizationId,sampleRecordId)
  const supabase=cloudClient()
  const actorId=await currentUserId()
  const payload: TablesUpdate<'laboratory_samples'>={updated_by:actorId,updated_at:new Date().toISOString()}
  if(patch.source!==undefined)payload.source_site=patch.source?.trim()||null
  if(patch.priority!==undefined)payload.priority=patch.priority||'routine'
  if(patch.sampleType!==undefined)payload.sample_type=patch.sampleType||'surveillance'
  const {error}=await supabase.from('laboratory_samples').update(payload).eq('organization_id',organizationId).eq('id',sampleRecordId)
  if(error)throw error
  return true
}

export async function cancelLaboratoryRequest(organizationId: string,sampleRecordId: string){
  await assertEditableRequest(organizationId,sampleRecordId)
  const supabase=cloudClient()
  const actorId=await currentUserId()
  const {error}=await supabase.from('laboratory_samples').update({status:'cancelled',updated_by:actorId,updated_at:new Date().toISOString()}).eq('organization_id',organizationId).eq('id',sampleRecordId)
  if(error)throw error
  return true
}

export async function deleteLaboratoryRequest(organizationId: string,sampleRecordId: string){
  await assertEditableRequest(organizationId,sampleRecordId)
  const supabase=cloudClient()
  const {error}=await supabase.from('laboratory_samples').delete().eq('organization_id',organizationId).eq('id',sampleRecordId)
  if(error)throw error
  return true
}

export function laboratoryRequestEditable(sample: AnyRecord|null|undefined){
  return Boolean(sample?.recordId&&sample.status==='requested'&&!sample.receivedAt&&!sample.finalizedAt&&!sample.result)
}
