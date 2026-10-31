import { describe, expect, it } from 'vitest'
import { CARPA_TEMPLATES } from '../src/features/controls/carpaTemplate'
import { catalogueForDepartment, parseCatalogueLines, daysToExpiry, prefilledExpiryRows, expiryAlerts, expiryCounts, expiryItems, expiryState, expiryWindow, impliedFinding, isExpiryControl, markRowRemoved, noteText, quantityShort } from '../src/features/controls/controlExpiry'

const now = new Date(2026, 9, 15, 10, 0)
const record = {
  id: 'CTRL-1',
  departments: ['ΜΕΘ', 'ΤΕΠ'],
  // A list (one listed item without a date): the departments keep stock, not findings.
  responseConfig: { mode: 'list', template: 'medication_expiry', expiryBeforeDays: 30, expiryAfterDays: 7, expiryCatalogue: [{ item: 'Adrenaline', quantity: '1' }] },
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

  it('fills the finding an expiry date implies, as a code whatever the screen language', () => {
    expect(impliedFinding({ expiry: '2026-10-12' }, { before: 30, after: 7 }, now)).toBe('expired')
    expect(impliedFinding({ expiry: '2026-10-20' }, { before: 30, after: 7 }, now)).toBe('expiring')
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
      { item: 'Adrenaline 1mg/ml', quantity: '10', form: 'ampoule', expiry: '2026-12-31', note: 'Στο τροχήλατο', category: '', ingredient: '' },
      { item: 'Σύριγγες 10ml', quantity: '120', form: 'piece', expiry: '', note: '', category: '', ingredient: '' },
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

describe('expected quantity and category of listed items', () => {
  const window = { before: 30, after: 7 }
  it('flags a shortage only when both counts are known and fewer were found', () => {
    expect(quantityShort({ expected: '5', quantity: '3' })).toBe(true)
    expect(quantityShort({ expected: '5', quantity: '5' })).toBe(false)
    expect(quantityShort({ expected: '', quantity: '3' })).toBe(false)
    expect(quantityShort({ expected: '5', quantity: '' })).toBe(false)
  })
  it('implies expired first, then shortage, then near expiry', () => {
    expect(impliedFinding({ expiry: '2026-10-01', expected: '5', quantity: '1' }, window, now)).toBe('expired')
    expect(impliedFinding({ expiry: '2026-10-20', expected: '5', quantity: '1' }, window, now)).toBe('shortage')
    expect(impliedFinding({ expiry: '2026-10-20', expected: '5', quantity: '5' }, window, now)).toBe('expiring')
  })
  it('keeps the list quantity as expected and the category on a new entry', () => {
    const listed = { responseConfig: { mode: 'list', template: 'medication_expiry', expiryCatalogue: [{ id: 'c1', item: 'ADRENALINE amp', quantity: '15', category: 'medicine', ingredient: 'Αδρεναλίνη', departments: [] }] }, assignments: {} }
    const [row] = prefilledExpiryRows(listed, 'ΤΕΠ')
    expect(row).toMatchObject({ item: 'ADRENALINE amp', expected: '15', category: 'medicine', ingredient: 'Αδρεναλίνη' })
  })
  it('reads category and active substance from pasted lines', () => {
    const [row] = parseCatalogueLines('ADRENALINE amp\t15\tΦύσιγγα\t\t\tΦάρμακο\tΑδρεναλίνη')
    expect(row).toMatchObject({ item: 'ADRENALINE amp', quantity: '15', form: 'ampoule', category: 'medicine', ingredient: 'Αδρεναλίνη' })
  })
})

describe('standard trolley and tray lists', () => {
  const byKey = key => CARPA_TEMPLATES.find(entry => entry.key === key).items
  it('lists the 14 medicines and 29 supplies (with the oxygen cylinder) of the trolley, without its intubation tray with expected quantities', () => {
    expect(byKey('trolley').filter(entry => entry.category === 'medicine')).toHaveLength(14)
    expect(byKey('trolley').filter(entry => entry.category === 'supply')).toHaveLength(29)
    expect(byKey('trolley').find(entry => entry.item === 'ADRENALINE amp')).toMatchObject({ quantity: '15', ingredient: 'Αδρεναλίνη' })
  })
  it('has the three intubation trays from the department forms', () => {
    expect(byKey('adult-tray')).toHaveLength(13)
    expect(byKey('neonate-tray')).toHaveLength(15)
    expect(byKey('maternity-neonate-tray')).toHaveLength(21)
  })
  it('gives every item a category, a positive quantity and an English note wherever there is a note', () => {
    for (const { items } of CARPA_TEMPLATES) for (const entry of items) {
      expect(['medicine', 'supply']).toContain(entry.category)
      expect(Number(entry.quantity)).toBeGreaterThan(0)
      expect(Boolean(entry.note)).toBe(Boolean(entry.noteEn))
    }
  })
  it('shows the English note in English until the note is edited', () => {
    expect(noteText({ note: 'ανά μέγεθος', noteEn: 'per size' }, 'en')).toBe('per size')
    expect(noteText({ note: 'ανά μέγεθος', noteEn: 'per size' }, 'el')).toBe('ανά μέγεθος')
    expect(noteText({ note: 'άλλο', noteEn: '' }, 'en')).toBe('άλλο')
  })

  it('treats a department without a list as findings of each check: not counted, not carried to the next check', () => {
    const findings = { ...record, responseConfig: { ...record.responseConfig, expiryCatalogue: [] } }
    const items = expiryItems(findings, ['ΜΕΘ'], now)
    // Every row of every check that was not voided, latest check first (even a removed one: it was found).
    expect(items.map(item => item.row.item)).toEqual(['Adrenaline', 'Atropine', 'Heparin', 'Saline'])
    expect(items.every(item => item.state === 'finding' && !item.alert)).toBe(true)
    expect(expiryCounts(items)).toEqual({ expired: 0, expiring: 0, alerting: 0 })
    expect(expiryAlerts([findings], { now })).toHaveLength(0)
    expect(prefilledExpiryRows(findings, 'ΜΕΘ')).toEqual([])
  })
})
