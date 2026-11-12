import { supabase } from '../../core/supabase/client'

function requireCloud() { if (!supabase) throw new Error('Supabase is not configured.') }

function mapRow(row) {
  return {
    id: row.id,
    criteriaKey: row.code,
    labelEl: row.name_el,
    labelEn: row.name_en || row.name_el,
    source: row.source_authority || '',
    groups: Array.isArray(row.metadata?.groups) ? row.metadata.groups : [],
    system: Boolean(row.metadata?.system),
    organizationId: row.organization_id || null,
  }
}

const COLUMNS = 'id,organization_id,code,name_el,name_en,source_authority,metadata,is_active'

// Hospital view: the per-organization copies fanned out from the global rows by the
// master_library_items_propagate trigger. Read-only here — hospitals never edit a
// system-governed criteria set, mirroring antibiotics/microorganisms.
export async function loadHaiCriteriaLibraryItems(organizationId) {
  requireCloud()
  if (!organizationId) throw new Error('Organization is required.')
  const { data, error } = await supabase.from('master_library_items').select(COLUMNS).eq('library_key', 'hai_criteria').eq('organization_id', organizationId).eq('is_active', true).order('name_el')
  if (error) throw error
  return (data || []).map(mapRow)
}

// Platform Owner (global, organization_id is null) rows: edits here fan out to every
// organization's linked copy via the master_library_items_propagate trigger, exactly
// like the antibiotics/microorganisms libraries.
export async function loadGlobalHaiCriteriaLibraryItems() {
  requireCloud()
  const { data, error } = await supabase.from('master_library_items').select(COLUMNS).eq('library_key', 'hai_criteria').is('organization_id', null).eq('is_active', true).order('name_el')
  if (error) throw error
  return (data || []).map(mapRow)
}

export async function updateGlobalHaiCriteriaLibraryItem(item) {
  requireCloud()
  if (!item?.id) throw new Error('Library item id is required.')
  const payload = {
    name_el: item.labelEl,
    name_en: item.labelEn || item.labelEl,
    source_authority: item.source || '',
    metadata: { system: true, locked: true, groups: item.groups || [] },
  }
  const { data, error } = await supabase.from('master_library_items').update(payload).is('organization_id', null).eq('id', item.id).select(COLUMNS).single()
  if (error) throw error
  return mapRow(data)
}
