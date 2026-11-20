// «Το τμήμα μου» of a hospital: one read (department_home_overview, 20261231601000). A failed
// read throws, so the screen shows its error state; it never falls back to the Demo's figures.
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'
import { normalizeDepartmentHome, type DepartmentHomeOverview } from './departmentHomeModel'

// department_home_overview is not in database.types yet: a client without the database types.
const untyped = () => supabase as unknown as SupabaseClient

export async function loadDepartmentHomeOverview(organizationId: string | null | undefined, departmentIds: string[] | null | undefined): Promise<DepartmentHomeOverview> {
  if (!hasSupabaseConfig || !supabase || !organizationId) throw new Error('DEPARTMENT_HOME_UNAVAILABLE')
  const { data, error } = await untyped().rpc('department_home_overview', { p_organization_id: organizationId, p_department_ids: departmentIds?.length ? departmentIds : null })
  if (error) throw error
  return normalizeDepartmentHome(data as Record<string, unknown> | null)
}
