// Recycle bin: a deleted record is kept for 30 days, as it was, so it can be
// restored or deleted for good. Each person sees, restores and empties only
// their own deletions. Production keeps the entries in the recycle_bin table;
// Demo (and records that live only in this browser) keep them locally.
// An entry's payload holds what the deletion removed:
//   server entry (bin_delete)     the server keeps the rows and restores them itself
//   { parts: [{ table, rows }] }  cloud rows, in deletion order (children first)
//   { local: { table, row } }     one row of a local repository table
//   { memory: { store, row } }    one row of an in-memory Demo list (see MEMORY_STORES)
import { supabase } from '../supabase/client'
import { isDemoDataEnvironment } from '../data/dataEnvironment'
import { loadSnapshot, saveSnapshot } from '../data/repository'

export const BIN_DAYS = 30
const DAY_MS = 86_400_000
const LOCAL_TABLE = 'recycle_bin_local'
const CHANGE_EVENT = 'limoxis:recycle-bin'

// Everyone with a role in the hospital has a bin: their own deletions.
export const canUseRecycleBin = role => Boolean(role)

// Who deletes what: the Platform Owner, the Hospital Admin and the Infection
// Control Lead any record; anyone else only a record they entered (bin_delete
// checks the same on the server).
const DELETE_ANY_ROLES = ['platform_owner', 'hospital_admin', 'infection_control_lead', 'demo']
export function canDeleteRecord({ role, actualRole, userId, createdBy }) {
  if (DELETE_ANY_ROLES.includes(role) || actualRole === 'platform_owner') return true
  return Boolean(userId) && Boolean(createdBy) && String(createdBy) === String(userId)
}

let actor = { name: null }
// The signed-in person, named on what they delete.
export function setRecycleBinActor(next) {
  actor = { name: next?.name || null }
}

const notify = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
}
export function onRecycleBinChange(handler) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(CHANGE_EVENT, handler)
  return () => window.removeEventListener(CHANGE_EVENT, handler)
}

const keepsLocally = organizationId => isDemoDataEnvironment() || !organizationId || !supabase
const loadLocalBin = () => loadSnapshot(LOCAL_TABLE, []) || []
const saveLocalBin = rows => saveSnapshot(LOCAL_TABLE, rows)
const newId = () =>
  globalThis.crypto?.randomUUID?.() || `bin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

// Demo lists that live only in memory, and how a row goes back into each.
const MEMORY_STORES = {
  clinical_cases: () =>
    import('../../features/surveillance/clinicalDemoData').then(m => row => {
      m.clinicalCases[row.id] = row
    }),
  laboratory_samples: () =>
    import('../../features/laboratory/laboratoryDemoData').then(m => row => {
      if (!m.laboratorySamples.some(item => String(item.id) === String(row.id))) m.laboratorySamples.unshift(row)
    }),
}

export const isExpired = (entry, now = Date.now()) => Date.parse(entry.expiresAt) < now
export const daysLeft = (entry, now = Date.now()) =>
  Math.max(0, Math.ceil((Date.parse(entry.expiresAt) - now) / DAY_MS))

const fromRow = row => ({
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

async function fileEntry(organizationId, { module, kind, label, detail = '', payload }) {
  const deletedAt = new Date().toISOString()
  const expiresAt = new Date(Date.now() + BIN_DAYS * DAY_MS).toISOString()
  if (keepsLocally(organizationId)) {
    saveLocalBin([
      { id: newId(), module, kind, label, detail, payload, deletedAt, deletedByName: actor.name || '', expiresAt },
      ...loadLocalBin(),
    ])
  } else {
    const { error } = await supabase.from('recycle_bin').insert({
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
export async function binCloudRows(organizationId, { module, kind, label, detail, parts }) {
  const snapshot = []
  for (const part of parts) {
    let query = supabase.from(part.table).select('*').eq('organization_id', organizationId)
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
export async function binServerRecord(organizationId, { table, id, label, detail = '', reason = '' }) {
  const { error } = await supabase.rpc('bin_delete', {
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
export async function binMemoryRow(organizationId, { module, kind, label, detail, store, row }) {
  if (!row) return
  await fileEntry(organizationId, { module, kind, label, detail, payload: { memory: { store, row } } })
}

// Files one row of a local repository table (Demo, or a browser-only store).
export async function binLocalRow(organizationId, { module, kind, label, detail, table, row }) {
  if (!row) return
  await fileEntry(organizationId, { module, kind, label, detail, payload: { local: { table, row } } })
}

// The person's own entries, newest first; expired ones are left out.
export async function listRecycleBin(organizationId, role) {
  if (!canUseRecycleBin(role)) return []
  let rows
  if (keepsLocally(organizationId)) rows = loadLocalBin()
  else {
    const { data, error } = await supabase.rpc('bin_list_mine', { p_organization_id: organizationId })
    if (error) throw error
    rows = (data || []).map(fromRow)
  }
  return rows.filter(entry => !isExpired(entry))
}

async function dropEntry(organizationId, entry) {
  if (keepsLocally(organizationId)) saveLocalBin(loadLocalBin().filter(row => row.id !== entry.id))
  else {
    const { error } = await supabase.rpc('bin_purge_mine', { p_entry: entry.id })
    if (error) throw error
  }
  notify()
}

// Puts the record back as it was and removes it from the bin.
export async function restoreFromBin(organizationId, entry) {
  if (entry.server) {
    const { error } = await supabase.rpc('bin_restore', { p_entry: entry.id })
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
    const rows = loadSnapshot(local.table, []) || []
    const key = local.row?.id ?? local.row?.record_key
    if (key == null || !rows.some(row => (row?.id ?? row?.record_key) === key)) saveSnapshot(local.table, [local.row, ...rows])
  } else if (parts?.length) {
    // Parents first: the reverse of the deletion order.
    for (const part of [...parts].reverse()) {
      const { error } = await supabase.from(part.table).insert(part.rows)
      if (!error) continue
      if (error.code !== '23505') throw error
      // Some rows are already back (an earlier, interrupted restore): add the rest.
      for (const row of part.rows) {
        const { error: rowError } = await supabase.from(part.table).insert(row)
        if (rowError && rowError.code !== '23505') throw rowError
      }
    }
  }
  await dropEntry(organizationId, entry)
}

// Deletes the entry for good.
export const purgeFromBin = dropEntry

// Removes the expired entries (the server also purges them daily).
export async function purgeExpiredBin(organizationId) {
  if (!keepsLocally(organizationId)) return
  const rows = loadLocalBin()
  const kept = rows.filter(entry => !isExpired(entry))
  if (kept.length !== rows.length) {
    saveLocalBin(kept)
    notify()
  }
}

// "<kind> · <date>" and the department, from the fields a deleted row usually has.
export function describeDeleted(kindLabel, source = {}) {
  const row = { ...(source?.session || {}), ...(source || {}) }
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
