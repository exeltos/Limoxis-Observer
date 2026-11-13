// The candidate's side of «Αίτηση από tablet»: no account, only the link's code. The
// two public functions (20261129300000_hr_application_tablet.sql) return the hospital
// and the position of a valid link, and record one application through it. The demo
// code («demo») shows the sample form and sends nothing.
import { supabase } from '../../core/supabase/client'
import { DEMO_PUBLIC, isDemoToken, normalizeCode } from './applicationModel'
import type { Json } from '../../core/supabase/database.types'
import type { ApplicationInfo } from './applicationModel'

const fail = (error: { message?: string } | null) => { throw new Error(error?.message || 'HR_APPLICATION_FAILED') }

export async function loadApplicationLink(token: unknown): Promise<ApplicationInfo | null> {
  if (isDemoToken(token)) return { ...DEMO_PUBLIC }
  if (!supabase) throw new Error('HR_APPLICATION_NOT_AVAILABLE')
  const { data, error } = await supabase.rpc('hr_application_public', { p_token: normalizeCode(token) })
  if (error) fail(error)
  return data as ApplicationInfo | null
}

export async function submitApplication(token: unknown, payload: Json) {
  if (isDemoToken(token)) { await new Promise(resolve => setTimeout(resolve, 300)); return { ok: true, demo: true } }
  if (!supabase) throw new Error('HR_APPLICATION_NOT_AVAILABLE')
  const { data, error } = await supabase.rpc('hr_application_submit', { p_token: normalizeCode(token), p_payload: payload })
  if (error) fail(error)
  return data
}
