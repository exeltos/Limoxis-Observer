import { supabase as configuredClient, type Cloud } from '../../core/supabase/client'
import { isOwnerPreview, previewPlatformAnnouncements } from '../../core/preview/ownerPreview'
import type { AnyRecord, Translate } from '../../types/featureTypes'

// The calls below run with a configured client: the demo and an unconfigured build return before them.
const supabase = configuredClient as Cloud

// Announcements of the platform owner to the hospital administrators (owner, 8/11/2026). The table and its RLS:
// supabase/migrations/20261231260000_platform_announcements.sql — the owner writes them, a hospital administrator reads
// the active ones meant for their hospital and records that they saw them.
const COLUMNS = 'id,kind,title_el,title_en,body_el,body_en,cta_label_el,cta_label_en,cta_url,image_url,attachment_path,attachment_name,attachment_type,image_position,document_path,document_name,document_type,show_in_demo,starts_at,ends_at,audience_org_ids,audience_all_hospitals,frequency,status,created_at,updated_at'

// Where the image sits next to the text.
export const IMAGE_POSITIONS = ['top', 'left', 'right', 'bottom']
const isImageType = (type: string) => /^image\//.test(type || '')

export function mapAnnouncement(row: AnyRecord) {
  const legacyFile = Boolean(row.attachment_path) && !isImageType(row.attachment_type)
  return {
    id: row.id,
    kind: row.kind || 'announcement',
    titleEl: row.title_el || '',
    titleEn: row.title_en || '',
    bodyEl: row.body_el || '',
    bodyEn: row.body_en || '',
    ctaLabelEl: row.cta_label_el || '',
    ctaLabelEn: row.cta_label_en || '',
    ctaUrl: row.cta_url || '',
    imageUrl: row.image_url || '',
    // The uploaded image (attachment_*) and the attached file, PDF / Word / PowerPoint / Excel (document_*): both can be
    // there. A file the first version stored in attachment_* is read as the attached file.
    attachmentPath: legacyFile ? '' : row.attachment_path || '',
    attachmentName: legacyFile ? '' : row.attachment_name || '',
    attachmentType: legacyFile ? '' : row.attachment_type || '',
    documentPath: row.document_path || (legacyFile ? row.attachment_path : ''),
    documentName: row.document_name || (legacyFile ? row.attachment_name || '' : ''),
    documentType: row.document_type || (legacyFile ? row.attachment_type || '' : ''),
    imagePosition: IMAGE_POSITIONS.includes(row.image_position) ? row.image_position : 'top',
    showInDemo: Boolean(row.show_in_demo),
    startsAt: row.starts_at || null,
    endsAt: row.ends_at || null,
    audience: row.audience_org_ids || [],
    // Every registered (non-demo) hospital. Older rows have no value: an empty list meant every hospital.
    allHospitals: row.audience_all_hospitals ?? !(row.audience_org_ids || []).length,
    frequency: row.frequency || 'once',
    status: row.status || 'active',
    createdAt: row.created_at || null,
  }
}

// Nothing chosen in «Where it shows» means every hospital and every demo.
const nobodyChosen = (draft: AnyRecord) => !draft.allHospitals && !draft.showInDemo && !(Array.isArray(draft.audience) && draft.audience.length)
const blank = (value: unknown) => (String(value ?? '').trim() ? String(value).trim() : null)
export function announcementPayload(draft: AnyRecord) {
  return {
    kind: draft.kind === 'promotion' ? 'promotion' : 'announcement',
    title_el: String(draft.titleEl || '').trim(),
    title_en: blank(draft.titleEn),
    body_el: String(draft.bodyEl || '').trim(),
    body_en: blank(draft.bodyEn),
    cta_label_el: blank(draft.ctaLabelEl),
    cta_label_en: blank(draft.ctaLabelEn),
    cta_url: blank(draft.ctaUrl),
    image_url: blank(draft.imageUrl),
    attachment_path: blank(draft.attachmentPath),
    attachment_name: blank(draft.attachmentName),
    attachment_type: blank(draft.attachmentType),
    image_position: IMAGE_POSITIONS.includes(draft.imagePosition) ? draft.imagePosition : 'top',
    document_path: blank(draft.documentPath),
    document_name: blank(draft.documentName),
    document_type: blank(draft.documentType),
    show_in_demo: nobodyChosen(draft) ? true : Boolean(draft.showInDemo),
    starts_at: draft.startsAt ? new Date(`${draft.startsAt}T00:00:00`).toISOString() : new Date().toISOString(),
    ends_at: draft.endsAt ? new Date(`${draft.endsAt}T23:59:59`).toISOString() : null,
    audience_org_ids: Array.isArray(draft.audience) ? draft.audience : [],
    audience_all_hospitals: nobodyChosen(draft) ? true : Boolean(draft.allHospitals),
    frequency: draft.frequency === 'every_visit' ? 'every_visit' : 'once',
    status: draft.status === 'stopped' ? 'stopped' : 'active',
  }
}

