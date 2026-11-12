// Health of each hospital on the platform Overview, read from the logs that
// already exist: the last recorded activity (platform_runtime_events — the
// screens' saves, imports and errors — and system_audit_log), and the errors
// of the last 24 hours (platform_runtime_events, severity «error»). Both are
// readable by the Platform Owner only (RLS). The activity of the last 14 days
// (one count per day, Athens time) is the recorded changes of system_audit_log.
import { supabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'
import { isOwnerPreview, previewHospitalHealth } from '../../core/preview/ownerPreview'
import { hospitalDate } from '../../core/dates/hospitalDate'

const DAY_MS = 24 * 60 * 60 * 1000
export const ACTIVITY_DAYS = 14
const later = (a, b) => (!a ? b : !b ? a : a > b ? a : b)
const athensDay = value => hospitalDate(value)

// The last ACTIVITY_DAYS calendar days (Athens), oldest first.
export function activityDays(now = Date.now()) {
  return Array.from({ length: ACTIVITY_DAYS }, (_, index) => athensDay(now - (ACTIVITY_DAYS - 1 - index) * DAY_MS))
}

// { [organizationId]: { lastActivityAt, errors24h, activity } } from the rows read;
// activity holds one count per day of activityDays(now), or null when the recent rows could not be read.
export function hospitalHealthOf({ events = [], audit = [], recent = [], now = Date.now() } = {}) {
  const since = new Date(now - DAY_MS).toISOString()
  const days = activityDays(now)
  const dayIndex = new Map(days.map((day, index) => [day, index]))
  const out = {}
  const entry = id => (out[id] ||= { lastActivityAt: null, errors24h: 0, activity: recent ? days.map(() => 0) : null })
  for (const row of events) {
    if (!row?.organization_id) continue
    const item = entry(row.organization_id)
    item.lastActivityAt = later(item.lastActivityAt, row.occurred_at)
    if (row.severity === 'error' && row.occurred_at >= since) item.errors24h += 1
  }
  for (const row of audit) {
    if (!row?.organization_id) continue
    const item = entry(row.organization_id)
    item.lastActivityAt = later(item.lastActivityAt, row.created_at)
  }
  for (const row of recent || []) {
    if (!row?.organization_id || !row.created_at) continue
    const index = dayIndex.get(athensDay(row.created_at))
    if (index !== undefined) entry(row.organization_id).activity[index] += 1
  }
  return out
}

export async function loadHospitalHealth({ now = Date.now() } = {}) {
  if (isOwnerPreview()) return previewHospitalHealth(now)
  if (!hasSupabaseConfig || !supabase) return {}
  const recentSince = new Date(now - ACTIVITY_DAYS * DAY_MS).toISOString()
  const [events, audit, recent] = await Promise.all([
    supabase.from('platform_runtime_events').select('organization_id,severity,occurred_at').order('occurred_at', { ascending: false }).limit(1000),
    supabase.from('system_audit_log').select('organization_id,created_at').not('organization_id', 'is', null).order('created_at', { ascending: false }).limit(1000),
    supabase.from('system_audit_log').select('organization_id,created_at').not('organization_id', 'is', null).gte('created_at', recentSince).limit(5000),
  ])
  if (events.error && audit.error) throw events.error
  return hospitalHealthOf({ events: events.data || [], audit: audit.data || [], recent: recent.error ? null : recent.data || [], now })
}
