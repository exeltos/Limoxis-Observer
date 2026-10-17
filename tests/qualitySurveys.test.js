import { describe, expect, it } from 'vitest'
import { SCALES, cleanAnswers, isQuestionShown, scaleOf, sectionLabel, departmentBreakdown, filterResponses, isSurveyOpen, monthlyTrend, nextSurveyCode, questionResult, responsesExport, surveyFromTemplate, surveyProblems, surveySummary } from '../src/features/quality/surveys/surveyModel'
import { filterSurveys, surveyCounts } from '../src/features/quality/surveys/SurveysPanel'
import { formSections, missingAnswers } from '../src/features/quality/surveys/SurveyForm'
import { qualityTabOf } from '../src/features/quality/qualityReturnSection'

const rating = (id, extra = {}) => ({ id, type: 'rating', label: id, required: true, options: [], ...extra })
const survey = { code: 'SRV-2026-01', title: 'Τεστ', satisfiedTarget: 80, questions: [rating('food'), rating('care'), { id: 'recommend', type: 'nps', label: 'NPS', required: true, options: [] }, { id: 'clean', type: 'yesno', label: 'Yes', required: false, options: [] }, { id: 'areas', type: 'multiple', label: 'Areas', required: false, options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] }, { id: 'note', type: 'text', label: 'Note', required: false, options: [] }] }
const response = (id, answers, extra = {}) => ({ id, answers, departmentId: 'd1', department: 'ΜΕΘ', channel: 'link', submittedAt: '2026-09-10T10:00:00Z', ...extra })

describe('Satisfaction surveys: the answers kept', () => {
  it('keeps only the survey’s questions, each of its kind, and refuses a missing required one', () => {
    expect(cleanAnswers(survey.questions, { food: 5, care: 4, recommend: 9, clean: true, areas: ['a'], note: '  καλό ', other: 'x' })).toEqual({ food: 5, care: 4, recommend: 9, clean: true, areas: ['a'], note: 'καλό' })
    expect(cleanAnswers(survey.questions, { food: 5, care: 4 })).toBeNull()
    expect(cleanAnswers(survey.questions, { food: 7, care: 4, recommend: 9 })).toBeNull()
    expect(cleanAnswers(survey.questions, { food: 5, care: 4, recommend: 9, areas: ['z'] })).toEqual({ food: 5, care: 4, recommend: 9 })
    expect(missingAnswers(survey.questions, { food: 5 }, { askDepartment: true })).toEqual(['department', 'care', 'recommend'])
  })

  it('says what a survey needs before it opens, and numbers surveys within the year', () => {
    expect(surveyProblems({ title: '', questions: [] })).toHaveLength(2)
    expect(surveyProblems({ title: 'x', questions: [{ id: 'q', type: 'single', label: 'q', options: [{ value: 'a', label: 'A' }] }] })).toHaveLength(1)
    expect(surveyProblems(surveyFromTemplate('inpatient'))).toEqual([])
    expect(nextSurveyCode(['SRV-2026-01', 'SRV-2026-03', 'SRV-2025-09'], 2026)).toBe('SRV-2026-04')
    expect(isSurveyOpen({ status: 'open', opensOn: '2026-01-01', closesOn: '2026-12-31' }, '2026-06-01')).toBe(true)
    expect(isSurveyOpen({ status: 'open', closesOn: '2026-05-31' }, '2026-06-01')).toBe(false)
    expect(isSurveyOpen({ status: 'draft' }, '2026-06-01')).toBe(false)
  })
})

describe('Satisfaction surveys: what the answers say', () => {
  const responses = [
    ...Array.from({ length: 6 }, (_, index) => response(`a${index}`, { food: 2, care: 5, recommend: 10, clean: true, areas: ['a'] })),
    ...Array.from({ length: 4 }, (_, index) => response(`b${index}`, { food: 5, care: 4, recommend: 3, clean: false, note: 'Κρύο φαγητό' }, { departmentId: 'd2', department: 'Χειρουργική', submittedAt: '2026-10-02T10:00:00Z' })),
  ]

  it('reads a scale as mean and share answering 4–5, and the recommendation score as promoters minus detractors', () => {
    expect(questionResult(survey.questions[0], responses)).toMatchObject({ count: 10, mean: 3.2, satisfied: 40, distribution: [0, 6, 0, 0, 4] })
    expect(questionResult(survey.questions[2], responses)).toMatchObject({ promoters: 60, detractors: 40, nps: 20 })
    expect(questionResult(survey.questions[3], responses).yes).toBe(60)
    expect(questionResult(survey.questions[4], responses).options[0]).toMatchObject({ value: 'a', count: 6, share: 100 })
    expect(questionResult(survey.questions[5], responses).texts).toHaveLength(4)
  })

  it('flags a question below target only with 10 answers or more, worst first', () => {
    const summary = surveySummary(survey, responses)
    expect(summary).toMatchObject({ responses: 10, satisfied: 70, nps: 20, comments: 4 })
    expect(summary.below.map(result => result.question.id)).toEqual(['food'])
    expect(surveySummary(survey, responses.slice(0, 9)).below).toEqual([])
  })

  it('breaks down by department and month, and filters by department, channel, dates and comment text', () => {
    expect(departmentBreakdown(survey, responses).map(row => [row.department, row.responses])).toEqual([['ΜΕΘ', 6], ['Χειρουργική', 4]])
    expect(monthlyTrend(survey, responses).map(row => [row.month, row.responses])).toEqual([['2026-09', 6], ['2026-10', 4]])
    expect(filterResponses(responses, { department: 'd2' })).toHaveLength(4)
    expect(filterResponses(responses, { from: '2026-10-01' })).toHaveLength(4)
    expect(filterResponses(responses, { query: 'κρύο' })).toHaveLength(4)
    const csv = responsesExport(survey, responses.slice(0, 1))
    expect(csv.headers.slice(0, 3)).toEqual(['Ημερομηνία', 'Τμήμα', 'Τρόπος'])
    expect(csv.rows[0]).toEqual(['2026-09-10', 'ΜΕΘ', 'Σύνδεσμος / QR', 2, 5, 10, 'Ναι', 'A', ''])
  })
})

