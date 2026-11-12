import type { Database } from '../supabase/database.types'
import type { OperatingProfile } from '../organization/operatingProfile'
import type { RoleUxPolicy } from '../permissions/roleUxPolicy'

type OrganizationRow = Database['public']['Tables']['organizations']['Row']

// Το ενεργό νοσοκομείο (οργανισμός). Από τη βάση έρχονται μόνο οι στήλες που
// ζητά το tenantService· το νοσοκομείο-δείγμα του browser (mode 'demo') έχει
// μόνο id, όνομα, κωδικό και τύπο.
export type Tenant = Partial<OrganizationRow> & {
  id: string
  name: string
  // Το νοσοκομείο-δείγμα του browser (fixtures), όχι πραγματικός οργανισμός Demo.
  mode?: 'demo'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- γραμμή work_assignments ή δείγματος
export type MembershipAssignment = Record<string, any>

// Το μέλος του νοσοκομείου που είναι ενεργό (organization_members με τα
// τμήματα, τα πρόσθετα και τις αναθέσεις του), ή το συνθετικό μέλος του
// Ιδιοκτήτη πλατφόρμας και της προεπισκόπησης ρόλου.
export interface Membership {
  id: string
  role: string
  status: string
  organization: Tenant | null
  departmentIds: string[]
  // Το τμήμα της προεπισκόπησης ρόλου σε πραγματικό νοσοκομείο.
  departmentId?: string
  departmentName?: string
  // Το τμήμα (όνομα) της προεπισκόπησης στο νοσοκομείο-δείγμα.
  previewDepartment?: string | null
  // Πρόσθετα (organization_member_capabilities) και δικαιώματα προσαρμοσμένου ρόλου.
  capabilities: string[]
  customCapabilities: string[]
  assignments: MembershipAssignment[]
  custom_role_id?: string | null
  screen_guides?: boolean | null
  platformSynthetic?: boolean
}

export interface RolePreview {
  role: string
  department: string
  departmentName?: string
}

// Η τιμή του TenantContext (TenantProvider).
export interface TenantContextValue {
  tenant: Tenant | null
  membership: Membership | null
  memberships: Membership[]
  activeMembershipId: string | null
  role: string | null
  loading: boolean
  isDemo: boolean
  operatingProfile: OperatingProfile
  moduleEnabled: (module: string) => boolean
  setTenantByMembership: (membershipId: string) => boolean
  enterPlatformDemo: () => Promise<boolean>
  enterSampleDemo: () => boolean
  enterDemoOrganization: (organizationId: string | null | undefined) => Promise<boolean>
  returnToPlatform: () => void
  reloadMemberships: () => Promise<Membership[]>
  actualRole: string | null
  rolePreview: RolePreview | null
  canRolePreview: boolean
  isRolePreview: boolean
  startRolePreview: (role: string, department?: string, departmentName?: string) => boolean
  updateRolePreviewDepartment: (department?: string, departmentName?: string) => void
  stopRolePreview: () => void
  uxPolicy: RoleUxPolicy
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- εγγραφή οποιασδήποτε ενότητας
  canAccessRecord: (record: Record<string, any> | null | undefined) => boolean
  canSeeSensitiveEmployeeHealth: boolean
}
