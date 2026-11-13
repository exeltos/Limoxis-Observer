import type { Tables } from '../../core/supabase/database.types'
import type { RegistryExport } from '../../core/export/registryExports'

// The shapes of the laboratory screens. laboratoryCloudService translates the database rows
// (laboratory_samples, microbiology_results and their children in database.types) into a
// LabSample; the Demo keeps samples in the same shape (laboratoryDemoData) and
// normalizeLaboratorySample gives both one set of fields. Demo and database samples carry
// different subsets, so most fields are optional.

// ---- database rows ---------------------------------------------------------------------------

export type LaboratorySampleRow = Tables<'laboratory_samples'>
export type MicrobiologyResultRow = Tables<'microbiology_results'>
export type SusceptibilityRow = Tables<'antimicrobial_susceptibility_results'>
export type CommunicationRow = Tables<'critical_result_communications'>
export type AmrCategoryRow = Pick<Tables<'amr_classification_categories'>, 'susceptible' | 'position' | 'category'>
// An AMR classification read with its categories (AMR_CATEGORY_SELECT).
export type AmrClassificationRow = Tables<'amr_classifications'> & { categories?: AmrCategoryRow[] | null }
// What the calculation snapshot reads of a classification row (the surveillance mapper gives the same).
export interface AmrCalculationSource { mechanism?: string | null, categories_tested?: number | null, categories?: AmrCategoryRow[] | null }
// A patient, department and specimen-library item as the list joins them.
export interface SamplePatientRow { id?: string, patient_code?: string | null, first_name?: string | null, last_name?: string | null }
export interface SampleDepartmentRow { id?: string, name?: string | null }
export interface SpecimenRow { id?: string | null, code?: string | null, name_el?: string | null, name_en?: string | null, nameEl?: string | null, nameEn?: string | null }
// A result of laboratory_sample_list: the row with its susceptibility tests, calls and classifications.
export type MicrobiologyResultListRow = MicrobiologyResultRow & { ast?: SusceptibilityRow[], communications?: CommunicationRow[], amr?: AmrClassificationRow[] }
// A sample of laboratory_sample_list(_lean): the row with its patient, department, specimen and results joined.
export type LaboratorySampleListRow = LaboratorySampleRow & { patient?: SamplePatientRow | null, department?: SampleDepartmentRow | null, specimen_type?: SpecimenRow | null, results?: MicrobiologyResultListRow[] }

// ---- a result and its children ---------------------------------------------------------------

// The calculation of an AMR classification (mechanism, categories tested, which were susceptible).
export interface AmrCalculation { mechanism?: string, categoriesTested?: number, susceptibleCategories?: string[], nonSusceptibleCategories?: string[] }
export interface AmrClassification { id?: string, organism?: string | null, classification?: string | null, definitionSource?: string, definitionVersion?: string, status?: string, rationale?: string, classifiedAt?: string | null, calculationSnapshot?: AmrCalculation | null }
// A susceptibility test (antibiogram row): the antibiotic, S/I/R and MIC or zone.
export interface AstResult { id?: string, organism?: string | null, drug?: string, code?: string | null, method?: string, sir?: string, mic?: number | string | null, operator?: string | null, zone?: number | string | null, standard?: string, version?: string, notes?: string | null, technicalUncertainty?: boolean }
// A susceptibility test as the antibiogram window sends it (the MIC as typed; the window requires the version).
export interface AstDraft { id?: string, organism?: string | null, drug: string, code?: string | null, method?: string, sir?: string, mic?: number | string | null, operator?: string | null, zone?: number | null, standard?: string, version?: string, notes?: string | null, technicalUncertainty?: boolean }
// The call of a critical result (the Demo also keeps who called and the recipient in English).
export interface CriticalCommunication { id?: string, at?: string, to?: string, toEn?: string, role?: string, method?: string, readBack?: boolean | null, notes?: string, notesEn?: string, by?: string, recipientName?: string, recipientRole?: string, recipientDepartment?: string }
// A microbiology result of a sample (mapMicrobiology; the Demo keeps a few of the fields).
export interface LabResult {
  id?: string
  result?: string | null
  resultStatus?: string | null
  amendedFrom?: string | null
  organism?: string | null
  resistance?: string | null
  amr?: AmrClassification[]
  susceptibilitySummary?: string | null
  critical?: boolean
  // The Demo keeps the count as it was saved.
  cfuCount?: number | string | null
  cfuLimit?: number | string | null
  withinLimit?: boolean | null
  resultedAt?: string | null
  validatedAt?: string | null
  validatedBy?: string | null
  method?: string
  preliminary?: boolean
  interpretationStandard?: string
  interpretationVersion?: string
  ast?: AstResult[]
  communications?: CriticalCommunication[]
}

