import { describe, expect, it } from 'vitest'
import { assignmentResponse, cleanDepartmentResponse, limitsText, responseVariants } from '../src/features/controls/controlResponse'
import { similarControls } from '../src/features/controls/controlSimilarity'
import { deviationActions } from '../src/features/controls/controlCriticality'

const record = {
  responseConfig: { mode: 'numeric', unit: '°C', min: '', max: '', deviationActions: 'Ενημέρωση προϊσταμένου' },
  assignments: {
    'Αιμοδοσία': { responseOverride: null },
    'Κεντρικά Εργαστήρια': { responseOverride: { min: 18, max: 25, deviationActions: 'Επικοινωνία με την Τεχνική Υπηρεσία' } },
  },
}

describe('limits and actions per department', () => {
  it('uses the control settings unless the department has its own', () => {
    expect(assignmentResponse(record, 'Αιμοδοσία')).toMatchObject({ min: '', max: '', deviationActions: 'Ενημέρωση προϊσταμένου' })
    expect(assignmentResponse(record, 'Κεντρικά Εργαστήρια')).toMatchObject({ min: 18, max: 25, unit: '°C' })
    expect(deviationActions(record, 'Κεντρικά Εργαστήρια')).toBe('Επικοινωνία με την Τεχνική Υπηρεσία')
    expect(deviationActions(record, 'Αιμοδοσία')).toBe('Ενημέρωση προϊσταμένου')
  })
  it('keeps only what differs from the control when saving', () => {
    const base = { min: 15, max: 25, deviationActions: 'Α' }
    expect(cleanDepartmentResponse({ min: 15, max: 25, deviationActions: 'Α' }, base)).toBeNull()
    expect(cleanDepartmentResponse({ min: 21, max: 25, deviationActions: 'Α' }, base)).toEqual({ min: 21 })
    expect(cleanDepartmentResponse({ min: '', max: 25 }, base)).toEqual({ min: '' })
    expect(cleanDepartmentResponse({ deviationActions: 'Β' }, base)).toEqual({ deviationActions: 'Β' })
    expect(cleanDepartmentResponse(null, base)).toBeNull()
  })
  it('writes the limits and counts the different settings', () => {
    expect(limitsText({ min: 18, max: 25, unit: '°C' })).toBe('18 – 25 °C')
    expect(limitsText({ min: 2, max: '', unit: '°C' })).toBe('≥ 2 °C')
    expect(limitsText({ min: '', max: 8, unit: '°C' })).toBe('≤ 8 °C')
    expect(limitsText({})).toBe('')
    expect(responseVariants(record, ['Αιμοδοσία', 'Κεντρικά Εργαστήρια'])).toBe(2)
    expect(responseVariants({ responseConfig: { min: 1 }, assignments: { Α: {}, Β: {} } }, ['Α', 'Β'])).toBe(1)
  })
})

describe('controls with a name the same in essence', () => {
  const controls = [
    { id: 'FM-CTRL-1276', title: 'ΚΑΤΑΓΡΑΦΗ ΘΕΡΜΟΚΡΑΣΙΑΣ ΧΩΡΩΝ' },
    { id: 'FM-CTRL-0001', title: 'Θερμοκρασία Ψυγείου' },
    { id: 'FM-CTRL-0006', title: 'Θερμοκρασία Φαρμάκων' },
    { id: 'FM-CTRL-0074', title: 'Φιάλες Οξυγόνου' },
  ]
  it('finds the same name whatever the case, accents or order', () => {
    expect(similarControls('Καταγραφή θερμοκρασίας χώρων', controls)[0]).toMatchObject({ same: true, control: { id: 'FM-CTRL-1276' } })
    expect(similarControls('ψυγείου θερμοκρασία', controls)[0].control.id).toBe('FM-CTRL-0001')
  })
  it('does not flag different controls that share one word, nor the control being edited', () => {
    expect(similarControls('Θερμοκρασία θαλάμου', controls)).toEqual([])
    expect(similarControls('Θερμοκρασία Ψυγείου', controls, { selfId: 'FM-CTRL-0001' })).toEqual([])
    expect(similarControls('Ψ', controls)).toEqual([])
  })
})
