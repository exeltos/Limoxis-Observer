import type { Tables } from '../../core/supabase/database.types'

// The shapes of the clinical course of a surveillance episode: the database rows
// clinicalCloudMappers reads (with their embedded lists), the records the
// screens keep (clinicalCloudService maps the rows, the demo store writes them
// by hand), and what the repository's writes take. Demo and cloud records name
// some fields differently, so most record fields are optional.

// ── Database rows ───────────────────────────────────────────────────────────

// A surveillance episode row.
export type ClinicalCaseRow = Tables<'surveillance_cases'>
// The case columns the mapping reads (a full row, or a line of surveillance_case_summaries, which has no created_by).
export type ClinicalCaseRowBase = Pick<ClinicalCaseRow, 'id' | 'patient_id' | 'department_id' | 'status' | 'started_at' | 'closed_at' | 'close_reason' | 'review_due_on' | 'room' | 'reason' | 'reason_en' | 'suspected_source' | 'isolation_required' | 'isolation_decided_at' | 'isolation_decided_by' | 'reopened_at' | 'reopen_reason'> & { organization_id?: string, created_by?: string | null }
// A timeline event row of an episode.
export type SurveillanceEventRow = Tables<'surveillance_events'>
// A finding of an assessment, as ASSESSMENT_SELECT embeds it.
export type AssessmentFindingRow = Pick<Tables<'clinical_assessment_findings'>, 'kind' | 'position' | 'label' | 'value_text' | 'value_numeric' | 'value_boolean'>
// A clinical assessment row with its findings.
export type AssessmentRow = Tables<'clinical_assessments'> & { findings?: AssessmentFindingRow[] | null }
// A criterion of an HAI classification, as HAI_SELECT embeds it.
export type HaiCriterionRow = Pick<Tables<'hai_classification_criteria'>, 'position' | 'criterion_id'>
// An HAI classification row with its criteria.
export type HaiRow = Tables<'hai_classifications'> & { criteria?: HaiCriterionRow[] | null }
// A precaution of an isolation, as ISOLATION_SELECT embeds it.
export type IsolationPrecautionRow = Pick<Tables<'isolation_episode_precautions'>, 'position' | 'precaution'>
// An isolation episode row with its precautions.
export type IsolationRow = Tables<'isolation_episodes'> & { precaution_rows?: IsolationPrecautionRow[] | null }
// The isolation columns the mapping reads (a full row, or the isolation of a list line).
export type IsolationRowBase = Pick<IsolationRow, 'id' | 'room' | 'reason' | 'started_at' | 'review_due_at' | 'ended_at' | 'end_reason' | 'status' | 'created_at' | 'created_by' | 'ended_by' | 'precaution_rows'> & { surveillance_case_id?: string | null }
// A category of an AMR classification, as AMR_SELECT embeds it.
export type AmrCategoryRow = Pick<Tables<'amr_classification_categories'>, 'susceptible' | 'position' | 'category'>
// An AMR classification row with its categories.
export type AmrRow = Tables<'amr_classifications'> & { categories?: AmrCategoryRow[] | null }
// A laboratory sample row.
export type SampleRow = Tables<'laboratory_samples'>
// A microbiology result row of a sample.
export type MicrobiologyResultRow = Tables<'microbiology_results'>
// A susceptibility (AST) row of a result.
export type SusceptibilityRow = Tables<'antimicrobial_susceptibility_results'>
// A critical result communication row of a result.
export type CriticalCommunicationRow = Tables<'critical_result_communications'>
// An antimicrobial therapy row.
export type TherapyRow = Tables<'antimicrobial_therapies'>
// A dose (administration) row of a therapy.
export type AdministrationRow = Tables<'antimicrobial_therapy_administrations'>
// A device row of an episode.
export type DeviceRow = Tables<'surveillance_devices'>
// A reassessment row of an episode.
export type ReassessmentRow = Tables<'surveillance_reassessments'>
// An outcome row of an episode.
export type OutcomeRow = Tables<'surveillance_outcomes'>
// The patient columns an episode reads.
export type CasePatientRow = Pick<Tables<'patients'>, 'id' | 'patient_code' | 'first_name' | 'last_name' | 'date_of_birth' | 'admission_date' | 'status'>
// The department columns an episode reads.
export type CaseDepartmentRow = Pick<Tables<'departments'>, 'id' | 'name'>
// The laboratory rows of an episode's samples, read together.
export interface RelatedLabRows {
  results?: MicrobiologyResultRow[]
  amrRows?: AmrRow[]
  astRows?: SusceptibilityRow[]
  communications?: CriticalCommunicationRow[]
}
// A sample of a list line (surveillance_case_summaries): only one naming an organism or a resistance.
export interface CaseSummarySampleRow {
  id: string
  sample_code: string
  requested_at: string | null
  organism: string | null
  resistance: string | null
}
// A line of surveillance_case_summaries (20261201110000): the episode with its patient, department, isolation and samples.
export type CaseSummaryRow = ClinicalCaseRowBase & {
  organization_id: string
  patient_sample_count?: number | null
  case_sample_count?: number | null
  patient?: CasePatientRow | null
  department?: CaseDepartmentRow | null
  isolation?: Omit<IsolationRowBase, 'surveillance_case_id'> | null
  samples?: CaseSummarySampleRow[] | null
}

