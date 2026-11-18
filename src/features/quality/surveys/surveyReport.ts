// The printed report of a satisfaction questionnaire (owner, 18/11/2026): the shared document layout (hospital band,
// facts, real tables, signatures, page numbers), so «Εκτύπωση / PDF» keeps selectable text and the same document
// opens in Word. The satisfaction of each question with a bar, «Συνοπτική» or «Αναλυτική», with or without a
// comparison with another period, as the registers print. Without React, so that it is unit tested.
import { escapeHtml } from '../../../core/export/reportDocument'
import { audienceLabel, departmentBreakdown, monthlyTrend, sectionLabel, sectionsOf, surveySummary, textOf } from './surveyModel'
import { compareLabel, detailLabel, periodDates } from '../../registers/registerReport'
import type { ReportCell, ReportDoc, ReportSection } from '../../../core/export/reportDocument'
import type { ReportCompare, ReportDetail } from '../../registers/registerReport'
import type { Survey, SurveyQuestion, SurveyResponse } from './surveyModel'
import type { SurveyQuestionResult } from './surveyTypes'

export type SurveyPeriod = { from: string, to: string }
export type SurveyReportInput = {
  survey: Survey
  // The responses the screen's filters keep (department, channel, search), every date.
  responses: SurveyResponse[]
  // The responses of the hospital's earlier questionnaires of the same kind: only for the comparison column.
  earlier?: SurveyResponse[]
  // The period printed; empty dates: every response.
  period?: Partial<SurveyPeriod> | null
  compare?: ReportCompare
  // The dates of «Με άλλη περίοδο».
  custom?: Partial<SurveyPeriod> | null
  detail?: ReportDetail
  language?: string
  // The names of the questionnaire's departments, and the filters of the screen as words (e.g. «Τμήμα: ΜΕΘ»).
  departments?: string[]
  filters?: string[]
}

const dayOf = (value: unknown) => String(value || '').slice(0, 10)
const toDate = (day: string) => new Date(`${day}T00:00:00Z`)
const dayText = (date: Date) => date.toISOString().slice(0, 10)
const addDays = (day: string, days: number) => { const date = toDate(day); date.setUTCDate(date.getUTCDate() + days); return dayText(date) }
const addYears = (day: string, years: number) => { const [y, m, d] = day.split('-').map(Number); const last = new Date(Date.UTC(y + years, m, 0)).getUTCDate(); return `${y + years}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}` }

// The responses inside the dates (by the day they were given, in Athens time as the service keeps it); all without dates.
export const responsesInPeriod = (responses: SurveyResponse[] = [], period?: Partial<SurveyPeriod> | null) =>
  responses.filter(response => (!period?.from || dayOf(response.submittedAt) >= period.from) && (!period?.to || dayOf(response.submittedAt) <= period.to))

// The period printed: the dates given, or from the first to the last response.
export function reportPeriod(responses: SurveyResponse[] = [], period?: Partial<SurveyPeriod> | null): SurveyPeriod | null {
  if (period?.from && period?.to) return { from: period.from, to: period.to }
  const days = responses.map(response => dayOf(response.submittedAt)).filter(Boolean).sort()
  if (!days.length) return null
  return { from: period?.from || days[0], to: period?.to || days[days.length - 1] }
}

// The period to compare with: as many days just before, the same dates a year earlier, or the dates typed.
export function surveyComparePeriod(choice: ReportCompare | undefined, period: SurveyPeriod | null, custom?: Partial<SurveyPeriod> | null): SurveyPeriod | null {
  if (choice === 'custom') return custom?.from && custom?.to && custom.from <= custom.to ? { from: custom.from, to: custom.to } : null
  if (!period) return null
  if (choice === 'previous') {
    const days = Math.round((toDate(period.to).getTime() - toDate(period.from).getTime()) / 86400000) + 1
    return { from: addDays(period.from, -days), to: addDays(period.from, -1) }
  }
  if (choice === 'lastYear') return { from: addYears(period.from, -1), to: addYears(period.to, -1) }
  return null
}

