// Τύποι των Demo της πλατφόρμας και του κύκλου ζωής ενός οργανισμού
// (παράταση, μετατροπή σε πελάτη, αντίγραφο, προγραμματισμένη και οριστική διαγραφή).
import type { Tables } from '../../core/supabase/database.types'

type DemoEntitlementRow = Tables<'platform_demo_entitlements'>
type OrganizationRow = Tables<'organizations'>

// Ο οργανισμός ενός Demo όπως έρχεται μαζί του: η λίστα φέρνει λίγα πεδία
// (id, name, code, is_demo), η καρτέλα όλα τα στοιχεία.
export interface DemoOrganization {
  id?: string
  name?: string | null
  code?: string | null
  type?: string | null
  status?: string | null
  region?: string | null
  health_region?: string | null
  city?: string | null
  country?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  bed_capacity?: number | null
  is_demo?: boolean | null
}

// Ένα Demo (γραμμή του platform_demo_entitlements) με τον οργανισμό του.
export type DemoEntitlement = Pick<DemoEntitlementRow, 'id' | 'label' | 'contact_name' | 'contact_email' | 'valid_from' | 'valid_until' | 'status' | 'organization_id' | 'demo_user_id'> & {
  organization?: DemoOrganization | null
}

// Η φόρμα της καρτέλας Demo (στοιχεία οργανισμού, επαφή και διάρκεια).
export interface DemoRecordDraft {
  label: string
  type: string
  region: string
  healthRegion: string
  city: string
  country: string
  contactPhone: string
  bedCapacity: number | string
  contactName: string
  contactEmail: string
  validFrom: string
  validUntil: string
}

// Η φόρμα του οδηγού «Νέο Demo»: η καρτέλα και ο Διαχειριστής του Demo.
export interface DemoWizardDraft extends DemoRecordDraft {
  adminName: string
  adminEmail: string
  access: string
}

// Ένας αξιολογητής που δημιουργείται (οδηγός ή «Προσθήκη χρήστη»).
export interface DemoEvaluatorInput {
  fullName: string
  email: string
  role: string
  departmentCode: string | null
  access: string // 'invite' ή 'password'
}

// Ό,τι επιστρέφει το create-demo-access για κάθε αξιολογητή.
export interface DemoCreatedEvaluator {
  fullName?: string
  email?: string
  role?: string
  username?: string
  temporaryPassword?: string
  error?: string
  emailSent?: boolean
  emailError?: string
  accessLink?: string
}

// Αξιολογητής με σύνδεσμο πρόσβασης (το κουμπί «Σύνδεσμος» εμφανίζεται μόνο τότε).
export type DemoLinkedEvaluator = DemoCreatedEvaluator & { accessLink: string }

// Η σύνοψη των δεδομένων που γράφτηκαν στο Demo.
export interface DemoSeedSummary {
  ok?: boolean
  patients?: number
  surveillanceCases?: number
  departments?: number
  laboratorySamples?: number
}

// Το αποτέλεσμα της δημιουργίας ενός Demo (παράθυρο «Το Demo είναι έτοιμο»).
export interface DemoCreationResult {
  organization?: { name?: string | null } | null
  evaluators?: DemoCreatedEvaluator[]
  seed?: DemoSeedSummary | null
}

// Το αποτέλεσμα της μετατροπής ενός Demo σε πελάτη.
export interface DemoConversionResult {
  organizationId?: string | null
}

// Ο οργανισμός που προκύπτει από τη μετατροπή.
export interface ConvertedOrganization {
  id: string | null
  name: string
  code: string
}

// Ένας χρήστης της πλατφόρμας, όσο χρειάζεται για την κατάσταση της πρόσκλησης ενός Demo.
export interface DemoInvitationUser {
  userId?: string | null
  email?: string | null
  role?: string | null
  status?: string | null
  invitation?: string | null
  organization?: { id?: string | null } | null
}

// Ένας οργανισμός προς οριστική διαγραφή.
export interface DeletionTarget {
  id?: string | null
  name?: string | null
  code?: string | null
  is_demo?: boolean | null
}

// Τι θα διαγραφεί από έναν οργανισμό (platform_organization_deletion_impact).
export interface DeletionImpactRow {
  organizationId: string
  name?: string | null
  code?: string | null
  records?: number
  systemRecords?: number
  files?: number
  bytes?: number
  members?: number
  accountsDeleted?: number
  accountsKept?: number
  blockers: string[] // πάντα πίνακας (κενός όταν δεν υπάρχει εμπόδιο)
}

// Το αποτέλεσμα της οριστικής διαγραφής, ανά οργανισμό.
export interface OrganizationDeletionOutcome {
  organizationId: string
  ok?: boolean
  name?: string | null
  code?: string | null
  error?: string | null
}

export interface OrganizationDeletionResult {
  results?: OrganizationDeletionOutcome[]
}

// Ο οργανισμός της ενότητας «Αντίγραφο & διαγραφή».
export interface OffboardingOrganization {
  id?: string | null
  name?: string | null
}

// Η προγραμματισμένη διαγραφή ενός οργανισμού.
export type OrganizationDeletionSchedule = Pick<OrganizationRow, 'deletion_scheduled_at' | 'deletion_requested_at' | 'deletion_reason' | 'deletion_export_waived_reason'>

// Μια διαγραφή που έχει ημερομηνία (μόνο τότε εμφανίζεται στο πάνελ).
export type ScheduledDeletion = Omit<OrganizationDeletionSchedule, 'deletion_scheduled_at'> & { deletion_scheduled_at: string }

// Ένα αντίγραφο (ZIP) του οργανισμού.
export type OrganizationExport = Pick<Tables<'platform_organization_exports'>, 'id' | 'organization_name' | 'organization_code' | 'file_size' | 'tables_count' | 'rows_count' | 'files_count' | 'created_at'>

// Ό,τι επιστρέφει η δημιουργία αντιγράφου.
export interface OrganizationExportResult {
  url: string
  tables?: number
  rows?: number
  files?: number
}

// Η φόρμα «Προγραμματισμός διαγραφής».
export interface DeletionScheduleValues {
  reason: string
  exportWaivedReason?: string
}

// Ό,τι επιστρέφει ο προγραμματισμός της διαγραφής.
export interface DeletionScheduleResult {
  deletionScheduledAt?: string | null
}

// Τα στοιχεία της μετατροπής ενός Demo σε πελάτη.
export interface DemoConversionInput {
  name: string
  code: string
  details?: Record<string, string>
}
