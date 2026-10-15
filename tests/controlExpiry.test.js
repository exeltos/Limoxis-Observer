import { describe, expect, it } from 'vitest'
import { catalogueForDepartment, parseCatalogueLines, daysToExpiry, prefilledExpiryRows, expiryAlerts, expiryCounts, expiryItems, expiryState, expiryWindow, impliedFinding, isExpiryControl, markRowRemoved } from '../src/features/controls/controlExpiry'

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

  it('lets a newer entry of an item replace the earlier one', () => {
    const later = { ...record, assignments: { ...record.assignments, 'ΤΕΠ': { history: [
      { id: 'n2', at: '2026-10-10', status: 'completed', structuredData: { rows: [{ item: 'naloxone', expiry: '2027-01-01' }] } },
      { id: 'n1', at: '2026-09-01', status: 'completed', structuredData: { rows: [{ item: 'Naloxone', expiry: '2026-09-01' }] } },
    ] } } }
    const items = expiryItems(later, ['ΤΕΠ'], now)
    expect(items).toHaveLength(1)
    expect(items[0].row.expiry).toBe('2027-01-01')
  })

  it('opens each entry with the listed items and their last lot and expiry', () => {
    const listed = { ...record, responseConfig: { ...record.responseConfig, expiryCatalogue: [
      { id: 'c1', item: 'Adrenaline', form: 'ampoule', expiry: '2027-05-01', departments: [] },
      { id: 'c2', item: 'Atropine', departments: ['ΜΕΘ'] },
      { id: 'c3', item: 'Naloxone', departments: ['ΤΕΠ'] },
    ] } }
    expect(catalogueForDepartment(listed, 'ΜΕΘ').map(entry => entry.item)).toEqual(['Adrenaline', 'Atropine'])
    const rows = prefilledExpiryRows(listed, 'ΜΕΘ')
    expect(rows[0]).toMatchObject({ item: 'Adrenaline', form: 'ampoule', expiry: '2026-10-20', fromCatalogue: true })
    // Atropine was marked as removed last time: its row starts empty.
    expect(rows[1]).toMatchObject({ item: 'Atropine', expiry: '', lot: '' })
  })

  it('shows listed items with the list expiry until an entry records them', () => {
    const listed = { ...record, responseConfig: { ...record.responseConfig, expiryCatalogue: [
      { id: 'c1', item: 'Adrenaline', expiry: '2027-05-01', departments: [] },
      { id: 'c9', item: 'Midazolam', form: 'ampoule', quantity: '5', expiry: '2026-10-13', departments: ['ΜΕΘ'] },
    ] } }
    const items = expiryItems(listed, ['ΜΕΘ'], now)
    const midazolam = items.find(item => item.row.item === 'Midazolam')
    expect(midazolam).toMatchObject({ source: 'list', execution: null, state: 'expired' })
    // Adrenaline was recorded by an entry: the entry wins over the list.
    expect(items.filter(item => item.row.item === 'Adrenaline')).toHaveLength(1)
    expect(items.find(item => item.row.item === 'Adrenaline').source).toBe('entry')
  })

  it('reads rows pasted from a spreadsheet', () => {
    expect(parseCatalogueLines('Adrenaline 1mg/ml\t10\tΦύσιγγα\t31/12/2026\tΣτο τροχήλατο\nΣύριγγες 10ml;120;τεμάχιο\n\n')).toEqual([
      { item: 'Adrenaline 1mg/ml', quantity: '10', form: 'ampoule', expiry: '2026-12-31', note: 'Στο τροχήλατο' },
      { item: 'Σύριγγες 10ml', quantity: '120', form: 'piece', expiry: '', note: '' },
    ])
  })

  it('carries the list forward: items an entry added stay, removed ones leave', () => {
    const listed = { ...record, responseConfig: { ...record.responseConfig, expiryCatalogue: [{ id: 'c1', item: 'Adrenaline', departments: [] }] },
      assignments: { 'ΜΕΘ': { history: [
        { id: 'e2', at: '2026-10-10', status: 'completed', structuredData: { rows: [
          { item: 'Adrenaline', lot: 'A2', expiry: '2027-01-01' },
          { item: 'Laryngoscope blade', form: 'piece', lot: 'L1', expiry: '2028-01-01' },
          { item: 'Old gauze', expiry: '2026-12-01', removedAt: '2026-10-10' },
        ] } },
        { id: 'e1', at: '2026-09-10', status: 'completed', structuredData: { rows: [{ item: 'Old gauze', expiry: '2026-12-01' }] } },
      ] } } }
    const rows = prefilledExpiryRows(listed, 'ΜΕΘ')
    expect(rows.map(row => row.item)).toEqual(['Adrenaline', 'Laryngoscope blade'])
    expect(rows[1]).toMatchObject({ form: 'piece', lot: 'L1', fromCatalogue: true, previous: { lot: 'L1', expiry: '2028-01-01', quantity: '' } })
    expect(expiryItems(listed, ['ΜΕΘ'], now).map(item => item.row.item)).not.toContain('Old gauze')
  })

  it('marks replacements, quantity updates and new items on the change form', async () => {
    const { expiryRowChange } = await import('../src/features/controls/controlExpiryPrint')
    const previous = { quantity: '10', lot: 'A1', expiry: '2026-10-09' }
    expect(expiryRowChange({ item: 'x', fromCatalogue: true, previous, quantity: '10', lot: 'A2', expiry: '2027-08-31' })).toBe('replaced')
    expect(expiryRowChange({ item: 'x', fromCatalogue: true, previous, quantity: '9', lot: 'A1', expiry: '2026-10-09' })).toBe('updated')
    expect(expiryRowChange({ item: 'x', fromCatalogue: true, previous, ...previous })).toBe('unchanged')
    expect(expiryRowChange({ item: 'y', quantity: '1', expiry: '2028-01-01' })).toBe('new')
    expect(expiryRowChange({ item: 'x', fromCatalogue: true, previous, ...previous, removedAt: '2026-10-15' })).toBe('removed')
  })
})
