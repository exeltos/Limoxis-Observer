import type { SupabaseClient } from '@supabase/supabase-js'
import { binCloudRows, binLocalRow, describeDeleted } from '../../core/recycleBin/recycleBinService'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { assertCloud, cloudClient } from '../../core/supabase/cloudContext'
import type { AnyRecord } from '../../types/featureTypes'
import { preventionDepartments } from './preventionDemoData'

// What the four Prevention cloud services (hand hygiene, waste, antiseptics,
// bundles) share: the organization's departments, the approved patient-days of
// one reporting period and deleting a record through the recycle bin.

// The organization a Prevention service reads or writes: the screens pass tenant?.id. Every cloud
// query runs after assertCloud(organizationId), which throws without one (hence `as string` there).
export type PreventionOrgId = string | null | undefined
// A department as the Prevention screens use it: id, Greek name (what records store), English name.
export interface PreventionDepartment { id: string; el: string; en: string }
// The record's table is named by the caller (deletePreventionRecord): client without types.
const untypedCloud = () => cloudClient() as unknown as SupabaseClient

// The Prevention tabs open together and each asks for the departments: callers
// that ask while a read is in flight share it (each gets its own copy).
const inFlight = new Map<string, PromiseLike<unknown>>()
export function sharedInFlight<T>(key: string, read: () => PromiseLike<T>): PromiseLike<T> {
  if (!inFlight.has(key)) {
    const promise = read()
    inFlight.set(key, promise)
    const done = () => { if (inFlight.get(key) === promise) inFlight.delete(key) }
    promise.then(done, done)
  }
  return inFlight.get(key) as PromiseLike<T>
}

// Active departments as {id,el,en}; records store the Greek name (el), the id
// resolves the department in the database. The demo keeps its own fixture,
// whose English names ('ED' for 'ΤΕΠ') the demo records were written with.
async function readPreventionDepartments(organizationId: string): Promise<PreventionDepartment[]> {
  const { data, error } = await cloudClient().from('departments').select('id,name').eq('organization_id', organizationId as string).eq('is_active', true).order('name')
  if (error) throw error
  return (data || []).map(row => ({ id: row.id, el: row.name, en: row.name }))
}
export async function loadPreventionDepartments(organizationId: PreventionOrgId): Promise<PreventionDepartment[]> {
  if (isDemoDataEnvironment()) return preventionDepartments.map(({ id, el, en }) => ({ id, el, en }))
  assertCloud(organizationId)
  const rows = await sharedInFlight(`departments|${organizationId}`, () => readPreventionDepartments(organizationId as string))
  return rows.map(row => ({ ...row }))
}

export async function findPreventionDepartment(organizationId: PreventionOrgId, name: string) {
  const department = (await loadPreventionDepartments(organizationId)).find(item => item.el === name)
  if (!department) throw new Error('Selected department is not available for this organization.')
  return department
}

// The approved patient_day_periods rows for exactly this period (one department,
// or all rows of the hospital when departmentId is empty), newest first.
export async function findApprovedPatientDayRows(organizationId: PreventionOrgId, { departmentId = null, from, to }: { departmentId?: string | null; from?: string | null; to?: string | null }) {
  if (isDemoDataEnvironment()) return null
  assertCloud(organizationId)
  if (!from || !to) return null
  let query = cloudClient().from('patient_day_periods').select('department_id,patient_days,period_start,period_end,source,review_status').eq('organization_id', organizationId as string).eq('period_start', from).eq('period_end', to).eq('review_status', 'approved')
  if (departmentId) query = query.eq('department_id', departmentId)
  const { data, error } = await query.order('updated_at', { ascending: false })
  if (error) throw error
  return data || []
}

// Deletes one record: a copy goes to the recycle bin first (the local row in
// the demo, the cloud rows otherwise), child rows are removed before the record.
// How a Prevention record is deleted: its table, the local (demo) table and the child rows that go with it.
export interface PreventionDeleteSpec { table: string; localTable: string; label: string; loadLocal: () => AnyRecord[]; saveLocal: (rows: AnyRecord[]) => unknown; children?: { table: string; column: string }[] }
export async function deletePreventionRecord(organizationId: PreventionOrgId, id: string | null | undefined, { table, localTable, label, loadLocal, saveLocal, children = [] }: PreventionDeleteSpec) {
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
  const { data: deleted } = await untypedCloud().from(table).select('*').eq('organization_id', organizationId as string).eq('id', id).maybeSingle()
  await binCloudRows(organizationId, { ...entry, ...describeDeleted(label, deleted || {}), parts: [...children.map(child => ({ table: child.table, match: { [child.column]: id } })), { table, match: { id } }] })
  for (const child of children) {
    const { error } = await untypedCloud().from(child.table).delete().eq('organization_id', organizationId as string).eq(child.column, id)
    if (error) throw error
  }
  const { error } = await untypedCloud().from(table).delete().eq('organization_id', organizationId as string).eq('id', id)
  if (error) throw error
}
