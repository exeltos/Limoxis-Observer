// «Το τμήμα μου» of a hospital: one read (department_home_period_overview, 20261231603000) for the period and its comparison. A failed
// read throws, so the screen shows its error state; it never falls back to the Demo's figures. The answer is kept for a short
// while (readCache): returning to the home page with the same period shows it at once.
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'
import { cachedRead, peekCachedRead } from '../../core/data/readCache'
import { departmentHomeWindow, normalizeDepartmentHome, type DepartmentHomeOverview, type DepartmentHomeWindow } from './departmentHomeModel'

// department_home_period_overview is not in database.types yet: a client without the database types.
const untyped = () => supabase as unknown as SupabaseClient

const argsOf = (organizationId: string, departmentIds: string[] | null | undefined, window: DepartmentHomeWindow) => ({
  p_organization_id: organizationId, p_department_ids: departmentIds?.length ? departmentIds : null,
  p_from: window.period.from, p_to: window.period.to, p_compare_from: window.compare.from, p_compare_to: window.compare.to, p_bucket: window.bucket,
})

export async function loadDepartmentHomeOverview(organizationId: string | null | undefined, departmentIds: string[] | null | undefined, window: DepartmentHomeWindow = departmentHomeWindow()): Promise<DepartmentHomeOverview> {
  if (!hasSupabaseConfig || !supabase || !organizationId) throw new Error('DEPARTMENT_HOME_UNAVAILABLE')
  const args = argsOf(organizationId, departmentIds, window)
  return cachedRead('department_home_period_overview', args, async () => {
    const { data, error } = await untyped().rpc('department_home_period_overview', args)
    if (error) throw error
    return normalizeDepartmentHome(data as Record<string, unknown> | null, window)
  })
}

// The figures read a moment ago for the same period, at once (no read), or null.
export function peekDepartmentHomeOverview(organizationId: string | null | undefined, departmentIds: string[] | null | undefined, window: DepartmentHomeWindow): DepartmentHomeOverview | null {
  if (!hasSupabaseConfig || !supabase || !organizationId) return null
  return peekCachedRead<DepartmentHomeOverview>('department_home_period_overview', argsOf(organizationId, departmentIds, window)) ?? null
}
