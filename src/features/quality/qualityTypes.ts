import type { Dispatch, ReactNode, SetStateAction } from 'react'
import type { Tables } from '../../core/supabase/database.types'
import type { ReportFact } from '../../core/export/reportDocument'
import type { IconType } from '../../design-system/types'
import type { KpiFigure } from '../../design-system/KpiCard'
import type { AttachmentFile } from '../../design-system/AttachmentField'
import type { LibraryItem } from '../management/useLibraries'
import type { RootCauseAnalysis } from './rootCauseAnalysis'
import type { AuditAnswer, AuditMeeting as AuditMeetingShape, AuditTeamMember as AuditTeamMemberShape } from './audits/auditTypes'

// The shapes the Quality records keep: incidents (reports), findings
// (deviations), corrective actions (CAPAs) and audits. qualityService.mapRow
// turns a database row into one; the demo keeps the record as it is in the
// browser, and a new record starts as a draft with only what the form filled.
// So beyond the code (`id`) every field may be missing: the screens read them
// with a fallback (`record.title||''`).

// --- The database rows -------------------------------------------------------------------

// What a select of a quality table embeds beside its columns (sectionConfig in qualityService).
interface QualityRowEmbeds {
  department?: { name: string | null } | null
  // An incident's event details, 1:1 rows (one, or a one-row array from an older PostgREST).
  fall?: unknown
  sharp?: unknown
  blue_code?: unknown
  obstetric?: unknown
  // A CAPA's steps, root cause analysis and progress notes.
  sub_actions?: CapaSubActionRow[] | null
  progress?: CapaProgressRow[] | null
  // An audit's checklist and team.
  checklist?: AuditChecklistRow[] | null
  team?: AuditTeamRow[] | null
  // The codes of the audits a record follows up (withFollowUpCodes).
  follow_up_code?: string
  follow_up_audit_code?: string
  history?: QualityHistoryEntry[] | null
}

// A row of any of the four record tables with its embeds: the columns are read by section in mapRow.
// (root_cause is the text column of incidents and findings; a CAPA's select embeds its analysis
// under the same name, which analysisFromRow reads as unknown.)
type RecordColumns = Partial<Omit<Tables<'quality_incidents'>, 'history'>> & Partial<Omit<Tables<'quality_findings'>, 'history'>> & Partial<Omit<Tables<'quality_capa_actions'>, 'history'>> & Partial<Omit<Tables<'quality_audits'>, 'history'>>
export type QualityDbRow = RecordColumns & QualityRowEmbeds & { id: string, code: string, status: string }

export type CapaSubActionRow = Tables<'quality_capa_sub_actions'>
export type CapaProgressRow = Tables<'quality_capa_progress'>
export type AuditChecklistRow = Tables<'quality_audit_checklist_items'> & { finding?: unknown }
export type AuditTeamRow = Tables<'quality_audit_team_members'> & { employee?: unknown }
// A stored child row as diffChildRows compares it: its id and the written fields.
export type ChildRow = { id?: string } & Record<string, unknown>

// --- The parts of a record ----------------------------------------------------------------

// One line of a record's history (auditEvent in core/audit/actor).
export interface QualityHistoryEntry {
  id?: string
  at?: string
  action?: string
  actor?: string
  actorId?: string
  actorEmail?: string
  reason?: string | null
  note?: string
  detail?: unknown
  title?: string
}

// An incident's event details, one block per kind (incidentDetails).
export interface IncidentFall { fallType: string, floorCondition: string, bedRails: string, location: string, examinedByDoctor: boolean | null, doctorInstructions: string, injuryCategory: string, injurySubcategory: string, injuredPersonType: string, injuredEmployeeId: string, injuryDescription: string }
export interface IncidentSharp { tool: string, toolState: string, bodySite: string, bodySiteOther: string, firstUser: string, contactDuration: string, exposedBodyPart: string, substance: string }
export interface IncidentBlueCode { interventions: string[], outcome: string, patientStatus: string, transferTo: string, doctor: string, nurse: string, staffInvolved: string, gloves: boolean | null }
export interface IncidentObstetric { subcategory: string }
export interface IncidentDetailBlocks { fall: IncidentFall, sharp: IncidentSharp, blueCode: IncidentBlueCode, obstetric: IncidentObstetric }
export type IncidentDetailKey = keyof IncidentDetailBlocks
export type IncidentDetailBlock = IncidentDetailBlocks[IncidentDetailKey]
// The fields of any block, as a form or a writer reads them by name (no two blocks share one).
export type IncidentBlockFields = Partial<IncidentFall & IncidentSharp & IncidentBlueCode & IncidentObstetric>

