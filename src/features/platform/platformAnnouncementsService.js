import { supabase } from '../../core/supabase/client'

// Announcements of the platform owner to the hospital administrators (owner, 8/11/2026). The table and its RLS:
// supabase/migrations/20261231260000_platform_announcements.sql — the owner writes them, a hospital administrator reads
// the active ones meant for their hospital and records that they saw them.
const COLUMNS = 'id,kind,title_el,title_en,body_el,body_en,cta_label_el,cta_label_en,cta_url,image_url,starts_at,ends_at,audience_org_ids,frequency,status,created_at,updated_at'

export function mapAnnouncement(row) {
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
    startsAt: row.starts_at || null,
    endsAt: row.ends_at || null,
    audience: row.audience_org_ids || [],
    frequency: row.frequency || 'once',
    status: row.status || 'active',
    createdAt: row.created_at || null,
  }
}

const blank = value => (String(value ?? '').trim() ? String(value).trim() : null)
export function announcementPayload(draft) {
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
    starts_at: draft.startsAt ? new Date(`${draft.startsAt}T00:00:00`).toISOString() : new Date().toISOString(),
    ends_at: draft.endsAt ? new Date(`${draft.endsAt}T23:59:59`).toISOString() : null,
    audience_org_ids: Array.isArray(draft.audience) ? draft.audience : [],
    frequency: draft.frequency === 'every_visit' ? 'every_visit' : 'once',
    status: draft.status === 'stopped' ? 'stopped' : 'active',
  }
}

// The owner's list, with how many administrators have seen each one.
export async function loadPlatformAnnouncements() {
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

export async function savePlatformAnnouncement(draft, userId) {
  const payload = { ...announcementPayload(draft), updated_by: userId || null, updated_at: new Date().toISOString() }
  const query = draft.id
    ? supabase.from('platform_announcements').update(payload).eq('id', draft.id)
    : supabase.from('platform_announcements').insert({ ...payload, created_by: userId || null })
  const { data, error } = await query.select(COLUMNS).single()
  if (error) throw error
  return mapAnnouncement(data)
}

export async function setPlatformAnnouncementStatus(id, status) {
  const { error } = await supabase.from('platform_announcements').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function deletePlatformAnnouncement(id) {
  const { error } = await supabase.from('platform_announcements').delete().eq('id', id)
  if (error) throw error
}

// What a hospital administrator should see now in this hospital: the active ones meant for it (RLS), minus the
// «once» ones they already saw.
export async function loadPendingAnnouncements(organizationId, userId) {
  const [{ data, error }, views] = await Promise.all([
    supabase.from('platform_announcements').select(COLUMNS).eq('status', 'active').order('starts_at', { ascending: true }),
    supabase.from('platform_announcement_views').select('announcement_id').eq('user_id', userId),
  ])
  if (error) throw error
  const seen = new Set((views.data || []).map(row => row.announcement_id))
  return pendingFor((data || []).map(mapAnnouncement), organizationId, seen)
}

// Pure: the announcements to show in a hospital (tested on its own).
export function pendingFor(list, organizationId, seenIds = new Set(), now = new Date()) {
  return list.filter(item => {
    if (item.status !== 'active') return false
    if (item.startsAt && new Date(item.startsAt) > now) return false
    if (item.endsAt && new Date(item.endsAt) <= now) return false
    if (item.audience.length && !item.audience.includes(organizationId)) return false
    return item.frequency === 'every_visit' || !seenIds.has(item.id)
  })
}

export async function markAnnouncementSeen(announcementId, organizationId, userId) {
  const { error } = await supabase
    .from('platform_announcement_views')
    .upsert({ announcement_id: announcementId, organization_id: organizationId, user_id: userId, seen_at: new Date().toISOString() }, { onConflict: 'announcement_id,user_id' })
  if (error) throw error
}
