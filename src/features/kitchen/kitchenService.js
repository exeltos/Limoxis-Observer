// Κουζίνα: reading and writing the kitchen tables (20261123110000_kitchen_module.sql).
// Every piece of data is a column of its own; a receipt's products and a day's meals
// are rows of their own. The database marks each entry in / out of limits and refuses
// what HACCP forbids (an entry out of limits without a corrective action, an expired or
// rejected batch, more than is left, a change to a signed-off record); the demo keeps
// everything in the browser and applies the same rules here.
import { supabase } from '../../core/supabase/client'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { isOwnerPreview } from '../../core/preview/ownerPreview'
import { isEmptyPreview } from '../../core/preview/emptyPreview'
import { loadSnapshot, saveSnapshot } from '../../core/data/repository'
import { kitchenDemoState } from './kitchenDemoData'
import { batchProblem, combine, stockRows, withStatuses } from './kitchenModel'
import { defrostStatus, needsCorrectiveAction, pureeingStatus, receiptStatus, resolveLimits, thermalStatuses } from './kitchenLimits'

const isLocal = () => isDemoDataEnvironment() || isOwnerPreview()
const LOCAL_KEY = 'kitchen_local_state'
const isUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))
const localId = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
const must = ({ data, error }) => { if (error) throw error; return data }

