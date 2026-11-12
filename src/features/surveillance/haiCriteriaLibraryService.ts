import { supabase } from '../../core/supabase/client'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { HAI_CRITERIA_SETS } from './haiCriteriaDefinitions'

function rowToCriteriaSet(row) {
  return {
    labelEl: row.name_el,
    labelEn: row.name_en || row.name_el,
    source: row.source_authority || 'CDC/NHSN (simplified)',
    groups: Array.isArray(row.metadata?.groups) ? row.metadata.groups : [],
  }
}

// Loads the HAI criteria sets HaiDialog should offer: the Platform-Owner-governed
// master_library_items rows (library_key 'hai_criteria') in production, or the static
// baseline in demo mode. Falls back to the static baseline if a production organization
// somehow has no rows yet, so the dialog never ends up with an empty/broken checklist.
export async function loadHaiCriteriaSets(organizationId) {
  if (isDemoDataEnvironment() || !supabase || !organizationId) return HAI_CRITERIA_SETS
  const { data, error } = await supabase
    .from('master_library_items')
    .select('code,name_el,name_en,source_authority,metadata')
    .eq('organization_id', organizationId)
    .eq('library_key', 'hai_criteria')
    .eq('is_active', true)
  if (error) throw error
  const sets = {}
  for (const row of data || []) {
    if (row.code) sets[row.code] = rowToCriteriaSet(row)
  }
  return Object.keys(sets).length ? sets : HAI_CRITERIA_SETS
}