// Every hospital and demo hospital the owner can address, not only the ones the owner is a member of (owner, 12/11/2026).
export async function loadAnnouncementTargets() {
  if (isOwnerPreview()) return []
  const [orgs, entitlements] = await Promise.all([
    supabase.from('organizations').select('id,name,code,status,is_demo').order('name'),
    supabase.from('platform_demo_entitlements').select('organization_id'),
  ])
  if (orgs.error) throw orgs.error
  // A demo is one made in the Demo screen (it has an entitlement); the built-in «Enter Demo» space is not a target.
  const demoIds = new Set((entitlements.data || []).map(row => row.organization_id))
  return (orgs.data || []).filter(org => org.id && (org.status as string) !== 'archived' && (org.status as string) !== 'deleted' && (!org.is_demo || demoIds.has(org.id)))
}

// The owner's list, with how many administrators have seen each one.
export async function loadPlatformAnnouncements() {
  if (isOwnerPreview()) return previewPlatformAnnouncements()
  const [{ data, error }, views] = await Promise.all([
    supabase.from('platform_announcements').select(COLUMNS).order('created_at', { ascending: false }),
    supabase.from('platform_announcement_views').select('announcement_id'),
  ])
  if (error) throw error
  if (views.error) throw views.error
  const seen = new Map()
  for (const row of views.data || []) seen.set(row.announcement_id, (seen.get(row.announcement_id) || 0) + 1)
  return (data || []).map(row => ({ ...mapAnnouncement(row), seenCount: seen.get(row.id) || 0 }))
}

export async function savePlatformAnnouncement(draft: AnyRecord, userId: string) {
  const payload = { ...announcementPayload(draft), updated_by: userId || null, updated_at: new Date().toISOString() }
  const query = draft.id
    ? supabase.from('platform_announcements').update(payload).eq('id', draft.id)
    : supabase.from('platform_announcements').insert({ ...payload, created_by: userId || null })
  const { data, error } = await query.select(COLUMNS).single()
  if (error) throw error
  return mapAnnouncement(data)
}

