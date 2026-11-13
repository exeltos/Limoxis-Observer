import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { antisepticLibrary } from './preventionDemoData'
import { antisepticPeriodBounds } from './antisepticMethods'
import { loadAntisepticLocal, saveAntisepticLocal } from './preventionStore'
import { assertCloud, cloudClient, currentUserId } from '../../core/supabase/cloudContext'
import type { AntisepticItemRef, AntisepticPeriodRow, AntisepticRecord, PreventionDraft } from './preventionTypes'
import { deletePreventionRecord, findApprovedPatientDayRows, loadPreventionDepartments, type PreventionOrgId } from './preventionCloud'

const monthLabel = (from: string | null, to: string | null) => {
  if (!from) return ''
  const start = String(from).slice(0, 7)
  const end = String(to || from).slice(0, 7)
  return start === end ? start : `${start} – ${end}`
}
const isAbhrItem = (item: AntisepticItemRef | null | undefined) =>
  Boolean(item && ((item.metadata as { is_abhr?: boolean } | null)?.is_abhr === true || item.code === 'ANT-ABHR'))
const isHospitalRecord = (record: Partial<AntisepticRecord> | null | undefined) =>
  record?.departmentScope === 'hospital' ||
  record?.departmentEl === 'Όλο το νοσοκομείο' ||
  record?.departmentEn === 'Whole hospital'

function mapRow(row: AntisepticPeriodRow): AntisepticRecord {
  const productEl = row.antiseptic_item?.name_el || ''
  const productEn = row.antiseptic_item?.name_en || productEl
  const patientDays = Number(row.patient_days) || 0
  const litres = Number(row.litres) || 0
  const eligible = isAbhrItem(row.antiseptic_item)
  const hospitalScope = !row.department_id
  return {
    id: row.id,
    period: monthLabel(row.period_start, row.period_end),
    periodStart: row.period_start,
    periodEnd: row.period_end,
    departmentScope: hospitalScope ? 'hospital' : 'department',
    departmentEl: hospitalScope ? 'Όλο το νοσοκομείο' : row.department?.name || '',
    departmentEn: hospitalScope ? 'Whole hospital' : row.department?.name || '',
    product: productEl,
    productEn,
    antisepticItemId: row.antiseptic_item_id,
    productCode: row.antiseptic_item?.code || '',
    litres,
    patientDays: patientDays || null,
    patientDaysSource: row.patient_days_source || '',
    indicator:
      eligible && patientDays > 0 ? Number(((litres / patientDays) * 1000).toFixed(2)) : null,
    indicatorEligible: eligible,
    method: row.source || 'manual',
    referenceNumber: row.source_reference || '',
    responsible: row.responsible_name || '',
    notes: row.notes || '',
    lifecycleStatus: 'active',
    createdAt: row.created_at,
    createdById: row.created_by,
    updatedAt: row.updated_at,
    updatedById: row.updated_by,
  }
}

// Τα τμήματα και η βιβλιοθήκη που χρειάζεται η φόρμα.
export type AntisepticSupport = Awaited<ReturnType<typeof loadAntisepticSupportData>>
export async function loadAntisepticSupportData(organizationId: PreventionOrgId) {
  if (isDemoDataEnvironment())
    return {
      departments: await loadPreventionDepartments(organizationId),
      products: antisepticLibrary.map(item => ({ ...item, indicatorEligible: isAbhrItem(item) })),
    }
  assertCloud(organizationId)
  const [departments, productsResult] = await Promise.all([
    loadPreventionDepartments(organizationId),
    cloudClient()
      .from('master_library_items')
      .select('id,name_el,name_en,code,metadata')
      .eq('organization_id', organizationId as string)
      .eq('library_key', 'antiseptics')
      .eq('is_active', true)
      .order('name_el'),
  ])
  if (productsResult.error) throw productsResult.error
  return {
    departments,
    products: (productsResult.data || []).map(x => ({
      id: x.id,
      el: x.name_el,
      en: x.name_en || x.name_el,
      code: x.code,
      metadata: x.metadata || {},
      indicatorEligible: isAbhrItem(x),
    })),
  }
}