// --- Columns ----------------------------------------------------------------------------
// camelCase field → [column, kind]; kind: t text, n number, b boolean, d date / time / timestamp, u uuid, j json.
const COLUMNS = {
  kitchen_settings: { expiryWarningDays: ['expiry_warning_days', 'n'], haccpReviewMonths: ['haccp_review_months', 'n'], haccpLastReviewOn: ['haccp_last_review_on', 'd'], haccpDocumentId: ['haccp_document_id', 'u'], haccpTeam: ['haccp_team', 't'], recallDrillMonths: ['recall_drill_months', 'n'], notes: ['notes', 't'] },
  kitchen_limits: { limitKey: ['limit_key', 't'], label: ['label', 't'], minValue: ['min_value', 'n'], maxValue: ['max_value', 'n'], withinMinutes: ['within_minutes', 'n'], unit: ['unit', 't'], active: ['active', 'b'], notes: ['notes', 't'] },
  kitchen_haccp_steps: { position: ['position', 'n'], stepKey: ['step_key', 't'], name: ['name', 't'], hazardBiological: ['hazard_biological', 'b'], hazardChemical: ['hazard_chemical', 'b'], hazardPhysical: ['hazard_physical', 'b'], hazardAllergen: ['hazard_allergen', 'b'], hazards: ['hazards', 't'], isCcp: ['is_ccp', 'b'], controlMeasure: ['control_measure', 't'], limitKey: ['limit_key', 't'], monitoring: ['monitoring', 't'], frequency: ['frequency', 't'], correctiveAction: ['corrective_action', 't'], verification: ['verification', 't'], records: ['records', 't'], responsible: ['responsible', 't'], active: ['active', 'b'] },
  kitchen_products: { name: ['name', 't'], category: ['category', 't'], storage: ['storage', 't'], unit: ['unit', 't'], supplierId: ['supplier_id', 'u'], supplierCode: ['supplier_code', 't'], lowStockQuantity: ['low_stock_quantity', 'n'], active: ['active', 'b'], notes: ['notes', 't'], source: ['source', 't'] },
  kitchen_menus: { name: ['name', 't'], weekday: ['weekday', 'n'], menuText: ['menu_text', 't'], active: ['active', 'b'], notes: ['notes', 't'], source: ['source', 't'] },
  kitchen_receipts: { code: ['code', 't'], supplierId: ['supplier_id', 'u'], supplierName: ['supplier_name', 't'], receivedOn: ['received_on', 'd'], receivedTime: ['received_time', 'd'], orderReference: ['order_reference', 't'], receiverEmployeeId: ['receiver_employee_id', 'u'], receiverName: ['receiver_name', 't'],
    temperatureCheck: ['temperature_check', 't'], packagingCheck: ['packaging_check', 't'], expiryCheck: ['expiry_check', 't'], vehicleCheck: ['vehicle_check', 't'], codingCheck: ['coding_check', 't'], temperatureClass: ['temperature_class', 't'], measuredTemperature: ['measured_temperature', 'n'], measuredTemperatureText: ['measured_temperature_text', 't'], temperatureUnparsed: ['temperature_unparsed', 'b'],
    accepted: ['accepted', 'b'], status: ['status', 't'], qualityNotes: ['quality_notes', 't'], correctiveAction: ['corrective_action', 't'], source: ['source', 't'] },
  kitchen_receipt_items: { position: ['position', 'n'], productId: ['product_id', 'u'], productName: ['product_name', 't'], batchCode: ['batch_code', 't'], lotLabel: ['lot_label', 't'], expiryOn: ['expiry_on', 'd'], quantity: ['quantity', 'n'], unit: ['unit', 't'], storage: ['storage', 't'], temperature: ['temperature', 'n'], temperatureText: ['temperature_text', 't'], temperatureUnparsed: ['temperature_unparsed', 'b'], accepted: ['accepted', 'b'], rejectionReason: ['rejection_reason', 't'], notes: ['notes', 't'] },
  kitchen_stock_writeoffs: { receiptItemId: ['receipt_item_id', 'u'], writtenOffOn: ['written_off_on', 'd'], quantity: ['quantity', 'n'], reason: ['reason', 't'], notes: ['notes', 't'], recordedByEmployeeId: ['recorded_by_employee_id', 'u'], recordedByName: ['recorded_by_name', 't'] },
  kitchen_productions: { productionDate: ['production_date', 'd'], menuId: ['menu_id', 'u'], menuText: ['menu_text', 't'], notes: ['notes', 't'], disinfectionVegetables: ['disinfection_vegetables', 'b'], disinfectionFruit: ['disinfection_fruit', 'b'], disinfectionAgent: ['disinfection_agent', 't'], disinfectionConcentrationPpm: ['disinfection_concentration_ppm', 'n'], disinfectionMinutes: ['disinfection_minutes', 'n'], disinfectionNotes: ['disinfection_notes', 't'],
    recordedByEmployeeId: ['recorded_by_employee_id', 'u'], recordedByName: ['recorded_by_name', 't'], source: ['source', 't'] },
  kitchen_production_meals: { position: ['position', 'n'], meal: ['meal', 't'], diet: ['diet', 't'], dish: ['dish', 't'], portions: ['portions', 'n'], notes: ['notes', 't'] },
  kitchen_material_usage: { productionId: ['production_id', 'u'], receiptItemId: ['receipt_item_id', 'u'], productId: ['product_id', 'u'], productName: ['product_name', 't'], lotLabel: ['lot_label', 't'], dishName: ['dish_name', 't'], usedOn: ['used_on', 'd'], quantity: ['quantity', 'n'], unit: ['unit', 't'], notes: ['notes', 't'], recordedByEmployeeId: ['recorded_by_employee_id', 'u'], recordedByName: ['recorded_by_name', 't'], source: ['source', 't'] },
  kitchen_thermal_processes: { productionId: ['production_id', 'u'], processDate: ['process_date', 'd'], processTime: ['process_time', 'd'], dishName: ['dish_name', 't'], productId: ['product_id', 'u'], cookingTemp: ['cooking_temp', 'n'], cookingText: ['cooking_text', 't'], chillTemp: ['chill_temp', 'n'], chillMinutes: ['chill_minutes', 'n'], chillText: ['chill_text', 't'], reheatTemp: ['reheat_temp', 'n'], reheatText: ['reheat_text', 't'], fryingTemp: ['frying_temp', 'n'], fryingText: ['frying_text', 't'], temperatureUnparsed: ['temperature_unparsed', 'b'],
    correctiveAction: ['corrective_action', 't'], notes: ['notes', 't'], recordedByEmployeeId: ['recorded_by_employee_id', 'u'], recordedByName: ['recorded_by_name', 't'], source: ['source', 't'] },
  kitchen_pureeing: { productionId: ['production_id', 'u'], pureedOn: ['pureed_on', 'd'], method: ['method', 't'], productName: ['product_name', 't'], visualCheck: ['visual_check', 'b'], bladeCheck: ['blade_check', 'b'], correctiveAction: ['corrective_action', 't'], notes: ['notes', 't'], recordedByEmployeeId: ['recorded_by_employee_id', 'u'], recordedByName: ['recorded_by_name', 't'], source: ['source', 't'] },
  kitchen_defrosting: { productionId: ['production_id', 'u'], receiptItemId: ['receipt_item_id', 'u'], productId: ['product_id', 'u'], productName: ['product_name', 't'], quantity: ['quantity', 'n'], unit: ['unit', 't'], method: ['method', 't'], startedAt: ['started_at', 'd'], startTemp: ['start_temp', 'n'], startText: ['start_text', 't'], endedAt: ['ended_at', 'd'], endTemp: ['end_temp', 'n'], endText: ['end_text', 't'], temperatureUnparsed: ['temperature_unparsed', 'b'],
    correctiveAction: ['corrective_action', 't'], notes: ['notes', 't'], recordedByEmployeeId: ['recorded_by_employee_id', 'u'], recordedByName: ['recorded_by_name', 't'], source: ['source', 't'] },
  kitchen_recall_drills: { code: ['code', 't'], drillDate: ['drill_date', 'd'], startedAt: ['started_at', 'd'], finishedAt: ['finished_at', 'd'], scenario: ['scenario', 't'], triggerText: ['trigger_text', 't'], receiptItemId: ['receipt_item_id', 'u'], productId: ['product_id', 'u'], productName: ['product_name', 't'], dishName: ['dish_name', 't'], targetMinutes: ['target_minutes', 'n'], elapsedMinutes: ['elapsed_minutes', 'n'],
    receivedQuantity: ['received_quantity', 'n'], usedQuantity: ['used_quantity', 'n'], stockQuantity: ['stock_quantity', 'n'], writtenOffQuantity: ['written_off_quantity', 'n'], quantityUnit: ['quantity_unit', 't'], accountedPercent: ['accounted_percent', 'n'], batchesCount: ['batches_count', 'n'], affectedDays: ['affected_days', 'n'], affectedMeals: ['affected_meals', 'n'], affectedPortions: ['affected_portions', 'n'],
    tracedWithinTarget: ['traced_within_target', 'b'], traceSnapshot: ['trace_snapshot', 'j'], notified: ['notified', 't'], actions: ['actions', 't'], result: ['result', 't'], lessons: ['lessons', 't'], conductedByEmployeeId: ['conducted_by_employee_id', 'u'], conductedByName: ['conducted_by_name', 't'], status: ['status', 't'], notes: ['notes', 't'] },
}
// Read-only columns the database fills (statuses, sign-off, codes).
const READ_ONLY = {
  kitchen_receipts: { temperatureStatus: 'temperature_status', result: 'result', limitStatus: 'limit_status' },
  kitchen_receipt_items: { temperatureStatus: 'temperature_status' },
  kitchen_thermal_processes: { cookingStatus: 'cooking_status', chillStatus: 'chill_status', reheatStatus: 'reheat_status', fryingStatus: 'frying_status', limitStatus: 'limit_status' },
  kitchen_pureeing: { limitStatus: 'limit_status' },
  kitchen_defrosting: { limitStatus: 'limit_status', verifiedAt: 'verified_at', verifiedByName: 'verified_by_name', verifiedByEmployeeId: 'verified_by_employee_id', reopenReason: 'reopen_reason' },
  kitchen_productions: { verifiedAt: 'verified_at', verifiedByName: 'verified_by_name', verifiedByEmployeeId: 'verified_by_employee_id', verificationNotes: 'verification_notes', reopenReason: 'reopen_reason' },
}

