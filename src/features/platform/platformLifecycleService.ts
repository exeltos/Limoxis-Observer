import { supabase, invokeAuthenticatedFunction } from '../../core/supabase/client'
import { isOwnerPreview } from '../../core/preview/ownerPreview'
import type { AnyRecord } from '../../types/featureTypes'

// Demo lifecycle and organization offboarding (phase 5,
// supabase/migrations/20261015120000_lifecycle_offboarding.sql).

function requireClient() {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')
  return supabase
}

export async function extendPlatformDemo(entitlementId: string, validUntil: string) {
  const supabase = requireClient()
  const { data, error } = await supabase.rpc('platform_extend_demo', { p_entitlement_id: entitlementId, p_valid_until: validUntil })
  if (error) throw error
  return data
}

// A Demo becomes a customer in one transaction; its synthetic data is cleared first.
export async function convertPlatformDemo(organizationId: string | null | undefined, { name, code, details = {} }: AnyRecord) {
  const supabase = requireClient()
  const { data, error } = await supabase.rpc('platform_convert_demo_tx', { p_organization_id: organizationId as string, p_name: name, p_code: code, p_details: details })
  if (error) throw error
  return data
}

export async function exportOrganization(organizationId: string | null | undefined) {
  return invokeAuthenticatedFunction('platform-export-organization', { organizationId })
}

export async function organizationExportLink(exportId: string) {
  const data = await invokeAuthenticatedFunction('platform-export-organization', { exportId })
  return data?.url || null
}

export async function listOrganizationExports(organizationId: string | null | undefined) {
  if (isOwnerPreview() || !supabase || !organizationId) return []
  const { data, error } = await supabase.from('platform_organization_exports')
    .select('id,organization_name,organization_code,file_size,tables_count,rows_count,files_count,created_at')
    .eq('source_organization_id', organizationId).order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function scheduleOrganizationDeletion(organizationId: string | null | undefined, { reason, exportWaivedReason = '' }: AnyRecord) {
  const supabase = requireClient()
  const { data, error } = await supabase.rpc('platform_schedule_organization_deletion', {
    p_organization_id: organizationId as string, p_reason: reason, p_export_waived_reason: exportWaivedReason || null,
  })
  if (error) throw error
  return data
}

export async function cancelOrganizationDeletion(organizationId: string | null | undefined) {
  const supabase = requireClient()
  const { data, error } = await supabase.rpc('platform_cancel_organization_deletion', { p_organization_id: organizationId as string })
  if (error) throw error
  return data
}
