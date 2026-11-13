import type { ReactNode } from 'react'
import type { AuditActor } from '../../core/audit/actor'
import type { OverflowItem } from '../../design-system/OverflowMenu'
import type { createClinicalRepository } from './clinicalRepository'
import type { makeDeviceBundles } from './forms/deviceBundles'
import type { epiRows } from './forms/sections/epiQuestionnaireSection'
import type { useEpisodeFormsData } from './forms/useEpisodeFormsData'
import type { useEpisodeProtocols } from './protocols/useEpisodeProtocols'
import type { loadOpenProtocolRuns } from './protocols/protocolService'
import type { loadEpiQuestionnaires, loadEpiSettings } from './epiQuestionnaire/epiQuestionnaireService'
import type { useLaboratoryRegistry } from '../laboratory/hooks/useLaboratoryRegistry'
import type {
  AdmissionStay,
  AntimicrobialTherapy,
  ClinicalAssessment,
  ClinicalCase,
  ClinicalLibraryRow,
  ClinicalPatient,
  ClinicalReassessment,
  ClinicalTimelineEvent,
  EpisodeSample,
  SampleRequestDraft,
} from './clinicalTypes'

// The shapes the clinical record screens keep besides the clinical records
// themselves (clinicalTypes.ts): the patient and the admission as the record
// page reads them, the libraries, the permissions, the entry a detail window
// shows and the forms of the dialogs.

// ── What the screens are handed ─────────────────────────────────────────────

// The repository the record screens write through.
export type ClinicalRecordRepository = ReturnType<typeof createClinicalRepository>
// The device row of the surveillance stage: the bundle of a device and where a check starts.
export type DeviceBundles = NonNullable<ReturnType<typeof makeDeviceBundles>>
// The laboratory samples of the record and the repository's actions.
export type LaboratoryRegistry = ReturnType<typeof useLaboratoryRegistry>
// The data of the forms tab, read once per record.
export type EpisodeFormsData = ReturnType<typeof useEpisodeFormsData>
// The protocols started on an episode and its antimicrobial reviews.
export type EpisodeProtocols = ReturnType<typeof useEpisodeProtocols>
// An open protocol of the hospital, for the badge on its episode's row.
export type OpenProtocolRun = Awaited<ReturnType<typeof loadOpenProtocolRuns>>[number]
// The stored epidemiological questionnaire of an episode, and the hospital's settings of it.
export type EpiQuestionnaireRow = Awaited<ReturnType<typeof loadEpiQuestionnaires>>[string]
export type EpiSettingsRows = Awaited<ReturnType<typeof loadEpiSettings>>
// The questionnaire line of an episode in the forms tab (its summary: origin, risk factors, signal).
export type EpiEntry = ReturnType<typeof epiRows>[number]

// The patient a record shows (patientsService): the clinical patient with the details of the form.
export interface RecordPatient extends ClinicalPatient {
  hospitalRecordNumber?: string | null
  firstName?: string | null
  firstNameEn?: string | null
  lastName?: string | null
  lastNameEn?: string | null
  fatherName?: string | null
  patronymic?: string | null
  patronymicEn?: string | null
  sex?: string | null
  notes?: string | null
  birthWeightGrams?: number | null
  gestationalAgeWeeks?: number | null
  departmentId?: string | null
  status?: string
}

// An admission of the patient (patientsService mapAdmission; the demo also keeps the record number).
export interface RecordAdmission extends AdmissionStay {
  department?: string
  department_type?: string | null
  caseNumber?: string | null
  notes?: string | null
  admissionSource?: string | null
  sourceFacility?: string
  mdrOnAdmission?: boolean
  mdrOnAdmissionDate?: string | null
}

// The libraries the clinical dialogs read (symptoms, risk factors, devices, antibiotics, definitions …), by key.
export type ClinicalLibraries = Partial<Record<string, ClinicalLibraryRow[]>>

// What the person may do on the surveillance sheet.
export interface ClinicalPermissions {
  canAssess: boolean
  canLab: boolean
  canClassifyResistance: boolean
  canIsolation: boolean
  canTherapy: boolean
  canProtocol: boolean
  canReassess: boolean
  canOutcome: boolean
  canEdit: boolean
  canDelete: (record: ClinicalCase) => boolean
  canReopen: boolean
}