const toValue = (kind, value) => {
  if (kind === 'b') return value === '' || value == null ? null : Boolean(value)
  if (kind === 'j') return value && typeof value === 'object' ? value : null
  if (value === '' || value == null) return null
  if (kind === 'n') { const n = Number(String(value).replace(',', '.')); return Number.isFinite(n) ? n : null }
  if (kind === 'u') return isUuid(value) ? value : null
  if (kind === 't') { const text = String(value).trim(); return text || null }
  return value
}
export function toRow(table, entry) {
  const row = {}
  for (const [field, [column, kind]] of Object.entries(COLUMNS[table])) if (field in entry) row[column] = toValue(kind, entry[field])
  return row
}
export function fromRow(table, row) {
  const entry = { id: row.id, createdAt: row.created_at, updatedAt: row.updated_at }
  for (const [field, [column, kind]] of Object.entries(COLUMNS[table])) {
    const value = row[column]
    entry[field] = kind === 'j' ? value ?? null : kind === 'b' ? (value == null ? null : Boolean(value)) : value == null ? '' : kind === 'd' && /time$/.test(column) && typeof value === 'string' && /^\d{2}:\d{2}/.test(value) ? value.slice(0, 5) : value
  }
  for (const [field, column] of Object.entries(READ_ONLY[table] || {})) entry[field] = row[column] ?? null
  return entry
}

