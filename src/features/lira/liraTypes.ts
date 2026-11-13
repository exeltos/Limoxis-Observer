import type { Tables } from '../../core/supabase/database.types'
import type { OutbreakLineRow } from './liraOutbreakInvestigation'

// Τύποι της LIRA. Το σύνολο δεδομένων (LiraData) το φτιάχνει το liraDataLayer:
// στην παραγωγή από τους πίνακες, στο demo από τα fixtures των άλλων ενοτήτων
// (που έχουν και δικά τους πεδία — γι' αυτό τα πεδία είναι προαιρετικά).

// Τα κοινά πεδία κάθε γραμμής: ημερομηνία σήματος, τμήμα, ασθενής.
export interface LiraRow {
  // Οι γραμμές του εργαστηρίου ταυτοποιούνται με το resultId· οι υπόλοιπες με id.
  id?: string
  department?: string | null
  departmentEl?: string | null
  departmentEn?: string | null
  signalDate?: string | null
  date?: string | null
  resultedAt?: string | null
  collectedAt?: string | null
  startedAt?: string | null
  dueDate?: string | null
  patient?: string | null
  patientId?: string | null
  patientCode?: string | null
  subjectCode?: string | null
  organism?: string | null
  status?: string | null
}
// Μια δοκιμή ευαισθησίας ενός αποτελέσματος.
export interface LiraAst {
  id?: string
  antimicrobialCode?: string | null
  antimicrobialName?: string | null
  method?: string | null
  micValue?: number | string | null
  micOperator?: string | null
  zoneDiameterMm?: number | string | null
  sirCategory?: string | null
  breakpointStandard?: string | null
  breakpointVersion?: string | null
  technicalUncertainty?: boolean | string | null
}
export interface LiraSurveillanceRow extends LiraRow { state?: string | null, resistance?: boolean | string | null, resistanceClass?: string | null, reviewDue?: string | null }
export interface LiraLabRow extends LiraRow {
  resultId?: string
  result?: string | null
  resistance?: string | null
  critical?: boolean
  communications?: { at?: string | null }[]
  specimenType?: string | null
  validationStatus?: string | null
  ast?: LiraAst[]
}
export interface LiraHandHygieneRow extends LiraRow { observations?: number, rate?: number }
export interface LiraBundleRow extends LiraRow { bundle?: string | null, score?: number | null, failedCount?: number, allOrNone?: boolean }
export interface LiraIncidentRow extends LiraRow { title?: string | null, severity?: string | null }
export interface LiraCapaRow extends LiraRow { title?: string | null, priority?: string | null }
export interface LiraPatientDayRow extends LiraRow { periodStart?: string | null, periodEnd?: string | null, patientDays?: number, source?: string | null, sourceReference?: string | null, reviewStatus?: string | null }
export interface LiraHaiRow extends LiraRow { caseId?: string | null, haiType?: string | null, caseStatus?: string | null, definitionSet?: string | null, definitionVersion?: string | null, criteriaMet?: boolean | null, classifiedAt?: string | null }
export interface LiraDeviceRow extends LiraRow { caseId?: string | null, deviceType?: string | null, insertedAt?: string | null, removedAt?: string | null }
export interface LiraIsolationRow extends LiraRow { caseId?: string | null, endedAt?: string | null, reviewDue?: string | null }

// Το σύνολο δεδομένων της LIRA.
export interface LiraData {
  surveillance?: LiraSurveillanceRow[]
  laboratory?: LiraLabRow[]
  handHygiene?: LiraHandHygieneRow[]
  bundles?: LiraBundleRow[]
  qualityIncidents?: LiraIncidentRow[]
  qualityCapas?: LiraCapaRow[]
  patientDays?: LiraPatientDayRow[]
  haiClassifications?: LiraHaiRow[]
  devices?: LiraDeviceRow[]
  isolations?: LiraIsolationRow[]
  generatedAt?: string
  source?: string
  provenance?: Record<string, string>
}

