import { supabase } from '../../core/supabase/client'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { isOwnerPreview } from '../../core/preview/ownerPreview'
import { loadControlAssignmentsLocal, loadControlDefinitionsLocal } from '../controls/controlStore'
import { loadLaboratorySamples } from '../laboratory/laboratoryCloudService'
import { laboratorySamples } from '../laboratory/laboratoryDemoData'
import { isEnvironmentalSample } from './environmentalSurveillanceData'
import { isOutsideLimit } from '../laboratory/environmentalLimit'
import { CULTURE_CATEGORY } from './culturePlan'

// The culture programme's reads: the culture controls (with the department sampled and the kinds of sample) and the
// environmental samples of the laboratory with their results. One read each.
const isLocal = () => isDemoDataEnvironment() || isOwnerPreview()

export async function loadCultureControls(organizationId) {
  if (isLocal()) {
    const assignments = loadControlAssignmentsLocal()
    return loadControlDefinitionsLocal().filter(row => row.category === CULTURE_CATEGORY).map(row => ({
      code: row.code, title: row.title, category: row.category, status: row.status, frequency: row.frequency_config || row.frequency || {},
      cultureDepartment: '', cultureSampleTypes: [],
      departments: assignments.filter(a => a.control_id === row.id || a.control_id === row.code).map(a => a.department?.name || a.department_id || '').filter(Boolean),
    }))
  }
  const { data, error } = await supabase.from('control_definitions')
    .select('code,title,category,status,frequency_config,culture_sample_types,culture_department:departments!control_definitions_culture_department_id_fkey(name),control_assignments!control_assignments_control_id_fkey(frequency_config,status,department:departments(name))')
    .eq('organization_id', organizationId).eq('category', CULTURE_CATEGORY).neq('status', 'archived')
  if (error) throw error
  return (data || []).map(row => {
    const assignment = (row.control_assignments || []).find(item => item.status !== 'paused') || null
    return {
      code: row.code, title: row.title, category: row.category, status: row.status,
      frequency: assignment?.frequency_config || row.frequency_config || {},
      cultureDepartment: row.culture_department?.name || '', cultureSampleTypes: row.culture_sample_types || [],
      departments: (row.control_assignments || []).map(item => item.department?.name).filter(Boolean),
    }
  })
}

// The environmental samples since a day, each marked when one of its results is out of the limit.
export async function loadCultureSamples(organizationId, since) {
  const rows = isLocal() ? laboratorySamples.filter(isEnvironmentalSample) : await loadLaboratorySamples(organizationId, { environmental: true, since })
  return rows.filter(row => String(row.collectedAt || '') >= since).map(row => ({ ...row, outside: (row.microbiologyResults || []).some(result => isOutsideLimit(result)) }))
}
