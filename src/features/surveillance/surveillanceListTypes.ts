import type { Database } from '../../core/supabase/database.types'
import type { IconType } from '../../design-system/types'
import type { EmptyStateAction } from '../../design-system/RegistryEmptyState'
import type { AttentionItem as AttentionListItem } from '../../design-system/AttentionList'
import type { loadOpenProtocolRuns } from './protocols/protocolService'
import type { environmentalResampleInitial } from './EnvironmentalSurveillanceFlow'
import type { ClinicalCaseDraft, ClinicalCaseLike, ClinicalLibraryRow, ClinicalPatient, EpisodeSample } from './clinicalTypes'

// The shapes of the Surveillance list, the new-episode flow, the episode sheet,
// the printed report and the cluster signal (the episode records themselves are
// in clinicalTypes). Rows come from the demo and the cloud, so fields are optional.

// ── The list ────────────────────────────────────────────────────────────────

// A patient's line of the list: the latest episode, with all of the patient's episodes under it (groupByPatient).
export type PatientListRow = ClinicalCaseLike & {
  episodes?: ClinicalCaseLike[]
  activeCount?: number
  groupReviewDue?: string | null
}

// A staff screening as the list reads it (employeeSurveillance records).
export interface EmployeeScreeningRow {
  id?: string
  recordId?: string
  employeeId?: string
  employeeName?: string
  employeeNameEn?: string
  department?: string
  departmentEn?: string
  startedAt?: string
  screeningTypes?: string[]
  status?: string
  resultStatus?: string
  interventionStatus?: string
  intervention?: string | null
  noIntervention?: boolean
  recheckDate?: string | null
  recheckDue?: string | null
  noRecheck?: boolean
}

// An environmental laboratory sample as the list reads it.
export interface EnvironmentalSampleRow {
  id?: string
  code?: string | null
  type?: string | null
  subjectType?: string | null
  source?: string | null
  department?: string
  organism?: string | null
  location?: string | null
  point?: string | null
  environmentalBatchId?: string | null
  collectedAt?: string | null
  requestedAt?: string | null
  status?: string
  result?: string | null
  critical?: boolean
}

// A line of any of the three lists (the page filters, sorts and pages them the same way).
export type SurveillanceListRow = PatientListRow & EmployeeScreeningRow & EnvironmentalSampleRow

// The empty state the page hands to a list.
export interface ListEmptyState {
  title?: string
  text?: string
  filtered?: boolean
  onClear?: () => void
  icon?: IconType
  action?: EmptyStateAction | null
}

// An open protocol run of an episode (the badge of its line).
export type OpenProtocolRun = Awaited<ReturnType<typeof loadOpenProtocolRuns>>[number]
// The prefill of a new environmental sampling, when it resamples an earlier point.
export type EnvironmentalResample = ReturnType<typeof environmentalResampleInitial>

// ── A new episode ───────────────────────────────────────────────────────────

// A patient an episode can be started for (the patients register, or one just created).
export type SurveillancePatient = ClinicalPatient & {
  status?: string
  patientCode?: string
  departmentId?: string | null
}

// The inline patient of the flow, as typed.
export interface PatientDraft {
  patientCode: string
  firstName: string
  lastName: string
  patronymic: string
  firstNameEn: string
  lastNameEn: string
  patronymicEn: string
  departmentId: string
  department: string
  departmentEn: string
  admissionDate: string
  dateOfBirth: string
}

// The start of the episode, as typed.
export interface StartDraft {
  startedAt: string
  reviewDue: string
  room: string
  reason: string
  reasonEn: string
  suspectedSource: string
  departmentId: string
  department?: string
  departmentEn?: string
}

// A laboratory sample an episode can start from (the patient's samples no episode holds).
export type SampleOption = EpisodeSample

// What the flow hands to its page: the start, and (from the list) the sample chosen or 'new' for a new request.
export type NewEpisodeDraft = ClinicalCaseDraft & { sampleChoice?: SampleOption | 'new' | null }

// ── The open episode ────────────────────────────────────────────────────────

// A step of the sheet's index; protocols add their own steps.
export interface JourneyStage {
  id: string
  label: string
  status: string
  meta?: string
  locked?: boolean
  protocol?: boolean
}

// A line of «needs attention» on top of the sheet.
export interface JourneyCue {
  id: string
  tone: string
  title: string
}

