// The printed report of a register (owner, 18/11/2026): the shared document layout
// (hospital band, title, facts, real tables, signatures, page numbers), so «Εκτύπωση / PDF»
// keeps selectable text instead of a picture of the screen, and the same document opens in Word.
// Without React, so that it is unit tested.
import { periodLabel, textOf } from './registerEngine'
import { formatIndicatorValue, indicatorStatusLabel } from './registerText'
import { escapeHtml } from '../../core/export/reportDocument'
import type { ReportCell, ReportDoc, ReportSection } from '../../core/export/reportDocument'
import type { IndicatorResult, Period } from './registerEngine'
import type { Register, RegisterIndicator } from './registerTypes'

// A row of the indicators of the period (as indicatorReport gives it).
export type ReportIndicatorRow = { indicator: RegisterIndicator, current: IndicatorResult, previous: IndicatorResult, lastYear: IndicatorResult }
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
}

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

function indicatorRow(row: ReportIndicatorRow, language: string, notes: Record<string, string>): ReportCell[] {
  const { indicator, current, previous, lastYear } = row
  const ratio = current.numerator != null && current.denominator != null && ['percent', 'rate', 'smr'].includes(indicator.aggregation)
    ? `${current.numerator} / ${current.denominator}${indicator.aggregation === 'rate' ? (language === 'en' ? ' days' : ' ημ.') : ''}`
    : ''
  const lines = [current.small ? (language === 'en' ? 'Few cases: read with caution' : 'Λίγα περιστατικά: με επιφύλαξη') : '', current.missing ? (language === 'en' ? `missing entry (${current.missing})` : `λείπει καταχώριση (${current.missing})`) : '', notes[indicator.id] || ''].filter(Boolean)
  const status = current.status && current.status !== 'context' ? indicatorStatusLabel(current.status, language) : '—'
  const name = `<strong>${escapeHtml(textOf(indicator, language))}</strong>${lines.map(line => `<span class="rd-muted" style="display:block;font-size:8.5pt">${escapeHtml(line)}</span>`).join('')}`
  return [
    { html: name },
    { text: valueText(current, indicator, language), align: 'right' },
    { text: ratio || '—', align: 'right', className: 'rd-muted' },
    { text: [formatIndicatorValue(previous.value, indicator, language), changeText(current.value, previous.value, indicator, language)].filter(Boolean).join(' · '), align: 'right' },
    { text: [formatIndicatorValue(lastYear.value, indicator, language), changeText(current.value, lastYear.value, indicator, language)].filter(Boolean).join(' · '), align: 'right' },
    targetText(indicator, language) || '—',
    { text: status, className: STATUS_CLASS[current.status || ''] || '' },
  ]
}

// The indicators of a period as a document: those with a target or a direction first, then those for context.
export function indicatorsDocument({ register, rows, period, language = 'el', entries, department, category, notes = {} }: IndicatorsDocumentInput): ReportDoc {
  const en = language === 'en'
  const name = en ? register.nameEn || register.name : register.name
  const columns = en
    ? ['Indicator', 'Value', 'Numerator / denominator', 'Previous period', 'Same period last year', 'Target', 'Assessment']
    : ['Δείκτης', 'Τιμή', 'Αριθμητής / παρονομαστής', 'Προηγούμενη περίοδος', 'Ίδια περίοδος πέρσι', 'Στόχος', 'Αξιολόγηση']
  const withTarget = rows.filter(row => judged(row.indicator))
  const context = rows.filter(row => !judged(row.indicator))
  const count = (status: string) => rows.filter(row => row.current.status === status).length
  const sections: ReportSection[] = [
    { title: en ? 'With a target or a direction' : 'Με στόχο ή κατεύθυνση', table: { columns, rows: withTarget.map(row => indicatorRow(row, language, notes)), empty: en ? 'No indicator with a target.' : 'Κανένας δείκτης με στόχο.' } },
    { title: en ? 'For context' : 'Πληροφοριακοί', table: { columns, rows: context.map(row => indicatorRow(row, language, notes)), empty: en ? 'No indicator for context.' : 'Κανένας πληροφοριακός δείκτης.' } },
  ].filter(section => section.table.rows.length)
  sections.push({
    title: en ? 'How to read it' : 'Πώς διαβάζεται',
    list: en
      ? ['«Previous period» and «Same period last year» show the value and its change (in points for a percent).', '«Not recorded»: no entry of the register records this; it is not a zero.', '«Missing entry»: entries whose yes/no answer was left empty, counted as «no».']
      : ['Η «Προηγούμενη περίοδος» και η «Ίδια περίοδος πέρσι» δείχνουν την τιμή και τη μεταβολή (σε μονάδες για ποσοστό).', '«Δεν καταγράφεται»: καμία εγγραφή του μητρώου δεν το καταγράφει· δεν είναι μηδέν.', '«Λείπει καταχώριση»: εγγραφές με κενό ναι/όχι, που μετρούν ως «όχι».'],
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
      [en ? 'Period' : 'Περίοδος', `${period.from.split('-').reverse().join('/')} – ${period.to.split('-').reverse().join('/')}`],
      ...(category ? [[en ? 'Patients' : 'Ασθενείς', category] as [string, string]] : []),
      ...(entries != null ? [[en ? 'Entries in the period' : 'Εγγραφές περιόδου', String(entries)] as [string, string]] : []),
      [en ? 'Assessment' : 'Αξιολόγηση', en ? `${count('onTarget')} on target · ${count('attention')} below target · ${count('breach')} past the limit` : `${count('onTarget')} εντός στόχου · ${count('attention')} εκτός στόχου · ${count('breach')} πέρα από το όριο`],
    ],
    sections,
    signatures: en ? ['Prepared by', 'Reviewed by'] : ['Συντάχθηκε', 'Ελέγχθηκε'],
    filename: `${register.code}_${period.from}_${period.to}`,
  }
}
