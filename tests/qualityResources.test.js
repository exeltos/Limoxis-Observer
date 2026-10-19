import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { addMonths, approvalFor, equipmentCapaSource, equipmentCounts, equipmentExport, equipmentProblems, equipmentStatus, eventProblems, evaluationScore, filterEquipment, filterSuppliers, newEquipment, nextEquipmentCode, nextSupplierCode, supplierCapaSource, supplierCounts, supplierStatus, withEquipmentStatus, withSupplierStatus, NO_EQUIPMENT_FILTERS, NO_SUPPLIER_FILTERS } from '../src/features/quality/resources/resourceModel'
import { demoResources } from '../src/features/quality/resources/resourceDemoData'
import { qualityTabOf } from '../src/features/quality/qualityReturnSection'

const TODAY = '2026-10-18'
const device = (extra = {}) => ({ ...newEquipment(), id: 'eq1', code: 'EQ-0001', name: 'Απινιδωτής', maintenanceMonths: 6, calibrationMonths: '', safetyMonths: 12, installedOn: '2024-01-10', ...extra })
const event = (kind, happenedOn, result = 'pass', extra = {}) => ({ id: `${kind}-${happenedOn}`, equipmentId: 'eq1', kind, happenedOn, result, recordedAt: `${happenedOn}T10:00:00Z`, ...extra })

describe('Equipment: the programme', () => {
  it('adds months to a date, keeping the end of a short month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2025-11-15', 12)).toBe('2026-11-15')
    expect(addMonths('', 6)).toBe('')
  })

  it('works out each check from the last successful one; a failed check does not count', () => {
    const status = equipmentStatus(device(), [event('maintenance', '2026-03-01'), event('maintenance', '2026-05-01', 'fail'), event('safety', '2025-11-01')], TODAY)
    const [maintenance, calibration, safety] = status.programme
    expect(maintenance).toMatchObject({ nextDue: '2026-09-01', state: 'overdue', days: -47 })
    expect(calibration.state).toBe('none')
    expect(safety).toMatchObject({ nextDue: '2026-11-01', state: 'dueSoon' })
    expect(status.due).toBe('overdue')
    expect(status.next.kind).toBe('maintenance')
  })

  it('a device never checked is due from its installation', () => {
    expect(equipmentStatus(device({ installedOn: '2026-08-01' }), [], TODAY).programme[0]).toMatchObject({ nextDue: '2027-02-01', state: 'ok' })
  })

  it('a failure takes the device out of service until a repair brings it back', () => {
    const failure = event('failure', '2026-10-01', 'out_of_service', { description: 'Δεν φορτίζει' })
    expect(equipmentStatus(device(), [failure], TODAY)).toMatchObject({ state: 'out_of_service', downSince: '2026-10-01' })
    expect(equipmentStatus(device(), [failure, event('repair', '2026-10-05', 'returned')], TODAY).state).toBe('in_service')
    expect(equipmentStatus(device(), [failure, event('repair', '2026-10-05', 'fail')], TODAY).state).toBe('out_of_service')
    // A fault that still lets it work changes nothing; a retired device is retired.
    expect(equipmentStatus(device(), [event('failure', '2026-10-01', 'fail', { description: 'x' })], TODAY).state).toBe('in_service')
    expect(equipmentStatus(device({ status: 'retired' }), [failure], TODAY)).toMatchObject({ state: 'retired', due: 'none' })
  })

  it('counts and sorts what needs attention first', () => {
    const devices = [device(), device({ id: 'eq2', code: 'EQ-0002', criticality: 'high' }), device({ id: 'eq3', code: 'EQ-0003', status: 'retired' })]
    const events = [event('maintenance', '2026-09-01'), event('safety', '2026-09-01'), { ...event('failure', '2026-10-10', 'out_of_service'), equipmentId: 'eq2' }]
    const rows = withEquipmentStatus(devices, events, TODAY)
    expect(equipmentCounts(rows)).toEqual({ total: 2, overdue: 1, dueSoon: 0, down: 1, critical: 1 })
    expect(filterEquipment(rows, NO_EQUIPMENT_FILTERS).map(row => row.code)).toEqual(['EQ-0002', 'EQ-0001'])
    expect(filterEquipment(rows, { ...NO_EQUIPMENT_FILTERS, quick: 'down' }).map(row => row.code)).toEqual(['EQ-0002'])
    expect(filterEquipment(rows, { ...NO_EQUIPMENT_FILTERS, state: 'retired' }).map(row => row.code)).toEqual(['EQ-0003'])
    expect(equipmentExport(rows, 'el').rows).toHaveLength(3)
  })

  it('asks for a name, a sensible interval and a description of a failure; numbers devices', () => {
    expect(equipmentProblems(device({ name: '', maintenanceMonths: 200 }))).toEqual(['όνομα', 'προληπτική συντήρηση κάθε 1–120 μήνες'])
    expect(eventProblems({ kind: 'failure', happenedOn: '2026-10-01', result: 'out_of_service', description: '' })).toEqual(['περιγραφή της βλάβης'])
    expect(eventProblems({ kind: 'maintenance', happenedOn: '2026-10-01', result: 'returned' })).toEqual(['αποτέλεσμα'])
    expect(nextEquipmentCode(['EQ-0009', 'EQ-0012', 'X-1'])).toBe('EQ-0013')
    expect(nextSupplierCode([])).toBe('SUP-001')
  })
})

