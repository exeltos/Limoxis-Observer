// Recycle bin: a deleted record is kept for 30 days, as it was, so it can be
// restored or deleted for good. Each person sees, restores and empties only
// their own deletions. Production keeps the entries in the recycle_bin table;
// Demo (and records that live only in this browser) keep them locally.
// An entry's payload holds what the deletion removed:
//   server entry (bin_delete)     the server keeps the rows and restores them itself
//   { parts: [{ table, rows }] }  cloud rows, in deletion order (children first)
//   { local: { table, row } }     one row of a local repository table
//   { memory: { store, row } }    one row of an in-memory Demo list (see MEMORY_STORES)
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase/client'
import { isDemoDataEnvironment } from '../data/dataEnvironment'
import { loadSnapshot, saveSnapshot } from '../data/repository'

export const BIN_DAYS = 30
const DAY_MS = 86_400_000
const LOCAL_TABLE = 'recycle_bin_local'
const CHANGE_EVENT = 'limoxis:recycle-bin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- γραμμές οποιουδήποτε πίνακα
type Row = Record<string, any>
type OrganizationId = string | null | undefined
export interface BinPayload {
  parts?: { table: string; rows: Row[] }[]
  local?: { table: string; row: Row }
  memory?: { store: string; row: Row }
}
export interface BinEntry {
  id: string
  module: string
  kind: string
  label?: string
  detail: string
  payload: BinPayload
  deletedAt: string
  deletedByName: string
  expiresAt: string
  server?: boolean
}
interface BinRecord { module: string; kind: string; label?: string; detail?: string }
// Οι πίνακες της διαγραφής ορίζονται δυναμικά (part.table): client χωρίς τύπους.
const cloud = () => supabase as unknown as SupabaseClient

// Everyone with a role in the hospital has a bin: their own deletions.
export const canUseRecycleBin = (role: unknown) => Boolean(role)

// Who deletes what: the Platform Owner, the Hospital Admin and the Infection
// Control Lead any record; anyone else only a record they entered (bin_delete
// checks the same on the server).
const DELETE_ANY_ROLES: unknown[] = ['platform_owner', 'hospital_admin', 'infection_control_lead', 'demo']
export function canDeleteRecord({ role, actualRole, userId, createdBy }: { role?: string | null; actualRole?: string | null; userId?: unknown; createdBy?: unknown }) {
  if (DELETE_ANY_ROLES.includes(role) || actualRole === 'platform_owner') return true
  return Boolean(userId) && Boolean(createdBy) && String(createdBy) === String(userId)
}

let actor: { name: string | null } = { name: null }
// The signed-in person, named on what they delete.
export function setRecycleBinActor(next: { name?: string | null } | null | undefined) {
  actor = { name: next?.name || null }
}

const notify = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
}
export function onRecycleBinChange(handler: () => void) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(CHANGE_EVENT, handler)
  return () => window.removeEventListener(CHANGE_EVENT, handler)
}

