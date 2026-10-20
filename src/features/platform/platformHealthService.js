// Health of each hospital on the platform Overview, read from the logs that
// already exist: the last recorded activity (platform_runtime_events — the
// screens' saves, imports and errors — and system_audit_log), and the errors
// of the last 24 hours (platform_runtime_events, severity «error»). Both are
// readable by the Platform Owner only (RLS).
import { supabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'
import { isOwnerPreview } from '../../core/preview/ownerPreview'

const DAY_MS = 24 * 60 * 60 * 1000
const later = (a, b) => (!a ? b : !b ? a : a > b ? a : b)

// { [organizationId]: { lastActivityAt, errors24h } } from the rows read.
export function hospitalHealthOf({ events = [], audit = [], now = Date.now() } = {}) {
  const since = new Date(now - DAY_MS).toISOString()
  const out = {}
  const entry = id => (out[id] ||= { lastActivityAt: null, errors24h: 0 })
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
  return out
}

export async function loadHospitalHealth({ now = Date.now() } = {}) {
  if (isOwnerPreview() || !hasSupabaseConfig || !supabase) return {}
  const [events, audit] = await Promise.all([
    supabase.from('platform_runtime_events').select('organization_id,severity,occurred_at').order('occurred_at', { ascending: false }).limit(1000),
    supabase.from('system_audit_log').select('organization_id,created_at').not('organization_id', 'is', null).order('created_at', { ascending: false }).limit(1000),
  ])
  if (events.error && audit.error) throw events.error
  return hospitalHealthOf({ events: events.data || [], audit: audit.data || [], now })
}
