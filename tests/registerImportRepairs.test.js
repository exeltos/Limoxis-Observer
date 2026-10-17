import { describe, expect, it } from 'vitest'
import { EMPTY_VALUE, planImport, repairNumber, suggestMapping, suggestOption, toGestation, toYesNo, valueMappings, withTemplateHints } from '../src/features/registers/registerImport'
import { registerFromTemplate } from '../src/features/registers/registerTemplates'

// A register created before the template learned its FileMaker names: no aliases, no option beginnings.
const stale = key => { const fresh = registerFromTemplate(key, { department: 'X', departmentId: 'X' }); return { ...fresh, fields: fresh.fields.map(field => ({ ...field, aliases: [], options: (field.options || []).map(option => ({ ...option, match: [] })) })) } }

describe('Register import: what FileMaker exports really look like', () => {
  it('reads the template’s FileMaker names for a register made from an older copy', () => {
    const register = stale('icu')
    expect(suggestMapping(register, ['ICU PATIENT CATEGORY', 'EUROSCORE'])).toEqual(['category', 'euroscore'])
    expect(withTemplateHints(register).fields.find(field => field.key === 'outcome').options.find(option => option.value === 'transfer_ward').match).toContain('ΜΕΤΑΦΟΡΑ')
  })

  it('matches list values typed with the keyboard on English, doubled or missing letters', () => {
    const antenatal = withTemplateHints(registerFromTemplate('obstetrics')).fields.find(field => field.key === 'antenatal')
    expect(suggestOption(antenatal, 'DEN TO GNVRIZE')).toBe('not_aware')
    expect(suggestOption(antenatal, 'ΔΕΝ ΤΟ ΓΝΩΡΙΙΖΕ')).toBe('not_aware')
    expect(suggestOption(antenatal, 'ΔΕΝ ΤΟ ΝΩΡΙΖΕ')).toBe('not_aware')
    expect(suggestOption(antenatal, 'ΤΑ ΠΑΡΑΚΟΛΟΥΘΗΣΕ ΔΙΑΔΙΚΤΥΑΚΑ')).toBe('attended')
    const outcome = registerFromTemplate('nicu').fields.find(field => field.key === 'outcome')
    expect(suggestOption(outcome, 'ΕΕΞΟΔΟΣ')).toBe('home')
    expect(suggestOption(outcome, 'ΦΙΛΟΞΕΝΙΑ')).toBe('')
  })

  it('repairs a number written twice, and a lost decimal point only where the field allows it', () => {
    expect(repairNumber({ min: 300, max: 6000 }, 850850)).toBe(850)
    expect(repairNumber({ min: 300, max: 6000 }, 3320)).toBe(3320)
    expect(repairNumber({ min: 0, max: 100 }, 242)).toBe(242)
    expect(repairNumber({ min: 0, max: 100, repair: 'decimal' }, 242)).toBe(2.42)
    expect(repairNumber({ min: 0, max: 100, repair: 'decimal' }, 1336)).toBe(13.36)
  })

  it('counts a neonate without an admission date on its discharge date, and says so', () => {
    const register = registerFromTemplate('nicu')
    const headers = ['ΑΡΙΘΜΟΣ ΠΕΡΙΣΤΑΤΙΚΟΥ', 'ΗΜΕΡΟΜΗΝΙΑ ΕΙΣΑΓΩΓΗΣ ΜΕΝΝ', 'ΗΜΕΡΟΜΗΝΙΑ ΕΞΟΔΟΥ ΑΠΟ ΤΗ ΜΕΝΝ', 'ΒΑΡΟΣ ΕΙΣΟΔΟΥ']
    const plan = planImport(register, headers, [['1', '', '2026-03-10', 900900], ['2', '2026-03-01', '2026-03-12', 3000]], suggestMapping(register, headers))
    expect(plan.counts.ready).toBe(2)
    expect(plan.items[0].entry.values).toMatchObject({ admission_date: '2026-03-10', birth_weight: 900 })
    expect(plan.issues.map(issue => issue.text).join(' ')).toMatch(/Χωρίς ημερομηνία/)
  })

  it('offers lines without a shift as «(empty)», counted where the user puts them', () => {
    const register = registerFromTemplate('emergency')
    const headers = ['Ημερομηνία', 'ΒΑΡΔΙΑ', 'ΧΕΙΡΟΥΡΓΕΙΑ']
    const rows = [['2026-03-01', '07:00-15:00', 4], ['2026-03-01', '', 2]]
    const mapping = suggestMapping(register, headers)
    expect(valueMappings(register, headers, rows, mapping)['sheet.measure'].values.map(item => item.value)).toContain(EMPTY_VALUE)
    expect(planImport(register, headers, rows, mapping).skipped.noMeasure).toBe(1)
    const placed = planImport(register, headers, rows, mapping, { valueMap: { 'sheet.measure': { [EMPTY_VALUE]: 'night' } } })
    expect(placed.items[0].entry.values.surgical).toEqual({ morning: 4, night: 2 })
  })

  it('finds a column by its words when FileMaker names it differently', () => {
    const register = { kind: 'case', fields: [{ key: 'cpap_days', type: 'number', label: 'Ημέρες σε CPAP' }, { key: 'tpn_days', type: 'number', label: 'Ημέρες TPN' }, { key: 'central_line_days', type: 'number', label: 'Ημέρες φλεβικού καθετήρα' }], settings: {} }
    expect(suggestMapping(register, ['ΔΙΑΡΚΕΙΑ ΣΤΟ CPAP', 'ΔΙΑΡΚΕΙΑ TPN', 'ΔΙΑΡΚΕΙΑ ΦΛΕΒΙΚΟΥ ΚΑΘΕΤΗΡΑ', 'ΦΕΡΕΙ PICC _ LINE'])).toEqual(['cpap_days', 'tpn_days', 'central_line_days', ''])
  })

  it('reads Latin look-alikes, a yes with a note, counts as yes and a lost gestation point', () => {
    const delivery = registerFromTemplate('nicu').fields.find(field => field.key === 'delivery')
    expect(suggestOption(delivery, 'K.T')).toBe('cs')
    expect(suggestOption(delivery, 'ΔΙΑ ΣΙΚΥΟΥΛΚΙΑΣ')).toBe('vaginal')
    expect(toYesNo('OXI', true)).toBe(false)
    expect(toYesNo('ΝΑΙ ( ΔΩΡΕΑ ΩΑΡΙΩΝ )', true)).toBe(true)
    expect(toYesNo(0, true)).toBe(false)
    expect(toYesNo(3, true)).toBe(true)
    expect(toGestation('375')).toBe(37 * 7 + 5)
    expect(toGestation(37.4)).toBe(37 * 7 + 4)
  })

  it('brings options the template gained after the register was made, marked for the register', () => {
    const register = stale('nicu')
    const reasons = withTemplateHints({ ...register, fields: register.fields.map(field => (field.key === 'admission_reason' ? { ...field, options: field.options.filter(option => option.value !== 'low_weight') } : field)) }).fields.find(field => field.key === 'admission_reason')
    expect(reasons.options.find(option => option.value === 'low_weight')).toMatchObject({ fromTemplate: true })
    expect(suggestOption(reasons, 'Χαμηλό Β.Γ - IUGR')).toBe('low_weight')
  })
})
