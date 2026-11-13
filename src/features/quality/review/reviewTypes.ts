import type { Tables } from '../../../core/supabase/database.types'
import type { Register, RegisterIndicator } from '../../registers/registerTypes'
import type { Meeting, MeetingGroup } from '../meetings/meetingModel'
import type { Survey, SurveyResponse } from '../surveys/surveyModel'
import type { certificationState, evaluationApproval } from '../resources/resourceModel'
import type { summarizeRisks } from '../risk/riskModel'

// The shapes the objectives and management review screens keep (reviewService translates them to and from
// the database rows: quality_objectives, quality_objective_values and quality_management_review* in database.types).

// --- Objectives ----------------------------------------------------------------------

// A quality objective (the Demo keeps the same shape, some fields absent).
export interface Objective {
  id: string
  code: string
  year: number
  level?: string
  committeeId?: string
  platformIndicatorKey?: string
  title: string
  titleEn?: string
  description?: string
  departmentId?: string
  registerId?: string
  indicatorKey?: string
  // A number, or '' when none (the form keeps what is typed).
  target: number | string
  direction: string
  unit?: string
  reportedValue?: number | string
  ownerLabel?: string
  dueDate?: string
  status: string
}

// An objective in the form (new or edited): any field may still be empty; `measure` is the form's own choice.
export type ObjectiveDraft = Partial<Omit<Objective, 'year' | 'title'>> & { title: string, year?: number | '', measure?: string }

// One month's value of an objective, entered by its owner (month = the month's first day).
export interface ObjectiveValue { id: string, objectiveId: string, month: string, value: number }

// One point of an objective's months (month 1–12).
export interface ObjectiveHistoryPoint { month: number, value: number | null }

// An indicator of the platform as the indicators' service maps it (only the fields read here).
export interface PlatformIndicatorDef {
  id: string
  definitionId?: string
  titleEl: string
  titleEn?: string
  numerator: string
  denominator?: string | null
  unit: string
  unitEn?: string
  calculation: string
  target: number | null
  direction: string
}

// A value entered by hand for a manual indicator, and the period it covers.
export interface ManualValue { value: number, from: string, to: string }

// A row of indicator_snapshots, with only the fields the year's file reads.
export interface IndicatorSnapshotRow { indicator_key: string, calculation_type: string, department_id?: string | null, period_start: string, period_end: string, value: number | null }

// How a value was computed: entered by hand, a count of infections, or numerator / denominator.
export interface EvidenceRow { manual?: ManualValue | null, ssi?: number | null, evidence?: (number | null)[] | null }

// A platform indicator of the year's file: its value, how it was computed and, when it has none, why (a key of the «missing data» page).
export interface DossierIndicatorRow extends EvidenceRow {
  def: PlatformIndicatorDef
  value: number | null
  numerator?: number | null
  denominator?: number | null
  missing: string | null
}

// An indicator of a department register for the year's file.
export interface RegisterIndicatorRow extends EvidenceRow {
  register: { id: string, name: string, nameEn: string }
  titleEl: string
  titleEn: string
  unit: string
  unitEn: string
  target: number | null
  direction?: string
  value: number | null
  status?: string
  missing: string | null
}

// The names of the levels: the hospital's departments and committees.
export interface LevelDepartment { id: string, name: string, nameEn?: string }
export interface LevelCommittee { id: string, code: string, name: string, shortName: string }
export interface LevelNames { departments: LevelDepartment[], committees: LevelCommittee[] }

// An item of a committee's annual plan as the committees' Demo keeps it (only the fields read here).
export interface CommitteePlanItem { id: string, title: string, indicator?: string, baseline?: string, target?: string, owner?: string, dueDate?: string, status?: string }

// A row of committee_plan_items with its committee, as loadCommitteeTargets selects it (the embed of committees has
// two relationships to choose from, so database.types cannot type it).
export type CommitteePlanRow = Pick<Tables<'committee_plan_items'>, 'id' | 'committee_id' | 'title' | 'indicator' | 'baseline' | 'target' | 'owner_label' | 'due_date' | 'status' | 'created_at'> & { committee: { code: string, name: string } | null }

// An objective of a committee's annual plan (committee_plan_items): indicator, baseline and target are text.
export interface CommitteeTarget {
  id: string
  committeeId: string
  committeeCode: string
  committeeName: string
  title: string
  indicator: string
  baseline: string
  target: string
  ownerLabel: string
  dueDate: string
  status: string
  year: number
}

