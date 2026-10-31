import { describe, expect, it } from 'vitest'
import { apacheMortality, breakdown, computeIndicator, sheetCoverage, computeValues, daysBetween, fieldVisible, formatValue, gestationText, indicatorReport, keyFrom, monthlySeries, parseGestation, periodLabel, periodOf, shiftPeriod, validateEntry } from '../src/features/registers/registerEngine'
import { REGISTER_TEMPLATES, registerFromTemplate } from '../src/features/registers/registerTemplates'
import { demoRegisterEntries, demoRegisters } from '../src/features/registers/registerDemoData'

const nicu = registerFromTemplate('nicu')
const indicator = id => nicu.indicators.find(item => item.id === id)
const entry = (values, extra = {}) => ({ id: Math.random().toString(36), entryDate: values.admission_date, values, ...extra })
const march = periodOf('month', '2026-03-10')

describe('department register fields', () => {
  it('computes length of stay and age on admission from the dates', () => {
    const values = computeValues(nicu.fields, { birth_date: '2026-03-01', admission_date: '2026-03-03', discharge_date: '2026-03-20' })
    expect(values.length_of_stay).toBe(17)
    expect(values.age_on_admission).toBe(2)
    expect(computeValues(nicu.fields, { admission_date: '2026-03-03' }).length_of_stay).toBeNull()
    expect(daysBetween('2026-02-27', '2026-03-02')).toBe(3)
  })

  it('reads gestation as weeks+days, never as a decimal', () => {
    expect(parseGestation('37+4')).toBe(263)
    expect(parseGestation('37')).toBe(259)
    expect(parseGestation('37+9')).toBeNull()
    expect(gestationText(263)).toBe('37+4')
    expect(formatValue(nicu.fields.find(f => f.key === 'gestation'), 263)).toBe('37+4 εβδ.')
  })

  it('stops a weight outside the limits and warns on an unusual one', () => {
    const base = { admission_date: '2026-03-03', birth_date: '2026-03-03', delivery: 'cs' }
    expect(validateEntry(nicu.fields, { ...base, birth_weight: 33200 }).errors.birth_weight).toMatch(/Το πολύ 6000/)
    expect(validateEntry(nicu.fields, { ...base, birth_weight: 450 }).warnings.birth_weight).toBeTruthy()
    expect(validateEntry(nicu.fields, { ...base, birth_weight: 3320 }).valid).toBe(true)
    expect(validateEntry(nicu.fields, { ...base }).errors.birth_weight).toBe('Υποχρεωτικό')
  })

  it('reads APACHE II mortality from the score band and the operative status', () => {
    expect(apacheMortality(5, true)).toBe(3)
    expect(apacheMortality(35, false)).toBe(85)
    expect(apacheMortality(50, true)).toBe(88)
    expect(apacheMortality(12, null)).toBeNull()
    const fields = [{ key: 'score', type: 'number' }, { key: 'postop', type: 'yesNo' }, { key: 'mortality', type: 'computed', computed: 'apacheII', from: 'score', to: 'postop' }]
    expect(computeValues(fields, { score: 22, postop: false }).mortality).toBe(40)
  })

  it('asks for a field required from a date only on cases from that date on', () => {
    const fields = nicu.fields.map(f => (f.key === 'birth_weight' ? { ...f, requiredFrom: '2024-01-01' } : f))
    const base = { birth_date: '2019-05-02', delivery: 'cs' }
    expect(validateEntry(fields, { ...base, admission_date: '2019-05-02' }, 'el', '2019-05-02').errors.birth_weight).toBeUndefined()
    expect(validateEntry(fields, { ...base, admission_date: '2024-01-01' }, 'el', '2024-01-01').errors.birth_weight).toBe('Υποχρεωτικό')
  })

  it('keeps discharge after admission and shows the outcome only after discharge', () => {
    const result = validateEntry(nicu.fields, { admission_date: '2026-03-10', birth_date: '2026-03-10', delivery: 'cs', birth_weight: 3000, discharge_date: '2026-03-01' })
    expect(result.errors.discharge_date).toMatch(/Όχι πριν/)
    const outcome = nicu.fields.find(f => f.key === 'outcome')
    expect(fieldVisible(outcome, {})).toBe(false)
    expect(fieldVisible(outcome, { discharge_date: '2026-03-12' })).toBe(true)
  })
})

