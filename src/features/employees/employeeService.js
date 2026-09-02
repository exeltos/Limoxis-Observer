import { supabase, invokeAuthenticatedFunction } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { loadEmployees as loadEmployeesLocal, saveEmployees as saveEmployeesLocal } from './employeeStore'

// Frontend historically treats the human-entered employee code as the record's
// own `id` (used directly in routes like /employees/EMP-001). The real table has
// both a proper uuid primary key AND a separate `employee_code` text column with
// its own per-organization uniqueness constraint — map frontend `id` to
// `employee_code`, not to the uuid, so every existing consumer keeps working.
const EMPLOYEE_COLUMNS = 'id,user_id,employee_code,department_id,first_name,first_name_en,last_name,last_name_en,father_name,department_name,department_name_en,profession_name,profession_name_en,employment_status,email,phone,hire_date,birth_date,created_at,updated_at'

function productionContext(organizationId,operation){
  if(isDemoDataEnvironment())return false
  if(!hasSupabaseConfig||!supabase)throw new Error(`PRODUCTION_CLOUD_REQUIRED:${operation}`)
  if(!organizationId)throw new Error(`PRODUCTION_ORGANIZATION_REQUIRED:${operation}`)
  return true
}

function fromRow(row) {
  return {
    id: row.employee_code,
    dbId: row.id,
    userId: row.user_id || null,
    accountLinked: Boolean(row.user_id),
    departmentId: row.department_id || null,
    organizationId: row.organization_id || null,
    firstName: row.first_name,
    firstNameEn: row.first_name_en || row.first_name,
    lastName: row.last_name,
    lastNameEn: row.last_name_en || row.last_name,
    fatherName: row.father_name || '',
    fatherNameEn: row.father_name || '',
    department: row.department_name || '',
    departmentEn: row.department_name_en || row.department_name || '',
    profession: row.profession_name || '',
    professionEn: row.profession_name_en || row.profession_name || '',
    employmentStatus: row.employment_status,
    email: row.email || '',
    phone: row.phone || '',
    hireDate: row.hire_date || '',
    birthDate: row.birth_date || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toWriteRow(organizationId, v) {
  return {
    organization_id: organizationId,
    employee_code: v.id,
    department_id: v.departmentId || null,
    first_name: v.firstName,
    first_name_en: v.firstNameEn || v.firstName,
    last_name: v.lastName,
    last_name_en: v.lastNameEn || v.lastName,
    father_name: v.fatherName || null,
    department_name: v.department || null,
    department_name_en: v.departmentEn || v.department || null,
    profession_name: v.profession || null,
    profession_name_en: v.professionEn || v.profession || null,
    employment_status: v.employmentStatus,
    email: v.email || null,
    phone: v.phone || null,
    hire_date: v.hireDate || null,
    birth_date: v.birthDate || null,
  }
}

export function cloudEnabled() {
  return hasSupabaseConfig && Boolean(supabase) && !isDemoDataEnvironment()
}

export async function loadEmployeesAsync(organizationId) {
  if(isDemoDataEnvironment())return loadEmployeesLocal()
  productionContext(organizationId,'employees.load')
  const { data, error } = await supabase
    .from('employees')
    .select(`${EMPLOYEE_COLUMNS},organization_id`)
    .eq('organization_id', organizationId)
    .order('last_name')
  if (error) throw error
  return (data || []).map(fromRow)
}

export async function createEmployeeAsync(organizationId, v) {
  if(isDemoDataEnvironment()){
    const rows=loadEmployeesLocal()
    const next=[v,...rows]
    saveEmployeesLocal(next)
    return v
  }
  productionContext(organizationId,'employees.create')
  const { data, error } = await supabase
    .from('employees')
    .insert(toWriteRow(organizationId, v))
    .select(`${EMPLOYEE_COLUMNS},organization_id`)
    .single()
  if (error) {
    if (error.code === '23505') throw new Error('DUPLICATE_EMPLOYEE_CODE')
    throw error
  }
  return fromRow(data)
}

export async function updateEmployeeAsync(organizationId, employeeDbId, v) {
  if(isDemoDataEnvironment()){
    const rows=loadEmployeesLocal()
    const next=rows.map(row=>row.id===v.id?{...row,...v}:row)
    saveEmployeesLocal(next)
    return {...v}
  }
  productionContext(organizationId,'employees.update')
  if(!employeeDbId)throw new Error('PRODUCTION_EMPLOYEE_DB_ID_REQUIRED:employees.update')
  const payload=toWriteRow(organizationId,v)
  delete payload.organization_id
  delete payload.employee_code
  const {data,error}=await supabase
    .from('employees')
    .update({...payload,updated_at:new Date().toISOString()})
    .eq('organization_id',organizationId)
    .eq('id',employeeDbId)
    .select(`${EMPLOYEE_COLUMNS},organization_id`)
    .single()
  if(error)throw error
  return fromRow(data)
}

export async function createEmployeeAccountAsync(organizationId,employee,{role='staff_user',email,phone,jobTitle}={}){
  if(isDemoDataEnvironment())throw new Error('DEMO_EMPLOYEE_ACCOUNT_NOT_AVAILABLE')
  productionContext(organizationId,'employees.account.create')
  if(!employee?.dbId)throw new Error('EMPLOYEE_DB_ID_REQUIRED')
  if(employee.userId)throw new Error('EMPLOYEE_ACCOUNT_ALREADY_LINKED')
  const accountEmail=String(email||employee.email||'').trim()
  if(!accountEmail)throw new Error('EMPLOYEE_EMAIL_REQUIRED')
  return invokeAuthenticatedFunction('create-organization-user',{
    organizationId,
    fullName:`${employee.firstName||''} ${employee.lastName||''}`.trim(),
    role,
    email:accountEmail,
    phone:phone??employee.phone??'',
    jobTitle:jobTitle??employee.profession??'',
    employeeDbId:employee.dbId,
  })
}

export async function deleteEmployeeAsync(organizationId, employeeDbId, employeeId) {
  if(isDemoDataEnvironment()){
    const rows=loadEmployeesLocal().filter(row=>row.id!==employeeId)
    saveEmployeesLocal(rows)
    return true
  }
  productionContext(organizationId,'employees.delete')
  if(!employeeDbId)throw new Error('PRODUCTION_EMPLOYEE_DB_ID_REQUIRED:employees.delete')
  const {error}=await supabase.from('employees').delete().eq('organization_id',organizationId).eq('id',employeeDbId)
  if(error)throw error
  return true
}