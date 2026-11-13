import type { TrainingQuestion } from './trainingAssessment'

// Τύποι της Εκπαίδευσης: τα αντικείμενα που κρατούν οι οθόνες (από τους mappers του
// trainingMappers, ή τα δεδομένα του demo). id είναι το κλειδί της εγγραφής (TRN-…, TRA-…,
// CERT-…, REQ-…), dbId το uuid της γραμμής. Τα προσχέδια των φορμών έχουν το ίδιο σχήμα.

// Μια επιλογή ερώτησης πολλαπλής επιλογής.
export type AssessmentOption = { id: string, text: string, correct: boolean }
// Μια ερώτηση της αξιολόγησης γνώσεων (ο τύπος της φόρμας ερωτήσεων, trainingAssessment).
export type AssessmentQuestion = TrainingQuestion
// Η απάντηση του εκπαιδευόμενου: επιλογή, επιλογές, σωστό/λάθος, αριθμός ή κείμενο.
export type AssessmentAnswer = string | number | boolean | string[] | null | undefined
export type AssessmentAnswers = Record<string, AssessmentAnswer>

// Ερώτηση και πρότυπο της αξιολόγησης του εκπαιδευτή.
export type FeedbackQuestion = { id: string, labelEl: string, labelEn: string }
export type FeedbackTemplate = { id: string, titleEl: string, titleEn: string, questions: FeedbackQuestion[], updatedAt?: string | null }
// Μια αξιολόγηση εκπαιδευτή που υπέβαλε ένας εκπαιδευόμενος.
export type FeedbackResponse = { employeeId: string, userId?: string | null, assignmentId?: string, submittedAt?: string | null, scores: Record<string, number | null>, comment: string | null }

// Υλικό του προγράμματος (σύνδεσμος ή αρχείο).
export type TrainingMaterial = { id: string, title: string, type: string, url: string }
// Η αξιολόγηση αποτελεσματικότητας του προγράμματος.
export type TrainingEffectiveness = { plannedDate: string, method: string, criterion: string, result: string, evaluatedAt: string, evaluatedBy: string, notes: string, comment?: string }

export type TrainingProgram = {
  id: string
  dbId?: string
  title: string
  titleEn?: string
  category: string
  method: string
  deliveryKind?: string
  owner: string
  trainer: string
  audience: string
  description: string
  startDate: string
  startTime?: string
  dueDate: string
  durationHours?: number | null
  location?: string
  cost?: number | null
  validMonths?: number | null
  requiresAssessment: boolean
  passScore?: number | null
  status: string
  departmentId?: string | null
  userId?: string | null
  materials: TrainingMaterial[]
  assessmentQuestions?: AssessmentQuestion[]
  trainerFeedbackTemplate?: FeedbackTemplate
  feedbackResponses?: FeedbackResponse[]
  effectiveness?: TrainingEffectiveness
  // Το μητρώο διαβάζει «ελαφριές» γραμμές: μόνο το πλήθος των ερωτήσεων.
  questionCount?: number
  createdAt?: string | null
  updatedAt?: string | null
}

export type TrainingAssignment = {
  id: string
  dbId?: string
  programId: string | null
  employeeId: string
  employeeDbId?: string | null
  employeeName: string
  department: string
  departmentId?: string | null
  userId?: string | null
  email?: string
  accountLinked?: boolean
  manualEntry?: boolean
  assignedDate: string
  dueDate: string
  status: string
  invitationSentAt?: string | null
  attendanceResponse?: string
  attendance?: boolean | null
  attendanceConfirmedAt?: string | null
  attendanceAttested?: boolean | null
  attendanceAttestedAt?: string | null
  attendanceAttestationMethod?: string | null
  attendanceAttestationVersion?: string | null
  completionConfirmedAt?: string | null
  feedbackSubmittedAt?: string | null
  assessmentSubmittedAt?: string | null
  assessmentAnswers?: AssessmentAnswers | null
  assessmentReviewStatus?: string | null
  assessmentReviewedAt?: string | null
  assessmentReviewedBy?: string | null
  assessmentReviewAcknowledged?: boolean | null
  assessmentReviewNote?: string | null
  awardedPoints?: Record<string, number | null>
  score?: number | null
  competent?: boolean | null
  completedDate?: string | null
  // Παλαιότερες τοπικές εγγραφές κρατούσαν την ολοκλήρωση ως completedAt.
  completedAt?: string | null
  certificateId?: string | null
  feedbackScores?: Record<string, number | null> | null
  feedbackComment?: string | null
  accessToken?: string
  // Η κατάσταση όπως τη δείχνει η λίστα (με τις εκπρόθεσμες), όχι αποθηκευμένο πεδίο.
  computedStatus?: string
  createdAt?: string | null
  updatedAt?: string | null
}

