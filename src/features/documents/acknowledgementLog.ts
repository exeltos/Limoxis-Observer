import { supabase } from '../../core/supabase/client'
import { roleLabel } from '../../core/permissions/roleLabels'
import { cloudClient } from '../../core/supabase/cloudContext'
import type { AnyRecord } from '../../types/featureTypes'

// A staff member of the audience, a distribution (announcement) and an acknowledgement.
type Member = AnyRecord
type Announcement = AnyRecord
type Ack = AnyRecord
export interface AcknowledgementSummary { total: number, acknowledged: Member[], pending: Member[], rate: number }

// Read-acknowledgement log for controlled documents: who a distribution was
// sent to, who confirmed reading it (and when) and who is still pending.
// A distribution is a required-acknowledgement announcement whose link_path
// points at the document; the audience rules mirror the announcement read
// policy (all / role / department scope / named users).

export const DOCUMENT_LINK_PREFIX = '/documents/'

// Does this member belong to the announcement's audience?
export function inAudience(member: Member, announcement: Announcement | null | undefined) {
  const type = announcement?.audienceType || 'all'
  const values = (announcement?.audienceValues || []).map(String)
  if (type === 'all') return true
  if (type === 'role') return values.includes(String(member.role || ''))
  if (type === 'user') return values.includes(String(member.userId))
  if (type === 'department') return (member.departmentIds || []).some((id: unknown) => values.includes(String(id)))
  return false
}

// Members of the audience split into acknowledged (with the time) and pending.
// Acknowledgements from users outside the current audience still count as
// acknowledged: the record of who read the document must not disappear when
// someone changes department or role.
export function acknowledgementSummary(members: Member[] | null | undefined, announcement: Announcement | null | undefined, acks: Ack[] | null | undefined): AcknowledgementSummary {
  const ackByUser = new Map((acks || []).map((row) => [String(row.userId), row.acknowledgedAt]))
  const audience = (members || []).filter((member) => inAudience(member, announcement))
  const audienceIds = new Set(audience.map((member) => String(member.userId)))
  const known = new Set((members || []).map((member) => String(member.userId)))
  const extra = [
    ...(members || []).filter((member) => !audienceIds.has(String(member.userId)) && ackByUser.has(String(member.userId))),
    // Acknowledgers the member list does not know (e.g. it could not be loaded).
    ...(acks || []).filter((row) => !known.has(String(row.userId))).map((row) => ({ userId: row.userId, name: row.name || '', role: row.role || '' })),
  ]
  const byName = (a: Member, b: Member) => String(a.name || '').localeCompare(String(b.name || ''), 'el')
  const acknowledged = [...audience, ...extra]
    .filter((member) => ackByUser.has(String(member.userId)))
    .map((member) => ({ ...member, acknowledgedAt: ackByUser.get(String(member.userId)) }))
    .sort((a, b) => String(a.acknowledgedAt).localeCompare(String(b.acknowledgedAt)))
  const pending = audience.filter((member) => !ackByUser.has(String(member.userId))).sort(byName)
  const total = acknowledged.length + pending.length
  return { total, acknowledged, pending, rate: total ? Math.round((acknowledged.length / total) * 100) : 0 }
}

// Profession-based audiences are stored as a snapshot of user ids, so they keep
// meaning what they meant on the day of the distribution.
export function usersWithProfessions(members: Member[] | null | undefined, professions: unknown[] | null | undefined) {
  const wanted = new Set((professions || []).map((value) => String(value).trim()).filter(Boolean))
  return (members || []).filter((member) => wanted.has(String(member.profession || '').trim())).map((member) => String(member.userId))
}