async function selectAll(build) {
  const all = []
  for (let from = 0; ; from += 1000) {
    const page = must(await build().range(from, from + 999)) || []
    all.push(...page)
    if (page.length < 1000) return all
  }
}
const byOrg = (table, organizationId, order = 'created_at') => selectAll(() => supabase.from(table).select('*').eq('organization_id', organizationId).order(order).order('id'))

// --- Local (demo) ---------------------------------------------------------------------------

function local() {
  const saved = loadSnapshot(LOCAL_KEY, null)
  if (saved && Array.isArray(saved.receipts)) return Array.isArray(saved.recallDrills) ? saved : { ...saved, recallDrills: isEmptyPreview() ? [] : kitchenDemoState().recallDrills }
  const seed = kitchenDemoState()
  // Empty-hospital preview: the kitchen's settings, limits and HACCP steps, no records.
  const state = isEmptyPreview() ? Object.fromEntries(Object.entries(seed).map(([key, value]) => [key, Array.isArray(value) && !['limits', 'steps'].includes(key) ? [] : value])) : seed
  saveSnapshot(LOCAL_KEY, state)
  return state
}
const saveLocal = state => saveSnapshot(LOCAL_KEY, state)
// The demo kitchen as it is in this browser (the Analysis demo reads it).
export const loadKitchenLocal = () => local()
const upsertIn = (list, entry) => (list.some(item => item.id === entry.id) ? list.map(item => (item.id === entry.id ? entry : item)) : [...list, entry])

export class KitchenRuleError extends Error { constructor(code) { super(code); this.code = code } }

// --- API -----------------------------------------------------------------------------------

