// The printed report of a register (owner, 18/11/2026): the shared document layout
// (hospital band, title, facts, real tables, signatures, page numbers), so «Εκτύπωση / PDF»
// keeps selectable text instead of a picture of the screen, and the same document opens in Word.
// Without React, so that it is unit tested.
import { computeIndicator, periodLabel, periodLength, shiftPeriod, textOf } from './registerEngine'
import { formatIndicatorValue, indicatorStatusLabel } from './registerText'
import { escapeHtml } from '../../core/export/reportDocument'
import type { ReportCell, ReportDoc, ReportSection } from '../../core/export/reportDocument'
import type { IndicatorResult, Period } from './registerEngine'
import type { Register, RegisterEntry, RegisterIndicator } from './registerTypes'

// A row of the indicators of the period (as indicatorReport gives it).
export type ReportIndicatorRow = { indicator: RegisterIndicator, current: IndicatorResult, previous?: IndicatorResult, lastYear?: IndicatorResult }
export type IndicatorsDocumentInput = {
  register: Register
  rows: ReportIndicatorRow[]
  period: Period
  language?: string
  entries?: number
  department?: string
  category?: string
  // A line under an indicator (ΜΕΝΝ: blood cultures still waiting for a decision).
  notes?: Record<string, string>
  // The period the owner compares with (owner, 18/11/2026): none, or any period, each as a column with its results.
  comparisons?: ReportComparison[]
  // «Συνοπτική»: indicator, value and comparisons; «Αναλυτική»: also numerator/denominator, target and assessment.
  detail?: ReportDetail
}
export type ReportDetail = 'summary' | 'full'
export const REPORT_DETAILS: ReportDetail[] = ['summary', 'full']
export const detailLabel = (value: ReportDetail, language = 'el') => (language === 'en' ? { summary: 'Summary', full: 'Detailed' } : { summary: 'Συνοπτική', full: 'Αναλυτική' })[value]
// One comparison column: its title (e.g. «2ο τρίμηνο 2026») and each indicator's result in that period.
export type ReportComparison = { label: string, results: Record<string, IndicatorResult | undefined> }
// The choices of the print dialog.
export type ReportCompare = 'none' | 'previous' | 'lastYear' | 'custom'
export const REPORT_COMPARES: ReportCompare[] = ['none', 'previous', 'lastYear', 'custom']
export const compareLabel = (value: ReportCompare, language = 'el') => (language === 'en'
  ? { none: 'No comparison', previous: 'With the previous period', lastYear: 'With the same period last year', custom: 'With another period' }
  : { none: 'Χωρίς σύγκριση', previous: 'Με την προηγούμενη περίοδο', lastYear: 'Με την ίδια περίοδο πέρσι', custom: 'Με άλλη περίοδο' })[value]
// A period as dates: «01/04/2026 – 30/06/2026».
export const periodDates = (period: { from: string, to: string }) => `${period.from.split('-').reverse().join('/')} – ${period.to.split('-').reverse().join('/')}`

const STATUS_CLASS: Record<string, string> = { onTarget: 'rd-good', attention: 'rd-warn', breach: 'rd-bad' }
const judged = (indicator: RegisterIndicator) => indicator.direction === 'higher' || indicator.direction === 'lower'
// A percent keeps its sign; any other unit is written after the number.
const valueText = (result: IndicatorResult, indicator: RegisterIndicator, language: string) =>
  result.notRecorded ? (language === 'en' ? 'Not recorded' : 'Δεν καταγράφεται') : formatIndicatorValue(result.value, indicator, language)

// The change against an earlier period, in points for a percent and in % of the earlier value otherwise.
export function changeText(now: number | null | undefined, before: number | null | undefined, indicator: RegisterIndicator, language = 'el') {
  if (now == null || before == null) return ''
  const en = language === 'en'
  const format = (value: number) => new Intl.NumberFormat(en ? 'en-GB' : 'el-GR', { maximumFractionDigits: 1, signDisplay: 'exceptZero' }).format(value)
  if (indicator.unit === '%') return `${format(now - before)} ${en ? 'pts' : 'μον.'}`
  if (before === 0) return now === 0 ? '0' : ''
  return `${format(((now - before) / Math.abs(before)) * 100)}%`
}

// The target as the screen shows it: «≥ 50%» for «higher is better», «≤ 2» for «lower».
export const targetText = (indicator: RegisterIndicator, language = 'el') =>
  indicator.target == null || indicator.target === '' ? '' : `${indicator.direction === 'higher' ? '≥' : '≤'} ${formatIndicatorValue(Number(indicator.target), indicator, language)}`

