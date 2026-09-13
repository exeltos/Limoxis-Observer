import { supabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'

export async function loadEmployeeHistoryAsync(organizationId,employeeDbId){
  if(isDemoDataEnvironment()||!employeeDbId)return []
  if(!hasSupabaseConfig||!supabase)throw new Error('PRODUCTION_CLOUD_REQUIRED:employees.history')
  if(!organizationId)throw new Error('PRODUCTION_ORGANIZATION_REQUIRED:employees.history')
  const {data,error}=await supabase.rpc('employee_admin_history',{p_employee_id:employeeDbId})
  if(error)throw error
  return (data||[]).map(row=>({
    id:String(row.audit_id),
    action:row.action,
    at:row.occurred_at,
    actorName:row.actor_name||'',
    actorRole:row.actor_role||'',
    changedFields:Array.isArray(row.changed_fields)?row.changed_fields:[],
  }))
}
