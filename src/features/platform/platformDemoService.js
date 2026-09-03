import { supabase } from '../../core/supabase/client'

const demoSelect = 'id,label,contact_name,contact_email,valid_from,valid_until,status,organization_id,demo_user_id,organization:organizations(id,name,code,type,status,region,health_region,city,country,contact_email,contact_phone,bed_capacity,is_demo)'

export async function loadPlatformDemoRecord(demoId) {
  if (!supabase || !demoId) throw new Error('SUPABASE_NOT_CONFIGURED')
  const { data, error } = await supabase
    .from('platform_demo_entitlements')
    .select(demoSelect)
    .eq('id', demoId)
    .single()
  if (error) throw error
  return data
}

export async function savePlatformDemoRecord(demo, patch) {
  if (!supabase || !demo?.id || !demo?.organization_id) throw new Error('SUPABASE_NOT_CONFIGURED')

  const organizationPayload = {
    name: String(patch.label || '').trim(),
    type: patch.type || 'hospital',
    region: patch.region || null,
    health_region: patch.healthRegion || null,
    city: patch.city || null,
    country: patch.country || null,
    contact_email: String(patch.contactEmail || '').trim().toLowerCase() || null,
    contact_phone: patch.contactPhone || null,
    bed_capacity: patch.bedCapacity === '' || patch.bedCapacity == null ? null : Number(patch.bedCapacity) || null,
    updated_at: new Date().toISOString(),
  }
  const { error: organizationError } = await supabase
    .from('organizations')
    .update(organizationPayload)
    .eq('id', demo.organization_id)
    .eq('is_demo', true)
  if (organizationError) throw organizationError

  const entitlementPayload = {
    label: String(patch.label || '').trim(),
    contact_name: patch.contactName || null,
    contact_email: String(patch.contactEmail || '').trim().toLowerCase() || null,
    valid_from: patch.validFrom,
    valid_until: patch.validUntil,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase
    .from('platform_demo_entitlements')
    .update(entitlementPayload)
    .eq('id', demo.id)
    .select(demoSelect)
    .single()
  if (error) throw error
  return data
}

export async function convertPlatformDemoToOrganization(demo, patch) {
  if (!supabase || !demo?.id || !demo?.organization_id) throw new Error('SUPABASE_NOT_CONFIGURED')

  const organizationPayload = {
    is_demo: false,
    status: 'active',
    name: String(patch.label || '').trim(),
    type: patch.type || 'hospital',
    region: patch.region || null,
    health_region: patch.healthRegion || null,
    city: patch.city || null,
    country: patch.country || null,
    contact_email: String(patch.contactEmail || '').trim().toLowerCase() || null,
    contact_phone: patch.contactPhone || null,
    bed_capacity: patch.bedCapacity === '' || patch.bedCapacity == null ? null : Number(patch.bedCapacity) || null,
    updated_at: new Date().toISOString(),
  }

  const { data: organization, error: organizationError } = await supabase
    .from('organizations')
    .update(organizationPayload)
    .eq('id', demo.organization_id)
    .eq('is_demo', true)
    .select('id,name,code,type,status,region,health_region,city,country,contact_email,contact_phone,bed_capacity,is_demo')
    .single()
  if (organizationError) throw organizationError

  const { error: entitlementError } = await supabase
    .from('platform_demo_entitlements')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('id', demo.id)

  if (entitlementError) {
    await supabase
      .from('organizations')
      .update({ is_demo: true, updated_at: new Date().toISOString() })
      .eq('id', demo.organization_id)
    throw entitlementError
  }

  return organization
}
