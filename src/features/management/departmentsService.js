import { supabase } from '../../core/supabase/client'

export async function loadDepartments(organizationId){
  if(!organizationId || !supabase) return []
  const {data,error}=await supabase.from('departments').select('id,name,code,is_active').eq('organization_id',organizationId).order('name')
  if(error) throw error
  return data??[]
}

export async function ensureDepartment(organizationId, name){
  if(!organizationId || !supabase || !name) return null
  const {data:existing,error:findError}=await supabase.from('departments').select('id').eq('organization_id',organizationId).eq('name',name).maybeSingle()
  if(findError) throw findError
  if(existing) return existing.id
  const {data:created,error:insertError}=await supabase.from('departments').insert({organization_id:organizationId,name}).select('id').single()
  if(insertError) throw insertError
  return created.id
}