const number = (value: number, language: string, digits = 1) => new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'el-GR', { maximumFractionDigits: digits }).format(value)
const percent = (value: number | null | undefined, language: string) => (value == null ? '—' : `${number(value, language)}%`)
const signed = (value: number, language: string) => new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'el-GR', { maximumFractionDigits: 1, signDisplay: 'exceptZero' }).format(value)
// The change in points (satisfaction %, NPS): «+3,2 μον.».
export const pointsChange = (now: number | null | undefined, before: number | null | undefined, language = 'el') =>
  now == null || before == null ? '' : `${signed(now - before, language)} ${language === 'en' ? 'pts' : 'μον.'}`

// Bars drawn with plain blocks and inline colours, so the print, the PDF and Word all keep them.
const GOOD = '#2f855a', BELOW = '#d97706', NEUTRAL = '#2f6f9f', TRACK = '#e3eaf0'
const SCALE_COLOURS = ['#b42318', '#f97316', '#cbd5e1', '#7cc49a', '#2f855a']
const track = (inner: string) => `<div style="height:9px;background:${TRACK};border-radius:2px;overflow:hidden;white-space:nowrap;font-size:0;line-height:0">${inner}</div>`
const block = (width: number, colour: string) => (width > 0 ? `<span style="display:inline-block;height:9px;width:${Math.max(0, Math.min(100, width)).toFixed(1)}%;background:${colour}"></span>` : '')
export function barHtml(value: number | null | undefined, target?: number | null) {
  if (value == null) return '<span style="color:#5d7083">—</span>'
  return track(block(value, target == null ? NEUTRAL : value >= target ? GOOD : BELOW))
}
// The answers 1 to 5 of a scale (or the groups of a recommendation) as one stacked bar.
export function stackedHtml(counts: number[] = [], colours: string[] = SCALE_COLOURS) {
  const total = counts.reduce((sum, value) => sum + value, 0)
  if (!total) return '<span style="color:#5d7083">—</span>'
  return track(counts.map((count, index) => block((count / total) * 100, colours[index] || NEUTRAL)).join(''))
}

type Column = { text: string, width: number }
type Row = { name: string, sub?: string, indent?: boolean, value: string, valueClass?: string, bar: string, compare: string[], count?: string, mean?: string }

// The headline of a question: the satisfied share of a 1–5 scale, the score of a recommendation, the share of Yes.
const headline = (result: SurveyQuestionResult | undefined) => {
  if (!result) return null
  if (result.question.type === 'rating') return result.satisfied ?? null
  if (result.question.type === 'nps') return result.nps ?? null
  if (result.question.type === 'yesno') return result.yes ?? null
  return null
}
const headlineText = (result: SurveyQuestionResult, language: string) => {
  const value = headline(result)
  if (value == null) return '—'
  if (result.question.type === 'nps') return `NPS ${signed(value, language)}`
  if (result.question.type === 'yesno') return `${language === 'en' ? 'Yes' : 'Ναι'} ${percent(value, language)}`
  return percent(value, language)
}

