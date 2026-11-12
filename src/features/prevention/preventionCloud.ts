import { binCloudRows, binLocalRow, describeDeleted } from '../../core/recycleBin/recycleBinService'
import { supabase } from '../../core/supabase/client'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { assertCloud } from '../../core/supabase/cloudContext'
import { preventionDepartments } from './preventionDemoData'

// What the four Prevention cloud services (hand hygiene, waste, antiseptics,
// bundles) share: the organization's departments, the approved patient-days of
// one reporting period and deleting a record through the recycle bin.

// The Prevention tabs open together and each asks for the departments: callers
// that ask while a read is in flight share it (each gets its own copy).
const inFlight = new Map()
export function sharedInFlight(key, read) {
  if (!inFlight.has(key)) {
    const promise = read()
    inFlight.set(key, promise)
    const done = () => { if (inFlight.get(key) === promise) inFlight.delete(key) }
    promise.then(done, done)
  }
  return inFlight.get(key)
}

// Active departments as {id,el,en}; records store the Greek name (el), the id
// resolves the department in the database. The demo keeps its own fixture,
// whose English names ('ED' for 'ΤΕΠ') the demo records were written with.
async function readPreventionDepartments(organizationId) {
  const { data, error } = await supabase.from('departments').select('id,name').eq('organization_id', organizationId).eq('is_active', true).order('name')
  if (error) throw error
  return (data || []).map(row => ({ id: row.id, el: row.name, en: row.name }))
}
export async function loadPreventionDepartments(organizationId) {
  if (isDemoDataEnvironment()) return preventionDepartments.map(({ id, el, en }) => ({ id, el, en }))
  assertCloud(organizationId)
  const rows = await sharedInFlight(`departments|${organizationId}`, () => readPreventionDepartments(organizationId))
  return rows.map(row => ({ ...row }))
}

export async function findPreventionDepartment(organizationId, name) {
  const department = (await loadPreventionDepartments(organizationId)).find(item => item.el === name)
  if (!department) throw new Error('Selected department is not available for this organization.')
  return department
}

// The approved patient_day_periods rows for exactly this period (one department,
// or all rows of the hospital when departmentId is empty), newest first.
export async function findApprovedPatientDayRows(organizationId, { departmentId = null, from, to }) {
  if (isDemoDataEnvironment()) return null
  assertCloud(organizationId)
  if (!from || !to) return null
  let query = supabase.from('patient_day_periods').select('department_id,patient_days,period_start,period_end,source,review_status').eq('organization_id', organizationId).eq('period_start', from).eq('period_end', to).eq('review_status', 'approved')
  if (departmentId) query = query.eq('department_id', departmentId)
  const { data, error } = await query.order('updated_at', { ascending: false })
  if (error) throw error
  return data || []
}

// Deletes one record: a copy goes to the recycle bin first (the local row in
// the demo, the cloud rows otherwise), child rows are removed before the record.
export async function deletePreventionRecord(organizationId, id, { table, localTable, label, loadLocal, saveLocal, children = [] }) {
  if (!id) return
  const entry = { module: 'clinical', kind: table }
  if (isDemoDataEnvironment()) {
    const rows = loadLocal()
    const row = rows.find(item => item.id === id)
    await binLocalRow(organizationId, { ...entry, ...describeDeleted(label, row), table: localTable, row })
    saveLocal(rows.filter(item => item.id !== id))
    return
  }
  assertCloud(organizationId)
  const { data: deleted } = await supabase.from(table).select('*').eq('organization_id', organizationId).eq('id', id).maybeSingle()
  await binCloudRows(organizationId, { ...entry, ...describeDeleted(label, deleted || {}), parts: [...children.map(child => ({ table: child.table, match: { [child.column]: id } })), { table, match: { id } }] })
  for (const child of children) {
    const { error } = await supabase.from(child.table).delete().eq('organization_id', organizationId).eq(child.column, id)
    if (error) throw error
  }
  const { error } = await supabase.from(table).delete().eq('organization_id', organizationId).eq('id', id)
  if (error) throw error
}