describe('department register indicators', () => {
  const entries = [
    entry({ admission_date: '2026-03-02', delivery: 'cs', discharge_date: '2026-03-12', outcome: 'home', central_line_days: 10, late_infection: true }),
    entry({ admission_date: '2026-03-05', delivery: 'cs', discharge_date: '2026-03-25', outcome: 'death', central_line_days: 10 }),
    entry({ admission_date: '2026-03-07', delivery: 'vaginal' }),
    entry({ admission_date: '2026-03-09', delivery: '' }),
    entry({ admission_date: '2026-04-01', delivery: 'cs' }),
  ]

  it('counts the cases of the period and the % of caesareans among those with a delivery mode', () => {
    expect(computeIndicator(nicu, indicator('admissions'), entries, march).value).toBe(4)
    const cs = computeIndicator(nicu, indicator('cs_rate'), entries, march)
    expect([cs.numerator, cs.denominator, cs.value]).toEqual([2, 3, 66.7])
    expect(cs.small).toBe(true)
  })

  it('averages length of stay over the discharged only, in the month of discharge', () => {
    const result = computeIndicator(nicu, indicator('mean_los'), entries, march)
    expect(result.value).toBe(15)
    expect(result.numerator).toBe(2)
  })

  it('computes a rate per 1,000 device days', () => {
    const result = computeIndicator(nicu, indicator('late_infection_rate'), entries, march)
    expect([result.numerator, result.denominator, result.value]).toEqual([1, 20, 50])
  })

  it('compares with the target: on target, attention, past the threshold', () => {
    const mortality = { ...indicator('mortality'), target: 2, threshold: 4 }
    expect(computeIndicator(nicu, mortality, entries, march).status).toBe('breach')
    expect(computeIndicator(nicu, { ...mortality, target: 60, threshold: 70 }, entries, march).status).toBe('onTarget')
    expect(computeIndicator(nicu, { ...mortality, target: 40, threshold: 70 }, entries, march).status).toBe('attention')
    expect(computeIndicator(nicu, indicator('admissions'), entries, march).status).toBe('context')
  })

  it('splits by a list field, with a «no value» row', () => {
    const rows = breakdown(nicu, indicator('admissions'), entries, march, 'delivery')
    expect(rows.map(row => [row.option.value, row.count])).toEqual([['vaginal', 1], ['cs', 2], ['', 1]])
  })

  it('reports this period, the previous one and the same one last year', () => {
    const report = indicatorReport(nicu, entries, periodOf('month', '2026-04-15'))
    const admissions = report.find(row => row.indicator.id === 'admissions')
    expect([admissions.current.value, admissions.previous.value, admissions.lastYear.value]).toEqual([1, 4, 0])
    expect(monthlySeries(nicu, indicator('admissions'), entries, 2026).slice(2, 4).map(point => point.value)).toEqual([4, 1])
  })
})

describe('monthly sheets', () => {
  const emergency = registerFromTemplate('emergency')
  const sheetEntries = [
    { id: 'a', periodStart: '2026-01-01', entryDate: '2026-01-01', values: { surgical: { morning: 90, night: 10 }, urgent: { morning: 45, night: 5 }, admissions: { morning: 0, afternoon: '' } } },
    { id: 'b', periodStart: '2026-02-01', entryDate: '2026-02-01', values: { surgical: { morning: 80, afternoon: 20 } } },
  ]
  const q1 = periodOf('quarter', '2026-02-10')
  const of = id => emergency.indicators.find(item => item.id === id)

  it('sums rows × measures and keeps an empty cell apart from zero', () => {
    expect(computeIndicator(emergency, of('total'), sheetEntries, q1).value).toBe(250)
    expect(computeIndicator(emergency, of('admissions'), sheetEntries, q1).value).toBe(0)
    expect(computeIndicator(emergency, of('total'), [], q1).value).toBeNull()
  })

  it('computes the share of a measure (a shift) and of a row', () => {
    expect(computeIndicator(emergency, of('night_share'), sheetEntries, q1).value).toBe(6)
    const ophthalmology = registerFromTemplate('ophthalmology')
    const cataracts = ophthalmology.indicators.find(item => item.id === 'cataract_share')
    expect(computeIndicator(ophthalmology, cataracts, [{ id: 'c', periodStart: '2026-01-01', entryDate: '2026-01-01', values: { cataract: { count: 30 }, vitrectomy: { count: 10 } } }], q1).value).toBe(75)
  })
})

