// The administrator's home (owner, 21/11/2026): «N σε απομόνωση» under «Ενεργές επιτηρήσεις» — the hospital's active
// isolation patients (distinct patients of the active isolation_episodes), which the administrator reads (RLS: view surveillance; a
// locked Surveillance module is cut in the database too). null when the read fails or there is no hospital: the tile
// then keeps its plain line, never the Demo's number.
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'

export async function loadActiveIsolationCount(organizationId: string | null | undefined): Promise<number | null> {
  if (!hasSupabaseConfig || !supabase || !organizationId) return null
  // Patients, not episodes: a patient with two active isolations counts once (every page of 1,000 rows).
  const patients = new Set<string>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await (supabase as unknown as SupabaseClient).from('isolation_episodes').select('id,patient_id').eq('organization_id', organizationId).eq('status', 'active').order('id').range(from, from + 999)
    if (error) return null
    for (const row of (data || []) as { id: string, patient_id: string | null }[]) patients.add(String(row.patient_id || row.id))
    if (!data || data.length < 1000) return patients.size
  }
}
