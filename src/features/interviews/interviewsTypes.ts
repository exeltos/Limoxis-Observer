// Τύποι των Συνεντεύξεων: η αίτηση (hr_candidates) με τις γλώσσες, τους προηγούμενους
// εργοδότες και τις συνεντεύξεις της, όπως τις διαβάζει η υπηρεσία (fromRow: κείμενο που
// λείπει γίνεται '', οι τιμές ναι/όχι μένουν null όταν δεν δηλώθηκαν), και οι διευθύνσεις.
// Οι τύποι είναι `type` (όχι interface) ώστε να περνούν στους γενικούς μετατροπείς
// στήλης (toRow), που δέχονται Record<string, unknown>.

export type CandidateEducation = { level?: string, school?: string, title?: string, year?: string | number, completed?: boolean }

export type CandidateLanguage = {
  id?: string
  candidateId?: string
  position?: number | ''
  language: string
  reading?: string
  writing?: string
  speaking?: string
  certificate?: boolean | null
  certificateName?: string
  createdAt?: string
  updatedAt?: string
}

export type CandidateEmployer = {
  id?: string
  candidateId?: string
  position?: number | ''
  employer: string
  fromOn?: string
  toOn?: string
  jobTitle?: string
  salary?: number | string
  leavingReason?: string
  createdAt?: string
  updatedAt?: string
}

// Μέλος της επιτροπής μιας συνέντευξης.
export type Interviewer = { employeeId?: string, name?: string, role?: string }

export type Interview = {
  id: string
  candidateId?: string
  scheduledAt?: string
  location?: string
  status?: string
  interviewers?: Interviewer[]
  scores?: Record<string, number | string>
  overallRating?: number | null
  outcome?: string
  recommendation?: string
  strengths?: string
  weaknesses?: string
  salaryExpectation?: number | string
  offeredSalary?: number | string
  benefits?: string
  availableFrom?: string
  evaluatedAt?: string
  evaluatedByName?: string
  notes?: string
  source?: string
  createdAt?: string
  updatedAt?: string
}

export type Candidate = {
  id: string
  code?: string
  fullName?: string
  gender?: string
  fatherName?: string
  motherName?: string
  birthDate?: string
  birthPlace?: string
  nationality?: string
  citizenship?: string
  idNumber?: string
  idAuthority?: string
  idIssuedOn?: string
  address?: string
  area?: string
  postcode?: string
  phoneLandline?: string
  phoneMobile?: string
  email?: string
  requestedPosition?: string
  professionalCategory?: string
  employmentType?: string
  militaryService?: string
  workPermit?: boolean | null
  practiceLicence?: boolean | null
  smoker?: boolean | null
  maritalStatus?: string
  children?: number | string
  educationLevel?: string
  education: CandidateEducation[]
  itSkills?: string
  activities?: string
  whyUs?: string
  applicationReason?: string
  appliedOn?: string
  consentGiven?: boolean | null
  consentAt?: string
  consentText?: string
  consentFuture?: boolean | null
  consentReferences?: boolean | null
  declarationTruth?: boolean | null
  consentVersion?: string
  // Τα κείμενα των συναινέσεων που δέχτηκε ο υποψήφιος, ανά κλειδί (και η γλώσσα τους).
  consentTexts?: Record<string, string>
  signedAt?: string
  // Η υπογραφή της αίτησης από tablet (μόνο στο demo μένει πάνω στην αίτηση).
  signature?: string
  status: string
  decision?: string
  decisionOn?: string
  decisionByName?: string
  decisionNotes?: string
  employeeId?: string
  // Ο κωδικός του εργαζομένου που έγινε (demo).
  employeeCode?: string
  source?: string
  notes?: string
  languages: CandidateLanguage[]
  employers: CandidateEmployer[]
  interviews: Interview[]
  createdAt?: string
  updatedAt?: string
}

// Μια συνέντευξη που έρχεται, με την αίτησή της (upcomingInterviews).
export type UpcomingInterview = Interview & { candidate: Candidate }

// Η απόφαση για μια αίτηση (decide).
export type CandidateDecision = { decision?: string, decisionOn?: string, decisionByName?: string, decisionNotes?: string, status?: string }

// Ο εργαζόμενος όπως τον διαβάζουν οι Συνεντεύξεις (επιτροπή, πρόσληψη): η ενότητα των
// εργαζομένων δεν έχει ακόμη τύπους.
export type InterviewEmployee = { id: string, dbId?: string, firstName?: string, lastName?: string, email?: string, position?: string, profession?: string, department?: string }

// Ένας σύνδεσμος αίτησης από tablet (ο κωδικός επιστρέφει μόνο μία φορά).
export type ApplicationLink = { id: string, token: string, position?: string, professionalCategory?: string, employmentType?: string, expiresAt?: string }

// Οι λίστες της αίτησης που διορθώνονται γραμμή-γραμμή.
export type CandidateListKey = 'education' | 'languages'

// Μια διεύθυνση: οι επαγγελματικές κατηγορίες της, οι διευθυντές (user id) και τα τμήματα που καλύπτει.
export type Division = { id: string, name: string, categories: string[], members: string[], departments?: string[] }
// Η διεύθυνση όπως τη στέλνει η φόρμα (νέα: χωρίς id).
export type DivisionDraft = { id?: string, name?: string, categories?: string[], members?: string[], departments?: string[] }
