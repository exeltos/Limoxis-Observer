import type { Tables } from '../../core/supabase/database.types'

// The shapes the Controls screens keep (mapDefinition in controlCloudService)
// and the rows they are read from: the database's (control_* in database.types)
// or the demo's local copies, which carry the same columns, some of them left out.

// A control's schedule (frequency_config, or a department's own): how often,
// at what times and how late an entry still counts. The form keeps numbers it
// has not saved yet as typed.
export interface ControlFrequency {
  kind?: string
  timesPerDay?: number | string
  times?: string[]
  interval?: number | string
  weekdaysOnly?: boolean
  toleranceMinutes?: number | string | null
}

// A limit as the form keeps it (typed text, '' when cleared) or as saved (a number).
export type ControlLimit = number | string | null | undefined

// An item of a checklist control; `el`/`en` are its texts (`label` in older records).
export interface ChecklistItem { id?: string, el?: string, en?: string, label?: string, required?: boolean }

// An item of an expiry control's catalogue: what a department keeps and checks.
export interface ExpiryCatalogueItem {
  // Every item the form adds has an id; lists brought in from elsewhere may not.
  id?: string
  item: string
  quantity?: string
  form?: string
  lot?: string
  expiry?: string
  note?: string
  noteEn?: string
  category?: string
  ingredient?: string
  departments?: string[]
  // Older lists kept the form as `unit`.
  unit?: string
}

// What a control asks for (response_config): the result's format and limits,
// the choices and which of them are findings, the checklist or the expiry
// settings, and the policy (criticality, evidence, what to do on a deviation).
export interface ControlResponseConfig {
  mode?: string
  label?: string
  unit?: string
  min?: ControlLimit
  max?: ControlLimit
  options?: string[]
  reportOn?: string[]
  template?: string
  checklist?: ChecklistItem[]
  expiryBeforeDays?: number
  expiryAfterDays?: number
  expiryCatalogue?: ExpiryCatalogueItem[]
  criticality?: string
  requiresEvidence?: boolean
  deviationActions?: string
}

// A department's own limits and deviation text (response_override).
export type ResponseOverride = Pick<ControlResponseConfig, 'min' | 'max' | 'deviationActions'>

// A responsible person picked from the employees.
export interface ControlPerson { userId?: string | null, employeeId?: string | null, name?: string, [key: string]: unknown }

// What response_config keeps besides the settings (__meta): the English title,
// the owner and assignees, place and equipment, who created it and for whom.
export interface ControlMeta {
  titleEn?: string
  ownerLabel?: string
  ownerPerson?: ControlPerson | null
  assignees?: Record<string, ControlPerson | null>
  location?: string
  equipment?: string
  createdByScope?: string
  createdForDepartment?: string | null
  createdByName?: string
  updatedByName?: string
}
export type StoredResponseConfig = ControlResponseConfig & { __meta?: ControlMeta }

// A file kept as evidence of an entry (its name, size and type; the stored path in the cloud).
export interface EvidenceItem { name: string, size: number, type: string, storagePath?: string, attachmentId?: string }

// A row of a structured entry: a findings row, an expiry row or a checklist
// answer. The rows are kept as the entry form left them.
export interface StructuredRow {
  id?: string
  item?: string
  itemEn?: string
  quantity?: string
  form?: string
  lot?: string
  expiry?: string
  finding?: string
  findingOther?: string
  action?: string
  category?: string
  note?: string
  noteEn?: string
  ingredient?: string
  required?: boolean
  answer?: string
  // Expiry rows: the list's quantity, what the row held when the entry opened, and its removal.
  expected?: string
  fromCatalogue?: boolean
  previous?: { quantity: string, lot: string, expiry: string }
  removedAt?: string
  removedBy?: string
}
// allOk: an expiry check with nothing expired or short («All in order»).
export interface StructuredData { template?: string, rows?: StructuredRow[] | null, allOk?: boolean }

// What an entry keeps besides its columns (response_data).
export interface ExecutionResponseData {
  structuredData?: StructuredData | null
  evidence?: EvidenceItem[]
  actorName?: string
  actorEmail?: string
  editedByName?: string
  editReason?: string
  cancelledByName?: string
  previousLastCompletedAt?: string | null
  previousNextDueAt?: string | null
  isExtra?: boolean
}

