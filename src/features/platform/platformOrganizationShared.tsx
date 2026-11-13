import type { Translate } from '../../types/featureTypes'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import type { Roster } from './bulkAccountsModel'
import type { LoginSession } from './platformTypes'

export type Setter<T> = Dispatch<SetStateAction<T>>

// An organization as the owner's record reads it: the Tenant (an organizations row) or a row of the
// registry; what the record saves (updatePlatformOrganization) comes back as a full row.
export type OrganizationRecordRow = {
  id: string
  name: string
  code?: string | null
  type?: string | null
  status?: string | null
  region?: string | null
  health_region?: string | null
  city?: string | null
  country?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  bed_capacity?: number | string | null
  is_demo?: boolean | null
  paused_at?: string | null
  deletion_scheduled_at?: string | null
  operating_profile?: string | null
  enabled_addons?: string[] | null
  enabled_modules?: string[] | null
  idle_lock_minutes?: number | null
  screen_guides_enabled?: boolean | null
  branding?: unknown
}

// A member of the organization with the person and the latest invitation (listOrganizationMembersDetailed).
export type OrganizationMember = {
  id: string
  userId: string
  role: string
  status: string
  username: string
  name: string
  email: string
  phone: string
  jobTitle: string
  invitationStatus: string | null
  invitationCreatedAt: string | null
  invitationExpiresAt: string | null
  createdAt: string | null
}

// An employee of the organization (loadEmployeesAsync) as the user record links it: only the fields read.
export type OrganizationEmployee = {
  dbId: string
  id?: string
  userId?: string | null
  firstName?: string
  lastName?: string
  department?: string
}

// The form of a user of the organization, of a new Hospital Admin, and the activation link shown.
export type OrganizationUserDraft = { fullName: string, email: string, phone: string, jobTitle: string, role: string }
export type NewAdminDraft = { name: string, email: string }
export type CreateUserDraft = { fullName: string, email: string, role: string }
export type InvitationLinkView = { link: string, name: string }

// What the organization record (PlatformOrganizationRecord) hands its tabs: its state and actions, read as the
// record keeps them; each tab adds the setters it calls with an updater.
// «Στοιχεία»
export type OrganizationDetailsContext = {
  admins: OrganizationMember[]
  canSave: boolean
  draft: OrganizationDraft
  editing: boolean
  inviteAdmin: () => unknown
  language: string
  loadingUsers: boolean
  newAdmin: NewAdminDraft
  onChanged?: (organization: OrganizationRecordRow) => void
  record: OrganizationRecordRow
  saveOrganization: () => unknown
  saving: boolean
  setDraft: Setter<OrganizationDraft>
  setEditing: Setter<boolean>
  setNewAdmin: Setter<NewAdminDraft>
  setRecord: Setter<OrganizationRecordRow>
  tx: Translate
  users: OrganizationMember[]
  working: boolean
}
// «Χρήστες»
export type OrganizationUsersContext = {
  startMode?: string
  filteredUsers: OrganizationMember[]
  onlineUserIds: Set<string>
  orgUserState: (user: OrganizationMember) => string
  setUserFilter: Setter<string>
  userFilter: string
  language: string
  loadRoster: () => unknown
  loadUsers: () => unknown
  loadingUsers: boolean
  onOpenEmployee?: (employeeId: string) => void
  pagedUsers: OrganizationMember[]
  record: OrganizationRecordRow
  roster: Roster
  rosterLoading: boolean
  rosterWithoutAccount: number
  safeUserPage: number
  sessions?: LoginSession[]
  setCreateUserDraft: Setter<CreateUserDraft>
  setCreateUserOpen: Setter<boolean>
  setSelectedUserId: (id: string, backTab?: string) => void
  setUserPage: Setter<number>
  setUserPageSize: Setter<number>
  setUserQuery: Setter<string>
  setUsersView: Setter<string>
  tx: Translate
  userPageSize: number
  userQuery: string
  userTotalPages: number
  users: OrganizationMember[]
  usersView: string
}
// The record of one user
export type OrganizationUserContext = {
  employees?: OrganizationEmployee[]
  loadSessions: () => unknown
  sessions?: LoginSession[]
  deleteSelectedUser: () => unknown
  employeeLinkDrafts: Record<string, string>
  employeeOptions: OrganizationEmployee[]
  invitationLink: InvitationLinkView | null
  language: string
  linkUserEmployee: (user: OrganizationMember) => unknown
  organization: OrganizationRecordRow
  resetUserAccess: (user: OrganizationMember) => unknown
  saveSelectedUser: () => unknown
  selectedEmployee: OrganizationEmployee | null
  selectedUser: OrganizationMember
  setEmployeeLinkDrafts: Setter<Record<string, string>>
  setInvitationLink: Setter<InvitationLinkView | null>
  setSelectedUserId: (id: string, backTab?: string) => void
  setUserDraft: Setter<OrganizationUserDraft>
  setUserEditing: Setter<boolean>
  showInvitationLink: (user: OrganizationMember) => unknown
  toggleSelectedUserStatus: () => unknown
  tx: Translate
  userDraft: OrganizationUserDraft
  userEditing: boolean
  working: boolean
}
// Shared by the organization record and its tabs (the regions, the roles a user can hold,
// the form section and the organization draft).