describe('Satisfaction surveys in the Quality Center', () => {
  it('counts and filters the list, and remembers the Surveys view', () => {
    const today = new Date().toISOString().slice(0, 10)
    const soon = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
    const surveys = [{ id: '1', code: 'SRV-1', title: 'Α', status: 'open', closesOn: soon, responseCount: 10, recentCount: 3 }, { id: '2', code: 'SRV-2', title: 'Β', status: 'draft', responseCount: 0, recentCount: 0 }, { id: '3', code: 'SRV-3', title: 'Γ', status: 'closed', opensOn: today, responseCount: 5, recentCount: 0 }]
    expect(surveyCounts(surveys)).toEqual({ open: 1, recent: 3, responses: 15, closing: 1, drafts: 1 })
    const base = { query: '', audience: 'all', status: 'all', quick: null }
    expect(filterSurveys(surveys, base).map(item => item.id)[0]).toBe('1')
    expect(filterSurveys(surveys, { ...base, quick: 'draft' }).map(item => item.id)).toEqual(['2'])
    expect(qualityTabOf('indicators:surveys')).toEqual({ tab: 'indicators', view: 'surveys' })
  })
})

describe('Satisfaction surveys: sections, scales and follow-up questions', () => {
  it('builds the ΙΑΣΩ questionnaires with the hospital’s name and their sections', () => {
    const wards = surveyFromTemplate('wards', { hospital: 'ΙΑΣΩ Θεσσαλίας' })
    expect(wards.questions.some(question => question.label.includes('ΙΑΣΩ Θεσσαλίας'))).toBe(true)
    expect(JSON.stringify(wards)).not.toContain('{hospital}')
    expect(wards.questions.every(question => wards.sections.some(section => section.key === question.section))).toBe(true)
    const kitchen = surveyFromTemplate('kitchen')
    expect(kitchen.questions.find(question => question.id === 'overall').label).toContain('νοσοκομείο')
    // No questionnaire asks who answered.
    for (const key of ['wards', 'maternity', 'kitchen']) expect(surveyFromTemplate(key).questions.map(question => question.id)).not.toEqual(expect.arrayContaining(['name', 'room', 'email', 'phone']))
  })

  it('shows a follow-up question only after the answer it depends on, and keeps nothing from it otherwise', () => {
    const questions = surveyFromTemplate('kitchen').questions
    const kept = questions.find(question => question.id === 'diet_kept')
    expect(isQuestionShown(kept, { diet: false })).toBe(false)
    expect(isQuestionShown(kept, { diet: true })).toBe(true)
    const full = Object.fromEntries(questions.filter(question => question.required).map(question => [question.id, 4]))
    expect(cleanAnswers(questions, { ...full, diet: false, diet_kept: 2 })).not.toHaveProperty('diet_kept')
    expect(cleanAnswers(questions, { ...full, diet: true, diet_kept: 2 })).toHaveProperty('diet_kept', 2)
    expect(missingAnswers(questions, { diet: true })).not.toContain('diet_kept')
  })

  it('words a rating by its scale, and names a section by the survey’s own title first', () => {
    expect(scaleOf({ scale: 'speed' })[0][0]).toBe('Αργή')
    expect(scaleOf({})).toBe(SCALES[0].steps)
    expect(sectionLabel('meals', 'el', [{ key: 'meals', label: 'Πρωινό', labelEn: 'Breakfast' }])).toBe('Πρωινό')
    expect(sectionLabel('meals', 'en', [{ key: 'meals', label: 'Πρωινό', labelEn: 'Breakfast' }])).toBe('Breakfast')
    const sections = formSections(surveyFromTemplate('kitchen'), { diet: false })
    expect(sections.map(section => section.key)).toEqual(['meals', 'service', 'overall', 'comments'])
    expect(sections[0].questions.map(question => question.id)).not.toContain('diet_kept')
  })
})
