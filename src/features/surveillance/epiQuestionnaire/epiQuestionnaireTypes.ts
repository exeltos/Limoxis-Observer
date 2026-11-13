// The shapes of the epidemiological questionnaire (epiQuestionnaireService translates the
// questionnaire and the hospital's settings to and from the database rows,
// surveillance_case_questionnaires and epi_questionnaire_question_settings in database.types).

// A text in both languages.
export type EpiText = { el: string, en: string }

// One answer, stored by question key: «yes» / «no» / «unknown», a detail and where it came from
// (`src`: manual / prefill / prefill_edited). A prefill suggestion carries `source` instead
// (therapy, icu, admission, devices, sample). Type aliases, so they fit the Json columns.
export type EpiAnswer = { a?: string | null, detail?: string, src?: string, source?: string }
export type EpiAnswers = Record<string, EpiAnswer>

// A question of the questionnaire. `risk`: counts as a risk factor when answered «Ναι».
// `prefill`: where the system can suggest the answer. The last three are added by the hospital's settings.
export interface EpiQuestion {
  key: string
  step: number
  core: boolean
  risk: EpiText | null
  windowDays: number | null
  prefill: string | null
  label: EpiText
  short: EpiText
  help?: EpiText
  active?: boolean
  edited?: boolean
}

// A hospital's setting of one question (wording, help, time window, on / off).
export interface EpiSetting {
  id?: string
  questionKey?: string
  labelEl?: string
  labelEn?: string
  helpEl?: string
  helpEn?: string
  windowDays?: number | null
  isActive?: boolean
  version?: number
  updatedAt?: string
}
// The changes of one save (from the settings screen).
export type EpiSettingPatch = Pick<EpiSetting, 'labelEl' | 'labelEn' | 'helpEl' | 'helpEn' | 'windowDays' | 'isActive'>

// The stored questionnaire of an episode (one per episode).
export interface EpiQuestionnaire {
  id: string
  caseId: string
  definitionVersion: number
  answers: EpiAnswers
  prefilled: EpiAnswers
  coreComplete: boolean
  answeredBy: string
  answeredAt: string
  updatedBy: string
  updatedAt: string
}
// What the computations read of a questionnaire (a stored row, or one from another screen).
export type EpiQuestionnaireLike = { answers?: EpiAnswers | null, prefilled?: EpiAnswers | null }

// ---- what the questionnaire reads of other records (owned by the surveillance records) ----
export interface EpiSample {
  collectedAt?: string | null
  requestedAt?: string | null
  // The mini version entered with a culture before the episode existed.
  clinicalContext?: EpiAnswers | null
  surveillanceCase?: string | null
  surveillanceCaseId?: string | null
}
export interface EpiTherapy { startedAt?: string | null, antimicrobial?: string | null }
export interface EpiDevice { name?: string | null, type?: string | null, status?: string | null, removedAt?: string | null }
export interface EpiEpisode {
  id?: string
  recordId?: string | null
  status?: string
  patient?: string
  patientEn?: string
  patientId?: string
  startedAt?: string | null
  admissionDate?: string | null
  department?: string | null
  departmentEn?: string | null
  departmentType?: string | null
  therapy?: EpiTherapy[] | null
  devices?: EpiDevice[] | null
  samples?: EpiSample[] | null
}
// The patient's admission (cloud rows keep department_type, the demo departmentType).
export interface EpiAdmission {
  admissionDate?: string | null
  admissionSource?: string | null
  sourceFacility?: string | null
  department?: string | null
  department_type?: string | null
  departmentType?: string | null
}

// Origin of the episode, worked out from the admission and the first sample.
export interface EpiOrigin {
  kind: 'hospital' | 'community'
  hospitalDay: number
  admittedOn: string
  referenceOn: string
}
// What the header, the episode row and the list show.
export interface EpiSummary {
  origin: EpiOrigin | null
  factors: string[]
  factorCount: number
  signal: boolean
  status: 'done' | 'pending'
  hasRow: boolean
}