describe('periods and templates', () => {
  it('builds months, quarters and years and steps back', () => {
    expect(periodOf('quarter', '2026-05-20')).toMatchObject({ from: '2026-04-01', to: '2026-06-30' })
    expect(periodOf('year', '2026-05-20')).toMatchObject({ from: '2026-01-01', to: '2026-12-31' })
    expect(shiftPeriod(periodOf('month', '2026-01-15'), -1)).toMatchObject({ from: '2025-12-01', to: '2025-12-31' })
    expect(shiftPeriod(periodOf('quarter', '2026-05-20'), -12).from).toBe('2025-04-01')
    expect(periodLabel(periodOf('quarter', '2026-05-20'))).toBe('2ο τρίμηνο 2026')
  })

  it('gives every template unique field keys and indicators that point at real fields', () => {
    for (const template of REGISTER_TEMPLATES) {
      const keys = (template.fields || []).map(field => field.key)
      expect(new Set(keys).size).toBe(keys.length)
      for (const item of template.indicators) {
        for (const filter of [...(item.filters || []), ...(item.denominatorFilters || [])]) expect(keys).toContain(filter.field)
        if (item.field) expect(keys).toContain(item.field)
        if (item.dateField) expect(keys).toContain(item.dateField)
        for (const rowKey of item.rows || []) expect(template.sheet.rows.map(row => row.key)).toContain(rowKey)
      }
    }
  })

  it('makes a stable key from a Greek label', () => {
    expect(keyFrom('Ημέρες TPN')).toBe('imeres_tpn')
    expect(keyFrom('Ημέρες TPN', ['imeres_tpn'])).toBe('imeres_tpn_2')
  })

  it('seeds a demo NICU register whose indicators all compute', () => {
    const today = '2026-10-16'
    const [register] = demoRegisters()
    const { entries, identities } = demoRegisterEntries(today)
    const own = entries.filter(item => item.registerId === register.id)
    expect(own.length).toBeGreaterThan(200)
    expect(own.every(item => identities[item.id])).toBe(true)
    expect(own.every(item => !('patientName' in item.values))).toBe(true)
    const report = indicatorReport(register, own, periodOf('year', '2026-06-01'))
    for (const row of report) expect(row.current.value).not.toBeNull()
  })
})

describe('the ICU register', () => {
  it('keeps General and Cardiac surgery patients apart, each with its own marker', async () => {
    const { caseMarker, registerThemeKey } = await import('../src/features/registers/registerThemes')
    const register = demoRegisters().find(item => item.templateKey === 'icu')
    expect(registerThemeKey(register)).toBe('icu')
    const own = demoRegisterEntries('2026-10-16').entries.filter(item => item.registerId === register.id)
    const cardiac = own.filter(item => item.values.category === 'cardiac'), general = own.filter(item => item.values.category === 'general')
    expect(cardiac.length).toBeGreaterThan(20)
    expect(general.length).toBeGreaterThan(20)
    expect(caseMarker(register, cardiac[0].values).tone).toBe('danger')
    expect(caseMarker(register, general[0].values).tone).toBe('info')
    expect(caseMarker(register, {})).toBeNull()
  })
  it('is recognised by its name too, and never mistaken for the NICU', async () => {
    const { registerThemeKey } = await import('../src/features/registers/registerThemes')
    expect(registerThemeKey({ name: 'Μητρώο ασθενών ΜΕΘ', nameEn: '', department: '' })).toBe('icu')
    expect(registerThemeKey({ name: 'Μητρώο νεογνών ΜΕΝΝ', nameEn: '', department: '' })).toBe('nicu')
    expect(registerThemeKey({ name: '', nameEn: 'NICU register', department: '' })).toBe('nicu')
    expect(registerThemeKey({ name: 'Μέθοδοι', nameEn: '', department: 'Παθολογική' })).toBe('')
  })
})

