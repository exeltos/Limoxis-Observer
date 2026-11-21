// The administrator's home (owner, 21/11/2026): «N σε απομόνωση» under «Ενεργές επιτηρήσεις» — the hospital's active
// isolation episodes, one count (head) of isolation_episodes, which the administrator reads (RLS: view surveillance; a
// locked Surveillance module is cut in the database too). null when the read fails or there is no hospital: the tile
// then keeps its plain line, never the Demo's number.
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'

export async function loadActiveIsolationCount(organizationId: string | null | undefined): Promise<number | null> {
  if (!hasSupabaseConfig || !supabase || !organizationId) return null
  const { count, error } = await (supabase as unknown as SupabaseClient).from('isolation_episodes').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('status', 'active')
  return error || count == null ? null : Number(count)
}
