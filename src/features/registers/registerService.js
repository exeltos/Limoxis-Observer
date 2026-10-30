import { supabase } from '../../core/supabase/client'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { isOwnerPreview } from '../../core/preview/ownerPreview'
import { loadSnapshot, saveSnapshot } from '../../core/data/repository'
import { demoRegisterEntries, demoRegisters } from './registerDemoData'
import { computeValues } from './registerEngine'
import { definitionRows, entryFromRow, registerFromRows, registerRow, rowFromEntry } from './registerCloud'

// Department registers. In the cloud a register is defined row by row
// (department_register_* tables) and its data is its own table, one column per
// field, with the case number and name in <table>_identity, which only the
// department reads (20261105100000_department_registers.sql). Demo data lives
// in the browser in the same shape the screens use.

// The demo and the Platform Owner preview (help screenshots) use the sample registers.
const isLocal = () => isDemoDataEnvironment() || isOwnerPreview()
// Any UUID the database accepts: imported cases keep their original ids, not all of them version 1–5.
const isUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''))
const localId = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
function assertCloud(organizationId) {
  if (!supabase) throw new Error('Supabase is not configured.')
  if (!organizationId) throw new Error('Organization is required.')
}
const must = ({ data, error }) => { if (error) throw error; return data }

// Every row of a query, 1000 at a time (the API's page): the first page tells
// how many there are, the rest are read together.
async function selectAll(query) {
  const first = await query().range(0, 999)
  const rows = must(first) || []
  const total = first.count ?? rows.length
  if (rows.length < 1000 || total <= 1000) return rows
  const pages = await Promise.all(Array.from({ length: Math.ceil(total / 1000) - 1 }, (_, index) => query().range((index + 1) * 1000, (index + 2) * 1000 - 1).then(must)))
  return [...rows, ...pages.flat().filter(Boolean)]
}

// The registers of an organization, read once for the screens that open together
// (Quality Center, objectives, a meeting); any write here reads them again.
const registersCache = new Map()
const REGISTERS_FRESH_MS = 30000
// The entries of a register, kept as briefly: going back from a case, or from
// the Quality Center to the register, does not read thousands of rows again.
const entriesCache = new Map()
function forgetRegisters() { registersCache.clear(); entriesCache.clear() }
// A write forgets what was read before it and what was read while it ran.
const afterWrite = async promise => { try { return await promise } finally { forgetRegisters() } }

// --- Demo storage --------------------------------------------------------------

function localState() {
  const registers = loadSnapshot('quality_department_registers', null)
  if (Array.isArray(registers)) return { registers, entries: loadSnapshot('quality_department_register_entries', []), identities: loadSnapshot('quality_department_register_identities', {}) }
  const seeded = demoRegisterEntries()
  const state = { registers: demoRegisters(), entries: seeded.entries, identities: seeded.identities }
  saveLocal(state)
  return state
}
function saveLocal(state) {
  saveSnapshot('quality_department_registers', state.registers)
  saveSnapshot('quality_department_register_entries', state.entries)
  saveSnapshot('quality_department_register_identities', state.identities)
}

// The date an entry counts on: the register's date field, else the day it was
// recorded (an active patient imported without dates), else today.
export function entryDateOf(register, values = {}, recorded = '') {
  const day = register.kind === 'sheet' ? null : values[register.settings?.entryDateField]
  return String(day || recorded || new Date().toISOString().slice(0, 10)).slice(0, 10)
}

// --- Registers -----------------------------------------------------------------

const registerSelect = 'id,organization_id,department_id,code,name_el,name_en,description_el,description_en,kind,status,version,template_key,entry_date_field,sheet_period,identity_case_number,identity_patient_name,table_name,history,updated_at,departments(name)'
const childTables = ['department_register_sections', 'department_register_fields', 'department_register_options', 'department_register_sheet_axes', 'department_register_indicators', 'department_register_indicator_filters']

