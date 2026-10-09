import { supabase, invokeAuthenticatedFunction } from '../../core/supabase/client'
import { isOwnerPreview } from '../../core/preview/ownerPreview'

// Demo lifecycle and organization offboarding (phase 5,
// supabase/migrations/20261015120000_lifecycle_offboarding.sql).

function requireClient() {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')
}

export async function extendPlatformDemo(entitlementId, validUntil) {
  requireClient()
  const { data, error } = await supabase.rpc('platform_extend_demo', { p_entitlement_id: entitlementId, p_valid_until: validUntil })
  if (error) throw error
  return data
}

// A Demo becomes a customer in one transaction; its synthetic data is cleared first.
export async function convertPlatformDemo(organizationId, { name, code, details = {} }) {
  requireClient()
  const { data, error } = await supabase.rpc('platform_convert_demo_tx', { p_organization_id: organizationId, p_name: name, p_code: code, p_details: details })
  if (error) throw error
  return data
}

// Deletes the Demos that expired more than the configured number of days ago.
export async function runPlatformHousekeeping() {
  if (isOwnerPreview() || !supabase) return { purged: [], failed: [] }
  return invokeAuthenticatedFunction('platform-housekeeping', {})
}

export async function exportOrganization(organizationId) {
  return invokeAuthenticatedFunction('platform-export-organization', { organizationId })
}

export async function organizationExportLink(exportId) {
  const data = await invokeAuthenticatedFunction('platform-export-organization', { exportId })
  return data?.url || null
}

export async function listOrganizationExports(organizationId) {
  if (isOwnerPreview() || !supabase || !organizationId) return []
  const { data, error } = await supabase.from('platform_organization_exports')
    .select('id,organization_name,organization_code,file_size,tables_count,rows_count,files_count,created_at')
    .eq('source_organization_id', organizationId).order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function scheduleOrganizationDeletion(organizationId, { reason, exportWaivedReason = '' }) {
  requireClient()
  const { data, error } = await supabase.rpc('platform_schedule_organization_deletion', {
    p_organization_id: organizationId, p_reason: reason, p_export_waived_reason: exportWaivedReason || null,
  })
  if (error) throw error
  return data
}

export async function cancelOrganizationDeletion(organizationId) {
  requireClient()
  const { data, error } = await supabase.rpc('platform_cancel_organization_deletion', { p_organization_id: organizationId })
  if (error) throw error
  return data
}
