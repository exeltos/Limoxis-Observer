import { supabase } from '../../core/supabase/client'

export async function loadDepartments(organizationId: string|null|undefined){
  if(!organizationId || !supabase) return []
  const {data,error}=await supabase.from('departments').select('id,name,code,is_active,department_type,patient_days_separate,patient_days_tracked').eq('organization_id',organizationId).order('name')
  if(error) throw error
  return data??[]
}

export async function ensureDepartment(organizationId: string|null|undefined, name: string|null|undefined){
  if(!organizationId || !supabase || !name) return null
  const {data:existing,error:findError}=await supabase.from('departments').select('id').eq('organization_id',organizationId).eq('name',name).maybeSingle()
  if(findError) throw findError
  if(existing) return existing.id
  const {data:created,error:insertError}=await supabase.from('departments').insert({organization_id:organizationId,name}).select('id').single()
  if(insertError) throw insertError
  return created.id
}

// Patient days counted apart from the hospital's total (Κλινοημέρες, owner 8/11/2026): the department's cases are left
// out of the hospital's rates per 1,000 patient days.
// A department that keeps patient days (a ward) is listed in Κλινοημέρες and compared in the hospital overview.
export async function setDepartmentPatientDays(organizationId: string|null|undefined, departmentId: string|null|undefined, { tracked, separate }: { tracked?: boolean, separate?: boolean }){
  if(!organizationId || !supabase || !departmentId) return
  const {error}=await supabase.from('departments').update({patient_days_tracked:Boolean(tracked),patient_days_separate:Boolean(tracked&&separate)}).eq('organization_id',organizationId).eq('id',departmentId)
  if(error) throw error
}
