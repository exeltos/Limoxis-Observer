// The learner's page (training-access, owner 20/11/2026) in steps: 1. Υλικό → 2. Ερωτήσεις (only when the programme
// asks for an assessment) → 3. Αξιολόγηση (the trainer & training evaluation) → 4. Υποβολή (the attendance declaration
// and the one final submission, with what is still missing). After the submission the same link shows the result:
// the score or «Ολοκληρώθηκε» / «Αναμονή ελέγχου», pass or not, the certificate and the material (read only).
// Pure functions, so the page and the tests agree.
import { trainingCategoryLabel, trainingMethodLabel } from './TrainingProgramForm'
import type { AssessmentOption, AssessmentQuestion, TrainingAssignment, TrainingProgram } from './trainingTypes'

export type AccessStep = 'material' | 'questions' | 'evaluation' | 'submit'
export type AccessQuestionLike = Omit<Partial<AssessmentQuestion>, 'options'> & { id: string, options?: (AssessmentOption | string)[] }
type ProgramLike = Pick<TrainingProgram, 'requiresAssessment'> & Partial<Pick<TrainingProgram, 'category' | 'method' | 'trainer' | 'owner' | 'dueDate' | 'passScore'>>

export function accessSteps(program: Pick<TrainingProgram, 'requiresAssessment'> | null | undefined): AccessStep[] {
  return program?.requiresAssessment ? ['material', 'questions', 'evaluation', 'submit'] : ['material', 'evaluation', 'submit']
}

const STEP_LABELS: Record<AccessStep, [string, string]> = { material: ['Υλικό', 'Material'], questions: ['Ερωτήσεις', 'Questions'], evaluation: ['Αξιολόγηση', 'Evaluation'], submit: ['Υποβολή', 'Submit'] }
export const accessStepLabel = (step: AccessStep, en = false) => STEP_LABELS[step][en ? 1 : 0]

// A step index kept inside the steps (a programme without questions has three).
export const clampStep = (index: number, steps: AccessStep[]) => Math.max(0, Math.min(steps.length - 1, Number.isFinite(index) ? Math.trunc(index) : 0))

export function questionAnswered(question: AccessQuestionLike | null | undefined, answer: unknown) {
  if (question?.required === false) return true
  if (answer === undefined || answer === null) return false
  if (Array.isArray(answer)) return answer.length > 0
  if (typeof answer === 'string') return answer.trim().length > 0
  return true
}

export interface AccessMissing { unanswered: number, notConfigured: boolean, attestation: boolean }
// What still stops the final submission: unanswered required questions (or an assessment with no questions), and the
// attendance declaration.
export function accessMissing(program: Pick<TrainingProgram, 'requiresAssessment'> | null | undefined, questions: AccessQuestionLike[], answers: Record<string, unknown>, attested: boolean): AccessMissing {
  const assess = Boolean(program?.requiresAssessment)
  return {
    unanswered: assess ? questions.filter(q => !questionAnswered(q, answers[q.id])).length : 0,
    notConfigured: assess && !questions.length,
    attestation: !attested,
  }
}
export const accessReady = (missing: AccessMissing) => !missing.unanswered && !missing.notConfigured && !missing.attestation

// The link is locked once the learner has submitted (or the training was completed by other means).
export const accessSubmitted = (assignment: Partial<Pick<TrainingAssignment, 'feedbackSubmittedAt' | 'status' | 'completionConfirmedAt'>> | null | undefined) =>
  Boolean(assignment && (assignment.feedbackSubmittedAt || assignment.status === 'completed' || assignment.completionConfirmedAt))

export type AccessResultKind = 'review' | 'passed' | 'failed' | 'completed'
export interface AccessResult { kind: AccessResultKind, score: number | null }
type Outcome = { score?: number | null, competent?: boolean | null, assessmentReviewStatus?: string | null, manualReviewRequired?: boolean } | null | undefined
// What the result view says: a free-text answer waits for review; with a score, pass or retraining; otherwise completed.
// The submission's own answer (outcome) wins over the stored assignment, which may not have been read again yet.
export function accessResult(assignment: Outcome, outcome: Outcome = null): AccessResult {
  const source = { ...(assignment || {}), ...Object.fromEntries(Object.entries(outcome || {}).filter(([, value]) => value !== undefined)) } as NonNullable<Outcome>
  const score = source.score ?? null
  if (source.manualReviewRequired || source.assessmentReviewStatus === 'pending') return { kind: 'review', score }
  if (source.competent === false) return { kind: 'failed', score }
  if (score != null) return { kind: 'passed', score }
  return { kind: 'completed', score }
}

const dayText = (value: string | null | undefined, en: boolean) => value ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString(en ? 'en-GB' : 'el-GR') : ''
// The details in one line: «Κατηγορία · Τρόπος · Εκπαιδευτής · Προθεσμία» (what is not known is left out).
export function accessDetailParts(program: ProgramLike | null | undefined, language = 'el') {
  const en = language === 'en'
  const clean = (value: string) => (value && value !== '—' ? value : '')
  const due = dayText(program?.dueDate, en)
  return [
    program?.category ? clean(trainingCategoryLabel(program.category, language)) : '',
    program?.method ? clean(trainingMethodLabel(program.method, language)) : '',
    clean(program?.trainer || program?.owner || ''),
    due ? `${en ? 'Due' : 'Προθεσμία'}\u00a0${due}` : '',
  ].filter(Boolean)
}
