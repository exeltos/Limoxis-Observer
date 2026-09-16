import { supabase } from '../../core/supabase/client'

const DEPARTMENT_CACHE_TTL_MS=15000
const departmentCache=new Map()

export async function loadDepartments(organizationId){
  if(!organizationId || !supabase) return []
  const cached=departmentCache.get(organizationId)
  if(cached&&Date.now()-cached.at<DEPARTMENT_CACHE_TTL_MS)return cached.rows
  const {data,error}=await supabase.from('departments').select('id,name,code,is_active').eq('organization_id',organizationId).order('name')
  if(error) throw error
  const rows=data??[]
  departmentCache.set(organizationId,{at:Date.now(),rows})
  return rows
}

export async function ensureDepartment(organizationId, name){
  if(!organizationId || !supabase || !name) return null
  const {data:existing,error:findError}=await supabase.from('departments').select('id').eq('organization_id',organizationId).eq('name',name).maybeSingle()
  if(findError) throw findError
  if(existing) return existing.id
  const {data:created,error:insertError}=await supabase.from('departments').insert({organization_id:organizationId,name}).select('id').single()
  if(insertError) throw insertError
  departmentCache.delete(organizationId)
  return created.id
}