// ── Records the screens keep ────────────────────────────────────────────────

// A clinical assessment: cloud keeps assessmentType and signsSymptoms, the demo type, symptoms and the English texts.
export interface ClinicalAssessment {
  id?: string
  date?: string
  assessmentType?: string
  type?: string
  classification?: string | null
  signsSymptoms?: string[]
  symptoms?: string[]
  symptomsEn?: string[]
  riskFactors?: string[]
  riskFactorsEn?: string[]
  summary?: string
  summaryEn?: string
  notes?: string
  byId?: string
  assessedBy?: string
}

// An HAI classification of an episode (`type` is the HAI type, e.g. bloodstreamInfection).
export interface HaiClassification {
  id?: string
  status?: string
  type: string
  definitionSet?: string
  definitionVersion?: string | null
  criteriaMet?: boolean | null
  criteriaEvidence?: string[]
  rationale?: string
  rationaleEn?: string
  classifiedAt?: string
  classifiedBy?: string
}

// The AMR calculation kept with a classification (amrCalculationSnapshot).
export interface AmrCalculationSnapshot {
  mechanism?: string
  categoriesTested?: number
  susceptibleCategories?: string[]
  nonSusceptibleCategories?: string[]
}

// The AMR classification of a microbiology result.
export interface AmrClassification {
  id: string
  classification: string | null
  status: string
  definitionSource: string
  definitionVersion: string
  calculationSnapshot: AmrCalculationSnapshot
  rationale: string
  classifiedAt: string | null
  classifiedBy: string | null
}

// One antimicrobial of a susceptibility test.
export interface SusceptibilityResult {
  id: string
  antimicrobial: string
  method: string
  micValue: number | null
  diskZoneMm: number | null
  interpretation: string
  breakpointStandard: string
  breakpointVersion: string
  breakpointValue: number | string | null
  testedAt: string
}

// A critical result told to the ward.
export interface CriticalCommunication {
  id: string
  at: string
  byId: string
  recipient: string
  recipientRole: string | null
  channel: string
  readBackConfirmed: boolean | null
  notes: string
}

// A microbiology result of a sample, with its AMR, AST and communications.
export interface MicrobiologyResult {
  id: string
  status: string
  organism: string | null
  resistanceClass: string | null
  susceptibilitySummary: string | null
  critical: boolean
  resultedAt: string
  validationStatus: string
  validatedAt: string | null
  validatedBy: string | null
  method: string | null
  preliminary: boolean
  interpretationStandard: string | null
  interpretationVersion: string | null
  amr: AmrClassification | null
  ast: SusceptibilityResult[]
  communications: CriticalCommunication[]
}

// A sample of an episode, or a laboratory list row placed under one: `id` is the sample code, `recordId` the row id.
export interface EpisodeSample {
  id?: string
  recordId?: string
  sampleCode?: string
  type?: string
  sampleType?: string
  source?: string | null
  sourceEn?: string | null
  collectedAt?: string | null
  receivedAt?: string | null
  requestedAt?: string | null
  requestedBy?: string | null
  resultedAt?: string | null
  status?: string
  result?: string | null
  organism?: string | null
  resistance?: string | null
  amr?: string | null
  susceptibility?: string | null
  critical?: boolean
  communicatedAt?: string | null
  priority?: string
  patientId?: string | null
  patientRecordId?: string | null
  departmentId?: string | null
  surveillanceCase?: string | null
  surveillanceCaseId?: string | null
  surveillance_case_id?: string | null
  surveillanceLinkInferred?: boolean
  microbiologyResults?: MicrobiologyResult[]
}

// An isolation of an episode (cloud reviewDue, demo nextReview).
export interface ClinicalIsolation {
  id?: string
  precautions?: string[]
  room?: string
  reason?: string
  startedAt?: string
  reviewDue?: string | null
  nextReview?: string | null
  endedAt?: string | null
  endReason?: string
  status?: string
  createdBy?: string
  endedBy?: string | null
}

