import type { PlatformUser } from '../../core/tenant/tenantService'
import type { listRuntimeEvents } from '../../core/diagnostics/runtimeDiagnosticsService'

// Κοινοί τύποι της πλατφόρμας (Ιδιοκτήτης Πλατφόρμας): Επισκόπηση, Ιστορικό & Υγεία (ενέργειες, συμβάντα,
// συνδέσεις) και οι σύνδεσμοι προς τις καρτέλες χρηστών και οργανισμών.

// A person on the platform, as listPlatformUsers returns them (core/tenant/tenantService): one row per membership.
export type { PlatformUser }

// A person as the owner screens read them for links and indexes: only the fields used, so a narrower
// row (a member of one organization, a row of the preview) fits too.
export interface PlatformUserRef {
  id?: string | number | null
  userId?: string | null
  name?: string | null
  username?: string | null
  email?: string | null
  role?: string | null
  kind?: string | null
  demoId?: string | null
  createdAt?: string | null
  organization?: { id?: string | null } | null
}

// What names a person on an owner screen: the user, the membership row or the username / e-mail.
export type UserRef = { userId?: string | null, memberId?: string | number | null, identifier?: string | null }

// The platform users by user, by membership row and by username / e-mail (buildUserIndex).
export type UserIndex<U extends PlatformUserRef = PlatformUserRef> = { byUserId: Map<string, U>, byMemberId: Map<string, U>, byLogin: Map<string, U> }

// An organization on the owner screens (organizations, Tenant): the fields the lists and statusOf read.
export interface PlatformOrganization {
  id: string
  name: string
  code?: string | null
  city?: string | null
  status?: string | null
  is_demo?: boolean | null
  paused_at?: string | null
  deletion_scheduled_at?: string | null
}
// What statusOf needs to give an organization its one status.
export type OrganizationState = Pick<PlatformOrganization, 'status' | 'paused_at' | 'deletion_scheduled_at'>

// A membership row (listPlatformOrganizationMembers) as the Overview counts it.
export type PlatformMember = { organization_id: string, status?: string | null, role?: string | null }

// A Demo (listPlatformDemos) as the Overview shows it.
export interface PlatformDemo {
  id: string
  label?: string | null
  valid_from?: string
  valid_until: string
  organization?: { name?: string | null } | null
}

// A sign-in (listLoginSessions): Ιστορικό & Υγεία › Συνδέσεις.
export interface LoginSession {
  sessionId: string
  userId: string
  organizationId?: string
  fullName: string
  username: string
  email: string
  isPlatformOwner: boolean
  organizations: string
  ip: string
  lastIp: string
  userAgent: string
  startedAt: string
  lastSeenAt: string
  endedAt: string | null
  endedReason: string
  active: boolean
  online: boolean
}
// The start of a sign-in, for the latest sign-in of each user.
export type SessionStart = { userId?: string | null, startedAt?: string | null }

// A sign-in attempt and a lock after failed attempts (listLoginAttempts).
export interface LoginAttempt { id: number, identifier: string, ip: string, userAgent: string, success: boolean, reason: string, createdAt: string }
export interface LoginLock { id: number, kind: string, subject: string, failures: number, lockedUntil: string, createdAt: string, releasedAt: string | null }
export type LoginAttempts = { attempts: LoginAttempt[], locks: LoginLock[] }

// A row of the audit trail (listPlatformAuditEvents). The metadata is free; the organization name and code
// are kept there for organizations that no longer exist.
export type AuditMetadata = { organization_name?: string, organization_code?: string, [key: string]: unknown }
export interface AuditEvent {
  id: number | string
  organizationId: string
  actorId: string
  actorName: string
  actorRole: string
  eventType: string
  entityType: string
  entityId: string
  metadata: AuditMetadata
  createdAt: string
}
// Identical consecutive events of one person in one row (groupAuditEvents), newest first.
export type AuditGroup = Pick<AuditEvent, 'id' | 'actorId' | 'actorName' | 'actorRole' | 'organizationId' | 'metadata' | 'eventType' | 'entityType'> & {
  count: number
  to: string
  from: string
  oldestTime: number
  entityIds: string[]
  rows: AuditEvent[]
}
// Names for a group's description: organization (id), user ({userId, memberId}), employee (id).
export type AuditNames = { organization?: (id: string)=>string, user?: (ref: UserRef)=>string, employee?: (id: string)=>string }

// The health of a hospital on the Overview.
export type HospitalHealth = { lastActivityAt: string | null, errors24h: number, activity: number[] | null }

// What waits for the owner on the Overview (loadOwnerWaitingCounts).
export type OwnerWaitingCounts = { legislation: number, waiting: number, locked: number }

// An item of the owner's briefing and notifications (loadPlatformAttentionItems, loadDemoActivityItems).
export interface PlatformAttentionItem {
  id: string
  title: string
  to: string
  type: string
  source: string
  count?: number
  popup?: boolean
  createdAt?: string | null
  message?: string
}

// An operational event of an organization (listRuntimeEvents), and the same with its organization (Ιστορικό & Υγεία › Συμβάντα).
export type RuntimeEventRow = Awaited<ReturnType<typeof listRuntimeEvents>>[number]
export type OrganizationRuntimeEvent = RuntimeEventRow & { organizationId: string, organizationName: string }
