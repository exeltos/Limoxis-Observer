import { describe, expect, it } from 'vitest'
import { daysToExpiry, expiryAlerts, expiryCounts, expiryItems, expiryState, expiryWindow, impliedFinding, isExpiryControl, markRowRemoved } from '../src/features/controls/controlExpiry'

const now = new Date(2026, 9, 15, 10, 0)
const record = {
  id: 'CTRL-1',
  departments: ['ΜΕΘ', 'ΤΕΠ'],
  responseConfig: { mode: 'list', template: 'medication_expiry', expiryBeforeDays: 30, expiryAfterDays: 7 },
  assignments: {
    'ΜΕΘ': { history: [
      { id: 'e2', status: 'completed', structuredData: { rows: [{ item: 'Adrenaline', expiry: '2026-10-20' }, { item: 'Atropine', expiry: '2026-10-05', removedAt: '2026-10-14' }] } },
      { id: 'e1', status: 'completed', structuredData: { rows: [{ item: 'Heparin', expiry: '2026-10-12' }, { item: 'Saline', expiry: '2027-03-01' }] } },
      { id: 'e0', status: 'cancelled', structuredData: { rows: [{ item: 'Voided', expiry: '2026-10-16' }] } },
    ] },
    'ΤΕΠ': { history: [{ id: 'e3', status: 'completed', structuredData: { rows: [{ item: 'Naloxone', expiry: '2026-09-01' }, { item: '', expiry: '' }] } }] },
  },
}

describe('control expiry tracking', () => {
  it('recognises expiry controls and reads their alert window', () => {
    expect(isExpiryControl(record)).toBe(true)
    expect(isExpiryControl({ responseConfig: { mode: 'list', template: 'generic_findings' } })).toBe(false)
    expect(expiryWindow(record)).toEqual({ before: 30, after: 7 })
    expect(expiryWindow({ responseConfig: {} })).toEqual({ before: 30, after: 7 })
  })

  it('counts days to expiry from ISO and dd/mm/yyyy dates', () => {
    expect(daysToExpiry('2026-10-20', now)).toBe(5)
    expect(daysToExpiry('12/10/2026', now)).toBe(-3)
    expect(daysToExpiry('', now)).toBe(null)
  })

  it('alerts before expiry and for the set days after it', () => {
    const window = { before: 30, after: 7 }
    expect(expiryState('2026-10-20', window, now)).toEqual({ state: 'expiring', days: 5, alert: true })
    expect(expiryState('2026-10-12', window, now)).toEqual({ state: 'expired', days: -3, alert: true })
    expect(expiryState('2026-09-01', window, now).alert).toBe(false)
    expect(expiryState('2027-03-01', window, now)).toMatchObject({ state: 'ok', alert: false })
  })

  it('keeps every listed item until it is removed, skipping voided entries', () => {
    const items = expiryItems(record, record.departments, now)
    expect(items.map(item => item.row.item)).toEqual(['Naloxone', 'Heparin', 'Adrenaline', 'Saline'])
    expect(expiryCounts(items)).toEqual({ expired: 2, expiring: 1, alerting: 2 })
  })

  it('marks one row of an entry as removed', () => {
    const execution = record.assignments['ΜΕΘ'].history[1]
    const next = markRowRemoved(execution, 0, { actorName: 'Ελένη', at: '2026-10-15T10:00:00Z' })
    expect(next.rows[0]).toMatchObject({ item: 'Heparin', removedAt: '2026-10-15T10:00:00Z', removedBy: 'Ελένη' })
    expect(next.rows[1].removedAt).toBeUndefined()
  })

  it('fills the finding an expiry date implies', () => {
    expect(impliedFinding({ expiry: '2026-10-12' }, { before: 30, after: 7 }, 'el', now)).toBe('Ληγμένο')
    expect(impliedFinding({ expiry: '2026-10-20' }, { before: 30, after: 7 }, 'en', now)).toBe('Near expiry')
  })

  it('raises one bell item per department with alerting items', () => {
    const alerts = expiryAlerts([record], { now })
    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toMatchObject({ type: 'expiry', to: '/controls/CTRL-1?tab=expiry', message: 'ΜΕΘ · 1 ληγμένο · 1 λήγει σύντομα' })
    expect(expiryAlerts([record], { now, canSee: (_, dep) => dep === 'ΤΕΠ' })).toHaveLength(0)
  })
})