export async function setPlatformAnnouncementStatus(id: string, status: string) {
  const { error } = await supabase.from('platform_announcements').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function deletePlatformAnnouncement(id: string) {
  const { error } = await supabase.from('platform_announcements').delete().eq('id', id)
  if (error) throw error
}

// What a hospital administrator should see now in this hospital: the active ones meant for it (RLS), minus the
// «once» ones they already saw.
export async function loadPendingAnnouncements(organizationId: string | null | undefined, userId: string) {
  const [{ data, error }, views] = await Promise.all([
    supabase.from('platform_announcements').select(COLUMNS).eq('status', 'active').order('starts_at', { ascending: true }),
    supabase.from('platform_announcement_views').select('announcement_id').eq('user_id', userId),
  ])
  if (error) throw error
  const seen = new Set((views.data || []).map(row => row.announcement_id))
  return pendingFor((data || []).map(mapAnnouncement), organizationId, seen)
}

// In a demo hospital (owner, 8/11/2026, 12/11/2026): the active ones marked «show in every demo» (the old setting) and the
// ones that name this demo hospital in «where it shows»; for whoever is in the demo. The gate shows each once per browser
// session, nothing is recorded.
export async function loadDemoAnnouncements(organizationId: string | null | undefined) {
  const { data, error } = await supabase.from('platform_announcements').select(COLUMNS).eq('status', 'active').order('starts_at', { ascending: true })
  if (error) throw error
  return (data || [])
    .map(mapAnnouncement)
    .filter(item => meantForDemo(item, organizationId))
    .filter(item => pendingFor([{ ...item, allHospitals: true }], '', new Set()).length)
}
// Who an announcement is for, in words (the list column): «all hospitals and demos», «all hospitals», «all demos», or the names.
export function audienceSummary(item: AnyRecord, nameOf: (id: string) => string, tx: Translate) {
  const names = (item.audience || []).map(nameOf)
  const hospitals = item.allHospitals ?? !names.length
  if (hospitals && item.showInDemo && !names.length) return tx('Όλα τα νοσοκομεία και τα demo', 'Every hospital and demo')
  return [hospitals ? tx('Όλα τα νοσοκομεία', 'Every hospital') : '', item.showInDemo ? tx('Όλα τα demo', 'Every demo') : '', ...names].filter(Boolean).join(', ')
}
// Pure: an announcement is for a demo hospital when it is for every demo (the old setting) or names this one.
export const meantForDemo = (item: AnyRecord, organizationId: string | null | undefined) => Boolean(item.showInDemo || (organizationId && item.audience.includes(organizationId)))

// The uploaded image or file: a private bucket, read through a short signed link.
const BUCKET = 'platform-announcements'
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'
export const DOCUMENT_ACCEPT = 'application/pdf,.docx,.pptx,.xlsx'
export const ATTACHMENT_ACCEPT = `${IMAGE_ACCEPT},${DOCUMENT_ACCEPT}`
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024
export const isImageAttachment = (item: AnyRecord) => isImageType(item?.attachmentType)
// The attached file (PDF, Word, PowerPoint, Excel) is uploaded the same way; it comes back under the document_* names.
export async function uploadAnnouncementDocument(file: File) {
  const uploaded = await uploadAnnouncementAttachment(file)
  return { documentPath: uploaded.attachmentPath, documentName: uploaded.attachmentName, documentType: uploaded.attachmentType }
}
export async function uploadAnnouncementAttachment(file: AnyRecord) {
  if (Number(file?.size || 0) > ATTACHMENT_MAX_BYTES) throw new Error('ATTACHMENT_TOO_LARGE')
  const safe = String(file.name || 'file').normalize('NFKD').replace(/[^\w.-]+/g, '_').slice(-80)
  const path = `${Date.now()}-${safe}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false })
  if (error) throw error
  return { attachmentPath: path, attachmentName: file.name || safe, attachmentType: file.type || '' }
}
export async function announcementAttachmentUrl(path: string) {
  if (!path) return ''
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
  if (error) throw error
  return data?.signedUrl || ''
}

// Pure: the announcements to show in a hospital (tested on its own).
export function pendingFor(list: AnyRecord[], organizationId: string | null | undefined, seenIds = new Set(), now = new Date()) {
  return list.filter((item: AnyRecord) => {
    if (item.status !== 'active') return false
    if (item.startsAt && new Date(item.startsAt) > now) return false
    if (item.endsAt && new Date(item.endsAt) <= now) return false
    if (!(item.allHospitals ?? !item.audience.length) && !item.audience.includes(organizationId)) return false
    return item.frequency === 'every_visit' || !seenIds.has(item.id)
  })
}

export async function markAnnouncementSeen(announcementId: string, organizationId: string | null | undefined, userId: string) {
  const { error } = await supabase
    .from('platform_announcement_views')
    .upsert({ announcement_id: announcementId, organization_id: organizationId as string, user_id: userId, seen_at: new Date().toISOString() }, { onConflict: 'announcement_id,user_id' })
  if (error) throw error
}
