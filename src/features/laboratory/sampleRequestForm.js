// «Αίτημα δείγματος»: the request an episode (or its follow-up «Επανέλεγχος») sends to the
// laboratory. The request carries who and why (patient, episode, department, sample type
// and site, priority); results are entered only in the Laboratory. See
// docs/SAMPLE_REQUEST_FORM.md for how to add a question.

// Questions added to the request, after the core fields. Each entry:
//   { key, label: { el, en }, kind: 'choice' | 'text', required, options: [{ value, label: { el, en } }] }
// The dialog renders them, validates the required ones with the shared form rule and hands
// the answers to onSave as `requestQuestions: { [key]: value }`.
export const SAMPLE_REQUEST_QUESTIONS = Object.freeze([])

export const SAMPLE_REQUEST_PRIORITIES = Object.freeze(['routine', 'urgent', 'critical'])

// The draft a request starts from (the dialog adds an empty answer per question).
export function emptySampleRequest({ type = '', questions = SAMPLE_REQUEST_QUESTIONS } = {}) {
  return {
    type: type || 'bloodCulture',
    source: '',
    priority: 'routine',
    requestQuestions: Object.fromEntries(questions.map(question => [question.key, ''])),
  }
}

// The keys of the required fields still empty, in form order (type and site first).
export function missingRequestFields(draft, questions = SAMPLE_REQUEST_QUESTIONS) {
  const missing = []
  if (!draft?.type) missing.push('type')
  if (!String(draft?.source || '').trim()) missing.push('source')
  for (const question of questions) {
    if (question.required && !String(draft?.requestQuestions?.[question.key] ?? '').trim()) missing.push(`question:${question.key}`)
  }
  return missing
}

// What is saved: a request has no collection time (the laboratory records the collection),
// so the sample is stored in the «requested» state.
export function sampleRequestPayload(draft) {
  const { type, source, priority, requestQuestions } = draft
  return { type, source: String(source || '').trim(), priority: priority || 'routine', requestQuestions }
}
