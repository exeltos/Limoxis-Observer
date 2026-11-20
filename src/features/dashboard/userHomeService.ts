// «Σε απομόνωση τώρα» on the home of the Department User and the Link Nurse: the number of the department's patients in
// isolation, never who. One read (department_isolation_count, 20261231604000): the Department User may not read the
// isolation records themselves, so the database counts them for the caller's own departments only. null when the
// hospital has locked Surveillance or the read failed (the tile then shows «—», never the Demo's number).
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'

// department_isolation_count is not in database.types yet: a client without the database types.
const untyped = () => supabase as unknown as SupabaseClient

export async function loadDepartmentIsolationCount(organizationId: string | null | undefined): Promise<number | null> {
  if (!hasSupabaseConfig || !supabase || !organizationId) return null
  const { data, error } = await untyped().rpc('department_isolation_count', { p_organization_id: organizationId })
  if (error || data == null) return null
  const count = Number(data)
  return Number.isFinite(count) ? count : null
}
