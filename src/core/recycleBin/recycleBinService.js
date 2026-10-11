// Recycle bin: a deleted record is kept for 30 days, as it was, so it can be
// restored or deleted for good. Production keeps the entries in the
// recycle_bin table; Demo (and records that live only in this browser) keep
// them locally. An entry's payload holds what the deletion removed:
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

// Which roles see the entries of each module (the Hospital Admin sees them all).
export const BIN_MODULE_ROLES = Object.freeze({
  clinical: ['infection_control_lead'],
  quality: ['quality_manager'],
  occupational: ['occupational_physician'],
  administration: [],
})
const BIN_ADMIN_ROLES = ['hospital_admin', 'platform_owner', 'demo']

export function canUseRecycleBin(role) {
  return BIN_ADMIN_ROLES.includes(role) || Object.values(BIN_MODULE_ROLES).some(roles => roles.includes(role))
}
export function binModulesFor(role) {
  if (BIN_ADMIN_ROLES.includes(role)) return Object.keys(BIN_MODULE_ROLES)
  return Object.entries(BIN_MODULE_ROLES).filter(([, roles]) => roles.includes(role)).map(([module]) => module)
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

// The entries the role may see, newest first; expired ones are left out.
export async function listRecycleBin(organizationId, role) {
  const modules = binModulesFor(role)
  if (!modules.length) return []
  let rows
  if (keepsLocally(organizationId)) rows = loadLocalBin()
  else {
    const { data, error } = await supabase
      .from('recycle_bin')
      .select('*')
      .eq('organization_id', organizationId)
      .in('module', modules)
      .order('deleted_at', { ascending: false })
    if (error) {
      if (['42P01', 'PGRST205'].includes(error.code)) return []
      throw error
    }
    rows = (data || []).map(fromRow)
  }
  return rows.filter(entry => modules.includes(entry.module) && !isExpired(entry))
}

async function dropEntry(organizationId, entry) {
  if (keepsLocally(organizationId)) saveLocalBin(loadLocalBin().filter(row => row.id !== entry.id))
  else {
    const { error } = await supabase.from('recycle_bin').delete().eq('organization_id', organizationId).eq('id', entry.id)
    if (error) throw error
  }
  notify()
}

// Puts the record back as it was and removes it from the bin.
export async function restoreFromBin(organizationId, entry) {
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
