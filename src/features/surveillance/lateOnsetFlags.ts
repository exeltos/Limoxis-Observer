import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as configuredClient } from '../../core/supabase/client'

// ΜΕΝΝ Ν6β (ιδιοκτήτης 17/11/2026): the samples of «Προς έλεγχο» that are a NICU neonate's positive blood culture taken
// 72 hours or more after admission: { sample row id → hours after admission }. Matched inside the database; no name and
// nothing of the register comes back. Empty in the demo and for anyone who does not read every sample of the hospital.
const supabase = configuredClient as unknown as SupabaseClient | null
export async function loadLateOnsetFlags(organizationId: string | null | undefined, isDemo: boolean): Promise<Record<string, number>> {
  if (isDemo || !organizationId || !supabase) return {}
  // No answer (an older database, a mocked client) is no tag, never an error of the page.
  let data: unknown = null
  try {
    const result = await supabase.rpc('nicu_late_onset_flags', { p_organization_id: organizationId })
    if (!result || result.error) return {}
    data = result.data
  } catch { return {} }
  const flags: Record<string, number> = {}
  for (const row of (data || []) as { sample_id: string, hours_after: number }[]) {
    const hours = Number(row.hours_after)
    if (Number.isFinite(hours) && (flags[row.sample_id] == null || hours < flags[row.sample_id])) flags[row.sample_id] = hours
  }
  return flags
}
// «10η ημέρα»: the day of the stay the culture was taken on (day 1 = the day of admission).
export const lateOnsetDay = (hours: number) => Math.floor(hours / 24) + 1
