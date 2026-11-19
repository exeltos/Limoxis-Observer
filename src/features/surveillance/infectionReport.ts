// «Αναφορά λοιμώξεων» (owner, 19/11/2026): a printed report of the infections the list shows now, from Surveillance
// (the episodes and their positive cultures) or from the Laboratory (the positive samples). The shared document
// layout (hospital band, facts, real tables, signatures), «Συνοπτική» or «Αναλυτική», with or without a comparison
// with another period, as the registers and the questionnaires print. By microorganism, resistance, site of the
// infection (or sample type), department and month, each with a bar. Without React, so that it is unit tested.
import { escapeHtml } from '../../core/export/reportDocument'
import { hospitalDay } from '../../core/dates/hospitalDate'
import { compareLabel, detailLabel, periodDates } from '../registers/registerReport'
import type { ReportCell, ReportDoc, ReportSection } from '../../core/export/reportDocument'
import type { ReportCompare, ReportDetail } from '../registers/registerReport'

// One line of the report: an episode (Surveillance) or a positive sample (Laboratory).
export type InfectionItem = {
  id: string
  code?: string
  // The day it counts on (the start of the episode, the collection of the sample): YYYY-MM-DD.
  date: string
  department?: string
  organism?: string
  resistance?: string
  // The site of the infection (Surveillance) or the sample type (Laboratory).
  group?: string
  // A healthcare-associated infection by its classification (Surveillance).
  hai?: boolean
  // The positive cultures behind the episode (Surveillance); a sample counts as one.
  positives?: number
  // Who it is about, only to count them (never printed).
  patientKey?: string
  // The status shown in the detailed list.
  status?: string
}
export type InfectionPeriod = { from: string, to: string }
// Patient days entered for a period (Management › Κλινοημέρες): the hospital's (no department) or a department's.
export type PatientDaysEntry = { from: string, to: string, value: number, department?: string | null }

export type InfectionReportInput = {
  source: 'surveillance' | 'laboratory'
  // Every item the screen's filters keep, at any date: the period and the comparison are cut here.
  items: InfectionItem[]
  period?: Partial<InfectionPeriod> | null
  compare?: ReportCompare
  custom?: Partial<InfectionPeriod> | null
  detail?: ReportDetail
  language?: string
  // The filters of the screen as words (e.g. «Τμήμα: ΜΕΝΝ»).
  filters?: string[]
  // The department the screen is filtered on, if any: the patient days are read for it.
  department?: string
  patientDays?: PatientDaysEntry[]
}

const toDate = (day: string) => new Date(`${day}T00:00:00Z`)
const dayText = (date: Date) => date.toISOString().slice(0, 10)
const addDays = (day: string, days: number) => { const date = toDate(day); date.setUTCDate(date.getUTCDate() + days); return dayText(date) }
const addYears = (day: string, years: number) => { const [y, m, d] = day.split('-').map(Number); const last = new Date(Date.UTC(y + years, m, 0)).getUTCDate(); return `${y + years}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}` }

export const itemsInPeriod = (items: InfectionItem[] = [], period?: Partial<InfectionPeriod> | null) =>
  items.filter(item => item.date && (!period?.from || item.date >= period.from) && (!period?.to || item.date <= period.to))

// The period printed: the dates given, or from the first to the last item.
export function infectionPeriod(items: InfectionItem[] = [], period?: Partial<InfectionPeriod> | null): InfectionPeriod | null {
  if (period?.from && period?.to) return { from: period.from, to: period.to }
  const days = items.map(item => item.date).filter(Boolean).sort()
  if (!days.length) return null
  return { from: period?.from || days[0], to: period?.to || days[days.length - 1] }
}

// The period to compare with: as many days just before, the same dates a year earlier, or the dates typed.
export function infectionComparePeriod(choice: ReportCompare | undefined, period: InfectionPeriod | null, custom?: Partial<InfectionPeriod> | null): InfectionPeriod | null {
  if (choice === 'custom') return custom?.from && custom?.to && custom.from <= custom.to ? { from: custom.from, to: custom.to } : null
  if (!period) return null
  if (choice === 'previous') {
    const days = Math.round((toDate(period.to).getTime() - toDate(period.from).getTime()) / 86400000) + 1
    return { from: addDays(period.from, -days), to: addDays(period.from, -1) }
  }
  if (choice === 'lastYear') return { from: addYears(period.from, -1), to: addYears(period.to, -1) }
  return null
}

