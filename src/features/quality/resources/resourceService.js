import { supabase } from '../../../core/supabase/client'
import { isDemoDataEnvironment } from '../../../core/data/dataEnvironment'
import { isOwnerPreview } from '../../../core/preview/ownerPreview'
import { loadSnapshot, saveSnapshot } from '../../../core/data/repository'
import { nextEquipmentCode, nextSupplierCode } from './resourceModel'
import { demoResources } from './resourceDemoData'
import { diffChildRows, rowId } from '../qualityRelations'
import { CERTIFICATION_FIELDS, EVALUATION_FIELDS, NONCONFORMITY_FIELDS, SCORE_FIELDS, SUPPLIER_SELECT, certificationRows, evaluationRows, nonconformityRows, scoreRows, supplierListsFromRow } from './supplierRelations'

// Suppliers and equipment (20261111100000_quality_suppliers_equipment.sql):
// a supplier's certifications, evaluations (with a score row per criterion)
// and nonconformities are rows of their own (20261116100000_quality_relational.sql),
// shown as lists on the supplier; a device's events are rows of their own, so a
// department can add one on its own device. The demo keeps everything in the browser.

const isLocal = () => isDemoDataEnvironment() || isOwnerPreview()
const isUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))
const localId = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
const must = ({ data, error }) => { if (error) throw error; return data }
const KEYS = { suppliers: 'quality_local_suppliers', equipment: 'quality_local_equipment', events: 'quality_local_equipment_events' }
const text = value => { const kept = String(value ?? '').trim(); return kept || null }
const months = value => (Number(value) >= 1 ? Math.round(Number(value)) : null)

function local() {
  const equipment = loadSnapshot(KEYS.equipment, null)
  if (Array.isArray(equipment)) return { suppliers: loadSnapshot(KEYS.suppliers, []), equipment, events: loadSnapshot(KEYS.events, []) }
  const state = demoResources()
  saveLocal(state)
  return state
}
function saveLocal(state) {
  for (const [field, key] of Object.entries(KEYS)) saveSnapshot(key, state[field])
}

// --- Cloud shapes -----------------------------------------------------------------------

const toSupplier = row => ({
  id: row.id, code: row.code, name: row.name, category: row.category, criticality: row.criticality, status: row.status,
  taxId: row.tax_id || '', contactName: row.contact_name || '', phone: row.phone || '', email: row.email || '', address: row.address || '', website: row.website || '', products: row.products || '',
  contractEndsOn: row.contract_ends_on || '', notes: row.notes || '',
  ...supplierListsFromRow(row),
  createdAt: row.created_at, updatedAt: row.updated_at,
})
const supplierRow = (organizationId, supplier) => ({
  organization_id: organizationId, name: supplier.name.trim(), category: supplier.category || 'consumables', criticality: supplier.criticality || 'medium', status: supplier.status || 'active',
  tax_id: text(supplier.taxId), contact_name: text(supplier.contactName), phone: text(supplier.phone), email: text(supplier.email), address: text(supplier.address), website: text(supplier.website), products: text(supplier.products),
  contract_ends_on: supplier.contractEndsOn || null, notes: text(supplier.notes),
})
const toEquipment = row => ({
  id: row.id, code: row.code, name: row.name, equipmentType: row.equipment_type || '', departmentId: row.department_id || '', location: row.location || '',
  manufacturer: row.manufacturer || '', model: row.model || '', serialNumber: row.serial_number || '', inventoryNumber: row.inventory_number || '', supplierId: row.supplier_id || '',
  criticality: row.criticality, status: row.status, installedOn: row.installed_on || '', warrantyEndsOn: row.warranty_ends_on || '',
  maintenanceMonths: row.maintenance_months || '', calibrationMonths: row.calibration_months || '', safetyMonths: row.safety_months || '', notes: row.notes || '',
  createdAt: row.created_at, updatedAt: row.updated_at,
})
const equipmentRow = (organizationId, equipment) => ({
  organization_id: organizationId, name: equipment.name.trim(), equipment_type: text(equipment.equipmentType), department_id: isUuid(equipment.departmentId) ? equipment.departmentId : null, location: text(equipment.location),
  manufacturer: text(equipment.manufacturer), model: text(equipment.model), serial_number: text(equipment.serialNumber), inventory_number: text(equipment.inventoryNumber), supplier_id: isUuid(equipment.supplierId) ? equipment.supplierId : null,
  criticality: equipment.criticality || 'medium', status: equipment.status || 'in_service', installed_on: equipment.installedOn || null, warranty_ends_on: equipment.warrantyEndsOn || null,
  maintenance_months: months(equipment.maintenanceMonths), calibration_months: months(equipment.calibrationMonths), safety_months: months(equipment.safetyMonths), notes: text(equipment.notes),
})
const toEvent = row => ({ id: row.id, equipmentId: row.equipment_id, kind: row.kind, happenedOn: row.happened_on, result: row.result, performedBy: row.performed_by || '', description: row.description || '', certificate: row.certificate || '', capaCode: row.capa_code || '', recordedAt: row.recorded_at })

