import { describe, expect, it } from 'vitest'
import { trainingDemoState } from '../src/features/training/trainingData'
import { trainingAssessmentIsValid, trainingAssessmentMaxScore } from '../src/features/training/trainingAssessment'
import { employeeRows, occupationalVisits, employeeVaccinations, employeeEvaluations, employeeExposureIncidents, employeeHistoryDemo, demoEmployeeDocuments } from '../src/features/employees/employeeDemoData'

const correct = (q, v) => q.type === 'single_choice' ? q.options.find(o => o.id === v)?.correct
  : q.type === 'true_false' ? v === q.correctBoolean
  : q.type === 'multiple_choice' ? JSON.stringify(v) === JSON.stringify(q.options.filter(o => o.correct).map(o => o.id)) : false

describe('demo training assessments', () => {
  it('every demo programme has valid knowledge-assessment questions', () => {
    for (const program of trainingDemoState.programs) {
      expect(program.assessmentQuestions.length, program.id).toBeGreaterThanOrEqual(5)
      expect(trainingAssessmentIsValid(program.assessmentQuestions), program.id).toBe(true)
    }
  })
  it('each submitted score follows from the submitted answers', () => {
    const submitted = trainingDemoState.assignments.filter(a => a.assessmentAnswers)
    expect(submitted.length).toBeGreaterThanOrEqual(6)
    for (const a of submitted) {
      const program = trainingDemoState.programs.find(p => p.id === a.programId)
      const got = program.assessmentQuestions.reduce((n, q) => n + (correct(q, a.assessmentAnswers[q.id]) ? q.points : 0), 0)
      expect(Math.round(100 * got / trainingAssessmentMaxScore(program.assessmentQuestions)), a.id).toBe(a.score)
      expect(a.competent, a.id).toBe(a.score >= program.passScore)
      expect(Boolean(a.certificateId), a.id).toBe(a.competent)
    }
  })
})

describe('demo employee record tabs', () => {
  const active = employeeRows.filter(e => e.employmentStatus === 'active')
  it('every active employee has data in the record tabs', () => {
    for (const e of active) {
      expect(occupationalVisits.some(x => x.employeeId === e.id), `${e.id} visits`).toBe(true)
      expect(employeeVaccinations.some(x => x.employeeId === e.id), `${e.id} vaccinations`).toBe(true)
      expect(employeeExposureIncidents.some(x => x.employeeId === e.id), `${e.id} exposures`).toBe(true)
      expect(employeeHistoryDemo.some(x => x.employeeId === e.id), `${e.id} history`).toBe(true)
      expect(demoEmployeeDocuments(e, trainingDemoState.certificates).length, `${e.id} documents`).toBeGreaterThan(0)
    }
  })
  it('performance evaluations carry period, evaluator and criteria scores', () => {
    for (const e of employeeRows) expect(employeeEvaluations.some(x => x.employeeId === e.id), e.id).toBe(true)
    for (const ev of employeeEvaluations) {
      expect(ev.period, ev.id).toBeTruthy()
      expect(ev.evaluatorName, ev.id).toBeTruthy()
      expect(ev.criteria).toHaveLength(8)
      expect(ev.overallScore).toBeGreaterThan(0)
    }
  })
  it('an inactive employee has no current-season vaccination or training', () => {
    const inactive = employeeRows.filter(e => e.employmentStatus !== 'active').map(e => e.id)
    expect(employeeVaccinations.some(x => inactive.includes(x.employeeId) && x.dose === '2025/26')).toBe(false)
    expect(trainingDemoState.assignments.some(x => inactive.includes(x.employeeId))).toBe(false)
  })
})