// The team's decision on isolation: required or not, when (cloud decidedAt, demo at) and by whom.
export interface IsolationDecision {
  required: boolean
  decidedAt?: string | null
  at?: string
  by?: string | null
}

// One dose of a therapy: given, withheld or refused.
export interface TherapyAdministration {
  id: string
  therapyId: string
  administeredAt: string
  dose: string
  route: string
  status: string
  withheldReason: string
  administeredBy: string | null
  notes: string
  createdBy: string
  createdAt: string
}

// An antimicrobial therapy of an episode (cloud plannedEndAt, demo plannedEnd; older demo rows approved).
export interface AntimicrobialTherapy {
  id?: string
  antimicrobial?: string
  drug?: string
  dose?: string
  route?: string
  indication?: string
  indicationEn?: string
  startedAt?: string
  startDate?: string
  plannedEndAt?: string | null
  plannedEnd?: string | null
  endedAt?: string | null
  endDate?: string | null
  approvalStatus?: string
  approved?: boolean
  status?: string
  isAdvancedAntibiotic?: boolean
  stewardshipLinked?: boolean
  createdBy?: string
  administrations?: TherapyAdministration[]
}

// A device of an episode (catheter, line, tube); the demo keeps the English texts too.
export interface ClinicalDevice {
  id?: string
  type?: string
  name?: string | null
  nameEn?: string | null
  site?: string | null
  siteEn?: string | null
  indication?: string | null
  indicationEn?: string | null
  insertedAt?: string | null
  reviewDue?: string | null
  removedAt?: string | null
  status?: string
  createdBy?: string
}

// A reassessment of an episode (cloud byId, demo by).
export interface ClinicalReassessment {
  id?: string
  date?: string
  at?: string
  status?: string
  decision?: string
  isolationDecision?: string | null
  therapyDecision?: string | null
  notes?: string
  notesEn?: string
  nextReviewDue?: string | null
  byId?: string
  by?: string
}

// The outcome that closed an episode.
export interface ClinicalOutcome {
  id?: string
  status?: string
  date?: string | null
  notes?: string
  notesEn?: string
  recordedById?: string
}

// An entry of an episode's history (cloud names the actor by id, the demo by name).
export interface ClinicalTimelineEvent {
  at: string
  createdAt?: string
  type?: string
  label?: string
  actor?: string
  actorEn?: string
  actorId?: string | null
  detail?: string | null
  value?: string | null
  notes?: string | null
  sampleId?: string
}

// A surveillance episode with its clinical course, as the record screens and the list read it.
// Cloud records carry the row ids (recordId, patientRecordId, departmentId), demo records the names only.
export interface ClinicalCase {
  id: string
  recordId?: string
  patientRecordId?: string
  patientId?: string
  patient?: string
  patientEn?: string
  patientName?: string
  dateOfBirth?: string | null
  birthWeightGrams?: number
  gestationalAgeWeeks?: number
  departmentId?: string | null
  department?: string
  departmentEn?: string
  admissionId?: string | null
  admissionDate?: string | null
  startedAt?: string
  reviewDue?: string | null
  room?: string
  reason?: string
  reasonEn?: string
  suspectedSource?: string | null
  source?: string | null
  sourceEn?: string | null
  organism?: string | null
  resistance?: string | null
  status?: string
  lifecycleStatus?: string
  completedAt?: string | null
  closeReason?: string | null
  reopenedAt?: string | null
  reopenReason?: string | null
  createdAt?: string
  createdBy?: string | null
  createdById?: string
  updatedAt?: string
  updatedBy?: string
  updatedById?: string
  voidedAt?: string
  voidedBy?: string
  voidedById?: string
  voidReason?: string
  assessment?: ClinicalAssessment | null
  assessments?: (ClinicalAssessment | null)[]
  haiClassification?: HaiClassification | null
  haiClassifications?: (HaiClassification | null)[]
  isolation?: ClinicalIsolation | null
  isolationDecision?: IsolationDecision | null
  isolations?: (ClinicalIsolation | null)[]
  therapy?: AntimicrobialTherapy[]
  samples?: EpisodeSample[]
  reassessments?: ClinicalReassessment[]
  outcome?: ClinicalOutcome | null
  previousOutcome?: ClinicalOutcome | null
  devices?: ClinicalDevice[]
  timeline?: ClinicalTimelineEvent[]
  // A list line (surveillance_case_summaries): how many samples the patient and the episode hold.
  sampleCount?: number
  caseSampleCount?: number | null
}

// What the read-only helpers take as an episode (a record of any source, or a row still untyped).
export type ClinicalCaseLike = Partial<ClinicalCase>