// Οι πίνακες της διερεύνησης έξαρσης.
export type OutbreakInvestigation = Tables<'lira_outbreak_investigations'>
export type OutbreakCaseReview = Tables<'lira_outbreak_case_reviews'>
export type OutbreakEvent = Tables<'lira_outbreak_investigation_events'>
export type OutbreakAction = Pick<Tables<'quality_capa_actions'>, 'id' | 'code' | 'title' | 'action_type' | 'priority' | 'status' | 'description' | 'owner_id' | 'owner_label' | 'due_date' | 'effectiveness_due' | 'effectiveness_status' | 'created_at' | 'updated_at'>

// Ό,τι διαβάζουν από τη διερεύνηση το κλείσιμο, ο βοηθός και η αναφορά (στενές όψεις,
// ώστε να ταιριάζουν και οι γραμμές της βάσης και οι demo γραμμές της οθόνης).
export interface OutbreakInvestigationLike { title?: string | null, organism?: string | null, status?: string | null, definition_id?: string | null, definition_version?: string | null, scope_from?: string | null, scope_to?: string | null }
export interface OutbreakCaseReviewLike { id?: string, record_key?: string, reviewed_at?: string | null, classification?: string | null, rationale?: string | null }
export interface OutbreakActionLike { id?: string, code?: string | null, title?: string | null, status?: string | null, due_date?: string | null, owner_label?: string | null }
// Ό,τι χρειάζεται το κλείσιμο από ένα γεγονός (ταιριάζει και η γραμμή της βάσης).
export interface OutbreakEventStamp { event_type?: string, created_at?: string }
export interface OutbreakEventLike { id?: string, event_type?: string, created_at?: string, payload?: { action?: string, text?: string, to?: string } | null }
// Ένα γεγονός του χρονολογίου, όσο το δείχνει η αναφορά.
export interface OutbreakTimelineLike { date?: string | null, type?: string, department?: string | null, label?: string | null }
// Η λίστα κρουσμάτων όπως τη διαβάζουν η ετοιμότητα κλεισίματος και ο βοηθός: μόνο το κλειδί κάθε γραμμής.
export interface OutbreakLineListLike { rows?: Pick<OutbreakLineRow, 'recordKey'>[], summary?: { uniquePatients?: number } }

// Ένα σήμα της ανάλυσης LIRA και η τεκμηρίωσή του (πηγή, εγγραφή, ημερομηνία).
export interface LiraEvidence { source: string, id: string | undefined, date: string | null }
export interface LiraSignal { id: string, severity: string, domain: string, department: string | null | undefined, title: string, summary: string | null | undefined, evidence: LiraEvidence[], to: string }

// Ένα απόσπασμα της εγκεκριμένης γνώσης και μια παραπομπή της απάντησης AI.
export interface LiraPassage { chunkId?: string, excerpt?: string, title?: string, label?: string, authority?: string, pageStart?: number | string | null, url?: string | null }
export interface LiraCitation { authority?: string, title?: string, version?: string | null, pageStart?: number | string | null, pageEnd?: number | string | null }
// Η τεκμηρίωση μιας απάντησης: πηγή και, όπου υπάρχει, εγγραφή και ημερομηνία.
export interface LiraProvenance { source: string, id?: string, date?: string | null }
// Η πρόταση να ανοίξει διερεύνηση από ένα σήμα (ο χρήστης την ξεκινά).
export interface LiraHandoff { title: string, organism?: string | null, from?: string | null, to?: string | null, department?: string | null, source?: string | { type?: string, method?: string, guardrails?: Record<string, boolean> } }
// Μια απάντηση της LIRA και ένα μήνυμα της συνομιλίας.
export interface LiraAnswer {
  title?: string
  subtitle?: string | null
  points?: (string | null | undefined)[]
  context?: unknown
  provenance?: LiraProvenance[]
  chartRows?: [string, number][] | null
  generic?: boolean
  passages?: LiraPassage[]
  citations?: LiraCitation[]
  handoff?: LiraHandoff | null
  ai?: { provider?: string, model?: string } | false | null
  investigationId?: string
}
export type LiraMessage = LiraAnswer & { id: string, kind: string, text?: string }
