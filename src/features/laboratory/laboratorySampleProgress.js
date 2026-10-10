// Where a laboratory sample stands in its workflow (received → result →
// susceptibility testing → critical-result communication → documents →
// finalized), and the checks on a microbiology result before it is saved.

export const organismsOf = result => String(result?.organism || '').split(',').map(name => name.trim()).filter(Boolean)

export function sampleProgress(sample) {
  const result = sample?.microbiologyResults?.[0] || null
  const ast = result?.ast || []
  const communications = result?.communications || []
  const organisms = organismsOf(result)
  const hasAst = name => ast.some(row => row.organism === name)

  const finalized = Boolean(sample?.finalizedAt)
  const rejected = sample?.status === 'rejected'
  const received = Boolean(sample && (sample.receivedAt || ['processing', 'completed'].includes(sample.status)))
  const resultValidated = Boolean(result && ['validated', 'amended'].includes(result.resultStatus))
  // Every organism of a positive result needs its own susceptibility test.
  const astRequired = result?.result === 'positive' && organisms.length > 0
  const astComplete = !astRequired || organisms.every(hasAst)
  // A critical result must be communicated (read-back) before finalizing.
  const communicationRequired = Boolean(result?.critical)
  const communicationComplete = !communicationRequired || communications.length > 0
  const documentsReviewed = Boolean(sample?.documentsReviewedAt)

  return {
    result,
    ast,
    amr: result?.amr || [],
    communications,
    organisms,
    finalized,
    rejected,
    locked: finalized || rejected,
    received,
    resultValidated,
    astRequired,
    astComplete,
    astDone: organisms.filter(hasAst).length,
    firstMissingAst: organisms.find(name => !hasAst(name)),
    communicationRequired,
    communicationComplete,
    documentsReviewed,
    readyToFinalize: Boolean(resultValidated && astComplete && communicationComplete && documentsReviewed),
  }
}

// Each workflow step is 'na' (not required), 'done', 'next' (the first one
// still open) or 'todo'.
export function workflowStates(steps) {
  let nextAssigned = false
  return steps.map(step => {
    if (step.na) return { ...step, state: 'na' }
    if (step.done) return { ...step, state: 'done' }
    if (nextAssigned) return { ...step, state: 'todo' }
    nextAssigned = true
    return { ...step, state: 'next' }
  })
}

// A result can be saved once it has an outcome (and, for an environmental
// positive, a CFU count); a positive clinical result needs at least one
// organism before it can be validated.
export function resultDraftChecks(draft, isEnvironmental) {
  return {
    complete: Boolean(draft.result) && (!isEnvironmental || draft.result === 'negative' || draft.cfuCount !== ''),
    needsOrganism: !isEnvironmental && draft.result === 'positive' && !draft.organisms.length,
  }
}

// The result as saved. For an environmental sample, a negative counts 0 CFU
// and the count is compared with the standard's limit (within when ≤ limit).
export function resultToSave(draft, validationStatus, { isEnvironmental = false, standard = null } = {}) {
  const hasLimit = standard?.limitCfu != null && standard?.limitCfu !== ''
  const cfu = isEnvironmental ? (draft.result === 'negative' ? 0 : draft.cfuCount === '' ? null : Number(draft.cfuCount)) : null
  const limit = isEnvironmental && hasLimit ? Number(standard.limitCfu) : null
  const within = isEnvironmental && limit != null && cfu != null ? cfu <= limit : null
  return { ...draft, validationStatus, organism: draft.organisms.join(', '), cfuCount: cfu, cfuLimit: limit, withinLimit: within, pendingAmr: {} }
}