function indicatorRow(row: ReportIndicatorRow, language: string, notes: Record<string, string>, comparisons: ReportComparison[], full: boolean): ReportCell[] {
  const { indicator, current } = row
  const ratio = current.numerator != null && current.denominator != null && ['percent', 'rate', 'smr'].includes(indicator.aggregation)
    ? `${current.numerator} / ${current.denominator}${indicator.aggregation === 'rate' ? (language === 'en' ? ' days' : ' ημ.') : ''}`
    : ''
  const lines = [current.small ? (language === 'en' ? 'Few cases: read with caution' : 'Λίγα περιστατικά: με επιφύλαξη') : '', current.missing ? (language === 'en' ? `missing entry (${current.missing})` : `λείπει καταχώριση (${current.missing})`) : '', notes[indicator.id] || ''].filter(Boolean)
  const status = current.status && current.status !== 'context' ? indicatorStatusLabel(current.status, language) : '—'
  const name = `<strong>${escapeHtml(textOf(indicator, language))}</strong>${lines.map(line => `<span class="rd-muted" style="display:block;font-size:8.5pt">${escapeHtml(line)}</span>`).join('')}`
  return [
    { html: name },
    { text: valueText(current, indicator, language), align: 'right' },
    ...(full ? [{ text: ratio || '—', align: 'right', className: 'rd-muted' }] : []),
    ...comparisons.map(comparison => {
      const other = comparison.results[indicator.id]
      return { text: other ? [formatIndicatorValue(other.value, indicator, language), changeText(current.value, other.value, indicator, language)].filter(Boolean).join(' · ') : '—', align: 'right' }
    }),
    ...(full ? [targetText(indicator, language) || '—', { text: status, className: STATUS_CLASS[current.status || ''] || '' }] : []),
  ]
}

// The indicators of a period as a document: those with a target or a direction first, then those for context.
export function indicatorsDocument({ register, rows, period, language = 'el', entries, department, category, notes = {}, comparisons = [], detail = 'full' }: IndicatorsDocumentInput): ReportDoc {
  const full = detail === 'full'
  const en = language === 'en'
  const name = en ? register.nameEn || register.name : register.name
  // Fixed widths, the same in every table of the document, so that the columns line up (owner, 18/11/2026).
  const others: [string, number][] = [
    [en ? 'Value' : 'Τιμή', 13],
    ...(full ? [[en ? 'Numerator / denominator' : 'Αριθμητής / παρονομαστής', 13] as [string, number]] : []),
    ...comparisons.map(comparison => [comparison.label, 15] as [string, number]),
    ...(full ? [[en ? 'Target' : 'Στόχος', 12], [en ? 'Assessment' : 'Αξιολόγηση', 12]] as [string, number][] : []),
  ]
  const nameWidth = Math.max(28, 100 - others.reduce((sum, [, width]) => sum + width, 0))
  const columns: ReportCell[] = [{ text: en ? 'Indicator' : 'Δείκτης', width: `${nameWidth}%` }, ...others.map(([text, width]) => ({ text, width: `${width}%` }))]
  const withTarget = rows.filter(row => judged(row.indicator))
  const context = rows.filter(row => !judged(row.indicator))
  const count = (status: string) => rows.filter(row => row.current.status === status).length
  const sections: ReportSection[] = [
    { title: en ? 'With a target or a direction' : 'Με στόχο ή κατεύθυνση', table: { columns, rows: withTarget.map(row => indicatorRow(row, language, notes, comparisons, full)), empty: en ? 'No indicator with a target.' : 'Κανένας δείκτης με στόχο.' } },
    { title: en ? 'For context' : 'Πληροφοριακοί', table: { columns, rows: context.map(row => indicatorRow(row, language, notes, comparisons, full)), empty: en ? 'No indicator for context.' : 'Κανένας πληροφοριακός δείκτης.' } },
  ].filter(section => section.table.rows.length)
  sections.push({
    title: en ? 'How to read it' : 'Πώς διαβάζεται',
    list: [
      ...(!comparisons.length ? [] : [en ? 'The comparison columns show the earlier value and the change (in points for a percent).' : 'Οι στήλες σύγκρισης δείχνουν την προηγούμενη τιμή και τη μεταβολή (σε μονάδες για ποσοστό).']),
      en ? '«Not recorded»: no entry of the register records this; it is not a zero.' : '«Δεν καταγράφεται»: καμία εγγραφή του μητρώου δεν το καταγράφει· δεν είναι μηδέν.',
      en ? '«Missing entry»: entries whose yes/no answer was left empty, counted as «no».' : '«Λείπει καταχώριση»: εγγραφές με κενό ναι/όχι, που μετρούν ως «όχι».',
    ],
  })
  return {
    language,
    kind: en ? 'Register indicators' : 'Δείκτες μητρώου',
    title: `${name} · ${periodLabel(period, language)}`,
    code: register.code,
    orientation: 'landscape',
    meta: [
      [en ? 'Register' : 'Μητρώο', name],
      [en ? 'Department' : 'Τμήμα', department || '—'],
      [en ? 'Period' : 'Περίοδος', periodDates(period)],
      ...(category ? [[en ? 'Patients' : 'Ασθενείς', category] as [string, string]] : []),
      ...(entries != null ? [[en ? 'Entries in the period' : 'Εγγραφές περιόδου', String(entries)] as [string, string]] : []),
      [en ? 'Compared with' : 'Σύγκριση με', comparisons.length ? comparisons.map(comparison => comparison.label).join(' · ') : (en ? 'No comparison' : 'Χωρίς σύγκριση')],
      ...(full ? [[en ? 'Assessment' : 'Αξιολόγηση', en ? `${count('onTarget')} on target · ${count('attention')} below target · ${count('breach')} past the limit` : `${count('onTarget')} εντός στόχου · ${count('attention')} εκτός στόχου · ${count('breach')} πέρα από το όριο`]] as [string, string][] : []),
    ],
    sections,
    signatures: en ? ['Prepared by', 'Reviewed by'] : ['Συντάχθηκε', 'Ελέγχθηκε'],
    filename: `${register.code}_${period.from}_${period.to}`,
  }
}