const keepsLocally = (organizationId: OrganizationId) => isDemoDataEnvironment() || !organizationId || !supabase
const loadLocalBin = (): BinEntry[] => loadSnapshot(LOCAL_TABLE, []) || []
const saveLocalBin = (rows: BinEntry[]) => saveSnapshot(LOCAL_TABLE, rows)
const newId = () =>
  globalThis.crypto?.randomUUID?.() || `bin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

// Demo lists that live only in memory, and how a row goes back into each.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- η γραμμή επιστρέφει σε λίστα Demo με το δικό της σχήμα
type StoreRow = any
const MEMORY_STORES: Record<string, () => Promise<(row: StoreRow) => void>> = {
  employee_surveillance: () =>
    import('../../features/surveillance/employeeSurveillanceData').then(m => row => m.restoreDemoEmployeeSurveillance(row)),
  patients: () =>
    import('../../features/patients/patientsService').then(m => row => m.restoreDemoPatient(row)),
  protocol_runs: () =>
    import('../../features/surveillance/protocols/protocolService').then(m => row => m.restoreDemoProtocolRun(row)),
  clinical_case_entries: () =>
    import('../../features/surveillance/clinicalDemoData').then(m => ({caseId, field, list, item}) => {
      const target = (m.clinicalCases as Record<string, Row>)[caseId]
      if (!target) return
      if (!list) target[field] = item
      else if (!(target[field] || []).some((entry: Row) => String(entry.id) === String(item.id))) target[field] = [item, ...(target[field] || [])]
    }),
  epi_questionnaires: () =>
    import('../../features/surveillance/epiQuestionnaire/epiQuestionnaireService').then(m => row => m.restoreDemoEpiQuestionnaire(row)),
  notification_reports: () =>
    import('../../features/reporting/notificationReportsService').then(m => row => m.restoreDemoNotificationReport(row)),
  scale_assessments: () =>
    import('../../features/clinical-scales/patientClinicalScalesService').then(m => row => {
      const list = m.demoPatientScaleAssessments()
      if (!list.some(item => String(item.id) === String(row.id))) list.unshift(row)
    }),
  clinical_cases: () =>
    import('../../features/surveillance/clinicalDemoData').then(m => row => {
      (m.clinicalCases as Record<string, Row>)[row.id] = row
    }),
  laboratory_samples: () =>
    import('../../features/laboratory/laboratoryDemoData').then(m => row => {
      if (!m.laboratorySamples.some(item => String(item.id) === String(row.id))) m.laboratorySamples.unshift(row)
    }),
}

export const isExpired = (entry: { expiresAt: string }, now = Date.now()) => Date.parse(entry.expiresAt) < now
export const daysLeft = (entry: { expiresAt: string }, now = Date.now()) =>
  Math.max(0, Math.ceil((Date.parse(entry.expiresAt) - now) / DAY_MS))

const fromRow = (row: Row): BinEntry => ({
  id: row.id,
  module: row.module,
  kind: row.kind,
  label: row.label,
  detail: row.detail || '',
  payload: row.payload || {},
  deletedAt: row.deleted_at,
  deletedByName: row.deleted_by_name || '',
  expiresAt: row.expires_at,
  server: Boolean(row.server),
})

async function fileEntry(organizationId: OrganizationId, { module, kind, label, detail = '', payload }: BinRecord & { payload: BinPayload }) {
  const deletedAt = new Date().toISOString()
  const expiresAt = new Date(Date.now() + BIN_DAYS * DAY_MS).toISOString()
  if (keepsLocally(organizationId)) {
    saveLocalBin([
      { id: newId(), module, kind, label, detail, payload, deletedAt, deletedByName: actor.name || '', expiresAt },
      ...loadLocalBin(),
    ])
  } else {
    const { error } = await cloud().from('recycle_bin').insert({
      organization_id: organizationId,
      module,
      kind,
      label: String(label || kind).slice(0, 300),
      detail: detail ? String(detail).slice(0, 300) : null,
      payload,
      deleted_by_name: actor.name,
    })
    // Before the recycle_bin migration is applied the deletion still goes ahead.
    if (error && !['42P01', 'PGRST205'].includes(error.code)) throw error
  }
  notify()
}

// Files the cloud rows a deletion is about to remove. `parts` lists each table
// in deletion order with the filter of its rows: [{ table, match: { column: value } }].
export async function binCloudRows(organizationId: OrganizationId, { module, kind, label, detail, parts }: BinRecord & { parts: { table: string; match: Record<string, unknown> }[] }) {
  const snapshot: { table: string; rows: Row[] }[] = []
  for (const part of parts) {
    let query = cloud().from(part.table).select('*').eq('organization_id', organizationId)
    for (const [column, value] of Object.entries(part.match)) query = Array.isArray(value) ? query.in(column, value) : query.eq(column, value)
    const { data, error } = await query
    if (error) throw error
    if (data?.length) snapshot.push({ table: part.table, rows: data })
  }
  if (!snapshot.length) return
  await fileEntry(organizationId, { module, kind, label, detail, payload: { parts: snapshot } })
}

// Deletes a record of the database to the bin, with everything under it, in one
// transaction on the server; only the person who deleted it can restore it.
export async function binServerRecord(organizationId: OrganizationId, { table, id, label, detail = '', reason = '' }: { table: string; id: unknown; label?: string; detail?: string; reason?: string }) {
  const { error } = await cloud().rpc('bin_delete', {
    p_table: table,
    p_id: id,
    p_label: String(label || table).slice(0, 300),
    p_detail: detail ? String(detail).slice(0, 300) : null,
    p_reason: reason || null,
  })
  if (error) throw error
  notify()
}

// Files one row of an in-memory Demo list (a key of MEMORY_STORES).
export async function binMemoryRow(organizationId: OrganizationId, { module, kind, label, detail, store, row }: BinRecord & { store: string; row: Row | null | undefined }) {
  if (!row) return
  await fileEntry(organizationId, { module, kind, label, detail, payload: { memory: { store, row } } })
}

// Files one row of a local repository table (Demo, or a browser-only store).
export async function binLocalRow(organizationId: OrganizationId, { module, kind, label, detail, table, row }: BinRecord & { table: string; row: Row | null | undefined }) {
  if (!row) return
  await fileEntry(organizationId, { module, kind, label, detail, payload: { local: { table, row } } })
}

// The person's own entries, newest first; expired ones are left out.
export async function listRecycleBin(organizationId: OrganizationId, role: unknown) {
  if (!canUseRecycleBin(role)) return []
  let rows: BinEntry[]
  if (keepsLocally(organizationId)) rows = loadLocalBin()
  else {
    const { data, error } = await cloud().rpc('bin_list_mine', { p_organization_id: organizationId })
    if (error) throw error
    rows = (data || []).map(fromRow)
  }
  return rows.filter(entry => !isExpired(entry))
}

async function dropEntry(organizationId: OrganizationId, entry: BinEntry) {
  if (keepsLocally(organizationId)) saveLocalBin(loadLocalBin().filter(row => row.id !== entry.id))
  else {
    const { error } = await cloud().rpc('bin_purge_mine', { p_entry: entry.id })
    if (error) throw error
  }
  notify()
}

// Puts the record back as it was and removes it from the bin.
export async function restoreFromBin(organizationId: OrganizationId, entry: BinEntry) {
  if (entry.server) {
    const { error } = await cloud().rpc('bin_restore', { p_entry: entry.id })
    if (error) throw error
    notify()
    return
  }
  const { parts, local, memory } = entry.payload || {}
  if (memory) {
    const put = await MEMORY_STORES[memory.store]?.()
    if (!put) throw new Error('This record cannot be restored in this session.')
    put(memory.row)
  } else if (local) {
    const rows: Row[] = loadSnapshot(local.table, []) || []
    const key = local.row?.id ?? local.row?.record_key
    if (key == null || !rows.some(row => (row?.id ?? row?.record_key) === key)) saveSnapshot(local.table, [local.row, ...rows])
  } else if (parts?.length) {
    // Parents first: the reverse of the deletion order.
    for (const part of [...parts].reverse()) {
      const { error } = await cloud().from(part.table).insert(part.rows)
      if (!error) continue
      if (error.code !== '23505') throw error
      // Some rows are already back (an earlier, interrupted restore): add the rest.
      for (const row of part.rows) {
        const { error: rowError } = await cloud().from(part.table).insert(row)
        if (rowError && rowError.code !== '23505') throw rowError
      }
    }
  }
  await dropEntry(organizationId, entry)
}

// Deletes the entry for good.
export const purgeFromBin = dropEntry

// Removes the expired entries (the server also purges them daily).
export async function purgeExpiredBin(organizationId: OrganizationId) {
  if (!keepsLocally(organizationId)) return
  const rows = loadLocalBin()
  const kept = rows.filter(entry => !isExpired(entry))
  if (kept.length !== rows.length) {
    saveLocalBin(kept)
    notify()
  }
}

// "<kind> · <date>" and the department, from the fields a deleted row usually has.
export function describeDeleted(kindLabel: string, source: Row | null = {}) {
  const row: Row = { ...(source?.session || {}), ...(source || {}) }
  const raw = row.date || row.observed_at || row.session_date || row.period_end || row.periodEnd || row.performed_at || row.collected_at || row.collectedAt || row.created_at || row.createdAt || ''
  const [y, m, d] = String(raw).slice(0, 10).split('-')
  const when = y && m && d ? `${d}/${m}/${y}` : ''
  const name = row.title || row.name || row.full_name || row.fullName || row.code || ''
  const department = (row.department && typeof row.department === 'object' ? row.department.el || row.department.name : row.department) || row.session?.department || row.department_name || row.departmentName || ''
  return {
    label: [kindLabel, name, when].filter(Boolean).join(' · '),
    detail: department || '',
  }
}
