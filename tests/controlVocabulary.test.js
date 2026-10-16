import { describe, expect, it } from 'vitest'
import { answerLabel, canonicalAnswer, categoryPreset, checklistScore, checklistSummary, choiceOptions, controlTypeCode, expiryFindingCode, expiryFindingLabel, isFindingAnswer, rowFindingText } from '../src/features/controls/controlVocabulary'
import { checklistRows, listHasFinding, structuredSummary } from '../src/features/controls/controlStructured'

describe('control vocabulary', () => {
  it('maps library control types and older category names to one result format', () => {
    expect(controlTypeCode('Έλεγχος θερμοκρασίας')).toBe('CTRL-TEMP')
    expect(controlTypeCode('Θερμοκρασίες')).toBe('CTRL-TEMP')
    expect(controlTypeCode('Δικό μας', [{ value: 'Δικό μας', el: 'Δικό μας', en: 'Ours', code: 'CTRL-AUDIT' }])).toBe('CTRL-AUDIT')
    expect(categoryPreset('Λήξεις')).toMatchObject({ mode: 'list', template: 'medication_expiry' })
    expect(categoryPreset('Επιθεώρηση με λίστα ελέγχου')).toMatchObject({ mode: 'checklist' })
    expect(categoryPreset('Κάτι άλλο')).toBeNull()
  })

  it('stores status answers in Greek whatever the screen language and knows which are findings', () => {
    expect(canonicalAnswer('Non-compliant')).toBe('Μη συμμόρφωση')
    const response = { options: ['Συμμορφώνεται', 'Non-compliant'] }
    expect(choiceOptions(response).map(x => x.value)).toEqual(['Συμμορφώνεται', 'Μη συμμόρφωση'])
    expect(isFindingAnswer(response, 'Non-compliant')).toBe(true)
    expect(isFindingAnswer(response, 'Συμμορφώνεται')).toBe(false)
    expect(isFindingAnswer({ options: ['Α', 'Β'], reportOn: ['Β'] }, 'Β')).toBe(true)
    expect(answerLabel('Μη συμμόρφωση', 'en')).toBe('Non-compliant')
  })

  it('keeps expiry findings as codes and reads entries saved with labels', () => {
    expect(expiryFindingCode('Ληγμένο')).toBe('expired')
    expect(expiryFindingCode('Near expiry')).toBe('expiring')
    expect(expiryFindingCode('expired')).toBe('expired')
    expect(expiryFindingLabel('expiring', 'en')).toBe('Near expiry')
    expect(rowFindingText({ finding: 'other', findingOther: 'Σπασμένη φύσιγγα' })).toBe('Σπασμένη φύσιγγα')
    expect(rowFindingText({ finding: 'Άλλο', findingOther: '' })).toBe('Άλλο')
  })

  it('scores a checklist without the items that do not apply', () => {
    const rows = [{ answer: 'yes' }, { answer: 'no' }, { answer: 'na' }, { answer: 'yes' }]
    expect(checklistScore(rows)).toMatchObject({ applicable: 3, yes: 2, no: 1, rate: 67 })
    expect(checklistSummary(rows)).toBe('2/3 συμμόρφωση (67%)')
    expect(listHasFinding(rows)).toBe(true)
    expect(listHasFinding([{ answer: 'yes' }, { answer: '' }])).toBe(false)
    expect(structuredSummary({ structuredData: { template: 'checklist', rows } }, { language: 'en' })).toBe('2/3 compliant (67%)')
  })

  it('opens a checklist entry with one row per item of the control', () => {
    const record = { responseConfig: { mode: 'checklist', checklist: [{ id: 'a', el: 'Αντισηπτικό', en: 'Hand rub' }, { id: 'b', el: ' ' }] } }
    expect(checklistRows(record)).toEqual([{ id: 'a', item: 'Αντισηπτικό', itemEn: 'Hand rub', required: true, answer: '', note: '' }])
  })
})