// Everything the kitchen screens need, in one go, with each entry's in / out of limits.
export async function loadKitchen(organizationId) {
  if (isLocal()) return withStatuses(local())
  if (!organizationId) return withStatuses({ settings: null, limits: [], steps: [], products: [], menus: [], receipts: [], writeoffs: [], productions: [], usage: [], thermal: [], pureeing: [], defrosting: [], suppliers: [], recallDrills: [] })
  const [settings, limits, steps, products, menus, receipts, items, writeoffs, productions, meals, usage, thermal, pureeing, defrosting, suppliers, recallDrills] = await Promise.all([
    supabase.from('kitchen_settings').select('*').eq('organization_id', organizationId).maybeSingle().then(must),
    byOrg('kitchen_limits', organizationId, 'limit_key'), byOrg('kitchen_haccp_steps', organizationId, 'position'), byOrg('kitchen_products', organizationId, 'name'), byOrg('kitchen_menus', organizationId, 'weekday'),
    byOrg('kitchen_receipts', organizationId, 'received_on'), byOrg('kitchen_receipt_items', organizationId, 'position'), byOrg('kitchen_stock_writeoffs', organizationId, 'written_off_on'),
    byOrg('kitchen_productions', organizationId, 'production_date'), byOrg('kitchen_production_meals', organizationId, 'position'), byOrg('kitchen_material_usage', organizationId, 'used_on'),
    byOrg('kitchen_thermal_processes', organizationId, 'process_date'), byOrg('kitchen_pureeing', organizationId, 'pureed_on'), byOrg('kitchen_defrosting', organizationId, 'started_at'),
    selectAll(() => supabase.from('quality_suppliers').select('id,name,category,status').eq('organization_id', organizationId).order('name').order('id')).catch(() => []),
    byOrg('kitchen_recall_drills', organizationId, 'drill_date').catch(() => []),
  ])
  const itemsBy = group(items.map(row => ({ ...fromRow('kitchen_receipt_items', row), receiptId: row.receipt_id })), 'receiptId')
  const mealsBy = group(meals.map(row => ({ ...fromRow('kitchen_production_meals', row), productionId: row.production_id })), 'productionId')
  return {
    settings: settings ? fromRow('kitchen_settings', settings) : { expiryWarningDays: 2, haccpReviewMonths: 12, haccpLastReviewOn: '', haccpDocumentId: '', haccpTeam: '', recallDrillMonths: 12, notes: '' },
    limits: resolveLimits(limits.map(row => fromRow('kitchen_limits', row))),
    steps: steps.map(row => fromRow('kitchen_haccp_steps', row)),
    products: products.map(row => fromRow('kitchen_products', row)),
    menus: menus.map(row => fromRow('kitchen_menus', row)),
    receipts: receipts.map(row => ({ ...fromRow('kitchen_receipts', row), items: itemsBy.get(row.id) || [] })),
    writeoffs: writeoffs.map(row => fromRow('kitchen_stock_writeoffs', row)),
    productions: productions.map(row => ({ ...fromRow('kitchen_productions', row), meals: mealsBy.get(row.id) || [] })),
    usage: usage.map(row => fromRow('kitchen_material_usage', row)),
    thermal: thermal.map(row => fromRow('kitchen_thermal_processes', row)),
    pureeing: pureeing.map(row => fromRow('kitchen_pureeing', row)),
    defrosting: defrosting.map(row => fromRow('kitchen_defrosting', row)),
    suppliers: suppliers.map(row => ({ id: row.id, name: row.name, category: row.category, status: row.status })),
    recallDrills: recallDrills.map(row => ({ ...fromRow('kitchen_recall_drills', row), stockCounts: row.trace_snapshot?.stockCounts || {} })),
  }
}
const group = (rows, key) => { const map = new Map(); for (const row of rows) { const list = map.get(row[key]) || []; list.push(row); map.set(row[key], list) } return map }

async function writeRow(table, organizationId, entry, extra = {}) {
  const row = { ...toRow(table, entry), ...extra }
  if (isUuid(entry.id)) return must(await supabase.from(table).update(row).eq('id', entry.id).eq('organization_id', organizationId).select('*').single())
  return must(await supabase.from(table).insert({ ...row, organization_id: organizationId }).select('*').single())
}
// The child rows of a parent as `rows` lists them: removes the others, writes these.
async function syncChildren(table, organizationId, parentColumn, parentId, rows) {
  const existing = must(await supabase.from(table).select('id').eq('organization_id', organizationId).eq(parentColumn, parentId)) || []
  const keep = new Set(rows.filter(row => isUuid(row.id)).map(row => row.id))
  const remove = existing.map(row => row.id).filter(id => !keep.has(id))
  if (remove.length) must(await supabase.from(table).delete().eq('organization_id', organizationId).in('id', remove))
  for (const [index, row] of rows.entries()) await writeRow(table, organizationId, { ...row, position: index }, { [parentColumn]: parentId })
}