async function selectAll(build) {
  const all = []
  for (let from = 0; ; from += 1000) {
    const page = must(await build().range(from, from + 999)) || []
    all.push(...page)
    if (page.length < 1000) return all
  }
}

// --- API ----------------------------------------------------------------------------------

// Everything the user may read, in one go: the lists and their figures need all three.
// A department reads no suppliers (the database returns none).
export async function loadResources(organizationId) {
  if (isLocal()) { const state = local(); return { suppliers: state.suppliers, equipment: state.equipment, events: state.events } }
  if (!organizationId) return { suppliers: [], equipment: [], events: [] }
  const [suppliers, equipment, events] = await Promise.all([
    selectAll(() => supabase.from('quality_suppliers').select(SUPPLIER_SELECT).eq('organization_id', organizationId).order('name').order('id')),
    selectAll(() => supabase.from('quality_equipment').select('*').eq('organization_id', organizationId).order('code').order('id')),
    selectAll(() => supabase.from('quality_equipment_events').select('*').eq('organization_id', organizationId).order('happened_on', { ascending: false }).order('id')),
  ])
  return { suppliers: suppliers.map(toSupplier), equipment: equipment.map(toEquipment), events: events.map(toEvent) }
}

export async function saveSupplier(organizationId, supplier) {
  if (isLocal()) {
    const state = local()
    const next = { ...supplier, id: supplier.id || localId('sup'), code: supplier.code || nextSupplierCode(state.suppliers.map(item => item.code)) }
    state.suppliers = supplier.id ? state.suppliers.map(item => (item.id === supplier.id ? next : item)) : [...state.suppliers, next]
    saveLocal(state)
    return next
  }
  let id = supplier.id
  if (isUuid(id)) must(await supabase.from('quality_suppliers').update(supplierRow(organizationId, supplier)).eq('id', id).eq('organization_id', organizationId).select('id').single())
  else {
    const codes = must(await supabase.from('quality_suppliers').select('code').eq('organization_id', organizationId)) || []
    id = must(await supabase.from('quality_suppliers').insert({ ...supplierRow(organizationId, supplier), code: nextSupplierCode(codes.map(item => item.code)) }).select('id').single()).id
  }
  await saveSupplierLists(organizationId, id, supplier)
  return toSupplier(must(await supabase.from('quality_suppliers').select(SUPPLIER_SELECT).eq('id', id).eq('organization_id', organizationId).single()))
}

// Writes the stored rows of a parent the way `rows` says: removes the ones no
// longer there, writes the new and the changed ones.
async function syncRows(organizationId, table, parentColumn, parentIds, rows, fields) {
  if (!parentIds.length && !rows.length) return
  const existing = parentIds.length ? must(await supabase.from(table).select(['id', parentColumn, ...fields].join(',')).eq('organization_id', organizationId).in(parentColumn, parentIds)) || [] : []
  const { upsert, remove } = diffChildRows(existing, rows, [parentColumn, ...fields])
  if (remove.length) must(await supabase.from(table).delete().eq('organization_id', organizationId).in('id', remove))
  if (upsert.length) must(await supabase.from(table).upsert(upsert.map(row => ({ ...row, organization_id: organizationId }))))
}