// The patient days of a period: the entries that lie inside it, the department's when the screen is on one,
// else the hospital's (or, without those, the departments' together). The entries must cover every day of the
// period without a gap (owner, 19/11/2026: a rate only over the whole period); otherwise null, as for none.
export function patientDaysIn(entries: PatientDaysEntry[] = [], period: InfectionPeriod | null, department = ''): number | null {
  if (!period) return null
  const inside = entries.filter(entry => entry.from >= period.from && entry.to <= period.to && entry.from <= entry.to && Number(entry.value) > 0)
  const chosen = department
    ? inside.filter(entry => entry.department === department)
    : inside.some(entry => !entry.department) ? inside.filter(entry => !entry.department) : inside
  if (!chosen.length) return null
  let reached = addDays(period.from, -1)
  for (const entry of [...chosen].sort((a, b) => a.from.localeCompare(b.from))) {
    if (entry.from > addDays(reached, 1)) return null
    if (entry.to > reached) reached = entry.to
  }
  if (reached < period.to) return null
  return chosen.reduce((sum, entry) => sum + Number(entry.value), 0)
}

// The HAI classification of each episode, read apart when the list rows do not carry it (the production list
// reads summaries): `byCase` by the episode's record id (or code); null when it could not be read, so the report
// shows «—» rather than a false «no».
export function withHaiClassifications<T extends { id?: string | null, recordId?: string | null, haiClassification?: unknown }>(cases: T[], byCase: Map<string, unknown> | null): T[] {
  return cases.map(item => {
    const { haiClassification: _drop, ...rest } = item
    void _drop
    if (!byCase) return rest as T
    return { ...rest, haiClassification: byCase.get(String(item.recordId || '')) ?? byCase.get(String(item.id || '')) ?? null } as T
  })
}

// Whether the report reaches before the dates already read (the laboratory list reads the last 12 months first):
// a period without a start (everything), or a period or its comparison that starts earlier.
export function reachesBefore(since: string, period?: Partial<InfectionPeriod> | null, compare: ReportCompare = 'none', custom?: Partial<InfectionPeriod> | null) {
  if (!since) return false
  if (!period?.from) return true
  if (period.from < since) return true
  if (compare === 'none') return false
  const compared = infectionComparePeriod(compare, { from: period.from, to: period.to || period.from }, custom)
  return Boolean(compared && compared.from < since)
}

export type InfectionGroup = { key: string, count: number, share: number }
// The items by one of their fields, the most first; an empty field counts as «Χωρίς στοιχείο».
export function groupItems(items: InfectionItem[], key: (item: InfectionItem) => string | undefined, none: string): InfectionGroup[] {
  const counts = new Map<string, number>()
  for (const item of items) { const value = String(key(item) || '').trim() || none; counts.set(value, (counts.get(value) || 0) + 1) }
  const total = items.length || 1
  return [...counts.entries()].map(([name, count]) => ({ key: name, count, share: (count / total) * 100 })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, 'el'))
}

const number = (value: number, language: string, digits = 1) => new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'el-GR', { maximumFractionDigits: digits }).format(value)
const signed = (value: number, language: string) => new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'el-GR', { maximumFractionDigits: 1, signDisplay: 'exceptZero' }).format(value)
// The comparison cell: the earlier count and the change, e.g. «12 · +3».
export const countChange = (now: number, before: number | null | undefined, language = 'el') => (before == null ? '—' : `${number(before, language)} · ${now - before === 0 ? '0' : signed(now - before, language)}`)

// Bars drawn with plain blocks and inline colours, so the print, the PDF and Word all keep them.
const BAR = '#2f6f9f', ALERT = '#b42318', TRACK = '#e3eaf0'
export function countBar(value: number, max: number, alert = false) {
  if (!max || !value) return `<div style="height:9px;background:${TRACK};border-radius:2px"></div>`
  const width = Math.max(2, Math.min(100, (value / max) * 100)).toFixed(1)
  return `<div style="height:9px;background:${TRACK};border-radius:2px;overflow:hidden;white-space:nowrap;font-size:0;line-height:0"><span style="display:inline-block;height:9px;width:${width}%;background:${alert ? ALERT : BAR}"></span></div>`
}

