import { selectInChunks } from '../../core/data/inChunks'
import { supabase as configuredClient, type Cloud } from '../../core/supabase/client'

// The calls below run with a configured client: the demo and an unconfigured build return before them.
const supabase = configuredClient as Cloud

export async function loadSurveillanceAdmissionLinks(organizationId: string | null | undefined,caseIds: string[]=[]){
  if(!supabase||!organizationId||!caseIds.length)return new Map()
  const {data,error}=await selectInChunks(caseIds,ids=>supabase.from('surveillance_cases').select('id,admission_id').eq('organization_id',organizationId).in('id',ids))
  if(error)throw error
  return new Map((data||[]).map(row=>[row.id,row.admission_id||null]))
}

export async function linkSurveillanceCaseToAdmission(organizationId: string | null | undefined,caseId: string,admissionId: string){
  if(!supabase||!organizationId||!caseId||!admissionId)return
  const {error}=await supabase.from('surveillance_cases').update({admission_id:admissionId}).eq('organization_id',organizationId).eq('id',caseId)
  if(error)throw error
}
