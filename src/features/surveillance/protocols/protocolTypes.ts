import type { Tables } from '../../../core/supabase/database.types'
import type { ClinicalActor } from '../clinicalTypes'
import type { ProtocolStep } from './protocolCatalogue'

// The shape the protocol screens keep (protocolService translates it from the
// database rows, clinical_protocol_* and antimicrobial_therapy_reviews in database.types).
export type ProtocolRunRow = Tables<'clinical_protocol_runs'>
export type ProtocolStepRow = Tables<'clinical_protocol_steps'>
export type ProtocolEventRow = Tables<'clinical_protocol_events'>
export type TherapyReviewRow = Tables<'antimicrobial_therapy_reviews'>

// A recorded step of a run: done (time, value), «not indicated» (reason) or pending again.
export interface ProtocolRunStep {
  id?: string
  key: string
  status: string
  doneAt?: string | null
  value?: string
  notIndicatedReason?: string
  therapyId?: string | null
  recordedByName?: string
  recordedAt?: string
}

// What an event of the run keeps (clinical_protocol_events.detail): the trigger,
// the step status, the old and new recognition time, or the new weight.
export type ProtocolEventDetail = { source?: string, status?: string, from?: string, to?: string, weightKg?: number | null }
// An entry of the run's history, newest first.
export interface ProtocolRunEvent {
  id?: string
  type: string
  stepKey?: string | null
  detail: ProtocolEventDetail
  reason?: string
  actorName?: string
  at: string
}
// An event as the service appends it (the actor and the time are added there).
export interface ProtocolEventInput {
  type: string
  stepKey?: string
  detail?: ProtocolEventDetail
  reason?: string
}

// A protocol started on an episode (the demo keeps no startedBy and may lack the case).
export interface ProtocolRun {
  id: string
  caseId?: string
  protocolKey: string
  recognizedAt: string
  recognitionSource?: string
  weightKg?: number | null
  status: string
  startedBy?: string
  startedByName?: string
  startedAt?: string
  completedAt?: string | null
  completedByName?: string
  closeReason?: string
  steps: ProtocolRunStep[]
  events: ProtocolRunEvent[]
}
// What the read-only helpers (catalogue, timing) take as a run.
export type ProtocolRunLike = Partial<ProtocolRun>

// An open run as the surveillance list badges it (the lists still keep it untyped).
export interface OpenProtocolRun {
  caseId?: string
  protocolKey?: string
  recognizedAt?: string
}

// «Start protocol» from the episode header or a qSOFA / SOFA prompt.
export interface ProtocolStartRequest {
  recognizedAt?: string | null
  source?: string
  assessmentId?: string | null
}

// ── What the service's writes take ──────────────────────────────────────────

// Who records: the audit actor (the reviewer also gives the job title).
export interface ProtocolActor extends ClinicalActor {
  jobTitle?: string
}
export interface ProtocolStartDraft {
  protocolKey: string
  recognizedAt: string
  recognitionSource?: string
  weightKg?: number | null
  triggerAssessmentId?: string | null
}
// The step dialog saves with a time whenever the status is 'done'.
export interface ProtocolStepDraft {
  key: string
  status: string
  doneAt: string
  value?: string
  notIndicatedReason?: string
  therapyId?: string | null
}
export interface RecognitionTimeDraft {
  recognizedAt: string
  reason?: string
  weightKg?: number | null
}
// completed or closed (with a reason).
export interface ProtocolFinishDraft {
  status: string
  reason?: string
}

// ── Timing ──────────────────────────────────────────────────────────────────

// g green, a amber, r red, n grey (see protocolTiming).
export type StepTone = 'g' | 'a' | 'r' | 'n'
export interface StepState {
  tone: StepTone
  code: string
  minutes: number | null
  dueFrom?: string | null
  dueBy?: string | null
}
// A visible step of a run with what was recorded and its state; the panel numbers the main steps.
export interface RunStepItem {
  step: ProtocolStep
  recorded: ProtocolRunStep | null
  state: StepState
}
export type NumberedStepItem = RunStepItem & { number: number | null }

// ── Antimicrobial review (48–72 h) ──────────────────────────────────────────

export interface TherapyReview {
  id: string
  therapyId?: string
  caseId?: string | null
  decision: string
  reasons: string[]
  note: string
  newRegimen: string
  reviewedAt: string
  reviewerName: string
  reviewerJobTitle: string
  hoursAfterStart?: number
}
// A demo review keeps no time; it is placed `hoursAfterStart` after the therapy start when loaded.
export type DemoTherapyReview = Omit<TherapyReview, 'reviewedAt'> & { reviewedAt: string | null }
export interface TherapyReviewDraft {
  decision: string
  reasons: string[]
  note?: string
  newRegimen?: string
}

export type ReviewState = 'reviewed' | 'reviewedLate' | 'closed' | 'upcoming' | 'due' | 'overdue'
// Where a therapy stands in its review window.
export interface ReviewWindow {
  therapyId?: string
  start: Date
  opensAt: Date
  dueBy: Date
  hours: number
  latest: TherapyReview | null
  reviews: TherapyReview[]
  state: ReviewState
  reviewedHours?: number
  hoursToOpen?: number
  hoursLeft?: number
  hoursOver?: number
}

// The values a translated text takes ({name}, {time}, …).
export type FillVars = Record<string, string | number | null | undefined>