async function loadDefinitions(organizationId, registerRows) {
  if (!registerRows.length) return []
  const ids = registerRows.map(row => row.id)
  const [sections, fields, options, axes, indicators, filters] = await Promise.all(childTables.map(table => selectAll(() => supabase.from(table).select('*', { count: 'exact' }).eq('organization_id', organizationId).in('register_id', ids).order('id'))))
  return registerRows.map(register => {
    const own = rows => (rows || []).filter(row => row.register_id === register.id)
    return registerFromRows({ register, sections: own(sections), fields: own(fields), options: own(options), axes: own(axes), indicators: own(indicators), filters: own(filters) })
  })
}

export async function loadRegisters(organizationId) {
  if (isLocal()) {
    const state = localState()
    return state.registers.map(register => {
      const own = state.entries.filter(entry => entry.registerId === register.id)
      return { ...register, entryCount: own.length, lastEntry: own.map(entry => entry.entryDate).sort().pop() || '' }
    })
  }
  assertCloud(organizationId)
  const cached = registersCache.get(organizationId)
  if (cached && Date.now() - cached.at < REGISTERS_FRESH_MS) return cached.promise
  const promise = readRegisters(organizationId)
  registersCache.set(organizationId, { at: Date.now(), promise })
  promise.catch(() => registersCache.delete(organizationId))
  return promise
}

async function readRegisters(organizationId) {
  const rows = must(await supabase.from('department_registers').select(registerSelect).eq('organization_id', organizationId).order('name_el'))
  const registers = await loadDefinitions(organizationId, rows || [])
  // How many entries and the latest one, in one request per register.
  return Promise.all(registers.map(async register => {
    if (!register.tableName) return { ...register, entryCount: 0, lastEntry: '' }
    const { data, count } = await supabase.from(register.tableName).select('entry_date', { count: 'exact' }).order('entry_date', { ascending: false }).limit(1)
    return { ...register, entryCount: count || 0, lastEntry: data?.[0]?.entry_date || '' }
  }))
}

export async function loadRegister(organizationId, id) {
  if (isLocal()) return localState().registers.find(register => register.id === id) || null
  assertCloud(organizationId)
  if (!isUuid(id)) return null
  const cached = registersCache.get(organizationId)
  if (cached && Date.now() - cached.at < REGISTERS_FRESH_MS) { const known = (await cached.promise.catch(() => [])).find(register => register.id === id); if (known) return known }
  const row = must(await supabase.from('department_registers').select(registerSelect).eq('id', id).eq('organization_id', organizationId).maybeSingle())
  if (!row) return null
  return (await loadDefinitions(organizationId, [row]))[0]
}

function nextCode(existing = []) {
  const numbers = existing.map(code => Number(String(code || '').match(/^REG-(\d+)$/)?.[1] || 0))
  return `REG-${String(Math.max(0, ...numbers) + 1).padStart(3, '0')}`
}

// Writes the definition row by row and lets the database add the columns of
// new fields. A field, option, sheet row or indicator taken out is archived,
// never deleted, so its column and data stay. A change raises the version.
async function saveRegisterNow(organizationId, register, { actor = '', action = 'updated', definitionChanged = false } = {}) {
  const event = { at: new Date().toISOString(), action, actor }
  const next = { ...register, version: definitionChanged && register.id ? (Number(register.version) || 1) + 1 : Number(register.version) || 1, history: [...(register.history || []), event] }
  if (isLocal()) {
    const state = localState()
    if (!next.id) {
      next.id = localId('reg')
      next.code = next.code || nextCode(state.registers.map(item => item.code))
      state.registers.push(next)
    } else state.registers = state.registers.map(item => (item.id === next.id ? next : item))
    saveLocal(state)
    return next
  }
  assertCloud(organizationId)
  forgetRegisters()
  let id = isUuid(next.id) ? next.id : null
  if (!id) {
    const codes = must(await supabase.from('department_registers').select('code').eq('organization_id', organizationId))
    next.code = next.code || nextCode((codes || []).map(row => row.code))
    id = must(await supabase.from('department_registers').insert(registerRow(next, organizationId)).select('id').single()).id
  } else must(await supabase.from('department_registers').update(registerRow(next, organizationId)).eq('id', id).eq('organization_id', organizationId))
  await saveDefinition(organizationId, id, next)
  must(await supabase.rpc('department_register_sync', { p_register_id: id }))
  // Reading the register then checks access once per query, not once per row.
  must(await supabase.rpc('department_register_fast_reads', { p_register_id: id }))
  return loadRegister(organizationId, id)
}