// An objective with what useObjectives adds: its register, indicator or platform indicator, its months and its value today.
export interface ObjectiveView extends Objective {
  kind?: undefined
  committeeName?: undefined
  register?: Register
  indicator?: RegisterIndicator
  platformIndicator: PlatformIndicatorDef | null
  months: ObjectiveValue[]
  department?: LevelDepartment
  committee?: LevelCommittee
  level: string
  current: { value: number | null, status: string }
  targetFromIndicator?: boolean
}

// A row of a committee's annual plan in the objectives' list.
export interface PlanObjective extends CommitteeTarget { kind: 'plan', level?: string, code?: undefined, titleEn?: undefined, current?: undefined }

// A row of the objectives' list: an objective or a committee's plan item.
export type ObjectiveListRow = ObjectiveView | PlanObjective

// --- Management reviews ----------------------------------------------------------------

export interface ReviewSection { id?: string, key: string, position: number, title: string, body: string }
export interface ReviewAction {
  id?: string
  position?: number
  sectionKey: string
  title: string
  ownerLabel: string
  dueDate: string
  status: string
  capaId?: string
  // Carried over, open, from the previous review.
  carried?: boolean
}
export interface ReviewParticipant { id?: string, position?: number, name: string, role: string, attended: boolean, signedAt: string | null }

// A management review (a new one has no id or code until saved).
export interface Review {
  id?: string
  code: string
  title: string
  reviewDate: string
  periodFrom: string
  periodTo: string
  // '' while the field is cleared.
  frequencyDays: number | ''
  nextReviewDate: string
  status: string
  summary: string
  approvedAt?: string | null
  approvedByLabel?: string
  sections: ReviewSection[]
  actions: ReviewAction[]
  participants: ReviewParticipant[]
}

// The period a review looks back on.
export interface ReviewPeriod { from: string, to: string }

// --- The facts of the other screens for the minutes (sectionFacts) ---------------------
// Records of other screens, with only the fields the minutes read; the ones handed whole to another
// screen's model (a risk, an opportunity, a certificate) stay records of that model.

export interface FactIncident { date?: string, status?: string, sentinel?: boolean, reportKind?: string }
export interface FactCapa { id: string, dbId?: string, code?: string, sourceId?: string, status: string, dueDate?: string, date?: string, createdAt?: string | null }
// An audit has no severity (the four sections are loaded in one loop).
export interface FactFinding { date?: string, severity?: string }
export interface FactAudit { status?: string, completedDate?: string | null, plannedDate?: string }
export interface FactObjective { title: string, titleEn?: string, unit?: string, direction?: string, target: number | string, current?: { value: number | null, status: string } }
export interface FactCommitteeMeeting { status?: string, date?: string }
export interface FactCommitteeDecision { status: string, dueDate?: string }
export interface FactCommittee { status?: string, meetings?: FactCommitteeMeeting[], decisions?: FactCommitteeDecision[] }
export interface FactSupplierIssue { date?: string, status?: string }
// Evaluations, certificates and risks in the shapes their own modules read them (resourceModel, riskModel).
export interface FactSupplier { status?: string, evaluations?: (Parameters<typeof evaluationApproval>[0] & { evaluatedOn?: string })[], certifications?: NonNullable<Parameters<typeof certificationState>[0]>[], nonconformities?: FactSupplierIssue[] }
export interface FactEquipmentEvent { happenedOn?: string, kind: string, result?: string }
export interface FactRiskAssessment { status?: string, assessedOn?: string, code?: string, title?: string, risks?: NonNullable<Parameters<typeof summarizeRisks>[0]>, opportunities?: Record<string, unknown>[] }
export interface FactTrainingProgram { status?: string, startDate?: string, dueDate?: string }
export interface FactTrainingAssignment { status?: string, completedDate?: string }
export interface FactDocument { status: string, type?: string, reviewDate?: string }

export interface ReviewFacts {
  incidents?: FactIncident[]
  capas?: FactCapa[]
  findings?: FactFinding[]
  audits?: FactAudit[]
  objectives?: FactObjective[]
  previous?: Pick<Review, 'actions'> | null
  surveys?: { survey: Survey, responses: SurveyResponse[] }[]
  meetingGroups?: MeetingGroup[]
  meetings?: Meeting[]
  committees?: FactCommittee[]
  suppliers?: FactSupplier[]
  equipment?: unknown[]
  equipmentEvents?: FactEquipmentEvent[]
  riskAssessments?: FactRiskAssessment[]
  trainingPrograms?: FactTrainingProgram[]
  trainingAssignments?: FactTrainingAssignment[]
  documents?: FactDocument[]
}

// A section of the minutes as REVIEW_SECTIONS describes it (short names, English title, the facts it draws on).
export interface ReviewSectionMeta { key: string, short: string, shortEn: string, title: string, titleEn: string, source?: string }
