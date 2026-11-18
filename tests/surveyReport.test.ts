// Ερωτηματολόγια (owner, 18/11/2026): the printed results on the shared document: the satisfaction of each
// question with its bar, a summary or a detailed layout, with or without a comparison with another period,
// and tables whose columns line up.
import { describe, expect, it } from 'vitest'
import { kitchenResponses, kitchenView, surveyFromTemplate } from '../src/features/quality/surveys/surveyModel'
import { barHtml, pointsChange, reportPeriod, responsesInPeriod, stackedHtml, surveyComparePeriod, surveyDocument } from '../src/features/quality/surveys/surveyReport'
import { buildReportHtml } from '../src/core/export/reportDocument'
import { readSource } from './helpers/readSource'
import type { Survey, SurveyResponse } from '../src/features/quality/surveys/surveyModel'

const staff = { ...surveyFromTemplate('staff'), id: 's1', code: 'SRV-2026-03', satisfiedTarget: 80 } as Survey
const answer = (id: string, day: string, score: number, extra = {}) => ({ id, submittedAt: `${day}T10:00:00Z`, departmentId: 'd1', department: 'ΜΕΘ', channel: 'link', answers: { workload: score, equipment: score, training: score, communication: score, management: score, safety_culture: score, overall: score, recommend: score * 2, safety_feedback: score >= 4, improve_areas: ['staffing'], comments: `σχόλιο ${id}`, ...extra } }) as SurveyResponse
const responses = [
  answer('a', '2026-04-10', 5), answer('b', '2026-05-12', 4), answer('c', '2026-06-20', 2),
  answer('d', '2026-01-15', 3), answer('e', '2026-02-10', 3), answer('f', '2025-05-01', 5),
]
const tables = (doc: ReturnType<typeof surveyDocument>) => (doc.sections || []).filter(section => section.table)

describe('Survey report: the periods', () => {
  it('keeps the responses inside the dates and finds the period of all of them', () => {
    expect(responsesInPeriod(responses, { from: '2026-04-01', to: '2026-06-30' }).map(row => row.id)).toEqual(['a', 'b', 'c'])
    expect(reportPeriod(responses)).toEqual({ from: '2025-05-01', to: '2026-06-20' })
    expect(reportPeriod([])).toBeNull()
  })
  it('compares with the days just before, the same dates last year, or any dates', () => {
    const quarter = { from: '2026-04-01', to: '2026-06-30' }
    expect(surveyComparePeriod('previous', quarter)).toEqual({ from: '2025-12-31', to: '2026-03-31' })
    expect(surveyComparePeriod('lastYear', quarter)).toEqual({ from: '2025-04-01', to: '2025-06-30' })
    expect(surveyComparePeriod('lastYear', { from: '2024-02-29', to: '2024-02-29' })).toEqual({ from: '2023-02-28', to: '2023-02-28' })
    expect(surveyComparePeriod('custom', quarter, { from: '2026-01-01', to: '2026-02-28' })).toEqual({ from: '2026-01-01', to: '2026-02-28' })
    expect(surveyComparePeriod('custom', quarter, { from: '2026-03-01', to: '2026-02-01' })).toBeNull()
    expect(surveyComparePeriod('none', quarter)).toBeNull()
    expect(pointsChange(80, 72.5, 'el')).toBe('+7,5 μον.')
    expect(pointsChange(80, 72.5, 'en')).toBe('+7.5 pts')
  })
})