// A step of a CAPA.
export interface CapaSubAction { id: string, title: string, owner: string, dueDate: string, done: boolean, doneAt: string | null, doneBy: string }
// A dated note on how a CAPA is going.
export interface CapaProgressEntry { id: string, date: string, note: string, author: string, createdAt: string | null }

// A question of an audit's checklist and its answer, a member of its team and its opening or closing
// meeting: the shapes of the audit programme (audits/auditTypes), so an audit passes between the two as it is.
export type AuditChecklistItem = AuditAnswer
export type AuditTeamMember = AuditTeamMemberShape
export type AuditMeeting = AuditMeetingShape

// A file of a record: stored (storagePath, a signed url) or, in the demo, kept in the browser (dataUrl, objectUrl).
export type QualityAttachment = AttachmentFile

// --- The record ----------------------------------------------------------------------------

// What every record has: its code (`id`, as the screens and the links use it),
// the database id, its title, department, status, people, lifecycle and history.
export interface QualityRecordCommon {
  id: string
  dbId?: string
  code?: string
  displayId?: string
  title?: string
  titleEn?: string
  department?: string
  departmentEn?: string
  departmentId?: string | null
  status: string
  owner?: string
  owners?: string[]
  ownerId?: string | null
  ownerEmployeeId?: string | null
  lifecycleStatus?: string
  updatedAt?: string | null
  updatedBy?: string
  updatedById?: string
  createdAt?: string | null
  voidReason?: string
  voidedAt?: string | null
  voidedById?: string | null
  voidedBy?: string
  correctionReason?: string
  correctionOpenedAt?: string | null
  correctionOpenedById?: string | null
  attachments?: AttachmentFile[]
  history?: QualityHistoryEntry[]
  // What incidents, findings and CAPAs share.
  severity?: string
  date?: string
  description?: string
  descriptionEn?: string
  source?: string
  sourceId?: string
  rootCause?: string
  reportedBy?: string
  reportedByEmployeeId?: string | null
  notes?: string
  dueDate?: string
  standard?: string
  findingClass?: string
  clauseRef?: string
}

// An incident (a staff report once Quality has classified it).
export interface IncidentFields {
  incidentClass?: string
  reachedPatient?: boolean
  harmOccurred?: boolean
  reportedById?: string | null
  reportedByLabel?: string
  anonymous?: boolean
  privacy?: string
  visibility?: string
  visibleTo?: string | null
  reportKind?: string
  sentinel?: boolean
  rcaDueDate?: string
  linkedPatient?: string
  linkedSurveillance?: string
  linkedAdmission?: string
  category?: string
  eventType?: string
  fall?: IncidentFall | null
  sharp?: IncidentSharp | null
  blueCode?: IncidentBlueCode | null
  obstetric?: IncidentObstetric | null
  eventTime?: string
  impact?: string
  immediateActions?: string
  immediateActionsEn?: string
  rootCauseEn?: string
  contributingFactors?: string
  contributingFactorsEn?: string
  affects?: string
  involvedPeople?: string
  patientReference?: string
  room?: string
}

// A finding (deviation): its kind and causes, its audit details and the assessment of whether an action is needed.
export interface FindingFields {
  auditItemId?: string | null
  deviationKind?: string
  causeCategories?: string[]
  recurring?: boolean | null
  verifiedByEmployeeId?: string | null
  verificationStatus?: string
  verifiedOn?: string
  verifiedBy?: string
  verificationNote?: string
  followUpAuditId?: string
  correctiveActionNeeded?: boolean | null
  noActionReason?: string
  assessedAt?: string
  assessedBy?: string
}

// A corrective or preventive action.
export interface CapaFields {
  priority?: string
  actionType?: string
  effectivenessDue?: string
  effectivenessStatus?: string
  sourceType?: string
  subActions?: CapaSubAction[]
  rootCauseAnalysis?: RootCauseAnalysis | null
  progress?: CapaProgressEntry[]
}