// One department's approved patient-days for the month; for the whole
// hospital its total row, else the sum of the department rows.
export async function findPatientDaysForPeriod(organizationId: PreventionOrgId, departmentId: string | null, from: string | null | undefined, to: string | null | undefined) {
  const rows = await findApprovedPatientDayRows(organizationId, { departmentId, from, to })
  if (!rows) return null
  if (departmentId) return rows.length ? Number(rows[0].patient_days) || 0 : null
  const hospitalTotal = rows.find(row => row.department_id == null)
  if (hospitalTotal) return Number(hospitalTotal.patient_days) || 0
  const departmentRows = rows.filter(row => row.department_id != null)
  return departmentRows.length
    ? departmentRows.reduce((sum, row) => sum + (Number(row.patient_days) || 0), 0)
    : null
}

export async function loadAntisepticRecords(organizationId: PreventionOrgId): Promise<AntisepticRecord[]> {
  if (isDemoDataEnvironment()) return loadAntisepticLocal()
  assertCloud(organizationId)
  const { data, error } = await cloudClient()
    .from('antiseptic_consumption_periods')
    .select(
      '*,department:departments(id,name),antiseptic_item:master_library_items(id,name_el,name_en,code,metadata)',
    )
    .eq('organization_id', organizationId as string)
    .order('period_start', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(mapRow)
}

export async function saveAntisepticRecord(organizationId: PreventionOrgId, record: PreventionDraft<AntisepticRecord>, { existingId = null }: { existingId?: string | null } = {}) {
  if (isDemoDataEnvironment()) {
    const rows = loadAntisepticLocal()
    const id = existingId || `ANT-${Date.now()}`
    const saved = { ...record, id, lifecycleStatus: 'active' }
    const next = existingId
      ? rows.map(row => (row.id === existingId ? saved : row))
      : [saved, ...rows]
    saveAntisepticLocal(next)
    return saved
  }
  assertCloud(organizationId)
  const userId = await currentUserId()
  const support = await loadAntisepticSupportData(organizationId)
  const hospitalScope = isHospitalRecord(record)
  const department = hospitalScope
    ? null
    : support.departments.find(x => x.el === record.departmentEl)
  if (!hospitalScope && !department)
    throw new Error('Selected department is not available for this organization.')
  const product = support.products.find(
    x => x.id === record.antisepticItemId || x.el === record.product,
  )
  if (!product) throw new Error('Selected antiseptic is not available in the central library.')
  const bounds =
    record.periodKind === 'range' && record.periodStart && record.periodEnd
      ? { from: record.periodStart, to: record.periodEnd }
      : antisepticPeriodBounds(record.period)
  if (!bounds) throw new Error('A valid period is required.')
  const periodStart = bounds.from
  const periodEnd = bounds.to
  const payload = {
    organization_id: organizationId as string,
    department_id: department?.id || null,
    period_start: periodStart,
    period_end: periodEnd,
    antiseptic_item_id: product.id,
    litres: Number(record.litres) || 0,
    source: record.method || 'manual',
    source_reference: record.referenceNumber || null,
    patient_days:
      record.patientDays === '' || record.patientDays == null ? null : Number(record.patientDays),
    patient_days_source: record.patientDaysSource || null,
    responsible_name: record.responsible || null,
    notes: record.notes || null,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  }
  let saved
  if (existingId) {
    const { data, error } = await cloudClient()
      .from('antiseptic_consumption_periods')
      .update(payload)
      .eq('organization_id', organizationId as string)
      .eq('id', existingId)
      .select('*')
      .single()
    if (error) throw error
    saved = data
  } else {
    const { data, error } = await cloudClient()
      .from('antiseptic_consumption_periods')
      .insert({ ...payload, created_by: userId })
      .select('*')
      .single()
    if (error) throw error
    saved = data
  }
  const rows = await loadAntisepticRecords(organizationId)
  return rows.find(x => x.id === saved.id) || null
}

export function deleteAntisepticRecord(organizationId: PreventionOrgId, id: string | null | undefined) {
  return deletePreventionRecord(organizationId, id, { table: 'antiseptic_consumption_periods', localTable: 'prevention_antiseptic', label: 'Αντισηπτικά', loadLocal: loadAntisepticLocal, saveLocal: saveAntisepticLocal })
}