// The period to compare with: the previous one, the same one last year, or the dates the owner typed (null: no comparison).
export function comparePeriod(choice: ReportCompare, period: Period, custom?: { from?: string, to?: string } | null): Period | null {
  if (choice === 'previous') return shiftPeriod(period, -periodLength(period))
  if (choice === 'lastYear') return shiftPeriod(period, -12)
  if (choice === 'custom' && custom?.from && custom?.to && custom.from <= custom.to) return { from: custom.from, to: custom.to, key: `custom:${custom.from}:${custom.to}` }
  return null
}

// A comparison column: every indicator of the register computed over that period.
export function comparisonFor(register: Register, entries: RegisterEntry[], period: Period, language = 'el'): ReportComparison {
  const label = period.key.startsWith('custom:') ? periodDates(period) : periodLabel(period, language)
  return { label, results: Object.fromEntries((register.indicators || []).map(indicator => [indicator.id, computeIndicator(register, indicator, entries, period)])) }
}

// The entries of a register (or the months of a sheet) as a landscape document, for the period the owner chose.
export function entriesDocument({ register, headers, rows, language = 'el', from = '', to = '', detail = 'summary' }: { register: Register, headers: string[], rows: unknown[][], language?: string, from?: string, to?: string, detail?: ReportDetail }): ReportDoc {
  const en = language === 'en'
  const name = en ? register.nameEn || register.name : register.name
  const range = from && to ? periodDates({ from, to }) : (en ? 'All entries' : 'Όλες οι εγγραφές')
  return {
    language,
    kind: register.kind === 'sheet' ? (en ? 'Register sheet' : 'Φύλλο μητρώου') : (en ? 'Register entries' : 'Εγγραφές μητρώου'),
    title: `${name} · ${range}`,
    code: register.code,
    orientation: 'landscape',
    meta: [
      [en ? 'Register' : 'Μητρώο', name],
      [en ? 'Department' : 'Τμήμα', (en ? register.departmentEn || register.department : register.department) || '—'],
      [en ? 'Period' : 'Περίοδος', range],
      [register.kind === 'sheet' ? (en ? 'Months' : 'Μήνες') : (en ? 'Entries' : 'Εγγραφές'), String(rows.length)],
      [en ? 'Layout' : 'Μορφή', detailLabel(detail, language)],
    ],
    sections: [{ table: { columns: headers, rows: rows.map(row => row.map(cell => (cell == null ? '' : typeof cell === 'number' ? { text: new Intl.NumberFormat(en ? 'en-GB' : 'el-GR', { maximumFractionDigits: 2 }).format(cell), align: 'right' } : String(cell)))), empty: en ? 'No entry in the period.' : 'Καμία εγγραφή στην περίοδο.' } }],
    filename: `${register.code}_${from && to ? `${from}_${to}` : 'all'}`,
  }
}

// The entries inside the dates (cases by their entry date, sheets by their month); all when no dates are given.
export function entriesInRange(register: Register, entries: RegisterEntry[], from = '', to = '') {
  if (!from || !to) return entries
  return entries.filter(entry => {
    const day = String((register.kind === 'sheet' ? entry.periodStart : entry.entryDate) || '').slice(0, 10)
    return day >= from && day <= to
  })
}
