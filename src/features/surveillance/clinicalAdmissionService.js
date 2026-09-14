import { supabase } from '../../core/supabase/client'

export async function loadSurveillanceAdmissionLinks(organizationId,caseIds=[]){
  if(!supabase||!organizationId||!caseIds.length)return new Map()
  const {data,error}=await supabase.from('surveillance_cases').select('id,admission_id').eq('organization_id',organizationId).in('id',caseIds)
  if(error)throw error
  return new Map((data||[]).map(row=>[row.id,row.admission_id||null]))
}

export async function linkSurveillanceCaseToAdmission(organizationId,caseId,admissionId){
  if(!supabase||!organizationId||!caseId||!admissionId)return
  const {error}=await supabase.from('surveillance_cases').update({admission_id:admissionId}).eq('organization_id',organizationId).eq('id',caseId)
  if(error)throw error
}
