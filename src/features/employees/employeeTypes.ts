import type { TrainingCertificate } from '../training/trainingTypes'
import type { TrainingQuestionInput } from '../training/trainingAssessment'

// Τύποι των Εργαζομένων: ο εργαζόμενος όπως τον διαβάζει η υπηρεσία (employeeService: fromRow,
// με τον κωδικό εργαζομένου ως id και το uuid της βάσης ως dbId) και όπως τον κρατά το demo.
// Τα κείμενα που λείπουν γίνονται '': τα ονόματα, το τμήμα, η ειδικότητα, η θέση, η κατάσταση,
// το email και η πρόσληψη υπάρχουν πάντα, και στο demo. Τα πεδία που δεν έχει
// κάθε πηγή (π.χ. τα στοιχεία λογαριασμού στο demo) είναι προαιρετικά.
// Οι τύποι είναι `type` (όχι interface) ώστε να περνούν σε Record<string, unknown>.

export type Employee = {
  id: string
  employeeCode?: string
  dbId?: string
  userId?: string | null
  accountLinked?: boolean
  departmentId?: string | null
  organizationId?: string | null
  firstName: string
  firstNameEn: string
  lastName: string
  lastNameEn: string
  fatherName?: string
  fatherNameEn?: string
  department: string
  departmentEn: string
  profession: string
  professionEn: string
  position: string
  positionEn: string
  hrDepartment?: string
  directorate?: string
  employmentStatus: string
  staffCategory?: string
  email: string
  phone?: string
  hireDate: string
  birthDate?: string
  photoPath?: string | null
  createdAt?: string
  updatedAt?: string
}

// Ό,τι στέλνει η φόρμα του εργαζομένου (νέος: χωρίς id, με τον κωδικό που πληκτρολογήθηκε).
export type EmployeeDraft = Partial<Employee> & { previousEmployeeCode?: string | null }

// Ένα τμήμα του νοσοκομείου (departments, ή από τη βιβλιοθήκη του demo).
export type EmployeeDepartment = { id: string, name: string, nameEn?: string, is_active?: boolean | null }
// Μια επιλογή των λιστών της καρτέλας: γραμμή βιβλιοθήκης ([ελληνικά, αγγλικά, …]) ή τμήμα ({ name, nameEn }).
export type EmployeeOption = { 0?: string, 1?: string, 2?: { id?: string, jobDescription?: Record<string, unknown> }, id?: string, name?: string, nameEn?: string }

// --- Οι υπο-εγγραφές της καρτέλας (employeeSubRecordsService). Το employeeId είναι ο κωδικός
// του εργαζομένου στο demo και το uuid της βάσης στην παραγωγή.

// Επίσκεψη στον ιατρό εργασίας.
export type OccupationalVisit = {
  id: string
  employeeId: string
  date: string
  type: string
  status: string
  followUpDate: string | null
  fitStatus: string
  clinicalNotes: string
  createdAt?: string | null
  updatedAt?: string | null
}
export type OccupationalVisitDraft = Partial<OccupationalVisit>

export type EmployeeVaccination = {
  id: string
  employeeId: string
  vaccine: string
  dose: string
  date: string | null
  lotNumber?: string
  validUntil: string | null
  status: string
  clinicalNotes?: string
  createdAt?: string | null
  updatedAt?: string | null
}

// Μια εκπαίδευση της καρτέλας (ανάθεση της ενότητας Εκπαίδευσης ή γραμμή του demo).
export type EmployeeTraining = {
  id: string
  employeeId: string
  titleEl: string | null
  titleEn: string | null
  date: string
  status: string
  assignedDate?: string
  completedDate?: string
  dueDate?: string
  programId?: string | null
  programDbId?: string | null
  assignmentDbId?: string | null
  materialCount?: number
  organiser?: string
  hours?: number | null
  score?: number | null
  competent?: boolean | null
  source?: string
}

// Ένα κριτήριο της αξιολόγησης απόδοσης (βαθμός 1–5 με βάρος).
export type EvaluationCriterion = { id?: string, name?: string, score?: number | string | null, weight?: number | string | null }