// A receipt with its products. Returns the saved receipt id.
export async function saveReceipt(organizationId, receipt) {
  if (isLocal()) {
    const state = local()
    const limits = resolveLimits(state.limits)
    const items = (receipt.items || []).map(item => ({ ...item, id: item.id || localId('kri') }))
    const { status } = receiptStatus(limits, receipt, items)
    if (status === 'out' && needsCorrectiveAction(status, receipt.correctiveAction) && needsCorrectiveAction(status, receipt.qualityNotes)) throw new KitchenRuleError('KITCHEN_CORRECTIVE_ACTION_REQUIRED')
    const code = receipt.code || `PAR-${String(Math.max(0, ...state.receipts.map(item => Number(String(item.code).replace(/\D/g, '')) || 0)) + 1).padStart(4, '0')}`
    const next = { ...receipt, id: receipt.id || localId('kr'), code, items, source: receipt.source || 'app' }
    state.receipts = upsertIn(state.receipts, next)
    saveLocal(state)
    return next.id
  }
  const saved = await writeRow('kitchen_receipts', organizationId, { ...receipt, code: receipt.code || '' }, receipt.code ? {} : { code: '' })
  await syncChildren('kitchen_receipt_items', organizationId, 'receipt_id', saved.id, receipt.items || [])
  return saved.id
}

export async function removeEntry(organizationId, table, id) {
  if (isLocal()) {
    const state = local()
    const field = LOCAL_FIELD[table]
    state[field] = state[field].filter(item => item.id !== id)
    if (table === 'kitchen_receipts') { const ids = new Set(); for (const r of state.receipts) for (const i of r.items || []) ids.add(i.id); state.usage = state.usage.map(u => (u.receiptItemId && !ids.has(u.receiptItemId) ? { ...u, receiptItemId: '' } : u)); state.writeoffs = state.writeoffs.filter(w => ids.has(w.receiptItemId)) }
    saveLocal(state)
    return
  }
  must(await supabase.from(table).delete().eq('id', id).eq('organization_id', organizationId))
}
const LOCAL_FIELD = { kitchen_receipts: 'receipts', kitchen_material_usage: 'usage', kitchen_thermal_processes: 'thermal', kitchen_pureeing: 'pureeing', kitchen_defrosting: 'defrosting', kitchen_productions: 'productions', kitchen_products: 'products', kitchen_menus: 'menus', kitchen_haccp_steps: 'steps', kitchen_stock_writeoffs: 'writeoffs', kitchen_recall_drills: 'recallDrills' }

const locked = (state, productionId) => Boolean(productionId && state.productions.find(item => item.id === productionId)?.verifiedAt)

// One entry of a production day or of the defrost list, with the database's rules.
export async function saveEntry(organizationId, table, entry) {
  if (isLocal()) {
    const state = local()
    const limits = resolveLimits(state.limits)
    if (['kitchen_material_usage', 'kitchen_thermal_processes', 'kitchen_pureeing'].includes(table) && (locked(state, entry.productionId) || locked(state, state[LOCAL_FIELD[table]].find(item => item.id === entry.id)?.productionId))) throw new KitchenRuleError('KITCHEN_DAY_VERIFIED')
    const status = table === 'kitchen_thermal_processes' ? thermalStatuses(limits, entry).overall : table === 'kitchen_pureeing' ? pureeingStatus(entry) : table === 'kitchen_defrosting' ? defrostStatus(limits, entry) : null
    if (needsCorrectiveAction(status, entry.correctiveAction) && (entry.source || 'app') === 'app') throw new KitchenRuleError('KITCHEN_CORRECTIVE_ACTION_REQUIRED')
    if (table === 'kitchen_defrosting') { const before = state.defrosting.find(item => item.id === entry.id); if (before?.verifiedAt) throw new KitchenRuleError('KITCHEN_RECORD_VERIFIED') }
    if (table === 'kitchen_material_usage' && entry.receiptItemId) {
      const stock = stockRows({ ...state, usage: state.usage.filter(item => item.id !== entry.id) }).find(row => row.receiptItemId === entry.receiptItemId)
      const problem = stock ? batchProblem(stock, entry.usedOn, entry.quantity) : ''
      if (problem) throw new KitchenRuleError(!stock.inStock ? 'KITCHEN_BATCH_REJECTED' : stock.expiryOn && stock.expiryOn < entry.usedOn ? 'KITCHEN_BATCH_EXPIRED' : 'KITCHEN_STOCK_INSUFFICIENT')
    }
    const next = { ...entry, id: entry.id || localId('ke'), source: entry.source || 'app' }
    const field = LOCAL_FIELD[table]
    state[field] = upsertIn(state[field], next)
    saveLocal(state)
    return next.id
  }
  return (await writeRow(table, organizationId, entry)).id
}