describe('SMR', () => {
  it('divides the deaths by the deaths the APACHE II risks add up to', () => {
    const icu = registerFromTemplate('icu')
    const smr = icu.indicators.find(item => item.id === 'smr')
    const risk = apacheMortality(30, true) / 100
    const stay = outcome => ({ values: { admission_date: '2026-03-01', discharge_date: '2026-03-10', apache_score: 30, apache_postop: true, outcome } })
    const result = computeIndicator(icu, smr, [stay('death'), stay('transfer_ward')], periodOf('month', '2026-03-10'))
    expect(result.numerator).toBe(1)
    expect(result.denominator).toBe(Number((2 * risk).toFixed(2)))
    expect(result.value).toBe(Number((1 / (2 * risk)).toFixed(2)))
    expect(result.small).toBe(true)
  })
  it('counts the pressure ulcers of the month of discharge', () => {
    const icu = registerFromTemplate('icu')
    const ulcers = icu.indicators.find(item => item.id === 'pressure_ulcers')
    const row = { values: { admission_date: '2026-02-20', discharge_date: '2026-03-04', pressure_ulcer: true } }
    expect(computeIndicator(icu, ulcers, [row], periodOf('month', '2026-03-10')).numerator).toBe(1)
    expect(computeIndicator(icu, ulcers, [row], periodOf('month', '2026-02-10')).n).toBe(0)
  })
})

describe('the paediatrics register', () => {
  it('computes the rates per 1,000 days from the stays and the lines', () => {
    const register = demoRegisters().find(item => item.templateKey === 'paediatrics')
    const own = demoRegisterEntries('2026-10-16').entries.filter(item => item.registerId === register.id)
    expect(own.length).toBeGreaterThan(300)
    expect(own.every(item => ['infant', 'toddler', 'child', 'adolescent'].includes(item.values.age_group))).toBe(true)
    const report = indicatorReport(register, own, periodOf('year', '2026-03-10'))
    for (const key of ['hai_rate', 'falls_rate', 'phlebitis_rate', 'isolation', 'mean_los']) expect(report.find(row => row.indicator.id === key).current.value).not.toBeNull()
    const rate = report.find(row => row.indicator.id === 'hai_rate').current
    expect(rate.value).toBe(Number(((rate.numerator / rate.denominator) * 1000).toFixed(2)))
  })
})

describe('the obstetrics register', () => {
  it('has its own look and a target on the caesarean rate in the demo', async () => {
    const { registerThemeKey } = await import('../src/features/registers/registerThemes')
    const register = demoRegisters().find(item => item.templateKey === 'obstetrics')
    expect(registerThemeKey(register)).toBe('obstetrics')
    expect(registerThemeKey({ name: 'Πράξεις Αίθουσας Τοκετών', nameEn: '', department: 'Μαιευτική', kind: 'sheet' })).toBe('')
    const cs = register.indicators.find(item => item.id === 'cs_rate')
    expect([cs.target, cs.threshold, cs.direction]).toEqual([55, 65, 'lower'])
    const own = demoRegisterEntries('2026-10-16').entries.filter(item => item.registerId === register.id)
    expect(own.length).toBeGreaterThan(400)
    expect(computeIndicator(register, cs, own, periodOf('year', '2026-03-10')).value).not.toBeNull()
  })
})