const dayShort = (day: string) => (day ? day.split('-').reverse().join('/') : '—')
const monthName = (month: string, language: string) => { const [y, m] = month.split('-').map(Number); return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'el-GR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1))) }

export function infectionDocument({ source, items, period: chosen = null, compare = 'none', custom = null, detail = 'summary', language = 'el', filters = [], department = '', patientDays = [] }: InfectionReportInput): ReportDoc {
  const en = language === 'en'
  const L = (el: string, enText: string) => (en ? enText : el)
  const full = detail === 'full'
  const lab = source === 'laboratory'
  const inPeriod = itemsInPeriod(items, chosen)
  const period = infectionPeriod(inPeriod, chosen)
  const comparedPeriod = compare === 'none' ? null : infectionComparePeriod(compare, period, custom)
  const compared = comparedPeriod ? itemsInPeriod(items, comparedPeriod) : null
  const comparedLabel = comparedPeriod ? periodDates(comparedPeriod) : ''
  const none = L('Χωρίς στοιχείο', 'Not recorded')

  // Fixed widths, the same in every table, so that the columns line up (owner, 18/11/2026).
  const others = [
    { text: L('Πλήθος', 'Count'), width: 11 },
    { text: L('Ποσοστό', 'Share'), width: 11 },
    { text: L('Γράφημα', 'Chart'), width: comparedPeriod ? 24 : 34 },
    ...(comparedPeriod ? [{ text: comparedLabel, width: 16 }] : []),
  ]
  const nameWidth = 100 - others.reduce((sum, column) => sum + column.width, 0)
  const columnsFor = (first: string): ReportCell[] => [{ text: first, width: `${nameWidth}%` }, ...others.map(column => ({ text: column.text, width: `${column.width}%` }))]
  type Row = { name: string, sub?: string, count: number, share?: number | null, max: number, alert?: boolean, before?: number | null, plain?: string, beforeText?: string, noCompare?: boolean }
  const cells = (row: Row): ReportCell[] => [
    { html: `<strong>${escapeHtml(row.name)}</strong>${row.sub ? `<span style="display:block;color:#5d7083;font-size:8.5pt">${escapeHtml(row.sub)}</span>` : ''}` },
    { text: row.plain ?? number(row.count, language), align: 'right' },
    { text: row.share == null ? '' : `${number(row.share, language)}%`, align: 'right' },
    { html: row.plain != null ? '' : countBar(row.count, row.max, row.alert) },
    ...(comparedPeriod ? [{ text: row.noCompare ? '' : row.plain != null ? (row.beforeText || '—') : countChange(row.count, row.before, language), align: 'right' }] : []),
  ]
  const groupTable = (title: string, first: string, key: (item: InfectionItem) => string | undefined, opts: { alert?: boolean, sub?: (group: InfectionGroup, rows: InfectionItem[]) => string } = {}): ReportSection | null => {
    const groups = groupItems(inPeriod, key, none)
    if (!groups.length) return null
    const earlier = compared ? groupItems(compared, key, none) : null
    const max = Math.max(...groups.map(group => group.count))
    return {
      title,
      table: {
        columns: columnsFor(first),
        rows: groups.map(group => cells({
          name: group.key, count: group.count, share: group.share, max, alert: opts.alert,
          before: earlier ? (earlier.find(item => item.key === group.key)?.count ?? 0) : null,
          sub: opts.sub ? opts.sub(group, inPeriod.filter(item => (String(key(item) || '').trim() || none) === group.key)) : '',
        })),
      },
    }
  }

  const sections: ReportSection[] = []
  if (!inPeriod.length) {
    sections.push({ title: L('Αποτελέσματα', 'Results'), text: L('Δεν υπάρχουν δεδομένα για την περίοδο με τα φίλτρα που ισχύουν.', 'There are no data for the period with the filters in force.') })
  } else {
    // 1. The headline figures.
    const patients = (list: InfectionItem[]) => new Set(list.map(item => item.patientKey).filter(Boolean)).size
    const resistant = (list: InfectionItem[]) => list.filter(item => item.resistance).length
    const positives = (list: InfectionItem[]) => list.reduce((sum, item) => sum + (lab ? 1 : Number(item.positives) || 0), 0)
    const hai = (list: InfectionItem[]) => list.filter(item => item.hai).length
    // The HAI figures only when the rows carry the classification.
    const haiKnown = inPeriod.some(item => item.hai !== undefined)
    const days = patientDaysIn(patientDays, period, department)
    const daysBefore = comparedPeriod ? patientDaysIn(patientDays, comparedPeriod, department) : null
    const rate = (count: number, value: number | null) => (value ? (count / value) * 1000 : null)
    const total = inPeriod.length
    const summary: Row[] = [
      { name: lab ? L('Θετικά δείγματα', 'Positive samples') : L('Επεισόδια επιτήρησης', 'Surveillance episodes'), count: total, share: null, max: total, before: compared ? compared.length : null },
      { name: L('Ασθενείς', 'Patients'), count: patients(inPeriod), share: null, max: total, before: compared ? patients(compared) : null },
      ...(lab ? [] : [
        ...(haiKnown ? [{ name: L('Λοιμώξεις σχετιζόμενες με τη φροντίδα (ΛΣΦΥ)', 'Healthcare-associated infections (HAI)'), sub: L('Με ταξινόμηση ΛΣΦΥ', 'With an HAI classification'), count: hai(inPeriod), share: (hai(inPeriod) / total) * 100, max: total, before: compared ? hai(compared) : null }] : []),
        { name: L('Θετικές καλλιέργειες', 'Positive cultures'), count: positives(inPeriod), share: null, max: Math.max(total, positives(inPeriod)), before: compared ? positives(compared) : null },
      ]),
      { name: L('Με αντοχή', 'With resistance'), sub: L('MRSA, VRE, ESBL, CRE κ.λπ.', 'MRSA, VRE, ESBL, CRE etc.'), count: resistant(inPeriod), share: (resistant(inPeriod) / total) * 100, max: total, alert: true, before: compared ? resistant(compared) : null },
    ]
    const rated = (list: InfectionItem[]) => (lab || !haiKnown ? list.length : hai(list))
    const rateNow = rate(rated(inPeriod), days)
    if (rateNow != null) {
      const rateBefore = compared ? rate(rated(compared), daysBefore) : null
      summary.push({ name: lab ? L('Θετικά ανά 1.000 κλινοημέρες', 'Positives per 1,000 patient days') : haiKnown ? L('ΛΣΦΥ ανά 1.000 κλινοημέρες', 'HAI per 1,000 patient days') : L('Επεισόδια ανά 1.000 κλινοημέρες', 'Episodes per 1,000 patient days'), sub: `${number(days as number, language, 0)} ${L('κλινοημέρες', 'patient days')}`, count: rateNow, max: 0, plain: number(rateNow, language, 2), beforeText: rateBefore == null ? '—' : number(rateBefore, language, 2) })
    }
    sections.push({ title: L('Σύνοψη', 'Summary'), keepTogether: true, table: { columns: columnsFor(L('Μέγεθος', 'Figure')), rows: summary.map(cells) } })

    // 2. By microorganism (with its resistance under it), by resistance, by site or sample type, by department, by month.
    const resistanceOf = (list: InfectionItem[]) => groupItems(list.filter(item => item.resistance), item => item.resistance, none).map(group => `${group.key} ${group.count}`).join(' · ')
    const byOrganism = groupTable(L('Ανά μικροοργανισμό', 'By microorganism'), L('Μικροοργανισμός', 'Microorganism'), item => item.organism, { sub: (_group, rows) => resistanceOf(rows) })
    if (byOrganism) sections.push(byOrganism)
    if (inPeriod.some(item => item.resistance)) {
      const withResistance = inPeriod.filter(item => item.resistance)
      const groups = groupItems(withResistance, item => item.resistance, none)
      const earlier = compared ? groupItems(compared.filter(item => item.resistance), item => item.resistance, none) : null
      const max = Math.max(...groups.map(group => group.count))
      sections.push({ title: L('Ανά αντοχή', 'By resistance'), table: { columns: columnsFor(L('Αντοχή', 'Resistance')), rows: groups.map(group => cells({ name: group.key, count: group.count, share: (group.count / inPeriod.length) * 100, max, alert: true, before: earlier ? (earlier.find(item => item.key === group.key)?.count ?? 0) : null })) } })
    }
    const bySite = groupTable(lab ? L('Ανά είδος δείγματος', 'By sample type') : L('Ανά σημείο λοίμωξης', 'By site of infection'), lab ? L('Είδος δείγματος', 'Sample type') : L('Σημείο λοίμωξης', 'Site'), item => item.group)
    if (bySite) sections.push(bySite)
    const byDepartment = groupTable(L('Ανά τμήμα', 'By department'), L('Τμήμα', 'Department'), item => item.department)
    if (byDepartment) sections.push(byDepartment)
    // By month, in date order; against the same month a year earlier when that is the comparison (else left blank).
    const months = new Map<string, number>()
    for (const item of inPeriod) months.set(item.date.slice(0, 7), (months.get(item.date.slice(0, 7)) || 0) + 1)
    const monthRows = [...months.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    if (monthRows.length > 1) {
      const max = Math.max(...monthRows.map(([, count]) => count))
      sections.push({ title: L('Ανά μήνα', 'By month'), table: { columns: columnsFor(L('Μήνας', 'Month')), rows: monthRows.map(([month, count]) => cells({ name: monthName(month, language), count, share: (count / inPeriod.length) * 100, max, noCompare: compare !== 'lastYear', before: compared ? compared.filter(item => item.date.slice(0, 7) === `${Number(month.slice(0, 4)) - 1}${month.slice(4)}`).length : null })) } })
    }

    // 3. «Αναλυτική»: the list of the cases (codes, never names).
    if (full) {
      const list = [...inPeriod].sort((a, b) => b.date.localeCompare(a.date))
      sections.push({
        title: lab ? L('Θετικά δείγματα της περιόδου', 'Positive samples of the period') : L('Επεισόδια της περιόδου', 'Episodes of the period'),
        pageBreak: list.length > 12,
        table: {
          columns: [
            { text: L('Κωδικός', 'Code'), width: '13%' }, { text: L('Ημερομηνία', 'Date'), width: '11%' }, { text: L('Τμήμα', 'Department'), width: '16%' },
            { text: lab ? L('Είδος δείγματος', 'Sample type') : L('Σημείο λοίμωξης', 'Site'), width: '18%' }, { text: L('Μικροοργανισμός', 'Microorganism'), width: '22%' }, { text: L('Αντοχή', 'Resistance'), width: '10%' },
            { text: lab ? L('Κατάσταση', 'Status') : L('ΛΣΦΥ', 'HAI'), width: '10%' },
          ],
          rows: list.map(item => [item.code || '—', dayShort(item.date), item.department || '—', item.group || '—', item.organism || '—', item.resistance || '—', lab ? (item.status || '—') : (item.hai ? L('Ναι', 'Yes') : item.hai === false ? L('Όχι', 'No') : '—')]),
        },
      })
    }
  }

  sections.push({
    title: L('Πώς διαβάζεται', 'How to read it'),
    list: [
      lab ? L('Μετρά κάθε θετικό δείγμα της περιόδου (ημερομηνία λήψης), με τα φίλτρα της λίστας.', 'Counts every positive sample of the period (by collection date), with the filters of the list.') : L('Μετρά κάθε επεισόδιο επιτήρησης της περιόδου (ημερομηνία έναρξης), με τα φίλτρα της λίστας· οι θετικές καλλιέργειες είναι όσες έχουν μικροοργανισμό ή θετικό αποτέλεσμα.', 'Counts every surveillance episode of the period (by start date), with the filters of the list; the positive cultures are those with an organism or a positive result.'),
      L('Το ποσοστό είναι επί του συνόλου της περιόδου· η μπάρα δείχνει το πλήθος σε σχέση με τη μεγαλύτερη τιμή του πίνακα. Κόκκινο: αντοχή.', 'The share is of the period’s total; the bar shows the count against the largest in the table. Red: resistance.'),
      ...(comparedPeriod ? [L('Η στήλη σύγκρισης δείχνει το πλήθος της άλλης περιόδου και τη μεταβολή.', 'The comparison column shows the count of the other period and the change.')] : []),
      L('Ο δείκτης ανά 1.000 κλινοημέρες εμφανίζεται μόνο όταν έχουν καταχωριστεί κλινοημέρες για όλη την περίοδο.', 'The rate per 1,000 patient days appears only when patient days were entered for the whole period.'),
    ],
  })

  const periodText = period ? periodDates(period) : L('Χωρίς δεδομένα', 'No data')
  return {
    language,
    kind: lab ? L('Εργαστήριο', 'Laboratory') : L('Επιτήρηση', 'Surveillance'),
    title: L('Αναφορά λοιμώξεων', 'Infection report'),
    subtitle: periodText,
    meta: [
      [L('Πηγή', 'Source'), lab ? L('Θετικά δείγματα εργαστηρίου', 'Positive laboratory samples') : L('Επεισόδια επιτήρησης ασθενών', 'Patient surveillance episodes')],
      [L('Περίοδος', 'Period'), periodText],
      [L('Σύγκριση με', 'Compared with'), comparedPeriod ? `${compareLabel(compare, language)}: ${comparedLabel}` : compareLabel('none', language)],
      [L('Μορφή', 'Layout'), detailLabel(detail, language)],
      ...(filters.length ? [[L('Φίλτρα', 'Filters'), filters.join(' · ')] as [string, string]] : []),
    ],
    sections,
    signatures: en ? ['Prepared by', 'Reviewed by'] : ['Συντάχθηκε', 'Ελέγχθηκε'],
    filename: `${lab ? 'lab' : 'surveillance'}_infections_${period ? `${period.from}_${period.to}` : 'all'}`,
  }
}

// The episodes of Surveillance as lines of the report (the page gives the label of the site, as on the screen).
type CaseLike = { id?: string | null, patientId?: string | null, patientRecordId?: string | null, startedAt?: string | null, department?: string | null, departmentEn?: string | null, organism?: string | null, resistance?: string | null, haiClassification?: { status?: string, criteriaMet?: boolean | null, type?: string } | null, samples?: { organism?: string | null, resistance?: string | null, result?: string | null }[] }
export const isPositiveSample = (sample: { organism?: string | null, result?: string | null } | null | undefined) => Boolean(sample && (sample.organism || String(sample.result || '').toLowerCase() === 'positive'))
export function surveillanceItems<T extends CaseLike>(cases: T[] = [], { language = 'el', siteOf }: { language?: string, siteOf: (item: T) => string }): InfectionItem[] {
  return cases.filter(item => item?.startedAt).map(item => {
    const samples = item.samples || []
    // A list row without the field says nothing about the classification (not «no infection»).
    const hai = 'haiClassification' in item ? Boolean(item.haiClassification && (item.haiClassification.criteriaMet === true || ['confirmed', 'probable'].includes(String(item.haiClassification.status || '')))) : undefined
    return {
      id: String(item.id || ''),
      code: item.patientId || '',
      date: hospitalDay(item.startedAt),
      department: (language === 'en' ? item.departmentEn || item.department : item.department) || '',
      organism: samples.find(sample => sample.organism)?.organism || item.organism || '',
      resistance: samples.find(sample => sample.resistance)?.resistance || item.resistance || '',
      group: siteOf(item),
      hai,
      positives: samples.filter(isPositiveSample).length,
      patientKey: item.patientId || item.patientRecordId || '',
    }
  })
}

// The positive samples of the Laboratory as lines of the report (the page gives the sample type and status in words).
type SampleLike = { id?: string | null, sampleCode?: string | null, patientId?: string | null, collectedAt?: string | null, requestedAt?: string | null, department?: string | null, departmentEn?: string | null, organism?: string | null, resistance?: string | null, result?: string | null }
export function laboratoryItems<T extends SampleLike>(samples: T[] = [], { language = 'el', typeOf, statusOf, codeOf }: { language?: string, typeOf: (sample: T) => string, statusOf?: (sample: T) => string, codeOf?: (sample: T) => string }): InfectionItem[] {
  return samples.filter(sample => String(sample.result || '').toLowerCase() === 'positive' && (sample.collectedAt || sample.requestedAt)).map(sample => ({
    id: String(sample.id || ''),
    code: codeOf ? codeOf(sample) : sample.sampleCode || sample.id || '',
    date: hospitalDay(sample.collectedAt || sample.requestedAt),
    department: (language === 'en' ? sample.departmentEn || sample.department : sample.department) || '',
    organism: sample.organism || '',
    resistance: sample.resistance || '',
    group: typeOf(sample),
    status: statusOf ? statusOf(sample) : '',
    patientKey: sample.patientId || '',
  }))
}