describe('Survey report: the document', () => {
  it('summary: the satisfaction of each question with its bar, no comparison column', () => {
    const doc = surveyDocument({ survey: staff, responses, period: { from: '2026-04-01', to: '2026-06-30' }, language: 'el' })
    expect(doc.code).toBe('SRV-2026-03')
    expect(doc.subtitle).toBe('01/04/2026 – 30/06/2026')
    expect(doc.meta).toContainEqual(['Απαντήσεις', '3'])
    expect(doc.meta).toContainEqual(['Σύγκριση με', 'Χωρίς σύγκριση'])
    const first = tables(doc)[0].table!
    expect(first.columns!.map(column => (column as { text: string }).text)).toEqual(['Μέγεθος', 'Τιμή', 'Γράφημα'])
    expect(first.rows![0][1]).toMatchObject({ text: '66,7%' })
    expect(doc.sections!.map(section => section.title)).not.toContain('Ανά μήνα')
  })
  it('every table has the same columns with the same widths, so they line up', () => {
    const doc = surveyDocument({ survey: staff, responses, compare: 'previous', period: { from: '2026-04-01', to: '2026-06-30' }, detail: 'full' })
    const widths = tables(doc).map(section => section.table!.columns!.map(column => (column as { width: string }).width).join('|'))
    expect(new Set(widths).size).toBe(1)
    expect(widths[0].split('|').reduce((sum, width) => sum + parseFloat(width), 0)).toBe(100)
  })
  it('a comparison column with the earlier value and the change in points', () => {
    const doc = surveyDocument({ survey: staff, responses, compare: 'previous', period: { from: '2026-04-01', to: '2026-06-30' } })
    const first = tables(doc)[0].table!
    expect((first.columns![3] as { text: string }).text).toBe('31/12/2025 – 31/03/2026')
    // Now 2 of 3 satisfied, before 0 of 2.
    expect(first.rows![0][3]).toMatchObject({ text: '0% · +66,7 μον.' })
    expect(doc.meta).toContainEqual(['Σύγκριση με', 'Με την προηγούμενη περίοδο: 31/12/2025 – 31/03/2026'])
  })
  it('the comparison also reads the earlier questionnaires of the same kind (last year\'s), never the printed figures', () => {
    const lastYear = [answer('x', '2025-05-02', 5), answer('y', '2025-05-03', 5)]
    const doc = surveyDocument({ survey: staff, responses, earlier: lastYear, compare: 'lastYear', period: { from: '2026-04-01', to: '2026-06-30' } })
    const first = tables(doc)[0].table!
    expect(first.rows![0][1]).toMatchObject({ text: '66,7%' })
    expect(first.rows![0][3]).toMatchObject({ text: '100% · -33,3 μον.' })
    expect(readSource('src/features/quality/surveys/SurveyRecordPage.tsx')).toContain('loadEarlierResponses(tenant?.id, survey)')
  })
  it('detailed: answers 1–5, choice questions, by department, by month and the comments', () => {
    const doc = surveyDocument({ survey: staff, responses, detail: 'full', language: 'en' })
    const titles = doc.sections!.map(section => section.title)
    expect(titles).toEqual(expect.arrayContaining(['Choice questions', 'By department', 'By month', 'Comments']))
    expect(doc.meta).toContainEqual(['Layout', 'Detailed'])
    const html = buildReportHtml(doc, { branding: null })
    expect(html).toContain('1: 0 · 2: 1 · 3: 2 · 4: 1 · 5: 2')
    expect(html).toContain('σχόλιο a')
  })
  it('a questionnaire without responses still prints', () => {
    const doc = surveyDocument({ survey: staff, responses: [], detail: 'full' })
    expect(doc.subtitle).toBe('Χωρίς απαντήσεις')
    expect(() => buildReportHtml(doc, { branding: null })).not.toThrow()
  })
  it('«Ικανοποίηση Κουζίνας» prints its food questions and where they come from', () => {
    const wards = { ...surveyFromTemplate('wards'), id: 'w1', code: 'SRV-2026-01', status: 'open' } as Survey
    const view = kitchenView([wards])!
    const food = view.questions.map(question => question.id)
    const kept = kitchenResponses([answer('k1', '2026-04-02', 5, { food_quality: 5, food_service: 4 }), answer('k2', '2026-04-03', 2, { food_quality: 2 })], food)
    const doc = surveyDocument({ survey: view, responses: kept })
    expect(doc.code).toBe('SRV-KITCHEN')
    expect(doc.meta).toContainEqual(['Από', 'ερωτήσεις «Φαγητό» · ερωτηματολόγια ασθενών: 1'])
    expect(tables(doc)[0].table!.rows![0][1]).toMatchObject({ text: '66,7%' })
  })
  it('bars keep their colours in print and Word: inline, coloured by the target', () => {
    expect(barHtml(85, 80)).toContain('#2f855a')
    expect(barHtml(60, 80)).toContain('#d97706')
    expect(barHtml(null)).toContain('—')
    expect(stackedHtml([1, 0, 0, 0, 1])).toContain('width:50.0%')
  })
  it('the results page prints the document instead of the screen', () => {
    const page = readSource('src/features/quality/surveys/SurveyRecordPage.tsx')
    expect(page).toContain('onPrint={tab === \'results\' ? () => setPrinting(true) : undefined}')
    expect(page).not.toContain('window.print()')
  })
})
