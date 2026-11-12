import { supabase } from '../../core/supabase/client'

function requireCloud(organizationId){
  if(!organizationId) throw new Error('Missing organization context.')
  if(!supabase) throw new Error('Supabase is not configured.')
}

function toRow(row){
  return {
    id:row.id,
    from:row.period_start,
    to:row.period_end,
    scope:row.department_id?'department':'hospital',
    departmentId:row.department_id||'',
    departmentEl:row.departments?.name||'',
    departmentEn:row.departments?.name||'',
    value:row.patient_days,
    source:row.source||'manual',
    reviewStatus:row.review_status||'reviewable'
  }
}

export async function loadPatientDayPeriods(organizationId){
  requireCloud(organizationId)
  const {data,error}=await supabase.from('patient_day_periods').select('id,period_start,period_end,department_id,patient_days,source,review_status,departments(name)').eq('organization_id',organizationId).order('period_start',{ascending:false})
  if(error) throw error
  return (data||[]).map(toRow)
}

export async function createPatientDayPeriod(organizationId,input){
  requireCloud(organizationId)
  const {data:{user}}=await supabase.auth.getUser()
  const payload={organization_id:organizationId,department_id:input.scope==='department'?input.departmentId:null,period_start:input.from,period_end:input.to,patient_days:Number(input.value),source:'manual',review_status:'reviewable',created_by:user?.id||null,updated_by:user?.id||null}
  const {data,error}=await supabase.from('patient_day_periods').insert(payload).select('id,period_start,period_end,department_id,patient_days,source,review_status,departments(name)').single()
  if(error) throw error
  return toRow(data)
}

export async function updatePatientDayPeriod(organizationId,id,input){
  requireCloud(organizationId)
  const {data:{user}}=await supabase.auth.getUser()
  const payload={department_id:input.scope==='department'?input.departmentId:null,period_start:input.from,period_end:input.to,patient_days:Number(input.value),updated_by:user?.id||null}
  const {data,error}=await supabase.from('patient_day_periods').update(payload).eq('organization_id',organizationId).eq('id',id).select('id,period_start,period_end,department_id,patient_days,source,review_status,departments(name)').single()
  if(error) throw error
  return toRow(data)
}

export async function removePatientDayPeriod(organizationId,id){
  requireCloud(organizationId)
  const {error}=await supabase.from('patient_day_periods').delete().eq('organization_id',organizationId).eq('id',id)
  if(error) throw error
}