// A supplier's certifications, evaluations with their scores, and nonconformities.
async function saveSupplierLists(organizationId, supplierId, supplier) {
  const withParent = rows => rows.map(row => ({ ...row, supplier_id: supplierId }))
  await syncRows(organizationId, 'quality_supplier_certifications', 'supplier_id', [supplierId], withParent(certificationRows(supplier.certifications)), CERTIFICATION_FIELDS)
  await syncRows(organizationId, 'quality_supplier_nonconformities', 'supplier_id', [supplierId], withParent(nonconformityRows(supplier.nonconformities)), NONCONFORMITY_FIELDS)
  const evaluations = (supplier.evaluations || []).map(item => ({ ...item, id: rowId(item.id) }))
  const rows = withParent(evaluationRows(evaluations))
  await syncRows(organizationId, 'quality_supplier_evaluations', 'supplier_id', [supplierId], rows, EVALUATION_FIELDS)
  const ids = rows.map(row => row.id)
  const stored = ids.length ? must(await supabase.from('quality_supplier_evaluation_scores').select('id,evaluation_id,criterion').eq('organization_id', organizationId).in('evaluation_id', ids)) || [] : []
  const scores = evaluations.filter(item => ids.includes(item.id)).flatMap(item => scoreRows(item, stored.filter(row => row.evaluation_id === item.id)).map(row => ({ ...row, evaluation_id: item.id })))
  await syncRows(organizationId, 'quality_supplier_evaluation_scores', 'evaluation_id', ids, scores, SCORE_FIELDS)
}

export async function removeSupplier(organizationId, id) {
  if (isLocal()) {
    const state = local()
    state.suppliers = state.suppliers.filter(item => item.id !== id)
    state.equipment = state.equipment.map(item => (item.supplierId === id ? { ...item, supplierId: '' } : item))
    saveLocal(state)
    return
  }
  must(await supabase.from('quality_suppliers').delete().eq('id', id).eq('organization_id', organizationId))
}

export async function saveEquipment(organizationId, equipment) {
  if (isLocal()) {
    const state = local()
    const next = { ...equipment, id: equipment.id || localId('eq'), code: equipment.code || nextEquipmentCode(state.equipment.map(item => item.code)) }
    state.equipment = equipment.id ? state.equipment.map(item => (item.id === equipment.id ? next : item)) : [...state.equipment, next]
    saveLocal(state)
    return next
  }
  if (isUuid(equipment.id)) return toEquipment(must(await supabase.from('quality_equipment').update(equipmentRow(organizationId, equipment)).eq('id', equipment.id).eq('organization_id', organizationId).select('*').single()))
  const codes = must(await supabase.from('quality_equipment').select('code').eq('organization_id', organizationId)) || []
  return toEquipment(must(await supabase.from('quality_equipment').insert({ ...equipmentRow(organizationId, equipment), code: nextEquipmentCode(codes.map(item => item.code)) }).select('*').single()))
}

export async function removeEquipment(organizationId, id) {
  if (isLocal()) {
    const state = local()
    state.equipment = state.equipment.filter(item => item.id !== id)
    state.events = state.events.filter(item => item.equipmentId !== id)
    saveLocal(state)
    return
  }
  must(await supabase.from('quality_equipment').delete().eq('id', id).eq('organization_id', organizationId))
}

export async function addEvent(organizationId, equipmentId, event) {
  const entry = { kind: event.kind, happenedOn: event.happenedOn, result: event.result, performedBy: text(event.performedBy) || '', description: text(event.description) || '', certificate: text(event.certificate) || '', capaCode: text(event.capaCode) || '' }
  if (isLocal()) {
    const state = local()
    const saved = { ...entry, id: localId('eqe'), equipmentId, recordedAt: new Date().toISOString() }
    state.events = [saved, ...state.events]
    saveLocal(state)
    return saved
  }
  return toEvent(must(await supabase.from('quality_equipment_events').insert({ organization_id: organizationId, equipment_id: equipmentId, kind: entry.kind, happened_on: entry.happenedOn, result: entry.result, performed_by: entry.performedBy || null, description: entry.description || null, certificate: entry.certificate || null, capa_code: entry.capaCode || null }).select('*').single()))
}

export async function removeEvent(organizationId, id) {
  if (isLocal()) {
    const state = local()
    state.events = state.events.filter(item => item.id !== id)
    saveLocal(state)
    return
  }
  must(await supabase.from('quality_equipment_events').delete().eq('id', id).eq('organization_id', organizationId))
}
