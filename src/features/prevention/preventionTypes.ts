import type { Tables } from '../../core/supabase/database.types'
import type { Vaccination } from '../occupational-health/vaccinationService'

// Τύποι της Πρόληψης: οι γραμμές της βάσης (database.types) και οι εγγραφές
// όπως τις κρατούν οι οθόνες (από τους mappers των υπηρεσιών). Οι demo
// εγγραφές και τα προσχέδια των φορμών έχουν το ίδιο σχήμα, με λιγότερα
// συμπληρωμένα πεδία — γι' αυτό τα πεδία είναι προαιρετικά.

type DepartmentRef = { id: string, name: string } | null

// --- Γραμμές της βάσης ---
export type HandHygieneSessionRow = Tables<'hand_hygiene_sessions'> & { department?: DepartmentRef, observations_detail?: Tables<'hand_hygiene_observations'>[] }
export type BundleTemplateRow = Tables<'prevention_bundle_templates'>
export type BundleAssessmentRow = Tables<'prevention_bundle_assessments'> & { department?: DepartmentRef }
export type WasteMeasurementRow = Tables<'waste_measurements'> & { department?: DepartmentRef, waste_type?: { name_el?: string | null, name_en?: string | null } | null }
export type AntisepticPeriodRow = Tables<'antiseptic_consumption_periods'> & { department?: DepartmentRef, antiseptic_item?: AntisepticItemRef | null }
export interface AntisepticItemRef { name_el?: string | null, name_en?: string | null, code?: string | null, metadata?: unknown }

// --- Κοινά πεδία κάθε εγγραφής ---
export interface PreventionRecord {
  id: string
  date?: string | null
  period?: string | null
  periodStart?: string | null
  periodEnd?: string | null
  departmentId?: string | null
  departmentEl?: string
  departmentEn?: string
  status?: string | null
  lifecycleStatus?: string
  notes?: string
  createdAt?: string | null
  createdById?: string | null
  createdBy?: string
  // Παλαιότερες τοπικές εγγραφές: το όνομα του τμήματος και των χρηστών με άλλα κλειδιά.
  department?: string
  createdByName?: string
  updatedByName?: string
  updatedAt?: string | null
  updatedById?: string | null
}

// --- Υγιεινή χεριών (WHO) ---
// Από τη βάση όλα συμπληρωμένα· στη φόρμα το πλήθος μένει κείμενο όσο γράφεται.
export interface WhoObservation {
  id: string
  professionalsCount: number | string
  professionalCategory: string
  moment?: string | null
  moments?: string[]
  action: string
  gloves?: boolean
  notes?: string
}
export interface WhoStats { opportunities: number, handRub: number, handWash: number, missed: number, professionals: number, compliant: number, compliance: number }
export interface HandHygieneSessionInfo { department?: string, date?: string | null, observer?: string, startTime?: string, endTime?: string }
export interface HandHygieneSession extends PreventionRecord {
  profession: string
  observations?: number
  compliant?: number
  rate?: number
  observer?: string
  session?: HandHygieneSessionInfo
  whoObservations?: WhoObservation[]
  whoStats?: WhoStats
}

