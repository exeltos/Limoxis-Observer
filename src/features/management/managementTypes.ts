import type { Json, Tables } from '../../core/supabase/database.types'
import type { HaiCriteriaGroup } from '../surveillance/surveillanceListTypes'

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

// --- Βιβλιοθήκη δεσμών μέτρων (prevention_bundle_templates) ---
// Ένα στοιχείο της δέσμης (ερώτηση ναι/όχι/δεν εφαρμόζεται).
export type BundleLibraryElement = { id?: string, labelEl: string, labelEn?: string, required?: boolean }
// Ένα πρότυπο δέσμης όπως το διαχειρίζεται η βιβλιοθήκη (readOnly/isNew: μόνο στη φόρμα).
export type BundleLibraryTemplate = {
  id?: string
  bundleKey?: string
  name: string
  titleEl?: string
  titleEn?: string
  version?: string
  status?: string
  scope?: string
  source?: string
  sourceVersion?: string
  departments?: string[]
  elements: BundleLibraryElement[]
  basedOn?: string | null
  system?: boolean
  hidden?: boolean
  publishedAt?: string | null
  retiredAt?: string | null
  createdAt?: string
  updatedAt?: string
  readOnly?: boolean
  isNew?: boolean
}

// --- Βιβλιοθήκη κριτηρίων ΛΣΦΥ (master_library_items, library_key = hai_criteria) ---
export type HaiCriteriaLibraryItem = {
  id: string
  criteriaKey: string | null
  // Τα σετ του demo (HAI_CRITERIA_SETS) μπορεί να μην έχουν ετικέτα ή πηγή.
  labelEl?: string
  labelEn?: string
  source?: string
  groups: HaiCriteriaGroup[]
  system: boolean
  organizationId: string | null
  // Μόνο στη φόρμα: ο χρήστης δεν μπορεί να το αλλάξει.
  readOnly?: boolean
}

// --- Δομικοί δείκτες νοσοκομείου (hospital_structure_snapshots) ---
export type HospitalStructureSnapshot = {
  id: string
  effectiveDate: string
  // Αριθμοί από τη βάση· στο demo η καταγραφή μένει όπως γράφτηκε στη φόρμα (κείμενο).
  totalBeds?: number | string | null
  icuBeds?: number | string | null
  singleRooms?: number | string | null
  infectionControlNurses?: number | string | null
  infectiousDiseasePhysicians?: number | string | null
  microbiologists?: number | string | null
  notes?: string
  createdAt?: string
  createdById?: string | null
  createdBy?: string
}
// Η καταγραφή στη φόρμα: οι αριθμοί μένουν κείμενο όσο γράφονται.
export type HospitalStructureDraft = { effectiveDate: string, notes?: string } & Partial<Record<'totalBeds' | 'icuBeds' | 'singleRooms' | 'infectionControlNurses' | 'infectiousDiseasePhysicians' | 'microbiologists', number | string | null>>

// --- Μελέτες σημειακού επιπολασμού (point_prevalence_surveys) ---
// Αριθμοί από τη βάση· στο demo η μελέτη μένει όπως γράφτηκε στη φόρμα (κείμενο).
export type PrevalenceSurvey = {
  id: string
  surveyDate: string
  departmentId: string
  departmentEl: string
  patientsTotal: number | string
  patientsWithHai: number | string
  patientsOnAntibiotics: number | string
  responsibleName: string
  notes: string
  createdAt?: string
  createdById?: string | null
}
export type PrevalenceSurveyDraft = Omit<PrevalenceSurvey, 'id' | 'createdAt' | 'createdById'>
// Ένα τμήμα στις επιλογές της φόρμας (νοσοκομείου ή του demo).
export type DepartmentChoice = { id: string, name: string, nameEn?: string | null }

// --- Ανακοινώσεις (management_announcements) ---
export type Announcement = {
  id?: string
  title: string
  message: string
  priority?: string
  audienceType?: string
  audienceValues: string[]
  requiresAck?: boolean
  startAt?: string
  endAt?: string
  linkPath?: string
  createdAt?: string
  createdById?: string | null
  updatedAt?: string
}
// Η ανακοίνωση στη φόρμα: έναρξη και λήξη ως ημερομηνία και ώρα χωριστά.
export type AnnouncementEditor = Announcement & { startDate: string, startTime: string, endDate: string, endTime: string }