describe('daily sheets', () => {
  const endoscopy = registerFromTemplate('endoscopy')
  const find = id => endoscopy.indicators.find(item => item.id === id)
  const day = (periodStart, gastroscopy, ercp = 0) => ({ periodStart, values: { gastroscopy: { count: gastroscopy }, ercp: { count: ercp } } })
  it('reads the mean per day and the days recorded from the daily sheets only', () => {
    const entries = [{ periodStart: '2026-10-01', values: { gastroscopy: { count: 90 } } }, day('2026-11-02', 4), day('2026-11-03', 6, 1)]
    expect(computeIndicator(endoscopy, find('daily_mean'), entries, periodOf('month', '2026-11-10')).value).toBe(5.5)
    expect(computeIndicator(endoscopy, find('days_recorded'), entries, periodOf('month', '2026-11-10')).value).toBe(2)
    // A month recorded as one total has no day to average: nothing, not a wrong number.
    expect(computeIndicator(endoscopy, find('daily_mean'), entries, periodOf('month', '2026-10-10')).value).toBeNull()
    expect(computeIndicator(endoscopy, find('days_recorded'), entries, periodOf('month', '2026-10-10')).value).toBeNull()
    expect(computeIndicator(endoscopy, find('total'), entries, periodOf('month', '2026-10-10')).value).toBe(90)
  })
  it('shares the advanced procedures over all the procedures', () => {
    const result = computeIndicator(endoscopy, find('advanced_share'), [day('2026-11-02', 9, 1)], periodOf('month', '2026-11-10'))
    expect(result.value).toBe(10)
  })
  it('keeps the daily-only mark when the definition goes to the database and back', async () => {
    const { registerFromRows, registerRow, definitionRows } = await import('../src/features/registers/registerCloud')
    const rows = definitionRows(endoscopy, 'org-1')
    expect(rows.indicators.find(row => row.key === 'daily_mean').daily_only).toBe(true)
    expect(rows.indicators.find(row => row.key === 'total').daily_only).toBe(false)
    expect(typeof registerFromRows).toBe('function')
    expect(typeof registerRow).toBe('function')
  })
})

describe('the day a sheet starts being daily', () => {
  it('takes a month as its first day and any date as it is', async () => {
    const { dailyStart, DAILY_SHEETS_FROM } = await import('../src/features/registers/registerEngine')
    expect(DAILY_SHEETS_FROM).toBe('2026-11-01')
    expect(dailyStart(undefined)).toBe('2026-11-01')
    expect(dailyStart('2026-10')).toBe('2026-10-01')
    expect(dailyStart('2026-10-31')).toBe('2026-10-31')
  })
  it('splits a month at the start: its single total before, the days from it', () => {
    const ed = { ...registerFromTemplate('emergency'), sheet: { ...registerFromTemplate('emergency').sheet, dailyFrom: '2026-10-31' } }
    const total = ed.indicators.find(item => item.id === 'total')
    const entries = [{ periodStart: '2026-10-01', values: { surgical: { morning: 100 } } }, { periodStart: '2026-10-31', values: { surgical: { morning: 5 } } }]
    expect(computeIndicator(ed, total, entries, periodOf('month', '2026-10-10')).value).toBe(105)
    // The month is cut by the start: no coverage line, rather than a wrong one.
    expect(sheetCoverage(entries, periodOf('month', '2026-10-10'), '2026-10-31', '2026-10-31')).toBeNull()
    expect(sheetCoverage(entries, periodOf('month', '2026-11-10'), '2026-11-05', '2026-10-31')).toEqual({ unit: 'day', recorded: 0, expected: 5 })
  })
  it('keeps the start when the definition goes to the database', async () => {
    const { registerRow } = await import('../src/features/registers/registerCloud')
    const ed = { ...registerFromTemplate('emergency'), sheet: { ...registerFromTemplate('emergency').sheet, dailyFrom: '2026-10-31' } }
    expect(registerRow(ed, 'org-1').daily_from).toBe('2026-10-31')
    expect(registerRow(registerFromTemplate('emergency'), 'org-1').daily_from).toBeNull()
  })
})

