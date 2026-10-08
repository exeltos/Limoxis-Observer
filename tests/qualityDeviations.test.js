import { describe, expect, it } from 'vitest'
import { bundleSourceId, capaPrefill, controlSourceId, deviationQueue, overdueSubActions, sourcePath, subActionProgress } from '../src/features/quality/qualityDeviations'

const now = new Date('2026-10-08T12:00:00Z')
const control = {
  id: 'CTRL-DEMO-0001', title: 'Θερμοκρασία ψυγείου', titleEn: 'Fridge temperature',
  responseConfig: { unit: '°C', criticality: 'high', deviationActions: '1. Μεταφορά εμβολίων\n2. Ενημέρωση φαρμακείου' },
  assignments: {
    ΜΕΘ: { departmentId: 'dep-icu', history: [
      { id: 'exec-aaaaaaaa-1', at: '2026-10-07T07:00:00Z', value: '11.5', hasFinding: true, status: 'completed' },
      { id: 'exec-bbbbbbbb-2', at: '2026-10-06T07:00:00Z', value: '4.2', hasFinding: false, status: 'completed' },
      { id: 'exec-cccccccc-3', at: '2026-10-05T07:00:00Z', value: '12', hasFinding: true, status: 'cancelled' },
      { id: 'exec-dddddddd-4', at: '2026-01-01T07:00:00Z', value: '13', hasFinding: true, status: 'completed' },
    ] },
  },
}
const bundle = { id: 'b1', templateTitle: 'CVC bundle', departmentEl: 'ΜΕΘ', departmentId: 'dep-icu', date: '2026-10-01', failedCount: 2, applicableCount: 5, status: 'completed' }

describe('deviation queue', () => {
  it('lists recent control findings and failed bundles without a CAPA', () => {
    const items = deviationQueue({ controls: [control], bundles: [bundle], capas: [], now })
    expect(items.map((x) => x.key)).toEqual(['control:exec-aaaaaaaa-1', 'bundle:b1'])
    expect(items[0]).toMatchObject({ priority: 'high', department: 'ΜΕΘ', departmentId: 'dep-icu', detail: '11.5 °C' })
  })

  it('drops deviations that a CAPA already points to, unless the CAPA was voided', () => {
    const sourceId = controlSourceId(control, control.assignments.ΜΕΘ.history[0])
    expect(deviationQueue({ controls: [control], capas: [{ sourceId }], now })).toEqual([])
    expect(deviationQueue({ controls: [control], capas: [{ sourceId, lifecycleStatus: 'voided' }], now })).toHaveLength(1)
    expect(deviationQueue({ bundles: [bundle], capas: [{ sourceId: bundleSourceId(bundle) }], now })).toEqual([])
  })

  it('turns deviation actions into CAPA steps', () => {
    const [item] = deviationQueue({ controls: [control], now })
    const prefill = capaPrefill(item, 'el')
    expect(prefill).toMatchObject({ source: 'control', departmentId: 'dep-icu', priority: 'high' })
    expect(prefill.subActions.map((s) => s.title)).toEqual(['Μεταφορά εμβολίων', 'Ενημέρωση φαρμακείου'])
    expect(sourcePath(prefill.sourceId)).toBe('/controls/CTRL-DEMO-0001')
    expect(sourcePath(bundleSourceId(bundle))).toBe('/prevention/bundles/b1')
  })

  it('counts progress and overdue steps', () => {
    const steps = [{ id: 1, done: true }, { id: 2, done: false, dueDate: '2026-10-01' }, { id: 3, done: false, dueDate: '2026-10-30' }]
    expect(subActionProgress(steps)).toEqual({ total: 3, done: 1, open: 2 })
    expect(overdueSubActions(steps, '2026-10-08').map((s) => s.id)).toEqual([2])
  })
})