// An audit: its programme (template, standard, plan) and how it went.
export interface AuditFields {
  auditType?: string
  plannedDate?: string
  completedDate?: string | null
  scope?: string
  scopeEn?: string
  leadAuditor?: string
  leadAuditorId?: string | null
  checklist?: AuditChecklistItem[]
  checklistSource?: string
  templateId?: string | null
  templateTitle?: string
  templateVersion?: number | null
  standards?: string[]
  extraTemplateIds?: string[]
  clausesScope?: string[]
  plannedMonthOnly?: boolean
  riskLevel?: string
  frequencyMonths?: number | null
  openingMeeting?: AuditMeeting
  closingMeeting?: AuditMeeting
  auditeeRepresentative?: string
  conclusion?: string
  followUpOf?: string
  origin?: string
  durationDays?: number | null
  auditBody?: string
  reportSentOn?: string
  correctionsDueOn?: string
  team?: AuditTeamMember[]
  findingIds?: string[]
}

export type IncidentRecord = QualityRecordCommon & IncidentFields
export type FindingRecord = QualityRecordCommon & FindingFields
export type CapaRecord = QualityRecordCommon & CapaFields
export type AuditRecord = QualityRecordCommon & AuditFields
// A record of any section, as the shared screens (record page, lists, service) hold it.
export type QualityRecord = QualityRecordCommon & IncidentFields & FindingFields & CapaFields & AuditFields
// A record being written: the create form's draft, before it has a code.
export type QualityDraft = Partial<QualityRecord>

// A department of an audit round arranged by hand, with its day (applyAuditRound), and the questionnaire a new audit starts from.
export interface AuditRoundItem { auditId?: string | null, plannedDate?: string, department?: string, departmentEn?: string, departmentId?: string | null }
export interface AuditRoundTemplate { id?: string, title?: string, version?: number | null, standard?: string, scope?: string }

// What another screen hands the report form (its location state): an episode, a control execution, or a record's details.
export interface EpisodeReportSource { departmentId?: string, department?: string, linkedPatient?: string, linkedSurveillance?: string, linkedAdmission?: string, patientLabel?: string, admissionLabel?: string, episodeLabel?: string }
export interface ControlReportSource { controlTitle?: string, value?: unknown, notes?: string, department?: string, departmentId?: string, scheduledAt?: string | null }
export interface ReportPrefillState { episodeSource?: EpisodeReportSource | null, controlSource?: ControlReportSource | null, qualitySource?: { title?: string, departmentId?: string, department?: string, description?: string, date?: string } | null }
// The staff report being written (emptyIncidentReport and its prefill): the texts are always there.
export type IncidentReportDraft = QualityDraft & { title: string, titleEn: string, description: string, descriptionEn: string, immediateActions: string, immediateActionsEn: string, episodeSource?: EpisodeReportSource }

// A choice of a vocabulary list: its value and its label in Greek and English.
export interface LabelledOption { value: string, label: string[] }
// An entry of a closed vocabulary (qualityVocabulary), with an optional hint in both languages.
export interface VocabularyEntry extends LabelledOption { hint?: string[] }
// An incident category: a library item, or a baseline one standing in for it.
export type CategoryItem = Pick<LibraryItem, 'value' | 'el' | 'en'> & { code?: string | null }
// A person the Quality fields offer: an employee, or a member with an account missing from the staff list a role may read.
export interface QualityPerson { id?: string, dbId?: string, userId?: string | null, firstName?: string, lastName?: string, firstNameEn?: string, lastNameEn?: string, position?: string, positionEn?: string, department?: string, employmentStatus?: string }
// A person's name as the employee records keep it (the injured employee of an incident).
export interface PersonName { id?: string, firstName?: string, lastName?: string, firstNameEn?: string, lastNameEn?: string }

// --- The lists -----------------------------------------------------------------------------

// A deviation recorded elsewhere (a control execution, a bundle assessment, a training) that no CAPA handles yet (deviationQueue).
export interface DeviationItem {
  key: string
  kind: string
  source: string
  sourceId: string
  path: string
  title?: string
  titleEn?: string
  department: string
  departmentEn?: string
  departmentId: string
  at: string
  detail?: string
  notes: string
  priority: string
  deviationActions: string
  // No one reported it: it was recorded in its own module (read beside a finding's reporter).
  reportedBy?: undefined
}

// What the deviation queue reads of the other modules' records: a control and
// its executions by department, a bundle assessment, a training programme.
export interface DeviationExecution { id: string, at: string, hasFinding?: boolean, status?: string, value?: unknown, notes?: string }
export interface DeviationControl { id: string, title: string, titleEn?: string, assignments?: Record<string, { departmentId?: string, history?: DeviationExecution[], responseOverride?: { deviationActions?: string } | null }>, responseConfig?: { unit?: string, criticality?: string } | null }
export interface DeviationBundle { id: string, status: string, date: string, failedCount: number, applicableCount?: number, templateTitle?: string, templateName?: string, departmentEl?: string, departmentEn?: string, departmentId?: string, generalNotes?: string }
export interface DeviationTraining { id: string, title: string, titleEn?: string, audience?: string, audienceEn?: string, dueDate?: string, effectiveness?: { result?: string, evaluatedAt?: string, criterion?: string, notes?: string } | null }
export interface DeviationSources { controls: DeviationControl[], bundles: DeviationBundle[], trainings: DeviationTraining[], capas: QualityRecord[] }

