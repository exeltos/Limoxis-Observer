// «Χάρτης τμημάτων» of the hospital's home: one read (hospital_department_period_matrix, 20261231638000) for the period and
// its comparison, kept for a short while (readCache). A failed read throws; the Demo counts its own sample records
// (collectDemoDepartmentMatrix), never in a real hospital.
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'
import { cachedRead } from '../../core/data/readCache'
import { normalizeHospitalMatrix, type HospitalMatrix } from './hospitalMatrixModel'
import type { DepartmentHomeWindow } from './departmentHomeModel'

// hospital_department_period_matrix is not in database.types yet: a client without the database types.
const untyped = () => supabase as unknown as SupabaseClient

export async function loadHospitalMatrix(organizationId: string | null | undefined, window: DepartmentHomeWindow): Promise<HospitalMatrix> {
  if (!hasSupabaseConfig || !supabase || !organizationId) throw new Error('HOSPITAL_MATRIX_UNAVAILABLE')
  const args = { p_organization_id: organizationId, p_from: window.period.from, p_to: window.period.to, p_compare_from: window.compare.from, p_compare_to: window.compare.to }
  return cachedRead('hospital_department_period_matrix', args, async () => {
    const { data, error } = await untyped().rpc('hospital_department_period_matrix', args)
    if (error) throw error
    return normalizeHospitalMatrix(data as Record<string, unknown> | null)
  })
}