export const GREEK_REGIONS = [
  'Ανατολική Μακεδονία και Θράκη',
  'Κεντρική Μακεδονία',
  'Δυτική Μακεδονία',
  'Ήπειρος',
  'Θεσσαλία',
  'Ιόνια Νησιά',
  'Δυτική Ελλάδα',
  'Στερεά Ελλάδα',
  'Αττική',
  'Πελοπόννησος',
  'Βόρειο Αιγαίο',
  'Νότιο Αιγαίο',
  'Κρήτη',
]
export const HEALTH_REGIONS = [
  '1η ΥΠΕ Αττικής',
  '2η ΥΠΕ Πειραιώς και Αιγαίου',
  '3η ΥΠΕ Μακεδονίας',
  '4η ΥΠΕ Μακεδονίας και Θράκης',
  '5η ΥΠΕ Θεσσαλίας και Στερεάς Ελλάδας',
  '6η ΥΠΕ Πελοποννήσου, Ιονίων Νήσων, Ηπείρου και Δυτικής Ελλάδας',
  '7η ΥΠΕ Κρήτης',
]
export const ROLES = [
  'hospital_admin',
  'infection_control_lead',
  'infection_control_member',
  'department_manager',
  'department_user',
  'laboratory',
  'committee_secretariat',
  'hr_office',
  'pharmacy',
  'occupational_physician',
  'doctor_reviewer',
  'quality_manager',
  'hospital_director',
  'division_director',
  'link_nurse',
  'staff_user',
]

export function FormSection({ title, subtitle, actions, children }: { title: ReactNode, subtitle?: ReactNode, actions?: ReactNode, children?: ReactNode }) {
  return (
    <section className="platform-form-section">
      <header>
        <div>
          <strong>{title}</strong>
          {subtitle && <span>{subtitle}</span>}
        </div>
        {actions && <div className="platform-form-section-actions">{actions}</div>}
      </header>
      {children}
    </section>
  )
}

// The organization form (Στοιχεία › Επεξεργασία), in the names updatePlatformOrganization reads.
export type OrganizationDraft = ReturnType<typeof toDraft>
export function toDraft(org: OrganizationRecordRow) {
  return {
    id: org.id,
    name: org.name || '',
    code: org.code || '',
    type: org.type || 'hospital',
    status: org.status || 'active',
    region: org.region || '',
    healthRegion: org.health_region || '',
    city: org.city || '',
    country: org.country || '',
    contactEmail: org.contact_email || '',
    contactPhone: org.contact_phone || '',
    bedCapacity: org.bed_capacity ?? '',
  }
}
export function organizationTypeLabel(type: string | null | undefined, language = 'el') {
  const labels: Record<string, { el: string, en: string }> = {
    hospital: { el: 'Νοσοκομείο', en: 'Hospital' },
    clinic: { el: 'Κλινική', en: 'Clinic' },
    group: { el: 'Όμιλος', en: 'Group' },
    other: { el: 'Άλλο', en: 'Other' },
  }
  return labels[String(type)]?.[language === 'en' ? 'en' : 'el'] || type || '—'
}