// A row of the reports / incidents register, or of the deviations list (registerRows, findingRows): a report
// (with its record), a deviation of the queue (with its item) or a finding (with the finding as its item).
interface RegisterRowFields {
  key: string
  source: string
  id: string
  code: string
  title?: string
  titleEn?: string
  kind?: string
  category?: string
  department: string
  departmentEn: string
  date: string
  owner: string
  status: string
  severity?: string
  sentinel?: boolean
  stage?: string
  reporter?: string
  anonymous?: boolean
  hasCapa?: boolean
  noActionNeeded?: boolean
  deviationKind?: string
  causeCategories?: string[]
  recurring?: boolean | null
}
export type RegisterRow = RegisterRowFields & ({ type: 'report', record: QualityRecord, item?: undefined } | { type: 'deviation', item: DeviationItem, record?: undefined } | { type: 'finding', item: QualityRecord, record?: undefined })

// The filters of the reports / incidents register and of the deviations list (REPORT_DEFAULTS, DEVIATION_DEFAULTS).
export interface ReportFilters extends ListFilters { query: string, kind: string, stage: string, department: string, category: string, quick?: string | null, period: string, origin: string, dateFrom: string, dateTo: string }
export interface DeviationFilters extends ListFilters { query: string, scope: string, source: string, department: string, priority: string, status: string, deviationKind: string, cause: string, recurring: string, dateFrom: string, dateTo: string, quick?: string | null }

// A row of the register that is a report (the reports and incidents lists hold only these).
export type ReportRow = Extract<RegisterRow, { type: 'report' }>

// The overview: a line of what needs attention, a bar of a group and a month's column.
export interface AttentionItem { key: string, type: string, id: string, code: string, title: string, rank?: number, days?: number, kind?: string, chip: { value?: ReactNode, unit?: ReactNode, tone?: string, title?: string }, meta: unknown[] }
export interface OverviewBar { key: string, label: string, value: number, share?: number | null, prev?: number }
export interface OverviewMonth { key: string, short: string, label: string, value: number, prev?: number }

// A row of the actions list: a CAPA (or a finding still without one) with where it came from (actionRows).
export type ActionRow = QualityRecord & { kind: string, sortDate?: string, sourceKind: string, sourceCode?: string, sourcePath?: string | null, sourceTitle?: string, sourceTitleEn?: string }
// An audit with how many of its findings are still open (auditRows).
export type AuditRow = QualityRecord & { openFindings: number }

// A figure of a tab's totals (KpiFigures), whose hint may be null while its list loads.
export type TabFigure = Omit<KpiFigure, 'hint'> & { hint?: string | null }
// A link of the record to a patient, an episode or its source.
export interface RecordLink { label: string, id: string, path?: string, source?: boolean, title?: string, external?: boolean }
// A choice of the «Create» button of a Quality tab.
export interface CreateOption { id: string, label: string, icon: IconType, onClick: () => void }

// A list printed grouped (groupedListDoc): its Excel table, the columns kept and the column it groups by.
export interface GroupedListSpec { title?: string, filename?: string, table: { headers: string[], rows: unknown[][] }, columns?: number[] | null, groupBy?: number | null, language?: string, meta?: ReportFact[] }

// A list's filters, kept as the user set them (useListFilters): text, choices and the quick figure.
export type ListFilters = Record<string, string | null | undefined>
// The filters of the actions and of the audits list (ACTION_DEFAULTS, AUDIT_DEFAULTS in QualityPage).
export interface ActionFilters extends ListFilters { query: string, kind?: string, status: string, department: string, source?: string, cycle?: string, quick?: string | null, dueFrom?: string, dueTo?: string }
export interface AuditFilters extends ListFilters { query: string, status: string, type: string, standard?: string, department: string, cycle?: string, mode: string, quick?: string | null }
// What useListFilters gives a list.
export interface ListView<F extends ListFilters = ListFilters> { filters: F, set: (name: string, value: unknown) => void, clear: () => void, setFilters: Dispatch<SetStateAction<F>> }