// An attachment of the demo's «Documents» tab.
export interface ClinicalDocument {
  id: string
  name: string
  size: number
  type: string
  dataUrl: string
  category: string
  description: string
}

// ── Patients and admissions ─────────────────────────────────────────────────

// The patient a record screen opens (`id` the patient code, `recordId` the row id).
export interface ClinicalPatient {
  id?: string
  recordId?: string
  patientId?: string
  name?: string
  nameEn?: string
  dateOfBirth?: string | null
  department?: string
  departmentEn?: string
  admissionDate?: string | null
}

// An admission (stay) of a patient, as the patient record scopes episodes and samples by it.
export interface AdmissionStay {
  id?: string
  admissionDate?: string | null
  dischargeDate?: string | null
  status?: string
  departmentId?: string | null
}

// ── What the repository's writes take ───────────────────────────────────────
// The fields a column requires are required; the rest are as the form keeps them.

// The audit actor of the demo writes.
export interface ClinicalActor {
  id?: string
  name?: string
}

// A new episode, or the edit of its start.
export interface ClinicalCaseDraft {
  departmentId?: string | null
  department?: string
  departmentEn?: string
  startedAt?: string
  reviewDue?: string | null
  room?: string
  reason?: string
  reasonEn?: string
  suspectedSource?: string | null
  admissionId?: string | null
  admissionDate?: string | null
}

// A clinical assessment as the dialog saves it.
export interface AssessmentDraft {
  date?: string
  assessmentType?: string
  classification?: string | null
  summary?: string
  notes?: string
  signsSymptoms?: string[]
  riskFactors?: string[]
}

// An HAI classification as the dialog saves it.
export interface HaiDraft {
  type: string
  status?: string
  definitionSet?: string
  definitionVersion?: string | null
  criteriaMet?: boolean | null
  criteriaEvidence?: string[]
  rationale?: string
  classifiedAt?: string
}

// A laboratory sample request (answers of the request questions keyed by question).
export interface SampleRequestDraft {
  type: string
  source?: string
  priority?: string
  requestQuestions?: Record<string, unknown>
}

// The start of an isolation.
export interface IsolationDraft {
  reason: string
  room?: string
  startedAt?: string
  reviewDue?: string | null
  precautions?: string[]
}

// The end of an isolation.
export interface IsolationEndDraft {
  status?: string
  endedAt?: string
  reason?: string
}

// A therapy as the dialog saves it (therapiesToSave flags the restricted ones).
export interface TherapyDraft {
  antimicrobial: string
  dose?: string
  route?: string
  indication?: string
  startedAt?: string
  plannedEndAt?: string | null
  plannedEnd?: string | null
  approvalStatus?: string
  isAdvancedAntibiotic?: boolean
  stewardshipLinked?: boolean
  therapyPlanId?: string
}

// The end of a therapy.
export interface TherapyEndDraft {
  status?: string
  endedAt?: string
}

// A dose given (or withheld) of a therapy.
export interface AdministrationDraft {
  administeredAt?: string
  dose?: string
  route?: string
  status?: string
  withheldReason?: string
  notes?: string
}

// A device added to an episode.
export interface DeviceDraft {
  type: string
  site?: string | null
  indication?: string | null
  insertedAt?: string | null
  reviewDue?: string | null
}

// The removal of a device.
export interface DeviceRemovalDraft {
  removedAt?: string
}

// A reassessment as the dialog saves it (`status` the clinical status, `decision` the therapy decision).
export interface ReassessmentDraft {
  status: string
  date?: string
  decision?: string
  isolationDecision?: string | null
  therapyDecision?: string | null
  notes?: string
  nextReviewDue?: string | null
}

// The outcome that completes an episode.
export interface OutcomeDraft {
  status: string
  date?: string
  notes?: string
}

// The entries of an episode that «Delete» sends to the recycle bin.
export type ClinicalEntryKind = 'assessment' | 'hai' | 'isolation' | 'outcome' | 'therapy' | 'reassessment' | 'device'

// ── Libraries ───────────────────────────────────────────────────────────────

// The extra fields of a library row ([el, en, meta]) the clinical screens read.
export interface ClinicalLibraryMeta {
  id?: string
  code?: string
  criteriaKey?: string
  [key: string]: unknown
}
// A library row ([el, en, meta]) as the clinical dialogs read it: Greek name, English name, extra fields
// (an object with those positions, so a LibraryTuple, an untyped row and a built list all fit).
export interface ClinicalLibraryRow {
  readonly length?: number
  0?: string
  1?: string
  2?: ClinicalLibraryMeta
}
