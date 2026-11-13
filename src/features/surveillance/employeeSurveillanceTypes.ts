import type { Tables } from '../../core/supabase/database.types'

// The shapes of the staff screening screens (employeeSurveillanceCloud translates
// them to and from the database rows, employee_surveillance_* in database.types).

export type EmployeeSurveillanceRow = Tables<'employee_surveillance_records'>
export type EmployeeSurveillanceBatchRow = Tables<'employee_surveillance_batches'>
// The employee and department columns a screening is hydrated with.
export type ScreeningEmployeeRow = Pick<Tables<'employees'>, 'id' | 'employee_code' | 'first_name' | 'first_name_en' | 'last_name' | 'last_name_en' | 'department_id' | 'department_name' | 'department_name_en'>
export type ScreeningDepartmentRow = Pick<Tables<'departments'>, 'id' | 'name'>

// A follow-up entry of the timeline (the database keeps it as JSON, so a type, not an interface).
export type FollowupTimelineEntry = { at?: string, type?: string, actor?: string, actorId?: string | null, detail?: string | null }

// A staff screening, as the cloud maps it or the Demo authors it (all optional: the
// screens also take records other screens still keep loosely). A type, so it can be
// exported as JSON.
export type EmployeeSurveillanceRecord = {
  id?: string
  recordId?: string
  subjectType?: string
  createdBy?: string | null
  createdById?: string
  createdAt?: string
  updatedBy?: string
  updatedById?: string
  updatedAt?: string
  organizationId?: string
  employeeDbId?: string
  employeeId?: string
  employeeName?: string
  employeeNameEn?: string
  departmentId?: string | null
  department?: string
  departmentEn?: string
  batchId?: string | null
  startedAt?: string
  screeningTypes?: string[]
  status?: string
  resultStatus?: string
  interventionStatus?: string
  intervention?: string | null
  interventionType?: string | null
  interventionStart?: string | null
  interventionEnd?: string | null
  interventionStartedAt?: string | null
  interventionCompletedAt?: string | null
  noIntervention?: boolean
  recheckDue?: string | null
  recheckDate?: string | null
  recheckRequired?: boolean
  noRecheck?: boolean
  correctionReason?: string
  sampleIds?: string[]
  positiveSampleIds?: string[]
  recheckSampleIds?: string[]
  timeline?: FollowupTimelineEntry[]
  notes?: string
}
// A screening read by its record page (Demo or cloud): it always has these.
export type LoadedScreening = EmployeeSurveillanceRecord & { id: string, startedAt: string, status: string }

// The follow-up the windows save (intervention and recheck).
export interface FollowupPatch {
  intervention?: string
  interventionType?: string
  interventionStart?: string
  interventionEnd?: string
  noIntervention?: boolean
  recheckDue?: string
  recheckDate?: string
  noRecheck?: boolean
  correctionReason?: string
  updatedAt?: string
}

// The fields of an employee a screening is started from (the employees register).
export interface ScreeningEmployee {
  id?: string
  dbId?: string
  firstName?: string
  lastName?: string
  firstNameEn?: string
  lastNameEn?: string
  department?: string
  departmentEn?: string
  departmentId?: string | null
  employmentStatus?: string
  staffCategory?: string
}

// A laboratory sample of a screening: only the fields these screens read.
export interface ScreeningSample {
  id?: string
  recordId?: string
  type?: string
  source?: string
  priority?: string
  status?: string
  result?: string | null
  resultStatus?: string
  resultedAt?: string
  finalizedAt?: string
  collectedAt?: string
  organism?: string | null
  employeeSurveillanceCase?: string
  employeeSurveillanceId?: string
  isRecheck?: boolean
  interventionType?: string
  interventionDetails?: string
  interventionStart?: string
  interventionEnd?: string
  timeline?: FollowupTimelineEntry[]
}

// The editor of a pending laboratory request.
export interface RequestEditorState {
  sample: ScreeningSample
  source: string
  priority: string
  sampleType: string
}

// A Demo batch of screenings (the cloud batch is mapped by the cloud service).
export interface EmployeeSurveillanceBatch {
  id?: string
  subjectType?: string
  department?: string
  departmentEn?: string
  startedAt?: string
  screeningTypes?: string[]
  employeeIds?: string[]
  surveillanceIds?: string[]
  status?: string
  createdBy?: string
  createdById?: string
  createdAt?: string
  updatedBy?: string
  updatedById?: string
  updatedAt?: string
}
