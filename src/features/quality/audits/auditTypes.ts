import type { Tables } from '../../../core/supabase/database.types'
import type { AttachmentFile } from '../../../design-system/AttachmentField'
import type { auditScore, roundPlan } from './auditModel'

// The shapes the audit programme keeps: the questionnaires (auditTemplateService
// and the seed), an audit with its answers and team (qualityService maps the
// rows, qualityRelations the answers and the team), the findings it raised and
// the auditor competence. The records reach the screens from the quality
// service, which still keeps them as open records, so every field is optional
// here: the screens read what they need and never require more.

// --- Questionnaires --------------------------------------------------------------------------

// A question of a questionnaire. The editor keeps the weight as typed until it is saved.
export interface AuditQuestion {
  id?: string | null
  position?: number
  chapterRef?: string
  chapterTitle?: string
  clauseRef?: string
  question?: string
  guidance?: string
  evidence?: string
  weight?: number | string
  critical?: boolean
  areas?: string[]
}

// A questionnaire: one of the platform library or a hospital's copy.
export interface AuditTemplate {
  id: string
  organizationId?: string | null
  isSystem: boolean
  basedOn?: string | null
  key?: string
  standard: string
  standardVersion?: string
  title: string
  description?: string
  scope?: string
  departmentTypes?: string[]
  active?: boolean
  version?: number
  source?: string
  updatedAt?: string | null
  questions: AuditQuestion[]
}

// A questionnaire being edited: a new one or a copy has no id until it is saved.
export type AuditTemplateDraft = Omit<AuditTemplate, 'id'> & { id: string | null }

// A questionnaire as the database returns it, with its questions.
export type AuditTemplateRow = Tables<'quality_audit_templates'> & { questions?: Tables<'quality_audit_template_questions'>[] | null }

// A chapter of a questionnaire, for the scope picker and the coverage.
export interface TemplateChapter { ref: string, title: string, questions: number, clauses: string[] }

// The seed of a questionnaire (seed/*.ts): chapters of questions, each
// [clause, question, evidence, guidance, options] with options c (critical),
// w (weight) and a (areas).
export interface SeedOptions { c?: boolean, w?: number, a?: string[] }
export type SeedQuestion = [clauseRef: string, question: string, evidence?: string, guidance?: string, options?: SeedOptions | null]
export interface QuestionnaireSeed {
  key: string
  standard: string
  version: string
  title: string
  description?: string
  scope: string
  departmentTypes?: string[]
  chapters: { ref: string, title: string, questions: SeedQuestion[] }[]
}

// --- An audit ---------------------------------------------------------------------------------

// The answer to one question of an audit (a row of its checklist).
export interface AuditAnswer {
  id?: string
  dbId?: string
  templateQuestionId?: string | null
  position?: number
  chapterRef?: string
  chapterTitle?: string
  clauseRef?: string
  item?: string
  itemEn?: string
  guidance?: string
  evidenceRequired?: string
  weight?: number
  critical?: boolean
  required?: boolean
  answer?: string
  note?: string
  evidence?: string
  findingClass?: string
  findingId?: string
  adHoc?: boolean
  standard?: string
  attachments?: AttachmentFile[]
}

// A member of the audit team: an employee, or an external auditor by name.
export interface AuditTeamMember {
  id?: string | null
  role?: string
  employeeId?: string | null
  name?: string
  external?: boolean
  affiliation?: string
  departmentId?: string | null
  department?: string
}

// The opening or the closing meeting.
export interface AuditMeeting { date?: string, attendees?: string }

// A history entry of a quality record.
export interface AuditHistoryEntry { at?: string, action?: string, actor?: string }

// An audit as the quality service keeps it.
export interface QualityAudit {
  id?: string
  dbId?: string
  displayId?: string
  title?: string
  titleEn?: string
  department?: string
  departmentEn?: string
  departmentId?: string | null
  status?: string
  lifecycleStatus?: string
  auditType?: string
  plannedDate?: string
  completedDate?: string | null
  plannedMonthOnly?: boolean
  scope?: string
  scopeEn?: string
  leadAuditor?: string
  leadAuditorId?: string | null
  checklist?: AuditAnswer[]
  checklistSource?: string
  templateId?: string | null
  templateTitle?: string
  templateVersion?: number | null
  standard?: string
  standards?: string[]
  extraTemplateIds?: string[]
  clausesScope?: string[]
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
  notes?: string
  reportSentOn?: string
  correctionsDueOn?: string
  team?: AuditTeamMember[]
  findingIds?: string[]
  history?: AuditHistoryEntry[]
  attachments?: AttachmentFile[]
}

// A finding an audit raised, with the fields the audit screens read (the
// findings are another part of Quality; their own type lives there).
export interface AuditFinding {
  id?: string
  displayId?: string
  title?: string
  titleEn?: string
  department?: string
  departmentEn?: string
  departmentId?: string | null
  source?: string
  sourceId?: string
  status?: string
  lifecycleStatus?: string
  findingClass?: string
  severity?: string
  standard?: string
  dueDate?: string
  owner?: string
  owners?: string[]
  description?: string
}

// A department as the audit checks read it (useDepartments gives these, an audit its own).
export interface AuditDepartment { id?: string | null, name?: string, nameEn?: string }

// --- Competence --------------------------------------------------------------------------------

export interface AuditorCertificate { employeeId?: string | null, title?: string, titleEn?: string, validUntil?: string | null }
export interface AuditorAssignment { employeeId?: string | null, programId?: string, status?: string | null, completedDate?: string | null }
export interface AuditorProgram { id?: string, title?: string, titleEn?: string, category?: string }
export interface AuditorCompetence { certificates: AuditorCertificate[], assignments: AuditorAssignment[], programs: AuditorProgram[] }

// --- Scores --------------------------------------------------------------------------------

export type AuditScore = ReturnType<typeof auditScore>
export type AuditChapterScore = AuditScore['chapters'][number]

// --- The programme ------------------------------------------------------------------------------

// An audit in a month of the programme, and where it stands (done, running, late, planned, cancelled).
export interface ProgrammeCell { audit: QualityAudit, state: string }
// A department's line of the programme: its audits by month (0–11).
export interface ProgrammeRow { key: string, name: string, nameEn: string, id: string, months: ProgrammeCell[][], count: number }

// A department of an audit round: its audit (if it has one) and its place in the days.
export type RoundItem = ReturnType<typeof roundPlan>['items'][number]

// What the finding dialog creates from an answer: the finding and, when ticked, its CAPA.
export interface FindingDialogValues { findingClass: string, owner: string, dueDate: string, withCapa: boolean, capaOwner: string, capaDueDate: string }

// A bar of the dashboard: a standard, a department or a chapter, with its compliance.
export interface ComplianceBar { key?: string, ref?: string, title?: string, rate: number | null, audits?: number }

// A department as the round saves it: its audit (if any) and the day it is audited on.
export interface RoundAssignment { auditId?: string | null, department?: string, departmentEn?: string, departmentId?: string, plannedDate: string }