// The epidemiological questionnaire of the episode, as the sheet's index reads it.
export interface QuestionnaireState {
  done: boolean
}

// A sample as the sample tree reads it (older laboratory rows name the organism microorganism).
export type TreeSample = EpisodeSample & { microorganism?: string | null }

// A positive sample waiting for an infection-control decision («Προς έλεγχο»).
export type ReviewSample = EpisodeSample & {
  patient?: string
  patientEn?: string
  department?: string
  departmentEn?: string
}

// A critical result counts as communicated by any of these (sample or result rows).
export type CommunicatedSample = Omit<EpisodeSample, 'microbiologyResults'> & {
  criticalCommunicatedAt?: string | null
  communications?: unknown[] | null
  microbiologyResults?: { communications?: unknown[] | null }[] | null
}

// A line of the summary's «needs attention» (the page may add its own, so the fields are optional).
export type AttentionItem = AttentionListItem & { stage?: string }

// ── The printed report ──────────────────────────────────────────────────────

// One antimicrobial of a sample's antibiogram (drug and S/I/R).
export interface ReportAstRow {
  drug?: string
  sir?: string
}

// A sample as the report prints it.
export type ReportSample = EpisodeSample & {
  typeLabel?: string
  ast?: ReportAstRow[] | null
}

// The libraries whose names the report prints (symptoms, risk factors).
export interface ReportLibraries {
  clinicalSymptoms?: ClinicalLibraryRow[]
  clinicalRiskFactors?: ClinicalLibraryRow[]
}

// How the report's parts write: language, translations, dates and the sample's name.
export interface ReportContext {
  L: (el: string, en: string) => string
  en: boolean
  t: (key: string) => string
  fmtDate: (value: unknown) => string
  fmtDateTime: (value: unknown) => string
  language: string
  sampleLabel: (sample: ReportSample) => string | undefined
}

// What the user may see in the report.
export interface ReportPermissions {
  surveillance?: boolean
  lab?: boolean
}

// ── Clusters and HAI criteria ───────────────────────────────────────────────

// A positive patient isolate the cluster detection reads ('YYYY-MM-DD' date).
export interface ClusterRecord {
  organism?: string | null
  department?: string | null
  date?: string | null
  resistance?: string | null
  patientId?: string | null
  sampleId?: string | null
}

// A demo laboratory sample, as the cluster records are taken from it.
export interface ClusterLabSample {
  id?: string | null
  result?: string | null
  resultStatus?: string | null
  organism?: string | null
  department?: string | null
  resistance?: string | null
  resultedAt?: string | null
  patientId?: string | null
  sampleType?: string | null
}

// What names a cluster (its alert id).
export interface ClusterKey {
  department?: string | null
  organism?: string | null
  firstDate?: string | null
}

// A line of get_organism_clusters.
export type OrganismClusterRow = Database['public']['Functions']['get_organism_clusters']['Returns'][number]

// A specimen of the «sampleTypes» library ([el, en, meta] read as names, code and source).
export interface SpecimenItem {
  el?: string
  en?: string
  code?: string | null
  meta?: { source?: unknown } | null
}

// One criterion of an HAI checklist.
export interface HaiCriterion {
  id: string
  textEl?: string
  textEn?: string
}
// A group of criteria: all, any, or at least two of them must be met.
export interface HaiCriteriaGroup {
  id?: string
  rule?: string
  items: HaiCriterion[]
}
// An HAI checklist (a type's criteria and their source).
export interface HaiCriteriaSet {
  labelEl?: string
  labelEn?: string
  source?: string
  groups: HaiCriteriaGroup[]
}

// ── Device-day indicators ───────────────────────────────────────────────────

// A device episode counted in the device days (deviceType: central line, urinary catheter or ventilator).
export interface DeviceDaySource {
  deviceType: string | null
  insertedAt?: string | null
  removedAt?: string | null
  department?: string
}
// An HAI classification counted against the device days (haiType: clabsi, cauti, vap).
export interface HaiDaySource {
  haiType: string
  criteriaMet?: boolean | null
  classifiedAt?: string
  department?: string
}
// The device days and HAI of one birth-weight band.
export interface DeviceDaySources {
  devices: DeviceDaySource[]
  haiClassifications: HaiDaySource[]
}
