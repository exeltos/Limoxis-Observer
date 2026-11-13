import type { ReactNode } from 'react'
import type { AdmissionStay, ClinicalCaseLike, ClinicalDevice, ClinicalPatient, EpisodeSample } from '../clinicalTypes'
import type { OverflowItem } from '../../../design-system/OverflowMenu'
import type { RecordDeleteOptions } from '../../recycle-bin/useRecordDelete'
import type { ContextualNavigateOptions } from '../../../core/navigation/useContextualNavigation'
import type { PatientClinicalScalesPanelProps } from '../../clinical-scales/PatientClinicalScalesPanel'
import type { loadEpiQuestionnaires, loadEpiSettings } from '../epiQuestionnaire/epiQuestionnaireService'
import type { bundleStatusForDevice } from './formStatus'
import type { NotifiableFinding } from '../../reporting/notifiableFindings'
import type { EodyEntry } from '../../reporting/eodyCatalogue'

// The shapes of the «Φόρμες & ερωτηματολόγια» tab: what the record page hands every section
// (the context), what a section is (formsRegistry) and the rows the sections read.

export type Translate = (key: string) => string

// The episode, patient and admission of the record (demo records carry the names only).
export type FormsEpisode = ClinicalCaseLike
export type FormsPatient = ClinicalPatient
export interface FormsAdmission extends AdmissionStay {
  department?: string | null
}

// A latest score per scale, as the page read it for the header chips.
export interface ScaleScoreRow {
  scale_key?: string
  score?: number | string | null
  assessed_at?: string | null
}

// What the record page gives every section (PatientClinicalCanonicalPage builds it once).
// Callbacks are methods, so the page's own narrower callbacks fit.
export interface EpisodeFormsCtx {
  enabled?: boolean
  scopeKey?: string
  organizationId?: string | null
  isDemo?: boolean
  language: string
  t: Translate
  role?: string | null
  has(capability: string): boolean
  patient?: FormsPatient | null
  admission?: FormsAdmission | null
  record?: FormsEpisode | null
  episodes: FormsEpisode[]
  // The laboratory samples of this record: the episode's, the admission's, or those outside any admission.
  samples?: EpisodeSample[]
  patientMode?: boolean
  // «Delete» of a record of a section: the item for its «⋯» menu, or null when not allowed.
  deleteItem?(options: RecordDeleteOptions): OverflowItem | null
  canDelete?(createdBy: unknown): boolean
  scaleRows?: ScaleScoreRow[]
  returnPath?: string
  onScalesChanged?(): void
  goTo(to: string, options?: ContextualNavigateOptions): void
  fmtDate(value: unknown): string
  fmtDateTime(value: unknown): string
  startProtocol?: PatientClinicalScalesPanelProps['onStartProtocol']
}

// ---- sections ------------------------------------------------------------------------------

// The data of one section, once loaded: { loading, value, error }.
export interface FormSectionState<V = unknown> {
  loading?: boolean
  value?: V
  error?: unknown
}
// The props the tab gives a section's Component (a section takes the ones it uses).
export interface FormSectionProps<V = unknown> {
  ctx: EpisodeFormsCtx
  section: FormSectionState<V>
  reload?: () => unknown
  openSection?: (id: string) => void
}
// A section of the printed record: a list of lines, or blocks of label / value pairs.
export interface FormReportSection {
  id: string
  title: string
  list?: string[]
  items?: { title?: string, pairs: string[][] }[]
}
// A registered section (see formsRegistry). Methods, so a section of any value fits the registry.
export interface EpisodeFormSection<V = unknown> {
  id: string
  order?: number
  withoutAdmission?: boolean
  canSee?(ctx: EpisodeFormsCtx): boolean
  load?(ctx: EpisodeFormsCtx): V | Promise<V>
  Component(props: FormSectionProps<V>): ReactNode
  buildReport?(ctx: EpisodeFormsCtx, section: FormSectionState<V>): FormReportSection | null
}

// ---- rows the sections read ------------------------------------------------------------------

// A device of an episode; older demo rows start at `startedAt`.
export interface BundleDevice extends ClinicalDevice {
  startedAt?: string | null
}

// A bundle check of a device (prevention_bundle_assessments as bundleCloudService maps it).
// `answers` are keyed by the bundle's elements: 'yes' / 'no' / 'na'.
export interface BundleAssessment {
  id?: string
  status?: string
  date?: string
  shift?: string
  score?: number | null
  deviceDay?: number | null
  answers?: Record<string, unknown> | null
  surveillanceDeviceId?: string | null
  createdAt?: string
  createdById?: string | null
}
// The status of a device's daily check, worked out from its checks (formStatus).
export type BundleStatus = ReturnType<typeof bundleStatusForDevice>

// An incident linked to the episode (quality_incidents as qualityService maps it).
export interface LinkedIncident {
  id?: string
  displayId?: string
  title?: string
  titleEn?: string
  status?: string
  lifecycleStatus?: string
  date?: string
  department?: string
  departmentEn?: string
}

// An outbreak investigation the patient was reviewed into (liraPatientLinks).
export interface OutbreakLink {
  id: string
  title?: string
  status?: string
  department?: string
  departmentEn?: string
  from?: string
  cases?: number
}

// A saved notification to ΕΟΔΥ (notificationReportsService; the laboratory's rows have the same fields).
export interface NotifiableReport {
  id?: string
  findingKey?: string
  status?: string
  notifiedAt?: string
  reference?: string
  updatedBy?: string | null
  patientRecordId?: string
  disease?: string
  diseaseCode?: string
  createdAt?: string
}
// A row of «Δηλωτέα νοσήματα»: a notifiable laboratory finding (with its report, if any), or a
// clinical notification that carries no finding.
export interface NotifiableRow {
  key?: string
  finding: NotifiableFinding | null
  report: NotifiableReport | null
  title: string
  sample: string
  organism: string
  date: string
  start?: string
  entry: EodyEntry | null
  status: string
}
// A patient the laboratory's «Νέα δήλωση» window offers.
export interface PickerPatient {
  id: string
  name: string
  nameEn?: string
  department?: string
  departmentEn?: string
}

// The epidemiological questionnaires of the episodes (by case key) and the hospital's settings.
export interface EpiSectionValue {
  rows: Awaited<ReturnType<typeof loadEpiQuestionnaires>>
  settings: Awaited<ReturnType<typeof loadEpiSettings>>
}

// What the scales panel hands back (its own row types).
export type ScalesPanelContext = Parameters<NonNullable<PatientClinicalScalesPanelProps['onContext']>>[0]

// The loaded data of the tab, by section id. The bundles and the questionnaire are read
// outside the tab too (the device row, the record header), so their values are named.
export interface EpisodeFormsData {
  bundles?: FormSectionState<BundleAssessment[]>
  epiQuestionnaire?: FormSectionState<EpiSectionValue>
  [id: string]: FormSectionState | undefined
}
