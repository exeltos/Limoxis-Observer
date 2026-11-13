import type { Json, Tables } from '../../core/supabase/database.types'

// Τύποι της Διαχείρισης: οι εγγραφές των κεντρικών βιβλιοθηκών και οι πηγές αναφοράς.

// Τα στοιχεία μιας εγγραφής βιβλιοθήκης (το τρίτο μέλος του LibraryTuple): κοινά πεδία
// για όλες τις βιβλιοθήκες, και όσα πρόσθετα κρατά η καθεμία (π.χ. ATC, is_abhr).
export type LibraryMeta = {
  id?: string
  active?: boolean
  system?: boolean
  locked?: boolean
  source?: string
  version?: string
  code?: string | null
  category?: string
  departmentType?: string
  // Η περιγραφή θέσης εργασίας μιας θέσης (employees/jobDescription).
  jobDescription?: Record<string, unknown>
  [key: string]: unknown
}

// Μια γραμμή master_library_items όπως τη διαβάζουν οι υπηρεσίες (με όσα πεδία επέλεξαν).
export type LibraryItemRow = Pick<Tables<'master_library_items'>, 'id' | 'name_el' | 'name_en' | 'code' | 'metadata' | 'source_authority' | 'source_version'> & Partial<Pick<Tables<'master_library_items'>, 'category' | 'is_active' | 'library_key'>>
// Ένα τμήμα όπως το διαβάζει η βιβλιοθήκη των τμημάτων.
export type DepartmentLibraryRow = Pick<Tables<'departments'>, 'id' | 'name' | 'code' | 'department_type'> & Partial<Pick<Tables<'departments'>, 'is_active'>>

// Μια πηγή αναφοράς (external_reference_versions) όπως τη δείχνουν οι οθόνες.
export type ExternalReferenceRow = Pick<Tables<'external_reference_versions'>, 'id' | 'organization_id' | 'source_key' | 'authority' | 'title' | 'source_url' | 'version_label' | 'checked_at' | 'status' | 'metadata'>
export type ExternalReference = {
  id: string
  label: string
  authority: string
  version: string
  versionEn: string
  status: string
  scope: string
  scopeEn: string
  sourceKey: string
  url: string
  checkedAt: string | null
  isGlobal: boolean
  organizationId: string | null
}
// Η πηγή όπως τη στέλνει η φόρμα (νέα: χωρίς id βάσης).
export type ExternalReferenceDraft = Partial<ExternalReference>

// Ορισμός δείκτη όπως τον διαχειρίζεται το πάνελ της Διαχείρισης (indicator_definitions).
export type IndicatorDefinitionRow = Pick<Tables<'indicator_definitions'>, 'id' | 'organization_id' | 'indicator_key' | 'version' | 'title_el' | 'title_en' | 'category' | 'numerator_definition' | 'denominator_definition' | 'multiplier' | 'unit' | 'source_authority' | 'effective_from' | 'effective_to' | 'status'>
export type ManagedIndicatorDefinition = {
  id: string
  organizationId: string | null
  system: boolean
  key: string
  version: string
  titleEl: string
  titleEn: string | null
  category: string
  numeratorDefinition: Json
  denominatorDefinition: Json
  multiplier: number
  unit: string
  sourceAuthority: string
  effectiveFrom: string
  effectiveTo: string
  status: string
}
export type ManagedIndicatorDefinitionDraft = Partial<ManagedIndicatorDefinition>

// Πρωτόκολλο περιβαλλοντικής δειγματοληψίας (όριο CFU ανά είδος δείγματος).
export type EnvironmentalStandard = {
  id: string
  subjectType: string
  sourceCode: string
  protocolCode: string
  unit: string
  limitCfu: number | null
  active: boolean
  system?: boolean
  locked?: boolean
  source?: string
  version?: string
}

// Το πρωτόκολλο στη φόρμα (νέο: χωρίς id· το όριο γράφεται ως κείμενο).
export type EnvironmentalStandardDraft = Omit<EnvironmentalStandard, 'id' | 'limitCfu'> & { id?: string, limitCfu: number | string | null }

// Ημέρες νοσηλείας μιας περιόδου, για ένα τμήμα ή όλο το νοσοκομείο (patient_day_periods).
export type PatientDayPeriod = {
  id: string
  from: string
  to: string
  scope: string
  departmentId?: string | null
  departmentEl: string
  departmentEn?: string
  value: number
  source: string
  reviewStatus?: string
}
// Ό,τι στέλνει η φόρμα των ημερών νοσηλείας.
export type PatientDayPeriodInput = { scope?: string, departmentId?: string | null, from: string, to: string, value: number | string }