async function archiveMissing(table, organizationId, registerId, keep, keyOf, extra = query => query) {
  const existing = must(await extra(supabase.from(table).select('id,' + keyOf.column).eq('organization_id', organizationId).eq('register_id', registerId)))
  const gone = (existing || []).filter(row => !keep.has(keyOf.value(row))).map(row => row.id)
  if (gone.length) must(await supabase.from(table).update({ archived: true }).in('id', gone))
}

async function saveDefinition(organizationId, registerId, register) {
  const rows = definitionRows(register, organizationId, registerId)
  if (rows.sections.length) must(await supabase.from('department_register_sections').upsert(rows.sections, { onConflict: 'register_id,key' }))
  if (rows.fields.length) must(await supabase.from('department_register_fields').upsert(rows.fields, { onConflict: 'register_id,key' }))
  await archiveMissing('department_register_fields', organizationId, registerId, new Set(rows.fields.map(row => row.key)), { column: 'key', value: row => row.key })
  const fieldIds = new Map((must(await supabase.from('department_register_fields').select('id,key').eq('register_id', registerId)) || []).map(row => [row.key, row.id]))
  const options = rows.options.map(({ fieldKey, ...option }) => ({ ...option, field_id: fieldIds.get(fieldKey) })).filter(option => option.field_id)
  if (options.length) must(await supabase.from('department_register_options').upsert(options, { onConflict: 'field_id,value' }))
  const existingOptions = must(await supabase.from('department_register_options').select('id,field_id,value').eq('register_id', registerId)) || []
  const keptOptions = new Set(options.map(option => `${option.field_id}:${option.value}`))
  const goneOptions = existingOptions.filter(row => !keptOptions.has(`${row.field_id}:${row.value}`)).map(row => row.id)
  if (goneOptions.length) must(await supabase.from('department_register_options').update({ archived: true }).in('id', goneOptions))
  if (rows.axes.length) must(await supabase.from('department_register_sheet_axes').upsert(rows.axes, { onConflict: 'register_id,axis,key' }))
  if (register.kind === 'sheet') await archiveMissing('department_register_sheet_axes', organizationId, registerId, new Set(rows.axes.map(row => `${row.axis}:${row.key}`)), { column: 'axis,key', value: row => `${row.axis}:${row.key}` })
  if (rows.indicators.length) must(await supabase.from('department_register_indicators').upsert(rows.indicators, { onConflict: 'register_id,key' }))
  await archiveMissing('department_register_indicators', organizationId, registerId, new Set(rows.indicators.map(row => row.key)), { column: 'key', value: row => row.key })
  const indicatorIds = new Map((must(await supabase.from('department_register_indicators').select('id,key').eq('register_id', registerId)) || []).map(row => [row.key, row.id]))
  must(await supabase.from('department_register_indicator_filters').delete().eq('register_id', registerId))
  const filters = rows.filters.map(({ indicatorKey, ...filter }) => ({ ...filter, indicator_id: indicatorIds.get(indicatorKey) })).filter(filter => filter.indicator_id)
  if (filters.length) must(await supabase.from('department_register_indicator_filters').insert(filters))
}

// --- Entries -------------------------------------------------------------------

// Case numbers and names: the whole identity table the user may read, page by
// page like the entries; ids picks only some (one case).
async function loadIdentities(register, ids = null) {
  const rows = ids
    ? must(await supabase.from(`${register.tableName}_identity`).select('entry_id,case_number,patient_name').in('entry_id', ids))
    : await selectAll(() => supabase.from(`${register.tableName}_identity`).select('entry_id,case_number,patient_name', { count: 'exact' }).order('entry_id'))
  return new Map((rows || []).map(row => [row.entry_id, { caseNumber: row.case_number || '', patientName: row.patient_name || '' }]))
}

