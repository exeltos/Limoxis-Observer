// Τύποι για την ενότητα Ανάλυσης. Δύο κατηγορίες:
// 1) Στενές όψεις των demo fixtures που διαβάζει το collectDemoDomainMetrics από
//    άλλες (ατύπωτες ακόμη) ενότητες — μόνο τα πεδία που διαβάζονται.
// 2) Τα συγκεντρωτικά μεγέθη (domain metrics) και το snapshot: τα διαβάζει η
//    παραγωγή από RPC ως JSON, οπότε το σχήμα τους δεν είναι γνωστό εδώ — όπως
//    και το MetricRow (any[]) στο analysisPageModel.

import type { Survey, SurveyQuestion, SurveyResponse } from '../quality/surveys/surveyTypes'

// --- 2) Συγκεντρωτικά (RPC JSON) ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- τα domain metrics είναι JSON από RPC (όπως το MetricRow)
export type DomainMetrics = Record<string, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- το snapshot της Ανάλυσης είναι JSON από RPC
export type AnalysisSnapshot = Record<string, any>

// --- 1) Στενές όψεις των demo fixtures ---
export interface DeviceRow { removedAt?: string | null, status?: string, nameEn?: string, name?: string, type?: string }
export interface TherapyRow { status?: string, endedAt?: string | null, approvalStatus?: string, approved?: boolean | null, antimicrobial?: string, administrations?: { status?: string }[] }
// Μια δοκιμή αντιβιογράμματος και ένα εργαστηριακό δείγμα, όσο τα διαβάζει το demo snapshot.
export interface AstRow { drug?: string, sir?: string }
export interface LabSampleRow {
  id?: string
  subjectType?: string
  organism?: string
  resultStatus?: string
  result?: string
  collectedAt?: string
  resultedAt?: string
  requestedAt?: string
  source?: string
  type?: string
  critical?: boolean
  resistance?: string
  department?: string
  patientId?: string
  status?: string
  ast?: AstRow[]
}
export interface CaseRow {
  lifecycleStatus?: string
  status?: string
  startedAt?: string
  department?: string
  departmentEn?: string
  organism?: string
  reviewDue?: string
  haiClassification?: { status?: string, type?: string } | null
  isolation?: { status?: string } | null
  outcome?: { status?: string } | null
  devices?: DeviceRow[]
  therapy?: TherapyRow[]
}
export interface WhoObservationRow { professionalsCount?: number | string, professionalCategory?: string, action?: string }
export interface HandHygieneRow {
  lifecycleStatus?: string
  date?: string
  observations?: number | string
  compliant?: number | string
  departmentEn?: string
  departmentEl?: string
  whoObservations?: WhoObservationRow[]
}
export interface BundleRow { lifecycleStatus?: string, date?: string, score?: number | string | null, bundle?: string, departmentEn?: string, departmentEl?: string }
export interface WasteRow { lifecycleStatus?: string, periodEnd?: string, date?: string, weight?: number | string, patientDays?: number | string, departmentEn?: string, departmentEl?: string }
export interface ControlExecutionRow { cancelled_at?: string | null, performed_at?: string, status?: string, has_finding?: boolean, department_id?: string, control_id?: string, control_definition_id?: string }
export interface ControlAssignmentRow { status?: string, next_due_at?: string | null }
export interface ControlDefinitionRow { id?: string, titleEn?: string, title_en?: string, title?: string }
export interface IncidentRow {
  lifecycleStatus?: string
  date?: string
  status?: string
  harmOccurred?: boolean
  harm_occurred?: boolean
  severity?: string
  dueDate?: string
  category?: string
  departmentEn?: string
  department?: string
}
export interface AnalysisEmployeeRow { id?: string, employmentStatus?: string, departmentEn?: string, department?: string }
export interface VaccinationRow { employeeId?: string, validUntil?: string | null, vaccine?: string }
export interface VisitRow { employeeId?: string, date?: string, type?: string, status?: string, followUpDate?: string }
export interface ExposureRow { incidentDate?: string, exposureType?: string }
export interface TrainingAssignmentRow { assignedDate?: string, computedStatus?: string, status?: string, score?: number | string | null, dueDate?: string, department?: string }
export interface DocumentRow { status?: string, type?: string, reviewDate?: string }
export interface MeetingRow { date?: string, status?: string }
export interface CommitteeRow { status?: string, meetings?: MeetingRow[] }
export interface PrevalenceSurveyRow { surveyDate?: string, patientsTotal?: number | string, patientsWithHai?: number | string, patientsOnAntibiotics?: number | string }
export interface LiraInvestigationRow { status?: string, organism?: string, created_at?: string, closed_at?: string }
// Οι έρευνες ικανοποίησης έχουν ήδη τύπους στην ενότητα quality.
export type SurveyQuestionRow = SurveyQuestion
export type SurveyRow = Survey
export type SurveyResponseRow = SurveyResponse
// Οι πηγές του «Ποιότητα & ασφάλεια τροφίμων» (ετερογενή δεδομένα από την ενότητα quality, ακόμη ατύπωτη).
export interface QualityFoodSources {
  audits?: DomainMetrics[]
  findings?: DomainMetrics[]
  suppliers?: DomainMetrics[]
  kitchen?: Record<string, DomainMetrics[]>
  surveys?: SurveyRow[]
  responses?: SurveyResponseRow[]
  assessments?: DomainMetrics[]
}
