import { supabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { loadEmployees as loadEmployeesLocal, saveEmployees as saveEmployeesLocal } from './employeeStore'

// Frontend historically treats the human-entered employee code as the record's
// own `id` (used directly in routes like /employees/EMP-001). The real table has
// both a proper uuid primary key AND a separate `employee_code` text column with
// its own per-organization uniqueness constraint — map frontend `id` to
// `employee_code`, not to the uuid, so every existing consumer (Committees staff
// picker, Training participants, routes, etc.) keeps working unchanged.
const EMPLOYEE_COLUMNS = 'id,employee_code,first_name,first_name_en,last_name,last_name_en,father_name,department_name,department_name_en,profession_name,profession_name_en,employment_status,email,phone,hire_date,birth_date,created_at,updated_at'

function fromRow(row) {
  return {
    id: row.employee_code,
    dbId: row.id,
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

function toInsertRow(organizationId, v) {
  return {
    organization_id: organizationId,
    employee_code: v.id,
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
  return hasSupabaseConfig && Boolean(supabase)
}

export async function loadEmployeesAsync(organizationId) {
  if (!cloudEnabled() || !organizationId || isDemoDataEnvironment()) return loadEmployeesLocal()
  const { data, error } = await supabase
    .from('employees')
    .select(EMPLOYEE_COLUMNS)
    .eq('organization_id', organizationId)
    .order('last_name')
  if (error) throw error
  return (data || []).map(fromRow)
}

export async function createEmployeeAsync(organizationId, v) {
  if (!cloudEnabled() || !organizationId || isDemoDataEnvironment()) {
    const rows = loadEmployeesLocal()
    const next = [v, ...rows]
    saveEmployeesLocal(next)
    return v
  }
  const { data, error } = await supabase
    .from('employees')
    .insert(toInsertRow(organizationId, v))
    .select(EMPLOYEE_COLUMNS)
    .single()
  if (error) {
    // Matches the organization_id+employee_code unique constraint already on the live table.
    if (error.code === '23505') throw new Error('DUPLICATE_EMPLOYEE_CODE')
    throw error
  }
  return fromRow(data)
}