export type TrainingCertificate = {
  id: string
  dbId?: string
  assignmentId: string | null
  employeeId: string
  title: string
  issuedDate: string
  validUntil: string | null
  issuer: string
  issuedAt?: string
  issuedById?: string
  departmentId?: string | null
  userId?: string | null
}

// Μια απαίτηση εκπαίδευσης: ποια προγράμματα, για ποιους (επάγγελμα, θέση, τμήμα), με ποια ανανέωση.
export type TrainingRequirement = {
  id: string
  dbId?: string
  title: string
  programIds: string[]
  professions: string[]
  positions?: string[]
  departments: string[]
  renewalMonths: number | null
  active: boolean
  departmentId?: string | null
  userId?: string | null
}

// Μια εγγραφή του ιστορικού της Εκπαίδευσης.
export type TrainingHistoryEntry = { at: string, actor: string, action: string }

// Το πρόγραμμα στη φόρμα: οι αριθμοί μένουν κείμενο όσο γράφονται (TRAINING_PROGRAM_DEFAULTS).
export type TrainingProgramDraft = Partial<Omit<TrainingProgram, 'durationHours' | 'cost' | 'validMonths' | 'passScore'>> & { durationHours?: number | string | null, cost?: number | string | null, validMonths?: number | string | null, passScore?: number | string | null }
// Ένας εργαζόμενος στις επιλογές των φορμών της Εκπαίδευσης (η ενότητα των εργαζομένων δεν έχει ακόμη τύπους).
export type TrainingEmployee = { id: string, dbId?: string, employeeCode?: string, firstName?: string, lastName?: string, firstNameEn?: string, lastNameEn?: string, name?: string, department?: string, departmentId?: string | null, email?: string, profession?: string, position?: string, employmentStatus?: string, staffCategory?: string, hireDate?: string, userId?: string | null }
// Ένας συμμετέχων που προστίθεται σε πρόγραμμα (από τα παρόντα μιας συνεδρίασης): χωρίς κωδικό, πρόσωπο εκτός μητρώου.
export type TrainingParticipantInput = { employeeCode?: string, name?: string, department?: string, departmentId?: string | null, email?: string }
// Μια γραμμή του ιστορικού εκπαίδευσης ενός εργαζομένου (η αναφορά employeeTrainingDoc).
export type EmployeeTrainingRow = { title: string, organiser?: string, date?: string | null, hours?: number | null, statusLabel: string, score?: number | string | null, done?: boolean }

// Ό,τι διαβάζουν το ετήσιο πλάνο και η επάρκεια από κάθε εγγραφή (λιγότερα πεδία από τις πλήρεις εγγραφές).
export type PlanProgram = Pick<TrainingProgram, 'id' | 'title' | 'status'> & Partial<Pick<TrainingProgram, 'startDate' | 'dueDate' | 'audience'>>
export type CompetenceAssignment = Pick<TrainingAssignment, 'id' | 'programId' | 'employeeId' | 'status'> & Partial<Pick<TrainingAssignment, 'completedDate' | 'completionConfirmedAt' | 'dueDate'>>
export type CompetenceCertificate = Pick<TrainingCertificate, 'assignmentId'> & Partial<Pick<TrainingCertificate, 'id' | 'validUntil'>>
export type CompetenceRequirement = Pick<TrainingRequirement, 'id' | 'title' | 'programIds'> & Partial<Omit<TrainingRequirement, 'id' | 'title' | 'programIds'>>