// The stored rows. The demo keeps the same columns but leaves out some it does
// not need (Optional): its texts, culture settings, own schedules and flags.
type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
// The demo writes the hospital it was given, which a screen may not have yet;
// the culture programme also reads `frequency` from older local rows.
type OrganizationRef = string | null | undefined
export type ControlDefinitionRow = Optional<Omit<Tables<'control_definitions'>, 'response_config' | 'frequency_config' | 'organization_id'>, 'acceptance_criteria' | 'goal' | 'guide_notes' | 'culture_department_id' | 'culture_group' | 'culture_sample_types'> & { organization_id: OrganizationRef, response_config: StoredResponseConfig | null, frequency_config: ControlFrequency | null, frequency?: ControlFrequency }
export type ControlAssignmentRow = Optional<Omit<Tables<'control_assignments'>, 'frequency_config' | 'response_override' | 'organization_id'>, 'assignee_id'> & { organization_id: OrganizationRef, frequency_config?: ControlFrequency | null, response_override?: ResponseOverride | null, department?: { id?: string | null, name?: string | null } | null, created_at?: string | null }
export type ControlExecutionRow = Optional<Omit<Tables<'control_executions'>, 'response_data' | 'organization_id'>, 'created_at' | 'checked_points' | 'result_text' | 'is_extra' | 'extra_reason' | 'has_item_list' | 'edited_at' | 'edited_by' | 'cancelled_at' | 'cancelled_by' | 'cancellation_reason' | 'notes' | 'value_text'> & { organization_id: OrganizationRef, response_data: ExecutionResponseData | null }
// A draft row; the demo's also carries the columns of an entry.
export type ControlDraftRow = Optional<Omit<Tables<'control_drafts'>, 'payload' | 'organization_id'>, 'record_key' | 'saved_at' | 'updated_at' | 'created_by'> & { organization_id: OrganizationRef, payload?: ExecutionDraft | null }

// Who records or cancels an entry (controlActorFromAuth).
export interface ControlActor { id: string, name: string, email?: string }

// One entry of a control (mapExecution).
export interface ControlExecution {
  id: string
  assignmentId: string | null
  at: string
  value: string
  resultText: string
  checkedPoints: string
  notes: string
  structuredData: StructuredData | null
  evidence: EvidenceItem[]
  responseData: ExecutionResponseData
  hasFinding: boolean
  status?: string
  actorId?: string
  by: string
  email: string
  editedAt: string | null
  editedBy: string
  editedById: string | null
  cancelledAt: string | null
  cancelledBy: string
  cancelledById: string | null
  cancellationReason: string
  isExtra: boolean
  extraReason: string
  previousLastCompletedAt: string | null
  previousNextDueAt: string | null
}

// What an entry form keeps while it is filled in, saved as a draft.
export interface ExecutionDraft {
  value?: string
  resultText?: string
  checkedPoints?: string
  notes?: string
  rows?: StructuredRow[]
  allOk?: boolean
  hasFinding?: boolean
  structuredData?: StructuredData | null
}
// A saved draft, as the assignment carries it.
export type SavedDraft = ExecutionDraft & { id: string, savedAt?: string, recordKey?: string }

// What a database count says of an assignment's entries (control_assignment_summary).
export interface AssignmentSummary { executions: number, today: number, findings: number, lastPerformedAt: string | null }
// The current period counted (control_period_progress), and as the screens read it.
export interface CountedProgress { start: string, end: string, required: number, done: number, extra: number }
export interface PeriodProgress extends CountedProgress { unit: string, complete: boolean }

// One department's assignment of a control: its own schedule and limits, its
// recent executions (history), the counts (summary) and the current period.
export interface ControlAssignment {
  dbId: string
  departmentId?: string | null
  department: string
  createdAt?: string | null
  lastCompletedAt?: string | null
  nextDueAt?: string | null
  status?: string
  frequency: ControlFrequency | null
  responseOverride: ResponseOverride | null
  history: ControlExecution[]
  summary: AssignmentSummary
  progress: CountedProgress | null
  draft: SavedDraft | null
  hasDraft: boolean
}

// A control with its departments and their assignments, by department name.
export interface ControlRecord {
  id: string
  dbId: string
  organizationId?: string | null
  title: string
  titleEn: string
  category: string
  description: string
  goal: string
  acceptanceCriteria: string
  guideNotes: string
  owner: string
  ownerId: string | null
  ownerPerson: ControlPerson | null
  assignees: Record<string, ControlPerson | null>
  location: string
  equipment: string
  responseConfig: ControlResponseConfig
  frequency: ControlFrequency
  status?: string
  createdByScope: string
  createdForDepartment: string | null
  createdBy: string
  updatedBy: string
  createdAt?: string
  updatedAt?: string
  departments: string[]
  pausedDepartments: string[]
  departmentIdByName: Record<string, string | null>
  assignments: Record<string, ControlAssignment>
}

// What the control form saves: the control's fields as the form keeps them,
// with each department's own schedule and limits.
export interface ControlDraft {
  id?: string
  dbId?: string
  title: string
  titleEn?: string
  category: string
  description?: string
  goal?: string
  acceptanceCriteria?: string
  guideNotes?: string
  owner?: string
  ownerPerson?: ControlPerson | null
  assignees?: Record<string, ControlPerson | null>
  location?: string
  equipment?: string
  responseConfig?: ControlResponseConfig
  frequency: ControlFrequency
  status?: string
  createdByScope?: string
  createdForDepartment?: string | null
  createdBy?: string
  updatedBy?: string
  departments: string[]
  pausedDepartments?: string[]
  departmentFrequencies?: Record<string, ControlFrequency | null>
  departmentResponses?: Record<string, ResponseOverride | null>
  assignments?: Record<string, ControlAssignment>
}

// The texts of a searchable list (empty, clear, «use what was typed»), passed to every select of the form.
export interface SelectText { emptyLabel?: string, clearLabel?: string, customLabel?: (text: string) => string }

// A row of the Controls list: the control and the departments the filters leave.
export interface ControlRow { item: ControlRecord, departments: string[] }