// A request to open the protocol picker (a qSOFA / SOFA prompt, or «Start protocol»).
export interface ProtocolRequest {
  nonce?: number
  episodeId?: string
  source?: string
  assessmentId?: string | null
  recognizedAt?: string
}

// The assessment with the initial screening answers its dialog keeps (keyed by question).
export type ScreenedAssessment = ClinicalAssessment & { screening?: Record<string, string> }
// An episode as its sheet reads it.
export type JourneyCase = ClinicalCase & { assessment?: ScreenedAssessment | null }

// A sample under the record: an episode's sample or a laboratory registry row.
export interface RecordSample extends EpisodeSample {
  typeLabel?: string
  department?: string
  departmentEn?: string
  patient?: string
  patientEn?: string
  createdBy?: string
}

// A line of the record's history being built: it is kept only once it has a time.
export type TimelineEntry = Omit<ClinicalTimelineEvent, 'at'> & { at?: string | null }

// An item of a «⋯» menu as the panels take it (a missing «Delete» is null).
export type MenuEntry = OverflowItem | null | false | undefined

// ── Entries of an episode ───────────────────────────────────────────────────

// An entry «Delete» sends to the recycle bin, with who entered it.
export interface ClinicalEntryRecord {
  id?: string
  byId?: string
  classifiedBy?: string
  createdBy?: string
  recordedById?: string
}

// The entry a detail window shows: a sample, a therapy or a reassessment.
export type ClinicalEntry =
  | { kind: 'sample', row: EpisodeSample }
  | { kind: 'therapy', row: AntimicrobialTherapy }
  | { kind: 'reassessment', row: ClinicalReassessment }
// The fields the detail window reads, whichever the entry.
export type ClinicalEntryRow = Partial<EpisodeSample & AntimicrobialTherapy & ClinicalReassessment>

// How the protocol calls of the sheet write (demo or cloud, and who).
export interface ProtocolOptions {
  isDemo: boolean
  actor: AuditActor | null
}

// The epidemiological questionnaire of the episode, as the sheet holds it.
export interface EpiState {
  row: EpiQuestionnaireRow | null
  settings: EpiSettingsRows
  ready: boolean
  nonce: number
}

// The forms of the episode's sheet that are open in edit mode.
export interface SheetEdit {
  assessment?: boolean
  isolation?: boolean
  reassessment?: boolean
  outcome?: boolean
}

// ── Dialog forms ────────────────────────────────────────────────────────────

// The clinical assessment as its dialog keeps it (the initial screening answers keyed by question).
export interface AssessmentForm {
  date: string
  classification: string
  summary: string
  signsSymptoms: string[]
  riskFactors: string[]
  screening: Record<string, string>
}

// A sample request as its dialog keeps it (answers of the extra questions keyed by question).
export interface SampleRequestForm {
  type: string
  source: string
  priority: string
  requestQuestions: Record<string, string>
}

// What the sample request shows read-only above its fields.
export interface SampleRequestContext {
  patient?: string
  episode?: string
  department?: string
}

// The episode (and its admission and samples) whose short questionnaire the sample request fills in.
export interface SampleRequestEpi {
  episode?: ClinicalCase | null
  admission?: RecordAdmission | null
  samples?: EpisodeSample[]
}

// An HAI classification as its dialog keeps it (criteriaKey picks the criteria checklist).
export interface HaiForm {
  status: string
  type: string
  definitionSet: string
  definitionVersion: string
  criteriaKey: string | null
  criteriaEvidence: string[]
  rationale: string
}

// The start of an isolation as its dialog keeps it.
export interface IsolationForm {
  precautions: string[]
  room: string
  reason: string
  startedAt: string
  reviewDue: string
}

// A reassessment as its dialog keeps it.
export interface ReassessmentForm {
  date: string
  status: string
  decision: string
  notes: string
  nextReviewDue: string
}

// A group of the criteria checklist of an HAI definition.
export interface HaiCriteriaGroup {
  id?: string
  rule?: string
  items: { id: string, textEl?: string, textEn?: string }[]
}

// The read-only value of the sheet, laid out like a form field.
export interface SheetDetailProps {
  label: string
  value: ReactNode
}

// A sample the record creates (a request, or a follow-up of a sample under its code).
export type NewSampleDraft = Partial<SampleRequestDraft> & {
  sampleCode?: string
  surveillanceCaseId?: string | null
  clinicalContext?: unknown
}
