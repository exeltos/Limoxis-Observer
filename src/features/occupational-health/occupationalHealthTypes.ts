// Τύποι για τις οθόνες Ιατρού Εργασίας. Οι εργαζόμενοι και οι επισκέψεις
// έρχονται από την ενότητα employees (που παίρνει ακόμα AnyRecord): οι οθόνες
// διαβάζουν μια στενή όψη τους, γι' αυτό οι τύποι μένουν εδώ και η μετατροπή
// γίνεται στα όρια, εκεί που καλούνται οι υπηρεσίες των employees.

// Στενή όψη ενός εργαζομένου, όπως τη διαβάζουν οι οθόνες Ιατρού Εργασίας.
export interface EmployeeRow {
  id: string
  dbId?: string | null
  firstName?: string
  lastName?: string
  firstNameEn?: string
  lastNameEn?: string
  department?: string
  departmentEn?: string
  employmentStatus?: string
}

// Μια επίσκεψη του Ιατρού Εργασίας, όπως αποθηκεύεται (προγραμματισμένη ή καταγεγραμμένη).
export interface OccupationalVisit {
  id: string
  employeeId: string
  date: string
  type: string
  status: string
  fitStatus: string
  followUpDate: string
  clinicalNotes: string
  createdAt?: string | null
  updatedAt?: string | null
}
export type OccupationalVisitDraft = Partial<OccupationalVisit>

// Το προσχέδιο του διαλόγου καταγραφής περιστατικού έκθεσης.
export type ExposureIncidentDraft = {
  employeeId?: string
  incidentDate?: string
  exposureType?: string
  deviceOrSource?: string
  bodySite?: string
  sourcePatientStatus?: string
  pepAdministered?: boolean | null
  pepDetails?: string
  followUpStatus?: string
  followUpDueAt?: string
  notes?: string
  status?: string
  sourceCaseId?: string
  employeeSurveillanceRecordId?: string
}
