import { describe, it, expect } from 'vitest'
import { acknowledgementComplete, nextEvaluationStep } from '../src/features/employees/employeeEvaluationWorkflow'

const evaluation = (status, source = 'employee_evaluations') => ({ status, source })
const everyone = { canCreate: true, canHrApprove: true, canAdminApprove: true, selfReadOnly: true }

describe('nextEvaluationStep', () => {
  it('moves draft → submitted → acknowledged → HR approved → finalized, one step per status', () => {
    expect(['draft', 'submitted', 'employee_acknowledged', 'hr_approved', 'finalized'].map(status => nextEvaluationStep(evaluation(status), everyone)))
      .toEqual(['submit', 'acknowledge', 'hrApprove', 'finalize', null])
  })

  it('each step belongs to one party', () => {
    expect(nextEvaluationStep(evaluation('draft'), { canHrApprove: true })).toBeNull()
    expect(nextEvaluationStep(evaluation('submitted'), { canCreate: true, canHrApprove: true, canAdminApprove: true })).toBeNull()
    expect(nextEvaluationStep(evaluation('employee_acknowledged'), { canCreate: true, selfReadOnly: true })).toBeNull()
    expect(nextEvaluationStep(evaluation('hr_approved'), { canHrApprove: true })).toBeNull()
  })

  it('a training knowledge assessment is never submitted as a performance evaluation', () => {
    expect(nextEvaluationStep(evaluation('draft', 'training'), everyone)).toBeNull()
  })

  it('nothing is selected, nothing to do', () => {
    expect(nextEvaluationStep(null, everyone)).toBeNull()
  })
})

describe('acknowledgementComplete', () => {
  it('needs an answer, and a comment when the employee disagrees', () => {
    expect(acknowledgementComplete('', 'ok')).toBe(false)
    expect(acknowledgementComplete('agree', '')).toBe(true)
    expect(acknowledgementComplete('disagree', '   ')).toBe(false)
    expect(acknowledgementComplete('disagree', 'The period is wrong')).toBe(true)
  })
})