// A defrost's start / end as timestamps from the form's day and time.
export const defrostEntry = draft => ({ ...draft, startedAt: combine(draft.startDay, draft.startTime), endedAt: draft.endDay ? combine(draft.endDay, draft.endTime) : '' })

export async function saveProduction(organizationId, production) {
  if (isLocal()) {
    const state = local()
    const before = state.productions.find(item => item.id === production.id)
    if (before?.verifiedAt) throw new KitchenRuleError('KITCHEN_RECORD_VERIFIED')
    const next = { ...production, id: production.id || localId('kp'), meals: (production.meals || []).map(meal => ({ ...meal, id: meal.id || localId('km') })), source: production.source || 'app' }
    state.productions = upsertIn(state.productions, next)
    saveLocal(state)
    return next.id
  }
  const saved = await writeRow('kitchen_productions', organizationId, production)
  if (Array.isArray(production.meals)) await syncChildren('kitchen_production_meals', organizationId, 'production_id', saved.id, production.meals)
  return saved.id
}

// The HACCP sign-off of a day or a defrost (who and when); reopening needs a reason.
export async function signOff(organizationId, table, id, { actor, notes = '' }) {
  const stamp = { verifiedAt: new Date().toISOString(), verifiedByName: actor?.name || '', verifiedByEmployeeId: actor?.employeeId || '', reopenReason: '', ...(table === 'kitchen_productions' ? { verificationNotes: notes } : {}) }
  if (isLocal()) {
    const state = local()
    const field = LOCAL_FIELD[table]
    state[field] = state[field].map(item => (item.id === id ? { ...item, ...stamp } : item))
    saveLocal(state)
    return
  }
  must(await supabase.from(table).update({ verified_at: stamp.verifiedAt, verified_by: isUuid(actor?.id) ? actor.id : null, verified_by_employee_id: isUuid(actor?.employeeId) ? actor.employeeId : null, verified_by_name: stamp.verifiedByName || null, reopen_reason: null, ...(table === 'kitchen_productions' ? { verification_notes: notes || null } : {}) }).eq('id', id).eq('organization_id', organizationId))
}
export async function reopen(organizationId, table, id, reason) {
  if (String(reason || '').trim().length < 3) throw new KitchenRuleError('KITCHEN_REOPEN_REASON_REQUIRED')
  if (isLocal()) {
    const state = local()
    const field = LOCAL_FIELD[table]
    state[field] = state[field].map(item => (item.id === id ? { ...item, verifiedAt: null, verifiedByName: null, verifiedByEmployeeId: null, reopenReason: reason } : item))
    saveLocal(state)
    return
  }
  must(await supabase.from(table).update({ verified_at: null, verified_by: null, verified_by_employee_id: null, verified_by_name: null, reopen_reason: reason }).eq('id', id).eq('organization_id', organizationId))
}

export async function saveWriteoff(organizationId, writeoff) {
  if (isLocal()) {
    const state = local()
    state.writeoffs = upsertIn(state.writeoffs, { ...writeoff, id: writeoff.id || localId('kw') })
    saveLocal(state)
    return
  }
  await writeRow('kitchen_stock_writeoffs', organizationId, writeoff)
}