describe('database shape', () => {
  it('writes every template row by row and reads the same register back', async () => {
    const { definitionRows, registerFromRows, registerRow } = await import('../src/features/registers/registerCloud')
    for (const template of REGISTER_TEMPLATES) {
      const register = registerFromTemplate(template.key, { departmentId: '2fe46b8b-d73a-4c2d-bc95-5817b4b0a5a7', department: 'ΜΕΝΝ' })
      const rows = definitionRows(register, 'org', 'reg')
      const fieldId = new Map(rows.fields.map((row, index) => [row.key, `f${index}`]))
      const indicatorId = new Map(rows.indicators.map((row, index) => [row.key, `i${index}`]))
      const back = registerFromRows({
        register: { id: 'reg', ...registerRow(register, 'org'), sheet_period: 'month', departments: { name: 'ΜΕΝΝ' } },
        sections: rows.sections,
        fields: rows.fields.map(row => ({ ...row, id: fieldId.get(row.key) })),
        options: rows.options.map(({ fieldKey, ...row }) => ({ ...row, field_id: fieldId.get(fieldKey) })),
        axes: rows.axes,
        indicators: rows.indicators.map(row => ({ ...row, id: indicatorId.get(row.key) })),
        filters: rows.filters.map(({ indicatorKey, ...row }) => ({ ...row, indicator_id: indicatorId.get(indicatorKey) })),
      })
      expect(back.fields).toEqual(register.fields)
      expect(back.indicators.map(item => ({ ...item, rows: item.rows || [] }))).toEqual(register.indicators.map(item => ({ ...item, filters: item.filters || [], denominatorFilters: item.denominatorFilters || [], rows: item.rows || [] })))
      if (register.kind === 'sheet') expect(back.sheet.rows).toEqual(register.sheet.rows)
      expect(back.settings.sections).toEqual(register.settings.sections)
    }
  })

  it('keeps the field keys usable as column names', () => {
    for (const template of REGISTER_TEMPLATES) {
      for (const field of template.fields || []) expect(field.key).toMatch(/^[a-z][a-z0-9_]{0,40}$/)
      // Columns every data table has already (department_register_fields.key check).
      for (const field of template.fields || []) expect(['id', 'organization_id', 'department_id', 'register_id', 'entry_date', 'period_start', 'status', 'locked', 'definition_version', 'created_by', 'created_at', 'updated_by', 'updated_at']).not.toContain(field.key)
      for (const field of template.fields || []) for (const option of field.options || []) expect(option.value).toMatch(/^[a-z0-9][a-z0-9_]{0,40}$/)
      for (const row of [...(template.sheet?.rows || []), ...(template.sheet?.measures || [])]) expect(row.key).toMatch(/^[a-z][a-z0-9_]{0,30}$/)
    }
  })
})

describe('how much of a period a sheet has', () => {
  const entries = [{ periodStart: '2026-01-01' }, { periodStart: '2026-03-01' }]
  it('counts the months of the period that have passed', () => {
    expect(sheetCoverage(entries, periodOf('quarter', '2026-03-10'), '2026-05-10', '2026-11')).toEqual({ unit: 'month', recorded: 2, expected: 3 })
  })
  it('counts days once the daily sheets start, up to today', () => {
    expect(sheetCoverage([{ periodStart: '2026-11-01' }, { periodStart: '2026-11-03' }], periodOf('month', '2026-11-10'), '2026-11-05', '2026-11')).toEqual({ unit: 'day', recorded: 2, expected: 5 })
  })
  it('says nothing for a period that mixes months and days, or has not started', () => {
    expect(sheetCoverage(entries, periodOf('year', '2026-11-10'), '2026-12-05', '2026-11')).toBeNull()
    expect(sheetCoverage(entries, periodOf('month', '2027-01-10'), '2026-12-05', '2026-11')).toBeNull()
  })
})

