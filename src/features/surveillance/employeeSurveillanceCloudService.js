import { supabase } from '../../core/supabase/client'

const assertCloud=()=>{if(!supabase)throw new Error('Supabase is not configured.')}

async function currentUserId(){
  assertCloud()
  const {data,error}=await supabase.auth.getUser()
  if(error)throw error
  const id=data?.user?.id
  if(!id)throw new Error('Authenticated user is required.')
  return id
}

function mapRecord(row,employee,department){
  return {
    id:row.surveillance_code,
    recordId:row.id,
    organizationId:row.organization_id,
    employeeDbId:row.employee_id,
    employeeId:employee?.employee_code||row.employee_id,
    employeeName:`${employee?.last_name||''} ${employee?.first_name||''}`.trim(),
    employeeNameEn:`${employee?.first_name_en||employee?.first_name||''} ${employee?.last_name_en||employee?.last_name||''}`.trim(),
    departmentId:employee?.department_id||null,
    department:employee?.department_name||department?.name||'',
    departmentEn:employee?.department_name_en||employee?.department_name||department?.name||'',
    batchId:row.batch_id||null,
    startedAt:row.started_at,
    screeningTypes:row.screening_types||[],
    status:row.status,
    resultStatus:row.result_status,
    interventionStatus:row.intervention_status,
    recheckDue:row.recheck_due||null,
    notes:row.notes||'',
    createdAt:row.created_at,
    updatedAt:row.updated_at,
  }
}

function mapBatch(row,department,records){
  const linked=(records||[]).filter(item=>item.batchId===row.id)
  return {
    id:row.batch_code,
    recordId:row.id,
    organizationId:row.organization_id,
    departmentId:row.department_id||null,
    department:department?.name||'',
    departmentEn:department?.name||'',
    startedAt:row.started_at,
    screeningTypes:row.screening_types||[],
    notes:row.notes||'',
    employeeCount:linked.length,
    activeCount:linked.filter(item=>item.status==='active').length,
    positiveCount:linked.filter(item=>item.resultStatus==='positive').length,
    records:linked,
    createdAt:row.created_at,
  }
}

async function hydrateRecords(rows){
  if(!rows?.length)return []
  const employeeIds=[...new Set(rows.map(row=>row.employee_id))]
  const {data:employees,error}=await supabase.from('employees').select('id,employee_code,first_name,first_name_en,last_name,last_name_en,department_id,department_name,department_name_en').in('id',employeeIds)
  if(error)throw error
  const departmentIds=[...new Set((employees||[]).map(row=>row.department_id).filter(Boolean))]
  const departmentResult=departmentIds.length?await supabase.from('departments').select('id,name').in('id',departmentIds):{data:[],error:null}
  if(departmentResult.error)throw departmentResult.error
  return rows.map(row=>{
    const employee=(employees||[]).find(item=>item.id===row.employee_id)
    const department=(departmentResult.data||[]).find(item=>item.id===employee?.department_id)
    return mapRecord(row,employee,department)
  })
}

export async function loadEmployeeSurveillanceRecords(organizationId){
  assertCloud()
  if(!organizationId)return []
  const {data,error}=await supabase.from('employee_surveillance_records').select('*').eq('organization_id',organizationId).order('started_at',{ascending:false})
  if(error)throw error
  return hydrateRecords(data||[])
}

export async function loadEmployeeSurveillanceBatches(organizationId,records=[]){
  assertCloud()
  if(!organizationId)return []
  const {data,error}=await supabase.from('employee_surveillance_batches').select('*').eq('organization_id',organizationId).order('started_at',{ascending:false})
  if(error)throw error
  const departmentIds=[...new Set((data||[]).map(row=>row.department_id).filter(Boolean))]
  const departments=departmentIds.length?await supabase.from('departments').select('id,name').in('id',departmentIds):{data:[],error:null}
  if(departments.error)throw departments.error
  return (data||[]).map(row=>mapBatch(row,(departments.data||[]).find(item=>item.id===row.department_id),records))
}

export async function createEmployeeSurveillanceRecord(organizationId,employeeDbId,draft){
  assertCloud()
  const actorId=await currentUserId()
  const code=draft.code||`ESUR-${new Date().toISOString().slice(2,10).replaceAll('-','')}-${String(Date.now()).slice(-5)}`
  const {data,error}=await supabase.from('employee_surveillance_records').insert({
    organization_id:organizationId,
    surveillance_code:code,
    employee_id:employeeDbId,
    batch_id:draft.batchId||null,
    started_at:draft.startedAt,
    screening_types:draft.screeningTypes||[],
    status:draft.status||'active',
    result_status:draft.resultStatus||'pending',
    intervention_status:draft.interventionStatus||'none',
    recheck_due:draft.recheckDue||null,
    notes:draft.notes||null,
    created_by:actorId,
    updated_by:actorId,
  }).select('*').single()
  if(error)throw error
  return (await hydrateRecords([data]))[0]
}

export async function createEmployeeSurveillanceBatch(organizationId,employees,draft){
  assertCloud()
  const actorId=await currentUserId()
  const batchCode=draft.code||`EBAT-${new Date().toISOString().slice(2,10).replaceAll('-','')}-${String(Date.now()).slice(-5)}`
  const {data:batch,error:batchError}=await supabase.from('employee_surveillance_batches').insert({
    organization_id:organizationId,
    batch_code:batchCode,
    department_id:draft.departmentId||null,
    started_at:draft.startedAt,
    screening_types:draft.screeningTypes||[],
    notes:draft.notes||null,
    created_by:actorId,
  }).select('*').single()
  if(batchError)throw batchError
  const payload=employees.map((employee,index)=>({
    organization_id:organizationId,
    surveillance_code:`ESUR-${new Date().toISOString().slice(2,10).replaceAll('-','')}-${String(Date.now()+index).slice(-5)}`,
    employee_id:employee.dbId,
    batch_id:batch.id,
    started_at:draft.startedAt,
    screening_types:draft.screeningTypes||[],
    status:'active',result_status:'pending',intervention_status:'none',notes:draft.notes||null,created_by:actorId,updated_by:actorId,
  }))
  if(payload.length){const {error}=await supabase.from('employee_surveillance_records').insert(payload);if(error)throw error}
  const records=await loadEmployeeSurveillanceRecords(organizationId)
  return (await loadEmployeeSurveillanceBatches(organizationId,records)).find(item=>item.recordId===batch.id)
}

export function getEmployeeSurveillanceKpis(rows){
  const today=new Date().toISOString().slice(0,10)
  return {
    active:(rows||[]).filter(row=>row.status==='active').length,
    positive:(rows||[]).filter(row=>row.resultStatus==='positive').length,
    needsIntervention:(rows||[]).filter(row=>['required','in_progress'].includes(row.interventionStatus)).length,
    needsRecheck:(rows||[]).filter(row=>row.recheckDue&&row.recheckDue<=today&&row.status==='active').length,
  }
}