// ---- a sample --------------------------------------------------------------------------------

// The answers the new-sample flow keeps with a sample (the epidemiological mini questionnaire, the admission screening).
export type ClinicalContext = { admissionScreening?: boolean } & Record<string, unknown>
export interface SpecimenType { id: string | null, code: string | null, nameEl: string, nameEn: string }
export interface TimelineEvent { at: string, type: string, actor?: string }

// A laboratory sample as the screens read it: `id` is the sample code, `recordId` the database row.
export type LabSample = {
  id: string
  recordId?: string | null
  code?: string
  organizationId?: string | null
  createdBy?: string | null
  requestedBy?: string | null
  patientRecordId?: string | null
  patientId?: string | null
  patient?: string
  patientEn?: string
  subjectType?: string | null
  subjectId?: string | null
  subjectName?: string | null
  subjectNameEn?: string | null
  subjectCode?: string | null
  employeeSurveillanceId?: string | null
  employeeSurveillanceBatchId?: string | null
  employeeSurveillanceCase?: string | null
  environmentalSurveillanceCase?: string | null
  departmentId?: string | null
  department?: string | null
  departmentEn?: string | null
  surveillanceCase?: string | null
  surveillanceCaseId?: string | null
  clinicalContext?: ClinicalContext | null
  type?: string
  sampleType?: string
  specimenTypeId?: string | null
  specimenType?: SpecimenType | null
  source?: string | null
  sourceEn?: string | null
  anatomicalSite?: string
  environmentalMethod?: string | null
  location?: string | null
  point?: string | null
  environmentalBatchId?: string | null
  environmentalPlate?: string | null
  environmentalPosition?: string | null
  collectedAt?: string | null
  requestedAt?: string | null
  receivedAt?: string | null
  rejectedAt?: string | null
  resultedAt?: string | null
  validatedAt?: string | null
  validatedBy?: string | null
  status?: string
  priority?: string
  specimenCondition?: string
  rejectionReason?: string | null
  // The first result's outcome and findings, repeated on the sample for the lists.
  result?: string | null
  resultStatus?: string | null
  organism?: string | null
  resistance?: string | null
  critical?: boolean
  cfuCount?: number | string | null
  cfuLimit?: number | string | null
  withinLimit?: boolean | null
  method?: string
  microbiologyResults?: LabResult[]
  // The Demo keeps the first result's tests and calls on the sample too.
  ast?: AstResult[]
  communications?: CriticalCommunication[]
  attachments?: unknown[]
  timeline?: TimelineEvent[]
  documentsReviewedAt?: string | null
  documentsReviewedBy?: string | null
  finalizedAt?: string | null
  finalizedBy?: string | null
  correctionReason?: string | null
  surveillanceReviewStatus?: string | null
  surveillanceReviewReason?: string | null
  surveillanceReviewNote?: string | null
  surveillanceReviewedAt?: string | null
  surveillanceReviewedBy?: string | null
  // A staff-check sample whose employee name is hidden from the viewer (maskStaffSample).
  staffMasked?: boolean
  // What the Demo programmes keep on their samples: the request's answers, the environmental type's label, and
  // the staff screening's own fields (the screening, its recheck and the intervention after a positive).
  requestQuestions?: Record<string, string>
  typeLabel?: string
  sourceCode?: string
  notes?: string
  workflowType?: string
  employeeId?: string
  batchId?: string | null
  organisms?: string[]
  isRecheck?: boolean
  interventionType?: string
  interventionDetails?: string
  interventionStart?: string
  interventionEnd?: string
}

// The other spellings normalizeLaboratorySample accepts (older Demo rows, database column names).
export interface LabSampleAliases {
  record_id?: string | null
  uuid?: string | null
  sample_code?: string | null
  subject_type?: string | null
  subject_id?: string | null
  subject_name?: string | null
  subject_name_en?: string | null
  subject_code?: string | null
  patient_code?: string | null
  patient_id?: string | null
  patientCode?: string | null
  organization_id?: string | null
  department_id?: string | null
  departmentName?: string | null
  department_name?: string | null
  departmentNameEn?: string | null
  department_name_en?: string | null
  sample_type?: string
  collectionSource?: string | null
  collection_source?: string | null
  collectionSourceEn?: string | null
  collection_source_en?: string | null
  result_status?: string | null
  resistanceClass?: string | null
  resistance_class?: string | null
  is_critical?: boolean | null
  requested_at?: string | null
  collected_at?: string | null
  received_at?: string | null
  rejected_at?: string | null
  rejection_reason?: string | null
  resulted_at?: string | null
  surveillance_case?: string | null
  surveillance_case_id?: string | null
  employee_surveillance_id?: string | null
  employee_surveillance_batch_id?: string | null
  environmental_method?: string | null
  environmental_batch_id?: string | null
  environmental_plate?: string | null
  environmental_position?: string | null
  documents_reviewed_at?: string | null
  finalized_at?: string | null
  surveillance_review_status?: string | null
  surveillance_review_reason?: string | null
  surveillance_review_note?: string | null
  surveillance_reviewed_at?: string | null
  surveillance_reviewed_by?: string | null
  resultId?: string
  sampleCode?: string
  amr?: AmrClassification[]
}
// What normalizeLaboratorySample takes: a sample in any of its spellings.
export type LabSampleSource = Partial<LabSample> & LabSampleAliases