describe('the cath lab register', () => {
  const cath = registerFromTemplate('cathLab')
  const row = (values, date = '2026-03-10') => ({ id: Math.random().toString(36), entryDate: date, values: { date, ...values } })
  it('has its own look, in three sections', async () => {
    const { registerThemeKey } = await import('../src/features/registers/registerThemes')
    expect(registerThemeKey(cath)).toBe('cathlab')
    expect(registerThemeKey({ name: 'Πράξεις Αιμοδυναμικού', kind: 'case' })).toBe('cathlab')
    expect(cath.settings.sections.map(item => item.key)).toEqual(['procedure', 'patient', 'outcome'])
    expect(cath.fields.every(field => cath.settings.sections.some(item => item.key === field.section))).toBe(true)
  })
  it('reads urgent procedures and angioplasty in ST-elevation infarction', () => {
    const entries = [
      row({ procedures: ['angiography', 'angioplasty'], indication: 'stemi', urgent: true }),
      row({ procedures: ['angiography'], indication: 'stemi', urgent: true }),
      row({ procedures: ['angiography'], indication: 'stable', urgent: false }),
      row({ procedures: ['pacemaker'], indication: 'rhythm', urgent: false }),
    ]
    const find = id => cath.indicators.find(item => item.id === id)
    expect(computeIndicator(cath, find('urgent_share'), entries, march).value).toBe(50)
    expect(computeIndicator(cath, find('stemi_share'), entries, march).value).toBe(50)
    expect(computeIndicator(cath, find('primary_pci'), entries, march).value).toBe(50)
  })
  it('hides the indicators of answers nobody has recorded yet', () => {
    const entries = [row({ procedures: ['angiography'] }), row({ procedures: ['angiography'], urgent: true })]
    const ids = indicatorReport(cath, entries, march).map(item => item.indicator.id)
    expect(ids).toContain('urgent_share')
    expect(ids).not.toContain('stemi_share')
    expect(indicatorReport(cath, [], march).map(item => item.indicator.id)).toContain('stemi_share')
  })
  it('has demo cases with every answer recorded', () => {
    const demo = demoRegisters().find(item => item.templateKey === 'cathLab')
    const own = demoRegisterEntries('2026-10-16').entries.filter(item => item.registerId === demo.id)
    expect(own.length).toBeGreaterThan(400)
    expect(indicatorReport(demo, own, periodOf('year', '2026-03-10')).length).toBe(demo.indicators.length)
  })
})

describe('the chemotherapy register', () => {
  const chemo = registerFromTemplate('chemotherapy')
  const active = chemo.indicators.find(item => item.id === 'active_patients')
  const patient = (start, end = '', extra = {}) => ({ id: Math.random().toString(36), entryDate: start || '2026-10-19', values: { start_date: start, end_date: end, ...extra } })
  it('counts the patients on treatment on the last day of the period, not the ones recorded in it', () => {
    const entries = [patient('2026-01-10', '2026-02-20'), patient('2026-02-01'), patient('2026-03-30'), patient('2026-04-05')]
    expect(computeIndicator(chemo, active, entries, periodOf('month', '2026-03-10')).value).toBe(2)
    expect(computeIndicator(chemo, active, entries, periodOf('month', '2026-02-10')).value).toBe(1)
    expect(computeIndicator(chemo, active, entries, periodOf('month', '2026-04-10')).value).toBe(3)
  })
  it('counts a patient without a start date from the day recorded, and splits by diagnosis', () => {
    const entries = [patient('', '', { diagnosis: 'C50' }), patient('2026-10-01', '', { diagnosis: 'C50' }), patient('2026-10-02', '', { diagnosis: 'C34' })]
    const october = periodOf('month', '2026-10-25')
    expect(computeIndicator(chemo, active, entries, october).value).toBe(3)
    expect(computeIndicator(chemo, active, entries, periodOf('month', '2026-09-10')).value).toBe(0)
    const split = breakdown(chemo, active, entries, october, 'diagnosis')
    expect(split.map(row => [row.option.value, row.count])).toEqual([['C50', 2], ['C34', 1]])
  })
  it('hides the mean age while no birth date is known, and has its own look', async () => {
    const { registerThemeKey } = await import('../src/features/registers/registerThemes')
    expect(registerThemeKey(chemo)).toBe('chemo')
    const ids = indicatorReport(chemo, [patient('2026-10-01')], periodOf('month', '2026-10-10')).map(item => item.indicator.id)
    expect(ids).not.toContain('mean_age')
    expect(ids).toContain('active_patients')
    expect(chemo.settings.sections.map(item => item.key)).toEqual(['patient', 'treatment', 'end'])
  })
})