export function professionsOf(members: Member[] | null | undefined) {
  return [...new Set((members || []).map((member) => String(member.profession || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'el'))
}

export function memberDepartment(member: Member, departments: AnyRecord[] = [], en = false) {
  const named = (member.departmentIds || []).map((id: unknown) => departments.find((item) => String(item.id) === String(id))?.name).filter(Boolean)
  if (named.length) return named.join(', ')
  return (en ? member.departmentEn : member.department) || member.department || ''
}

export function memberPosition(member: Member, en = false) {
  return (en ? member.professionEn : member.profession) || member.profession || roleLabel(member.role, en ? 'en' : 'el')
}

// Flat rows for the inspector export: one line per person per distribution.
export function acknowledgementLogRows(entries: AnyRecord[] | null | undefined, { departments = [], en = false }: { departments?: AnyRecord[], en?: boolean } = {}) {
  const rows: AnyRecord[] = []
  for (const entry of entries || []) {
    const summary = entry.summary
    const base = { documentCode: entry.documentCode || '', documentTitle: entry.documentTitle || '', version: entry.version || '', sentAt: entry.sentAt || '' }
    for (const member of summary.acknowledged) rows.push({ ...base, name: member.name, position: memberPosition(member, en), department: memberDepartment(member, departments, en), status: 'acknowledged', acknowledgedAt: member.acknowledgedAt })
    for (const member of summary.pending) rows.push({ ...base, name: member.name, position: memberPosition(member, en), department: memberDepartment(member, departments, en), status: 'pending', acknowledgedAt: '' })
  }
  return rows
}

const mapMember = (row: AnyRecord): Member => ({
  userId: row.user_id,
  name: row.full_name || '',
  role: row.member_role || '',
  departmentIds: Array.isArray(row.department_ids) ? row.department_ids : [],
  profession: row.profession || '',
  professionEn: row.profession_en || row.profession || '',
  department: row.employee_department || '',
  departmentEn: row.employee_department_en || row.employee_department || '',
})

const mapAnnouncement = (row: AnyRecord): Announcement => ({
  id: row.id,
  title: row.title,
  audienceType: row.audience_type,
  audienceValues: Array.isArray(row.audience_values) ? row.audience_values : [],
  linkPath: row.link_path || '',
  createdAt: row.created_at,
})

// Active members with what the audience rules match on. Throws when the
// database function is not installed yet; callers fall back to showing only
// the acknowledgements.
export async function loadAcknowledgementMembers(organizationId: string | null | undefined): Promise<Member[]> {
  if (!supabase || !organizationId) return []
  const { data, error } = await cloudClient().rpc('document_acknowledgement_members', { p_organization_id: organizationId })
  if (error) throw error
  return (data || []).map(mapMember)
}

export async function loadAcknowledgements(organizationId: string | null | undefined, announcementIds: string[] | null | undefined): Promise<Ack[]> {
  if (!supabase || !organizationId || !announcementIds?.length) return []
  const { data, error } = await cloudClient().from('management_announcement_acknowledgements').select('announcement_id,user_id,acknowledged_at').eq('organization_id', organizationId).in('announcement_id', announcementIds)
  if (error) throw error
  return (data || []).map((row) => ({ announcementId: row.announcement_id, userId: row.user_id, acknowledgedAt: row.acknowledged_at }))
}

// Every document distribution of the organization with its summary.
export async function loadOrganizationAcknowledgementLog(organizationId: string | null | undefined): Promise<{ announcements?: Announcement[], acks?: Ack[], entries?: AnyRecord[], members: Member[], complete: boolean }> {
  if (!supabase || !organizationId) return { entries: [], members: [], complete: false }
  const { data, error } = await cloudClient().from('management_announcements').select('id,title,audience_type,audience_values,link_path,created_at').eq('organization_id', organizationId).eq('requires_ack', true).like('link_path', `${DOCUMENT_LINK_PREFIX}%`).order('created_at', { ascending: false })
  if (error) throw error
  const announcements = (data || []).map(mapAnnouncement)
  const acks = await loadAcknowledgements(organizationId, announcements.map((item) => item.id))
  let members: Member[] = [], complete = true
  try { members = await loadAcknowledgementMembers(organizationId) } catch { complete = false }
  return { announcements, acks, members, complete }
}

// Builds a summary per distribution from loaded announcements, members and
// acknowledgements. When the member list is unavailable, acknowledgers are
// still listed (with their names from the profile lookup) so nothing is lost.
export function summarizeDistributions(announcements: Announcement[] | null | undefined, members: Member[] | null | undefined, acks: Ack[] | null | undefined, documents: AnyRecord[] = []) {
  const docById = new Map((documents || []).map((doc) => [String(doc.id), doc]))
  return (announcements || []).map((announcement) => {
    const documentId = String(announcement.linkPath || '').slice(DOCUMENT_LINK_PREFIX.length)
    const doc = docById.get(documentId)
    const own = (acks || []).filter((row) => row.announcementId === announcement.id)
    return {
      announcement,
      documentId,
      documentCode: doc?.code || doc?.id || documentId,
      documentTitle: doc?.title || announcement.title,
      version: doc?.version || '',
      sentAt: announcement.createdAt,
      summary: acknowledgementSummary(members, announcement, own),
    }
  })
}

// Demo: the seeded staff are the audience, published documents have been
// distributed and most people have confirmed, so the log has something to show.
export function demoAcknowledgementMembers(employees: AnyRecord[] = []): Member[] {
  const roleFor = (profession: string) => (/Ιατρ/.test(profession) ? 'doctor_reviewer' : /Νοσηλ/.test(profession) ? 'department_user' : /Διοικ/.test(profession) ? 'quality_manager' : 'staff_user')
  return employees.map((emp) => ({
    userId: emp.id,
    name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
    nameEn: `${emp.firstNameEn || emp.firstName || ''} ${emp.lastNameEn || emp.lastName || ''}`.trim(),
    role: roleFor(emp.profession || ''),
    departmentIds: [],
    profession: emp.profession || '',
    professionEn: emp.professionEn || emp.profession || '',
    department: emp.department || '',
    departmentEn: emp.departmentEn || emp.department || '',
  }))
}

export function demoDistributions(documents: AnyRecord[] = [], members: Member[] = []) {
  const published = documents.filter((doc) => doc.status === 'published')
  const announcements: Announcement[] = [], acks: Ack[] = []
  published.forEach((doc, index) => {
    const id = `demo-distribution-${doc.id}`
    const sentAt = doc.publishedAt || doc.updatedAt || new Date().toISOString()
    announcements.push({ id, title: doc.title, audienceType: 'all', audienceValues: [], linkPath: `${DOCUMENT_LINK_PREFIX}${doc.id}`, createdAt: sentAt })
    const confirmed = Math.max(0, members.length - 2 - (index % 2))
    members.slice(0, confirmed).forEach((member, i) => {
      const at = new Date(new Date(sentAt).getTime() + (i + 1) * 9.5 * 3600000).toISOString()
      acks.push({ announcementId: id, userId: member.userId, acknowledgedAt: at })
    })
  })
  return { announcements, acks }
}
