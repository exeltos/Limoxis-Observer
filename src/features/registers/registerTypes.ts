import type { Tables } from '../../core/supabase/database.types'

// The shape the register screens keep (registerCloud translates it to and from
// the database rows, department_register_* in database.types).

// A value of an entry. A case keeps one per field: a date or time as text, a
// number, yes/no, a list choice or several; a sheet keeps one row of numbers
// per sheet row (measure → number). The fields are defined by each hospital,
// so the values are keyed by field and checked where they are read.
export type SheetCells = Record<string, number>
export type EntryValue = string | number | boolean | string[] | SheetCells | null | undefined
export type EntryValues = Record<string, EntryValue>

// A sheet cell set, read from an entry's value (an object of numbers; anything else has no cells).
export const cellsOf = (value: EntryValue): SheetCells | undefined => (value && typeof value === 'object' && !Array.isArray(value) ? value : undefined)

// An option of a list field; `match` are the beginnings of the FileMaker values it takes on import.
export interface FieldOption { value: string, label: string, labelEn?: string, match?: string[], fromTemplate?: boolean }
// Shown when another field has a value (any, or this one).
export type ShowWhen = { field: string, value?: string | boolean }
// The limits the builder keeps as typed ('' when cleared) and the database as numbers.
export type Limit = number | string | null
export interface RegisterField {
  key: string
  section?: string
  type: string
  label: string
  labelEn?: string
  unit?: string
  unitEn?: string
  min?: Limit
  max?: Limit
  usualMin?: Limit
  usualMax?: Limit
  required?: boolean
  requiredFrom?: string
  list?: boolean
  provisional?: boolean
  help?: string
  helpEn?: string
  notBefore?: string
  showWhen?: ShowWhen
  computed?: string
  from?: string
  to?: string
  aliases?: string[]
  options?: FieldOption[]
  // Import only: how a number that lost its decimal point is read, and a field the template gained since.
  repair?: string
  fromTemplate?: boolean
}

// A row, measure or group of a sheet.
export interface SheetAxisItem { key: string, label: string, labelEn?: string, help?: string, helpEn?: string, group?: string, aliases?: string[] }
export interface IndicatorFilter { field: string, op: string, value?: string | number }
export interface RegisterIndicator {
  id: string
  title: string
  titleEn?: string
  aggregation: string
  filters?: IndicatorFilter[]
  denominatorFilters?: IndicatorFilter[]
  direction?: string
  field?: string
  dateField?: string
  denominatorField?: string
  multiplier?: Limit
  rows?: string[]
  measure?: string
  denominatorRows?: string[]
  denominatorMeasure?: string
  dailyOnly?: boolean
  unit?: string
  unitEn?: string
  target?: Limit
  threshold?: Limit
  note?: string
  noteEn?: string
  archived?: boolean
}
export interface RegisterSection { key: string, label: string, labelEn?: string }
export interface RegisterSheetDef { period?: string, dailyFrom?: string, rows?: SheetAxisItem[], measures?: SheetAxisItem[], groups?: SheetAxisItem[], measureColumn?: string[] }
export interface RegisterIdentitySettings { caseNumber?: boolean, patientName?: boolean, caseNumberAliases?: string[], patientNameAliases?: string[] }
export interface RegisterSettings { sections?: RegisterSection[], identity?: RegisterIdentitySettings | null, entryDateField?: string, breakdowns?: string[], description?: string, descriptionEn?: string }
export type RegisterHistoryEvent = { at: string, action: string, actor: string }

// A saved register (a new one, from a template, is a RegisterDraft until saved).
export interface Register {
  id: string
  code: string
  name: string
  nameEn: string
  kind: string
  status: string
  version: number
  templateKey: string
  tableName?: string
  departmentId: string
  department: string
  departmentEn: string
  history?: RegisterHistoryEvent[]
  updatedAt?: string
  fields: RegisterField[]
  sheet: RegisterSheetDef
  indicators: RegisterIndicator[]
  settings: RegisterSettings
  // The list of registers adds how many entries and the latest one.
  entryCount?: number
  lastEntry?: string
  // Import only (from the template): the dates a case without its own takes, and registers kept without dates.
  entryDateFallbacks?: string[]
  undatedImport?: boolean
}
export type RegisterDraft = Omit<Register, 'id'> & { id?: string }

// A ready-made register (registerTemplates): a case template has its fields, a sheet template its rows.
interface TemplateBase {
  key: string
  name: string
  nameEn: string
  description: string
  descriptionEn: string
  identity?: RegisterIdentitySettings
  entryDateField?: string
  entryDateFallbacks?: string[]
  undatedImport?: boolean
  retiredAliases?: string[]
  importRepairs?: Record<string, string>
  sections?: RegisterSection[]
  fields?: RegisterField[]
  breakdowns?: string[]
  sheet?: RegisterSheetDef
  indicators: RegisterIndicator[]
}
export type RegisterTemplate = (TemplateBase & { kind: 'case', fields: RegisterField[] }) | (TemplateBase & { kind: 'sheet', sheet: RegisterSheetDef & { rows: SheetAxisItem[] } })

// Case number and name, kept apart (only the department reads them).
export type EntryIdentity = { caseNumber: string, patientName: string }
// One saved case, or one period of a sheet (an EntryDraft until saved).
export interface RegisterEntry {
  id: string
  registerId?: string
  entryDate?: string | null
  periodStart?: string | null
  periodEnd?: string | null
  version?: number
  values: EntryValues
  status?: string
  locked?: boolean
  createdBy?: string | null
  createdByLabel?: string
  createdAt?: string
  updatedAt?: string
  identity?: EntryIdentity | null
}
export type EntryDraft = Omit<RegisterEntry, 'id'> & { id?: string }
// A sheet's values (row → measure → number), and an entry of a sheet register.
export type SheetValues = Record<string, SheetCells>
export type SheetEntry = Omit<RegisterEntry, 'values'> & { values: SheetValues }

// The definition rows of the database.
export type RegisterRow = Tables<'department_registers'> & { departments?: { name: string } | null }
export type SectionRow = Tables<'department_register_sections'>
export type FieldRow = Tables<'department_register_fields'>
export type OptionRow = Tables<'department_register_options'>
export type AxisRow = Tables<'department_register_sheet_axes'>
export type IndicatorRow = Tables<'department_register_indicators'>
export type FilterRow = Tables<'department_register_indicator_filters'>
// A row of a register's own data table (one column per field), absent from database.types.
export type DataRow = Record<string, EntryValue> & { id: string, entry_date?: string, period_start?: string | null, period_end?: string | null, definition_version?: number, status?: string, locked?: boolean, created_by?: string | null, created_at?: string, updated_at?: string }

// The export handlers a tab hands to the record's header («Export ▾»).
export type ExportApi = { excel?: () => void, pdf?: () => void | Promise<void>, busy?: boolean, disabled?: boolean }