// The entries of a register; withIdentity adds case number and name where the
// user may read them (the department), and leaves them empty otherwise.
export async function loadEntries(organizationId, registerId, { withIdentity = false, register: known = null } = {}) {
  if (isLocal()) {
    const state = localState()
    return state.entries.filter(entry => entry.registerId === registerId).map(entry => ({ ...entry, identity: withIdentity ? state.identities[entry.id] || null : null }))
  }
  assertCloud(organizationId)
  const register = known || await loadRegister(organizationId, registerId)
  if (!register?.tableName) return []
  const key = `${organizationId}:${register.id}:${register.version}:${withIdentity ? 'named' : 'plain'}`
  const cached = entriesCache.get(key)
  if (cached && Date.now() - cached.at < REGISTERS_FRESH_MS) return (await cached.promise).slice()
  // The entries and their identities are read together, not one after the other.
  const promise = Promise.all([
    selectAll(() => supabase.from(register.tableName).select('*', { count: 'exact' }).order('entry_date', { ascending: false }).order('id')),
    withIdentity && register.kind === 'case' ? loadIdentities(register) : Promise.resolve(new Map()),
  ]).then(([rows, identities]) => rows.map(row => entryFromRow(register, row, identities.get(row.id) || null)))
  entriesCache.set(key, { at: Date.now(), promise })
  promise.catch(() => entriesCache.delete(key))
  return (await promise).slice()
}

export async function loadEntry(organizationId, entryId, { withIdentity = false, register = null } = {}) {
  if (isLocal()) {
    const state = localState()
    const entry = state.entries.find(item => item.id === entryId)
    return entry ? { ...entry, identity: withIdentity ? state.identities[entry.id] || null : null } : null
  }
  assertCloud(organizationId)
  if (!isUuid(entryId) || !register?.tableName) return null
  const row = must(await supabase.from(register.tableName).select('*').eq('id', entryId).maybeSingle())
  if (!row) return null
  const identities = withIdentity && register.kind === 'case' ? await loadIdentities(register, [entryId]) : new Map()
  return entryFromRow(register, row, identities.get(entryId) || null)
}

// One case or one sheet period. Length of stay and age are computed by the
// database (generated columns); the demo computes them here.
async function saveEntryNow(organizationId, register, entry, { identity = null, actorLabel = '' } = {}) {
  const values = register.kind === 'sheet' ? entry.values || {} : computeValues(register.fields, entry.values || {})
  const periodStart = register.kind === 'sheet' ? entry.periodStart : null
  const entryDate = register.kind === 'sheet' ? periodStart : entryDateOf(register, values, entry.entryDate)
  if (isLocal()) {
    const state = localState()
    if (register.kind === 'sheet' && state.entries.some(item => item.registerId === register.id && item.periodStart === periodStart && item.id !== entry.id)) throw new Error('period-exists')
    const saved = { ...entry, registerId: register.id, values, periodStart, entryDate, version: register.version, status: entry.status || 'complete', locked: Boolean(entry.locked), updatedAt: new Date().toISOString() }
    if (!saved.id) {
      saved.id = localId('reg-entry')
      saved.createdAt = saved.updatedAt
      saved.createdByLabel = actorLabel
      state.entries.push(saved)
    } else state.entries = state.entries.map(item => (item.id === saved.id ? { ...item, ...saved } : item))
    if (identity) state.identities[saved.id] = identity
    saveLocal(state)
    return { ...saved, identity }
  }
  assertCloud(organizationId)
  forgetRegisters()
  const row = rowFromEntry(register, { ...entry, entryDate }, organizationId)
  const query = isUuid(entry.id) ? supabase.from(register.tableName).update(row).eq('id', entry.id) : supabase.from(register.tableName).insert(row)
  const { data, error } = await query.select('*').single()
  if (error) {
    if (error.code === '23505') throw new Error('period-exists')
    throw error
  }
  if (identity && register.kind === 'case' && (identity.caseNumber || identity.patientName)) must(await supabase.from(`${register.tableName}_identity`).upsert({ entry_id: data.id, organization_id: organizationId, case_number: identity.caseNumber || null, patient_name: identity.patientName || null }))
  return entryFromRow(register, data, identity)
}

