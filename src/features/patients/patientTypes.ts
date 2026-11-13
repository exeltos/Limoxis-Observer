// What the patient screens keep for a patient and an admission (patientsService
// translates the rows of patients / patient_admissions). The Demo keeps the same shapes.

export type Patient = {
  id: string
  recordId?: string
  firstName?: string | null
  lastName?: string | null
  fatherName?: string | null
  name?: string
  nameEn?: string
  hospitalRecordNumber?: string | null
  dateOfBirth?: string | null
  birthWeightGrams?: number | null
  gestationalAgeWeeks?: number | null
  sex?: string | null
  departmentId?: string | null
  department?: string
  departmentEn?: string
  departmentType?: string | null
  admissionDate?: string | null
  dischargeDate?: string | null
  status?: string
  notes?: string | null
  caseNumber?: string
  updatedAt?: string | null
  createdBy?: string | null
  // The patients list adds whether the patient has an admission and the latest one.
  hasAdmission?: boolean
  lastAdmissionDate?: string | null
  admissionId?: string
  // The Demo links a patient to its surveillance episodes and carries a few extra fields.
  patientCode?: string
  patronymic?: string | null
  patronymicEn?: string | null
  firstNameEn?: string | null
  lastNameEn?: string | null
}
// A new patient (or the form): a code and the fields typed, no record id yet.
export type PatientDraft = Partial<Patient> & { patientCode?: string, patronymic?: string | null, fullName?: string }

export type Admission = {
  id: string
  departmentId?: string | null
  department?: string
  department_type?: string | null
  admissionDate?: string | null
  dischargeDate?: string | null
  status?: string
  notes?: string | null
  admissionSource?: string | null
  sourceFacility?: string
  mdrOnAdmission?: boolean
  mdrOnAdmissionDate?: string | null
  // The Demo keeps the admission's record number on the admission.
  caseNumber?: string
}
// What an admission form sends (an admission, a discharge, a transfer).
export type AdmissionDraft = { departmentId?: string | null, department?: string, admissionDate?: string | null, dischargeDate?: string | null, caseNumber?: string, status?: string, notes?: string | null, date?: string, reason?: string }
// The patient form's state: everything typed, as text.
export type PatientFormDraft = { patientCode: string, firstName: string, lastName: string, fatherName: string, hospitalRecordNumber: string, dateOfBirth: string, birthWeightGrams: string | number, gestationalAgeWeeks: string | number, sex: string, departmentId: string, department: string, departmentEn: string, admissionDate: string, status: string, notes: string }
// A department a patient can belong to.
export type PatientDepartment = { id: string, name: string, nameEn?: string, department_type?: string | null }
