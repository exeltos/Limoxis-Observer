// Στενές όψεις των αντικειμένων που διαβάζουν οι αναφορές (ΕΟΔΥ, EARS-Net,
// ποιότητα δεδομένων): εργαστηριακά δείγματα, αποτελέσματα και αντιβιογράμματα
// από την ενότητα laboratory, και ασθενείς από την ενότητα patients — που
// παίρνουν ακόμα AnyRecord. Οι τύποι μένουν εδώ και η μετατροπή γίνεται στα όρια,
// όπου φορτώνονται τα δείγματα και οι ασθενείς.

// Ένα αντιβιόγραμμα (δοκιμή ευαισθησίας) ενός αποτελέσματος.
export interface AstTest {
  organism?: string
  standard?: string
  version?: string
  code?: string
  drug?: string
  name?: string
  mic?: string | number
  operator?: string
  sir?: string
  zone?: string | number
}

// Ένα μικροβιολογικό αποτέλεσμα ενός δείγματος.
export interface ReportResult {
  id?: string
  amendedFrom?: string
  result?: string
  resultStatus?: string
  organism?: string
  resultedAt?: string
  resistance?: string
  ast?: AstTest[]
}

// Ένα εργαστηριακό δείγμα, όπως το διαβάζουν οι αναφορές. Ένα δείγμα χωρίς
// microbiologyResults λειτουργεί και ως ένα μοναδικό αποτέλεσμα (currentResults),
// γι' αυτό περιλαμβάνει και τα πεδία του αποτελέσματος.
export interface ReportSample {
  id: string
  recordId?: string
  sampleCode?: string
  subjectType?: string
  subjectCode?: string
  subjectId?: string
  patientId?: string
  patient?: string
  patientEn?: string
  subjectName?: string
  department?: string
  departmentEn?: string
  departmentId?: string
  type?: string
  sampleType?: string
  source?: string
  sourceEn?: string
  status?: string
  collectedAt?: string
  receivedAt?: string
  microbiologyResults?: ReportResult[]
  // Πεδία αποτελέσματος (όταν το δείγμα λειτουργεί ως αποτέλεσμα):
  result?: string
  resultStatus?: string
  organism?: string
  resultedAt?: string
  amendedFrom?: string
  resistance?: string
  ast?: AstTest[]
}

// Ένας ασθενής, όπως τον διαβάζουν οι αναφορές.
export interface ReportPatient {
  id: string
  patientCode?: string
  name?: string
  nameEn?: string
  department?: string
  departmentEn?: string
  departmentType?: string
  sex?: string
  dateOfBirth?: string
  birthWeightGrams?: number | null
  admissionDate?: string
  dischargeDate?: string
}

// Το νοσοκομείο (tenant), όσο το διαβάζει η αναφορά EARS-Net.
export interface ReportTenant {
  id?: string
  code?: string
  slug?: string
}

// Ό,τι χρειάζεται η saveNotificationReport από ένα εύρημα (NotifiableFinding).
export interface NotificationFindingInput {
  findingKey: string
  patientRecordId?: string
  sample: { recordId?: string }
  rule: { id: string }
}