describe('Suppliers: evaluation and approval', () => {
  const supplier = (extra = {}) => ({ id: 's1', code: 'SUP-001', name: 'Προμηθευτής', category: 'consumables', criticality: 'high', status: 'active', certifications: [], evaluations: [], nonconformities: [], ...extra })

  it('scores the six criteria as a share of the points, and approves from it', () => {
    expect(evaluationScore({ quality: 5, delivery: 4, specs: 5, documents: 4, support: 5, price: 3 })).toBe(87)
    expect(evaluationScore({ quality: 3, delivery: 3 })).toBe(60)
    expect(evaluationScore({})).toBeNull()
    expect([approvalFor(80), approvalFor(79), approvalFor(60), approvalFor(59), approvalFor(null)]).toEqual(['approved', 'conditional', 'conditional', 'rejected', 'unevaluated'])
  })

  it('reads the latest evaluation, the yearly due date, certificates, nonconformities and the contract', () => {
    const status = supplierStatus(supplier({
      evaluations: [{ evaluatedOn: '2025-01-10', scores: { quality: 5, delivery: 5, specs: 5, documents: 5, support: 5, price: 5 } }, { evaluatedOn: '2025-09-01', scores: { quality: 3, delivery: 2, specs: 3, documents: 3, support: 3, price: 3 } }],
      certifications: [{ type: 'ISO 9001', expiresOn: '2026-10-01' }, { type: 'CE', expiresOn: '2026-11-30' }, { type: 'ISO 13485', expiresOn: '2028-01-01' }],
      nonconformities: [{ severity: 'major', status: 'open' }, { severity: 'minor', status: 'closed' }],
      contractEndsOn: '2026-11-01',
    }), TODAY)
    expect(status).toMatchObject({ score: 57, approval: 'rejected', evaluationDue: true, nextEvaluation: '2026-09-01', expiredCertificates: 1, expiringCertificates: 1, openNonconformities: 1, majorOpen: 1, contractState: 'expiring' })
    expect(supplierStatus(supplier(), TODAY)).toMatchObject({ approval: 'unevaluated', evaluationDue: true })
    expect(supplierStatus(supplier({ status: 'inactive' }), TODAY).evaluationDue).toBe(false)
  })

  it('counts and filters suppliers', () => {
    const rows = withSupplierStatus([supplier(), supplier({ id: 's2', code: 'SUP-002', name: 'Άλλος', evaluations: [{ evaluatedOn: '2026-06-01', scores: { quality: 4, delivery: 4, specs: 4, documents: 4, support: 4, price: 4 } }] }), supplier({ id: 's3', status: 'inactive' })], [{ supplierId: 's2' }], TODAY)
    expect(supplierCounts(rows)).toMatchObject({ total: 2, approved: 1, attention: 0, evaluationDue: 1 })
    expect(rows.find(row => row.id === 's2').equipmentCount).toBe(1)
    expect(filterSuppliers(rows, NO_SUPPLIER_FILTERS)).toHaveLength(2)
    expect(filterSuppliers(rows, { ...NO_SUPPLIER_FILTERS, quick: 'approved' }).map(row => row.code)).toEqual(['SUP-002'])
  })
})

describe('Corrective actions and the Center', () => {
  it('a failure and a supplier nonconformity open a corrective action that names them', () => {
    expect(equipmentCapaSource(device({ departmentId: 'ΜΕΘ', model: 'D-300' }), event('failure', '2026-10-01', 'out_of_service', { description: 'Δεν φορτίζει' }))).toMatchObject({ sourceId: 'EQ:EQ-0001', departmentId: 'ΜΕΘ', title: 'Βλάβη: Απινιδωτής D-300' })
    expect(supplierCapaSource({ code: 'SUP-002', name: 'Αναλώσιμα' }, { date: '2026-09-01', severity: 'major', description: 'Σχισμένα γάντια' }, 'en').sourceId).toBe('SUP:SUP-002')
    const lists = fs.readFileSync('src/features/quality/QualityLists.jsx', 'utf8')
    expect(lists).toContain("if(id.startsWith('EQ:'))return 'equipment'")
    expect(lists).toContain("if(id.startsWith('SUP:'))return 'supplier'")
  })

  it('comes back to the right view of the resources tab', () => {
    expect(qualityTabOf('resources:suppliers')).toEqual({ tab: 'resources', view: 'suppliers' })
    expect(qualityTabOf('resources')).toEqual({ tab: 'resources', view: null })
  })

  it('the demo always has something overdue, due soon and out of service', () => {
    const state = demoResources()
    const rows = withEquipmentStatus(state.equipment, state.events)
    const count = equipmentCounts(rows)
    expect(count.overdue).toBeGreaterThan(0)
    expect(count.dueSoon).toBeGreaterThan(0)
    expect(count.down).toBe(1)
    expect(supplierCounts(withSupplierStatus(state.suppliers, state.equipment)).nonconformities).toBe(2)
  })

  it('the database keeps suppliers to Quality and lets a department record events on its own devices', () => {
    const sql = fs.readFileSync('supabase/migrations/20261111100000_quality_suppliers_equipment.sql', 'utf8')
    expect(sql).toMatch(/create policy quality_suppliers_read[^;]*current_user_quality_read_orgs[^;]*;/)
    expect(sql).not.toMatch(/create policy quality_suppliers_read[^;]*department_scopes/)
    expect(sql).toMatch(/create policy quality_equipment_events_insert[^;]*current_user_department_scopes/)
    expect(sql).toContain('revoke update on public.quality_equipment_events from authenticated')
  })
})