// Many entries at once (an import): 500 rows per request, identities after.
// Returns how many were written.
async function saveEntriesNow(organizationId, register, items, { onProgress } = {}) {
  if (isLocal() && register.kind === 'case') {
    // One read and one write of the browser's copy for the whole file.
    const state = localState(), now = new Date().toISOString()
    for (const item of items) {
      const values = computeValues(register.fields, item.entry.values || {})
      const saved = { ...item.entry, id: localId('reg-entry'), registerId: register.id, values, periodStart: null, entryDate: entryDateOf(register, values, item.entry.entryDate), version: register.version, status: item.entry.status || 'complete', locked: false, updatedAt: now, createdAt: now }
      state.entries.push(saved)
      if (item.identity) state.identities[saved.id] = item.identity
    }
    saveLocal(state)
    onProgress?.(items.length, items.length)
    return items.length
  }
  if (isLocal()) {
    let done = 0
    for (const item of items) { await saveEntry(organizationId, register, item.entry, { identity: item.identity }); done += 1 }
    onProgress?.(done, items.length)
    return done
  }
  assertCloud(organizationId)
  forgetRegisters()
  let done = 0
  for (let index = 0; index < items.length; index += 500) {
    const chunk = items.slice(index, index + 500)
    const rows = chunk.map(item => rowFromEntry(register, { ...item.entry, entryDate: register.kind === 'sheet' ? item.entry.periodStart : entryDateOf(register, item.entry.values, item.entry.entryDate) }, organizationId))
    const saved = must(await supabase.from(register.tableName).insert(rows).select('id'))
    const identities = chunk.map((item, position) => (item.identity && (item.identity.caseNumber || item.identity.patientName) ? { entry_id: saved[position].id, organization_id: organizationId, case_number: item.identity.caseNumber || null, patient_name: item.identity.patientName || null } : null)).filter(Boolean)
    if (identities.length && register.kind === 'case') must(await supabase.from(`${register.tableName}_identity`).insert(identities))
    done += chunk.length
    onProgress?.(done, items.length)
  }
  return done
}

async function deleteEntryNow(organizationId, register, entryId) {
  if (isLocal()) {
    const state = localState()
    state.entries = state.entries.filter(entry => entry.id !== entryId)
    delete state.identities[entryId]
    saveLocal(state)
    return
  }
  assertCloud(organizationId)
  forgetRegisters()
  must(await supabase.from(register.tableName).delete().eq('id', entryId))
}

// Replacing an import: the given entries go, identities with them (cascade).
async function deleteEntriesNow(organizationId, register, entryIds) {
  if (!entryIds.length) return 0
  if (isLocal()) {
    const state = localState(), ids = new Set(entryIds)
    state.entries = state.entries.filter(entry => !ids.has(entry.id))
    for (const id of ids) delete state.identities[id]
    saveLocal(state)
    return ids.size
  }
  assertCloud(organizationId)
  forgetRegisters()
  for (let index = 0; index < entryIds.length; index += 200) must(await supabase.from(register.tableName).delete().in('id', entryIds.slice(index, index + 200)))
  return entryIds.length
}

// Closing a period locks its sheet; reopening it allows corrections again.
async function setEntryLockedNow(organizationId, register, entryId, locked) {
  if (isLocal()) {
    const state = localState()
    state.entries = state.entries.map(entry => (entry.id === entryId ? { ...entry, locked } : entry))
    saveLocal(state)
    return
  }
  assertCloud(organizationId)
  forgetRegisters()
  must(await supabase.from(register.tableName).update({ locked }).eq('id', entryId))
}

// Every write leaves the cached registers and entries to be read again.
export const saveRegister = (...args) => afterWrite(saveRegisterNow(...args))
export const saveEntry = (...args) => afterWrite(saveEntryNow(...args))
export const saveEntries = (...args) => afterWrite(saveEntriesNow(...args))
export const deleteEntry = (...args) => afterWrite(deleteEntryNow(...args))
export const deleteEntries = (...args) => afterWrite(deleteEntriesNow(...args))
export const setEntryLocked = (...args) => afterWrite(setEntryLockedNow(...args))