// ---- what the screens send -------------------------------------------------------------------

// A new sample (the new-sample flow, a surveillance request, the staff and environmental programmes).
export interface SampleDraft {
  sampleCode?: string
  subjectType?: string | null
  subjectName?: string | null
  subjectNameEn?: string | null
  subjectCode?: string | null
  newPatient?: boolean
  patient?: string
  patientEn?: string
  patientId?: string | null
  departmentId?: string | null
  department?: string | null
  departmentEn?: string | null
  surveillanceCase?: string | null
  surveillanceCaseId?: string | null
  employeeSurveillanceId?: string | null
  employeeSurveillanceBatchId?: string | null
  type?: string
  specimenTypeId?: string | null
  source?: string | null
  sourceEn?: string | null
  sourceCode?: string
  environmentType?: string
  anatomicalSite?: string
  environmentalMethod?: string | null
  location?: string | null
  point?: string | null
  environmentalBatchId?: string | null
  environmentalPlate?: string | null
  environmentalPosition?: string | null
  collectedAt?: string | null
  requestedAt?: string | null
  receivedAt?: string | null
  priority?: string
  admissionScreening?: boolean
  clinicalContext?: ClinicalContext | null
  requestQuestions?: Record<string, string>
}
// Another sample of the same visit in the new-sample flow (the choice of the type list and its row id).
export interface ExtraSampleDraft { id: string, choice: string, type: string, specimenTypeId: string, sourceCode: string, source: string, sourceEn: string, anatomicalSite: string }

// A change of a sample: its fields, with the receipt and collection time as given (a Date from «Παραλαβή»).
export type SamplePatch = Partial<Omit<LabSample, 'receivedAt' | 'collectedAt'>> & { receivedAt?: string | Date | null, collectedAt?: string | Date | null }

// The result window's form: the outcome, organisms and method as chosen, the CFU count as typed.
export interface ResultForm { id: string | null, result: string, organisms: string[], critical: boolean, method: string, interpretationStandard: string, interpretationVersion: string, cfuCount: number | string }
// A result as the result window saves it (resultToSave): the outcome, organisms and, for an environmental sample, the CFU.
export interface ResultDraft {
  id?: string | null
  result?: string
  organisms?: string[]
  organism?: string | null
  critical?: boolean
  method?: string
  interpretationStandard?: string
  interpretationVersion?: string
  cfuCount?: number | string | null
  cfuLimit?: number | string | null
  withinLimit?: boolean | null
  validationStatus?: string
  resultStatus?: string
  susceptibilitySummary?: string | null
  resultedAt?: string | null
  preliminary?: boolean
  resistance?: string | null
  pendingAmr?: Record<string, unknown>
  ast?: AstResult[]
  amr?: AmrClassification[]
  communications?: CriticalCommunication[]
}
// A classification as the AMR window saves it.
export interface AmrDraft { classification?: string | null, organism?: string | null, definitionSource?: string, definitionVersion?: string, status?: string, rationale?: string, calculationSnapshot?: AmrCalculation | null }
// A critical-result call as the communication window saves it.
export interface CommunicationDraft { recipientName: string, recipientRole?: string, recipientDepartment?: string, method?: string, readBack?: boolean, communicatedDate?: string, communicatedTime?: string, at?: string, notes?: string }

// What the record card adds to a sample: who requested it and the admission's MDR flag.
export interface SampleExtras { requesterName?: string, mdrOnAdmission?: boolean, mdrOnAdmissionDate?: string | null }

// ---- reference data --------------------------------------------------------------------------

// An environmental sampling standard (environmental_standards.payload): the limit of a type and method.
export interface EnvironmentalStandard { id?: string, active?: boolean, subjectType?: string, sourceCode?: string | null, limitCfu?: number | string | null, unit?: string, protocolCode?: string, [key: string]: unknown }

// What a tab of the laboratory page hands the page's «Εξαγωγή»: the rows it shows now and their titles.
export interface TabExport { build: () => RegistryExport, kind: string, title: string }

// An error of a run of saves that stopped part-way (receivePlate adds how many were done).
export type PartialError = Error & { received?: number }
