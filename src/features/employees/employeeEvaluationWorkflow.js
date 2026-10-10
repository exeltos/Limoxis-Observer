// The performance evaluation workflow: draft → submitted to the employee →
// acknowledged by the employee → approved by HR → finalized by the administrator.
// Each status allows one next step, to one party.

export function nextEvaluationStep(evaluation, { canCreate = false, canHrApprove = false, canAdminApprove = false, selfReadOnly = false } = {}) {
  if (!evaluation) return null
  // Only the evaluator's own drafts are submitted; training assessments arrive finished.
  if (evaluation.status === 'draft') return evaluation.source === 'employee_evaluations' && canCreate ? 'submit' : null
  // Only the evaluated employee acknowledges, from their own (read-only) record.
  if (evaluation.status === 'submitted') return selfReadOnly ? 'acknowledge' : null
  if (evaluation.status === 'employee_acknowledged') return canHrApprove ? 'hrApprove' : null
  if (evaluation.status === 'hr_approved') return canAdminApprove ? 'finalize' : null
  return null
}

// The employee states whether they agree; disagreeing needs a comment.
export function acknowledgementComplete(agreement, comment) {
  return Boolean(agreement) && (agreement !== 'disagree' || Boolean(String(comment || '').trim()))
}
