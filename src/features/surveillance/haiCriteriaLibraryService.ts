import { supabase as configuredClient, type Cloud } from '../../core/supabase/client'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { HAI_CRITERIA_SETS, type HaiCriteriaSets } from './haiCriteriaDefinitions'
import type { Tables } from '../../core/supabase/database.types'
import type { HaiCriteriaGroup } from './surveillanceListTypes'

// The master_library_items columns a criteria set is read from; its metadata (a Json column) holds the groups.
type CriteriaSetRow = Pick<Tables<'master_library_items'>, 'name_el' | 'name_en' | 'source_authority'> & { metadata: { groups?: HaiCriteriaGroup[] } | null }

// The calls below run with a configured client: the demo and an unconfigured build return before them.
const supabase = configuredClient as Cloud

function rowToCriteriaSet(row: CriteriaSetRow) {
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
export async function loadHaiCriteriaSets(organizationId: string | null | undefined) {
  if (isDemoDataEnvironment() || !supabase || !organizationId) return HAI_CRITERIA_SETS
  const { data, error } = await supabase
    .from('master_library_items')
    .select('code,name_el,name_en,source_authority,metadata')
    .eq('organization_id', organizationId as string)
    .eq('library_key', 'hai_criteria')
    .eq('is_active', true)
  if (error) throw error
  const sets: HaiCriteriaSets = {}
  for (const row of data || []) {
    if (row.code) sets[row.code] = rowToCriteriaSet(row as CriteriaSetRow)
  }
  return Object.keys(sets).length ? sets : HAI_CRITERIA_SETS
}