export function surveyDocument({ survey, responses, earlier = [], period: chosen = null, compare = 'none', custom = null, detail = 'summary', language = 'el', departments = [], filters = [] }: SurveyReportInput): ReportDoc {
  const en = language === 'en'
  const full = detail === 'full'
  const target = Number(survey.satisfiedTarget) || 80
  const inPeriod = responsesInPeriod(responses, chosen)
  const period = reportPeriod(inPeriod, chosen)
  const comparedPeriod = compare === 'none' ? null : surveyComparePeriod(compare, period, custom)
  const compared = comparedPeriod ? responsesInPeriod([...responses, ...earlier.filter(row => !responses.some(own => own.id === row.id))], comparedPeriod) : null
  const summary = surveySummary(survey, inPeriod)
  const before = compared ? surveySummary(survey, compared) : null
  const resultOf = (id: string, results: SurveyQuestionResult[] | undefined) => results?.find(result => result.question.id === id)
  const comparedLabel = comparedPeriod ? periodDates(comparedPeriod) : ''

  // Fixed widths, the same in every table of the document, so that the columns line up (owner, 18/11/2026).
  const others: Column[] = [
    { text: en ? 'Value' : 'Τιμή', width: 13 },
    { text: en ? 'Chart' : 'Γράφημα', width: full ? 20 : 26 },
    ...(comparedPeriod ? [{ text: comparedLabel, width: 17 }] : []),
    ...(full ? [{ text: en ? 'Answers' : 'Απαντήσεις', width: 10 }, { text: en ? 'Mean (1–5)' : 'Μέσος (1–5)', width: 10 }] : []),
  ]
  const nameWidth = Math.max(28, 100 - others.reduce((sum, column) => sum + column.width, 0))
  const columnsFor = (first: string): ReportCell[] => [{ text: first, width: `${nameWidth}%` }, ...others.map(column => ({ text: column.text, width: `${column.width}%` }))]
  const cells = (row: Row): ReportCell[] => [
    { html: `${row.indent ? '<span style="display:inline-block;width:14px"></span>' : ''}${row.indent ? escapeHtml(row.name) : `<strong>${escapeHtml(row.name)}</strong>`}${row.sub ? `<span style="display:block;color:#5d7083;font-size:8.5pt">${escapeHtml(row.sub)}</span>` : ''}` },
    { text: row.value, align: 'right', className: row.valueClass || '' },
    { html: row.bar },
    ...(comparedPeriod ? row.compare.map(text => ({ text: text || '—', align: 'right' })) : []),
    ...(full ? [{ text: row.count ?? '', align: 'right' }, { text: row.mean ?? '', align: 'right' }] : []),
  ]
  const compareText = (now: number | null, earlier: number | null | undefined, kind: string) => {
    if (!compared) return ''
    if (earlier == null) return '—'
    const shown = kind === 'nps' ? `NPS ${signed(earlier, language)}` : percent(earlier, language)
    return [shown, pointsChange(now, earlier, language)].filter(Boolean).join(' · ')
  }
  const satisfiedClass = (value: number | null | undefined) => (value == null ? '' : value >= target ? 'rd-good' : 'rd-warn')

  const questionRow = (result: SurveyQuestionResult): Row => {
    const { question } = result
    const earlier = headline(resultOf(question.id, before?.results))
    const value = headline(result)
    const bar = question.type === 'rating'
      ? (full ? stackedHtml(result.distribution) : barHtml(result.satisfied, target))
      : question.type === 'nps'
        ? stackedHtml(result.distribution ? [result.distribution.slice(0, 7).reduce((a, b) => a + b, 0), result.distribution.slice(7, 9).reduce((a, b) => a + b, 0), result.distribution.slice(9).reduce((a, b) => a + b, 0)] : [], ['#b42318', '#cbd5e1', '#2f855a'])
        : barHtml(result.yes)
    const sub = full && question.type === 'rating' && result.count
      ? (result.distribution || []).map((count, index) => `${index + 1}: ${count}`).join(' · ')
      : full && question.type === 'nps' && result.count ? `${en ? 'Promoters' : 'Υποστηρικτές'} ${percent(result.promoters, language)} · ${en ? 'Detractors' : 'Επικριτές'} ${percent(result.detractors, language)}` : ''
    return {
      name: textOf(question, language), sub, value: headlineText(result, language), valueClass: question.type === 'rating' ? satisfiedClass(value) : '',
      bar, compare: [compareText(value, earlier, question.type)], count: String(result.count), mean: question.type === 'rating' && result.mean != null ? number(result.mean, language) : '',
    }
  }
  const scored = (question: SurveyQuestion) => ['rating', 'nps', 'yesno'].includes(question.type)
  const resultsBySection = (keys: string[]) => summary.results.filter(result => scored(result.question) && keys.includes(result.question.section || ''))

  const sections: ReportSection[] = []
  // 1. The headline figures, in the same columns as the questions.
  const overallRows: Row[] = [
    { name: en ? 'Overall satisfaction' : 'Συνολική ικανοποίηση', sub: en ? `Answers 4–5 over every 1–5 answer · target ${target}%` : `Απαντήσεις 4–5 σε όλες τις απαντήσεις 1–5 · στόχος ${target}%`, value: percent(summary.satisfied, language), valueClass: satisfiedClass(summary.satisfied), bar: barHtml(summary.satisfied, target), compare: [compareText(summary.satisfied, before?.satisfied, 'rating')], count: String(summary.responses), mean: '' },
    ...(summary.results.some(result => result.question.type === 'nps') ? [{ name: en ? 'Recommendation (NPS)' : 'Σύσταση (NPS)', sub: en ? 'Promoters (9–10) minus detractors (0–6)' : 'Υποστηρικτές (9–10) μείον επικριτές (0–6)', value: summary.nps == null ? '—' : `NPS ${signed(summary.nps, language)}`, bar: barHtml(summary.nps == null ? null : (summary.nps + 100) / 2), compare: [compareText(summary.nps, before?.nps, 'nps')], count: '', mean: '' }] : []),
    { name: en ? 'Responses' : 'Απαντήσεις', value: String(summary.responses), bar: '', compare: [compared ? `${compared.length} · ${signed(summary.responses - compared.length, language)}` : ''], count: '', mean: '' },
  ]
  sections.push({ title: en ? 'Summary' : 'Σύνοψη', keepTogether: true, table: { columns: columnsFor(en ? 'Figure' : 'Μέγεθος'), rows: overallRows.map(cells) } })

  // 2. One table per section of the questionnaire.
  const allSections = sectionsOf(survey)
  const keys = allSections.map(item => item.key)
  const groups = [...allSections.map(item => ({ title: sectionLabel(item.key, language, allSections), results: resultsBySection([item.key]) })), { title: en ? 'Other questions' : 'Λοιπές ερωτήσεις', results: summary.results.filter(result => scored(result.question) && !keys.includes(result.question.section || '')) }]
    .filter(group => group.results.length)
  groups.forEach(group => sections.push({ title: group.title, table: { columns: columnsFor(en ? 'Question' : 'Ερώτηση'), rows: group.results.map(result => cells(questionRow(result))) } }))
  if (!groups.length) sections.push({ title: en ? 'Questions' : 'Ερωτήσεις', text: en ? 'The questionnaire has no question with a score.' : 'Το ερωτηματολόγιο δεν έχει ερώτηση με βαθμολογία.' })

  if (full) {
    // 3. Choice questions: each option's share, in the same columns.
    const choices = summary.results.filter(result => ['single', 'multiple'].includes(result.question.type))
    if (choices.length) {
      const rows: Row[] = choices.flatMap(result => [
        { name: textOf(result.question, language), sub: result.question.type === 'multiple' ? (en ? 'Several answers allowed' : 'Επιτρέπονται πολλές απαντήσεις') : '', value: '', bar: '', compare: [''], count: String(result.count), mean: '' },
        ...(result.options || []).map(option => {
          const earlier = resultOf(result.question.id, before?.results)?.options?.find(item => item.value === option.value)
          return { name: textOf(option, language), indent: true, value: percent(option.share, language), bar: barHtml(option.share), compare: [compared ? (earlier ? [percent(earlier.share, language), pointsChange(option.share, earlier.share, language)].filter(Boolean).join(' · ') : '—') : ''], count: String(option.count), mean: '' }
        }),
      ])
      sections.push({ title: en ? 'Choice questions' : 'Ερωτήσεις επιλογής', table: { columns: columnsFor(en ? 'Answer' : 'Απάντηση'), rows: rows.map(cells) } })
    }
    // 4. By department and by month: the satisfied share with its bar.
    const byDepartment = departmentBreakdown(survey, inPeriod, language)
    if (byDepartment.length) {
      const earlierOf = (key: string) => (compared ? surveySummary(survey, compared.filter(response => (response.departmentId || '') === key)) : null)
      sections.push({ title: en ? 'By department' : 'Ανά τμήμα', table: { columns: columnsFor(en ? 'Department' : 'Τμήμα'), rows: byDepartment.map(group => { const earlier = earlierOf(group.key); return cells({ name: group.department, value: percent(group.satisfied, language), valueClass: satisfiedClass(group.satisfied), bar: barHtml(group.satisfied, target), compare: [compareText(group.satisfied, earlier && earlier.responses ? earlier.satisfied : null, 'rating')], count: String(group.responses), mean: '' }) }) } })
    }
    const months = monthlyTrend(survey, inPeriod)
    if (months.length) {
      const monthName = (month: string) => { const [y, m] = month.split('-').map(Number); return new Intl.DateTimeFormat(en ? 'en-GB' : 'el-GR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1))) }
      sections.push({ title: en ? 'By month' : 'Ανά μήνα', table: { columns: columnsFor(en ? 'Month' : 'Μήνας'), rows: months.map(row => cells({ name: monthName(row.month), value: percent(row.satisfied, language), valueClass: satisfiedClass(row.satisfied), bar: barHtml(row.satisfied, target), compare: [''], count: String(row.responses), mean: '' })) } })
    }
    // 5. The comments, the latest first (at most 40).
    const texts = summary.results.filter(result => result.question.type === 'text').flatMap(result => result.texts || [])
      .sort((a, b) => String(b.submittedAt || '').localeCompare(String(a.submittedAt || '')))
    if (texts.length) sections.push({ title: en ? 'Comments' : 'Σχόλια', list: texts.slice(0, 40).map(item => `${dayOf(item.submittedAt).split('-').reverse().join('/')}${(en ? item.departmentEn : item.department) ? ` · ${en ? item.departmentEn : item.department}` : ''}: ${item.text}`), note: texts.length > 40 ? (en ? `The latest 40 of ${texts.length} comments; all of them are in the Excel of the responses.` : `Τα 40 πιο πρόσφατα από ${texts.length} σχόλια· όλα είναι στο Excel των απαντήσεων.`) : '' })
  }

  sections.push({
    title: en ? 'How to read it' : 'Πώς διαβάζεται',
    list: [
      en ? `Satisfaction: the share of answers 4 or 5 on a 1–5 scale. Green: at or above the target (${target}%); orange: below it.` : `Ικανοποίηση: το ποσοστό των απαντήσεων 4 ή 5 στην κλίμακα 1–5. Πράσινο: στον στόχο (${target}%) ή πάνω· πορτοκαλί: κάτω από αυτόν.`,
      ...(full ? [en ? 'The chart of a 1–5 question shows the answers 1 (red) to 5 (green); the line under the question gives their counts.' : 'Το γράφημα μιας ερώτησης 1–5 δείχνει τις απαντήσεις 1 (κόκκινο) έως 5 (πράσινο)· η γραμμή κάτω από την ερώτηση δίνει το πλήθος τους.'] : []),
      ...(comparedPeriod ? [en ? 'The comparison column shows the earlier value and the change in points.' : 'Η στήλη σύγκρισης δείχνει την προηγούμενη τιμή και τη μεταβολή σε μονάδες.'] : []),
      en ? 'A share from fewer than 10 answers is read with caution.' : 'Ποσοστό από λιγότερες από 10 απαντήσεις διαβάζεται με επιφύλαξη.',
    ],
  })

  const name = textOf(survey, language)
  const periodText = period ? periodDates(period) : (en ? 'No responses' : 'Χωρίς απαντήσεις')
  return {
    language,
    kind: en ? 'Satisfaction questionnaire' : 'Ερωτηματολόγιο ικανοποίησης',
    title: name,
    subtitle: periodText,
    code: survey.code,
    meta: [
      [en ? 'Respondents' : 'Κοινό', audienceLabel(survey.audience, language)],
      [en ? 'Departments' : 'Τμήματα', departments.length ? departments.join(', ') : (en ? 'Every department' : 'Όλα τα τμήματα')],
      [en ? 'Period' : 'Περίοδος', periodText],
      [en ? 'Responses' : 'Απαντήσεις', String(summary.responses)],
      [en ? 'Satisfaction' : 'Ικανοποίηση', `${percent(summary.satisfied, language)} · ${en ? 'target' : 'στόχος'} ${target}%`],
      [en ? 'Compared with' : 'Σύγκριση με', comparedPeriod ? `${compareLabel(compare, language)}: ${comparedLabel}` : compareLabel('none', language)],
      [en ? 'Layout' : 'Μορφή', detailLabel(detail, language)],
      ...(survey.derived ? [[en ? 'Made from' : 'Από', en ? `«Food» questions · patient questionnaires: ${survey.sources?.length || 0}` : `ερωτήσεις «Φαγητό» · ερωτηματολόγια ασθενών: ${survey.sources?.length || 0}`] as [string, string]] : []),
      ...(filters.length ? [[en ? 'Filters' : 'Φίλτρα', filters.join(' · ')] as [string, string]] : []),
    ],
    sections,
    signatures: en ? ['Prepared by', 'Reviewed by'] : ['Συντάχθηκε', 'Ελέγχθηκε'],
    filename: `${survey.code || 'survey'}_${period ? `${period.from}_${period.to}` : 'all'}`,
  }
}