// A recall drill (Άσκηση ανάκλησης). Returns the saved drill (with its code).
export async function saveRecallDrill(organizationId, drill) {
  if (isLocal()) {
    const state = local()
    const list = state.recallDrills || []
    const code = drill.code || `ANK-${String(Math.max(0, ...list.map(item => Number(String(item.code).replace(/\D/g, '')) || 0)) + 1).padStart(4, '0')}`
    const next = { ...drill, id: drill.id || localId('krd'), code, updatedAt: new Date().toISOString() }
    state.recallDrills = upsertIn(list, next)
    saveLocal(state)
    return next
  }
  const saved = await writeRow('kitchen_recall_drills', organizationId, { ...drill, code: drill.code || '' }, drill.code ? {} : { code: '' })
  return { ...fromRow('kitchen_recall_drills', saved), stockCounts: saved.trace_snapshot?.stockCounts || {} }
}

// Catalogue, menus, HACCP steps: one row each.
export async function saveSimple(organizationId, table, entry) {
  if (isLocal()) {
    const state = local()
    const field = LOCAL_FIELD[table]
    const next = { ...entry, id: entry.id || localId('kx') }
    state[field] = upsertIn(state[field], next)
    saveLocal(state)
    return next.id
  }
  return (await writeRow(table, organizationId, entry)).id
}

// The organization's critical limits and settings.
export async function saveLimits(organizationId, limits) {
  if (isLocal()) {
    const state = local()
    state.limits = limits.map(item => ({ limitKey: item.limitKey, minValue: item.minValue, maxValue: item.maxValue, withinMinutes: item.withinMinutes, active: item.active !== false }))
    saveLocal(state)
    return
  }
  const rows = limits.map(item => ({ ...toRow('kitchen_limits', { ...item, label: item.label?.[0] || item.limitKey }), organization_id: organizationId }))
  must(await supabase.from('kitchen_limits').upsert(rows, { onConflict: 'organization_id,limit_key' }))
}
export async function saveSettings(organizationId, settings) {
  if (isLocal()) {
    const state = local()
    state.settings = { ...state.settings, ...settings }
    saveLocal(state)
    return
  }
  must(await supabase.from('kitchen_settings').upsert({ ...toRow('kitchen_settings', settings), organization_id: organizationId }, { onConflict: 'organization_id' }))
}

// The message for an error of a kitchen rule (database or demo).
export function kitchenErrorMessage(error, language = 'el') {
  const en = language === 'en'
  const text = `${error?.code || ''} ${error?.message || ''}`
  const known = [
    ['KITCHEN_CORRECTIVE_ACTION_REQUIRED', en ? 'An entry out of limits needs a corrective action.' : 'Μια καταχώριση εκτός ορίων χρειάζεται διορθωτική ενέργεια.'],
    ['KITCHEN_BATCH_EXPIRED', en ? 'The batch has expired and cannot be used.' : 'Η παρτίδα έχει λήξει και δεν χρησιμοποιείται.'],
    ['KITCHEN_BATCH_REJECTED', en ? 'The batch was rejected at receipt.' : 'Η παρτίδα απορρίφθηκε στην παραλαβή.'],
    ['KITCHEN_STOCK_INSUFFICIENT', en ? 'The batch does not have that much left.' : 'Η παρτίδα δεν έχει τόσο υπόλοιπο.'],
    ['KITCHEN_DAY_VERIFIED', en ? 'The production day is signed off: reopen it first.' : 'Η ημέρα παραγωγής έχει επαληθευτεί: ανοίξτε την πρώτα ξανά.'],
    ['KITCHEN_RECORD_VERIFIED', en ? 'The record is signed off: reopen it first.' : 'Η εγγραφή έχει επαληθευτεί: ανοίξτε την πρώτα ξανά.'],
    ['KITCHEN_REOPEN_REASON_REQUIRED', en ? 'Give the reason for reopening.' : 'Γράψτε την αιτία για το άνοιγμα.'],
    ['KITCHEN_SIGNOFF_FORBIDDEN', en ? 'Only the kitchen manager or the quality office signs off.' : 'Την επαλήθευση την κάνει ο υπεύθυνος κουζίνας ή το γραφείο ποιότητας.'],
  ].find(([code]) => text.includes(code))
  return known ? known[1] : (en ? 'The entry could not be saved.' : 'Δεν ήταν δυνατή η αποθήκευση.')
}