// --- Δέσμες μέτρων ---
export interface BundleTemplateElement { id: string, labelEl?: string, labelEn?: string, label_el?: string, label_en?: string, label?: string, [key: string]: unknown }
export interface BundleTemplate {
  dbId?: string
  id: string
  bundleKey?: string
  name?: string | null
  title?: string | null
  titleEl?: string | null
  titleEn?: string | null
  version?: string | null
  status?: string | null
  scope?: string | null
  source?: string | null
  sourceVersion?: string | null
  system?: boolean
  departments?: string[]
  elements: [string, string][]
  rawElements: BundleTemplateElement[]
}
// Ο επανέλεγχος μιας απόκλισης (BundleFollowUpDialog): κατάσταση, ημερομηνία, σχόλιο και ποιος τον έκανε.
export type BundleFollowUp = { status?: string, date?: string, comment?: string, reviewedBy?: string, reviewedById?: string, reviewedAt?: string, at?: string, note?: string }
// Μια απόκλιση της αξιολόγησης: το στοιχείο που απαντήθηκε «όχι».
export type BundleFinding = { id: string, label?: string, note?: string }
export interface BundleAssessment extends PreventionRecord {
  // Από τη βάση πάντα συμπληρωμένα (assessment_date, status, created_at).
  date?: string
  status?: string
  createdAt?: string
  bundle?: string
  templateId?: string
  templateName?: string | null
  templateTitle?: string | null
  templateVersion?: string | null
  templateSource?: string | null
  templateSnapshot?: BundleTemplate | null
  score?: number | null
  answers: Record<string, string>
  answerNotes: Record<string, string>
  shift?: string
  context?: string
  patientId?: string
  patientRef?: string
  deviceId?: string
  deviceRef?: string
  patientRecordId?: string
  surveillanceCaseId?: string
  surveillanceDeviceId?: string
  deviceDay?: number | null
  generalNotes?: string
  followUps?: Record<string, BundleFollowUp>
  applicableCount?: number
  failedCount?: number
  allOrNone?: boolean
  findings?: BundleFinding[]
  owner?: string
}
// Η αξιολόγηση πριν αποθηκευτεί (χωρίς ακόμη id).
export type BundleAssessmentDraft = PreventionDraft<BundleAssessment>
// Ό,τι φέρνει η συσκευή ενός επεισοδίου στη φόρμα της δέσμης (buildBundlePrefill).
export interface BundleExecutionPrefill {
  surveillanceCaseId?: string | null
  surveillanceDeviceId?: string | null
  patientRecordId?: string | null
  patientLabel?: string
  admissionLabel?: string
  episodeLabel?: string
  deviceLabel?: string
  deviceDay?: number | null
  departmentId?: string | null
  departmentName?: string
  bundleKeys?: string[]
  date?: string
  shift?: string
}
// Τα κριτήρια μιας αξιολόγησης δέσμης όπως αποθηκεύονται (json).
export interface BundleCriteria {
  answers?: Record<string, string>
  answerNotes?: Record<string, string>
  templateSnapshot?: BundleTemplate | null
  shift?: string
  context?: string
  patientId?: string
  patientRef?: string
  deviceId?: string
  deviceRef?: string
  generalNotes?: string
  followUps?: Record<string, BundleFollowUp>
  owner?: string
}

// --- Ιατρικά απόβλητα ---
export interface WasteMeasurement extends PreventionRecord {
  wasteType?: string
  type?: string
  typeEn?: string
  wasteTypeId?: string | null
  // Αριθμοί από τη βάση· στο προσχέδιο της φόρμας μένουν κείμενο.
  weight?: number | string
  containers?: number | string
  patientDays?: number | string | null
  patientDaysSource?: string
  indicator?: number | null
  responsible?: string
  documentNumber?: string
  collectionCompany?: string
}

// --- Αντισηπτικά ---
export interface AntisepticRecord extends PreventionRecord {
  departmentScope?: string
  periodKind?: string
  product?: string
  productEn?: string
  antisepticItemId?: string | null
  productCode?: string
  litres?: number | string
  patientDays?: number | string | null
  patientDaysSource?: string
  indicator?: number | null
  indicatorEligible?: boolean
  method?: string
  referenceNumber?: string
  responsible?: string
}

// --- Εμβολιασμοί προσωπικού ---
// Ο εμβολιασμός (υπηρεσία της Υγείας εργαζομένων)· στο προσχέδιο της φόρμας
// τα πεδία συμπληρώνονται σταδιακά.
export type StaffVaccinationDraft = Omit<Vaccination, 'id' | 'employeeId'> & { id?: string, employeeId?: string }
// Ο εργαζόμενος όπως τον διαβάζουν οι εμβολιασμοί της Πρόληψης.
export interface PreventionEmployee {
  id: string
  dbId?: string
  firstName?: string
  lastName?: string
  firstNameEn?: string
  lastNameEn?: string
  profession?: string
  professionEn?: string
  department?: string
  departmentEn?: string
  employmentStatus?: string
}

// Μια εγγραφή πριν αποθηκευτεί (χωρίς ακόμη id).
export type PreventionDraft<T extends { id: string }> = Omit<T, 'id'> & { id?: string }

// Η γραμμή οποιασδήποτε καρτέλας της Πρόληψης (η λίστα, η ταξινόμηση και τα
// φίλτρα διαβάζουν τα πεδία όλων των καρτελών).
export type PreventionTabRow = HandHygieneSession & WasteMeasurement & AntisepticRecord & BundleAssessment & Partial<Vaccination> & { id: string }