// Αξιολόγηση: τυπική αξιολόγηση απόδοσης (employee_evaluations) ή αξιολόγηση γνώσεων εκπαίδευσης (source 'training').
export type EmployeeEvaluation = {
  id: string
  employeeId: string
  titleEl: string
  titleEn: string
  date: string
  status: string
  resultEl?: string
  resultEn?: string
  period?: string
  evaluatorUserId?: string | null
  evaluatorName?: string
  criteria?: EvaluationCriterion[]
  overallScore?: number | null
  notes?: string
  employeeComment?: string
  employeeAgreement?: string
  employeeAcknowledgedAt?: string | null
  hrApprovedAt?: string | null
  adminApprovedAt?: string | null
  finalizedAt?: string | null
  score?: number | null
  competent?: boolean | null
  programId?: string | null
  assessmentAnswers?: Record<string, unknown>
  assessmentQuestions?: TrainingQuestionInput[]
  certificateId?: string | null
  certificate?: TrainingCertificate | null
  program?: { title?: string, titleEn?: string }
  source?: string
}
// Η νέα αξιολόγηση απόδοσης όπως τη στέλνει η φόρμα.
export type EmployeeEvaluationDraft = { date?: string, period?: string, criteria?: EvaluationCriterion[], notes?: string }

export type EmployeeCertificate = {
  id: string
  employeeId: string
  titleEl: string
  titleEn: string
  issuer: string
  issueDate: string
  validUntil: string
  certificateNumber: string
  attachments: unknown[]
}
export type EmployeeCertificateDraft = Partial<Omit<EmployeeCertificate, 'id' | 'employeeId'>>

// Έκθεση σε αιχμηρό ή βλεννογόνο.
export type ExposureIncident = {
  id: string
  employeeId: string
  incidentDate: string
  exposureType: string
  deviceOrSource: string
  bodySite: string
  sourcePatientStatus: string
  reportedAt: string | null
  pepAdministered: boolean | null
  pepDetails: string
  followUpStatus: string
  followUpDueAt: string
  notes: string
  status: string
  employeeSurveillanceRecordId?: string | null
  sourceCaseId?: string | null
}
export type ExposureIncidentDraft = Partial<Omit<ExposureIncident, 'id' | 'employeeId'>>

// Μια εγγραφή του ιστορικού του εργαζομένου (αλλαγές στοιχείων).
// Στην παραγωγή το ιστορικό ενώνει και τις υπο-εγγραφές (historyKind: visit, vaccination, training, …).
export type EmployeeHistoryEntry = { id: string, employeeId?: string, at: string | null, action: string, changedFields: string[], actorName: string, actorRole: string, historyKind?: string }

// Ο συνδεδεμένος χρήστης όπως τον διαβάζει το «Το προφίλ μου» (προφίλ, λογαριασμός, συμμετοχή),
// με τα ονόματα πεδίων και των δύο μορφών (camelCase της εφαρμογής, snake_case της βάσης).
export type SignedInProfile = { id?: string | null, username?: string | null, email?: string | null, contactEmail?: string | null, fullName?: string | null, full_name?: string | null, employeeId?: string | null, employee_id?: string | null, isPlatformOwner?: boolean | null, is_platform_owner?: boolean | null }
export type SignedInUser = { id?: string | null, email?: string | null, user_metadata?: { full_name?: string | null, username?: string | null } | null }
export type MembershipLink = { employeeId?: string | null, employee_id?: string | null, profile?: { employeeId?: string | null } | null }

// Η περιγραφή θέσης εργασίας (στα metadata της θέσης, Διαχείριση > Βιβλιοθήκες > Θέσεις εργασίας).
export type JobDescriptionField = 'purpose' | 'reportsTo' | 'duties' | 'responsibilities' | 'qualifications' | 'competencies'
export type JobDescription = Partial<Record<JobDescriptionField, string>> & { version?: number, updatedAt?: string | null, updatedBy?: string }
// Η αποδοχή μιας έκδοσης της περιγραφής από τον εργαζόμενο.
export type PositionAcknowledgement = { id?: string, employeeId: string, position: string, version: number, acknowledgedAt: string, acknowledgedByName: string }
