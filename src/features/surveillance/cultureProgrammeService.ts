import { supabase as configuredClient, type Cloud } from '../../core/supabase/client'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { isOwnerPreview } from '../../core/preview/ownerPreview'
import { loadControlAssignmentsLocal, loadControlDefinitionsLocal } from '../controls/controlStore'
import { loadLaboratorySamples, loadStaffCultureSamples } from '../laboratory/laboratoryCloudService'
import { laboratorySamples } from '../laboratory/laboratoryDemoData'
import { isEnvironmentalSample } from './environmentalSurveillanceData'
import { isOutsideLimit } from '../laboratory/environmentalLimit'
import { CULTURE_CATEGORY } from './culturePlan'
import type { CultureControl, CultureFrequency, CultureSample } from './environmentTypes'

// The calls below run with a configured client: the demo and an unconfigured build return before them.
const supabase = configuredClient as Cloud

// The culture programme's reads: the culture controls (with the department sampled and the kinds of sample) and the
// environmental samples of the laboratory with their results. One read each.
const isLocal = () => isDemoDataEnvironment() || isOwnerPreview()
// The demo hospital's air cultures, every six months: a culture of a group, from any department.
const DEMO_GROUP_CULTURES = [{ code: 'CTRL-DEMO-AIR', title: 'Καλλιέργειες αέρα', category: CULTURE_CATEGORY, status: 'active', frequency: { kind: 'monthly', interval: 6 }, cultureDepartment: '', cultureSampleTypes: [], cultureGroup: 'air', departments: [] }]

export async function loadCultureControls(organizationId: string | null | undefined): Promise<CultureControl[]> {
  if (isLocal()) {
    const assignments = loadControlAssignmentsLocal()
    return loadControlDefinitionsLocal().filter(row => row.category === CULTURE_CATEGORY).map(row => ({
      code: row.code, title: row.title, category: row.category, status: row.status, frequency: row.frequency_config || row.frequency || {},
      cultureDepartment: '', cultureSampleTypes: [], cultureGroup: row.culture_group || '',
      departments: assignments.filter(a => a.control_id === row.id || a.control_id === row.code).map(a => a.department?.name || a.department_id || '').filter(Boolean),
    })).concat(DEMO_GROUP_CULTURES)
  }
  const { data, error } = await supabase.from('control_definitions')
    .select('code,title,category,status,frequency_config,culture_sample_types,culture_group,culture_department:departments!control_definitions_culture_department_id_fkey(name),control_assignments!control_assignments_control_id_fkey(frequency_config,status,department:departments(name))')
    .eq('organization_id', organizationId as string).eq('category', CULTURE_CATEGORY).neq('status', 'archived')
  if (error) throw error
  return (data || []).map(row => {
    const assignment = (row.control_assignments || []).find(item => item.status !== 'paused') || null
    return {
      code: row.code, title: row.title, category: row.category, status: row.status,
      // frequency_config is a Json column; the controls keep it as { kind, interval }.
      frequency: (assignment?.frequency_config || row.frequency_config || {}) as CultureFrequency,
      cultureDepartment: row.culture_department?.name || '', cultureSampleTypes: row.culture_sample_types || [], cultureGroup: row.culture_group || '',
      departments: (row.control_assignments || []).map(item => item.department?.name).filter(Boolean),
    }
  })
}

// The environmental samples since a day, and the employees' screening samples (the staff cultures, of kind «staff»), each
// marked when one of its results is out of the limit.
export async function loadCultureSamples(organizationId: string | null | undefined, since: string): Promise<CultureSample[]> {
  const [environmental, staff] = isLocal()
    ? [laboratorySamples.filter(isEnvironmentalSample), laboratorySamples.filter(row => row.employeeSurveillanceId)]
    : await Promise.all([loadLaboratorySamples(organizationId, { environmental: true, since }), loadStaffCultureSamples(organizationId, since)])
  const rows: CultureSample[] = [...environmental, ...staff.map(row => ({ ...row, type: 'staff' }))]
  return rows.filter(row => String(row.collectedAt || '') >= since).map(row => ({ ...row, outside: (row.microbiologyResults || []).some(result => isOutsideLimit(result)) }))
}
