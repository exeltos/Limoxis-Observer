import { supabase } from '../supabase/client'

export async function listMemberships(userId) {
  if (!supabase || !userId) return []
  const { data, error } = await supabase
    .from('organization_members')
    .select(`
      id, role, status, custom_role_id,
      custom_role:custom_roles(id, name, capabilities:custom_role_capabilities(capability)),
      organization:organizations(id, name, code, type, status),
      scopes:organization_member_scopes(department_id),
      add_ons:organization_member_capabilities(capability),
      assignments:work_assignments(id, assignment_type, status, due_at, department_id)
    `)
    .eq('user_id', userId)
    .eq('status', 'active')
  if (error) throw error
  return (data ?? []).filter((membership) => membership.organization).map((membership) => ({
    ...membership,
    departmentIds: (membership.scopes ?? []).map((item) => item.department_id).filter(Boolean),
    capabilities: (membership.add_ons ?? []).map((item) => item.capability).filter(Boolean),
    customCapabilities: (membership.custom_role?.capabilities ?? []).map((item) => item.capability).filter(Boolean),
    assignments: (membership.assignments ?? []).filter((item) => item.status !== 'completed' && item.status !== 'cancelled'),
  }))
}

export async function listPlatformOwnerOrganizations() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, code, type, status, region, health_region, city, country, contact_email, contact_phone, bed_capacity, paused_at')
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map((organization) => ({
    id: `platform-owner:${organization.id}`,
    role: 'platform_owner',
    status: 'active',
    organization,
    departmentIds: [],
    capabilities: [],
    customCapabilities: [],
    assignments: [],
    platformSynthetic: true,
  }))
}

export async function createPlatformOrganization({ name, code, type = 'hospital', status = 'active', region = null, healthRegion = null, city = null, country = 'Greece', contactEmail = null, contactPhone = null, bedCapacity = null }) {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')
  const { data, error } = await supabase
    .from('organizations')
    .insert({ name: name.trim(), code: code.trim().toUpperCase(), type, status, region: region || null, health_region: healthRegion || null, city: city || null, country: country || 'Greece', contact_email: contactEmail || null, contact_phone: contactPhone || null, bed_capacity: bedCapacity ? Number(bedCapacity) : null })
    .select('id, name, code, type, status, region, health_region, city, country, contact_email, contact_phone, bed_capacity, paused_at')
    .single()
  if (error) throw error
  return data
}

export async function deletePlatformOrganization(organizationId) {
  if (!supabase || !organizationId) return
  const { error } = await supabase.from('organizations').delete().eq('id', organizationId)
  if (error) throw error
}

export async function createOrganizationUser({ organizationId, fullName, role, email = null }) {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')
  const { data, error } = await supabase.functions.invoke('create-organization-user', {
    body: { organizationId, fullName: fullName.trim(), role, email },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data
}


export async function listPlatformOrganizationMembers() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('organization_members')
    .select('id, organization_id, user_id, role, status, organization:organizations(id,name,code)')
  if (error) throw error
  return data ?? []
}

export async function listPlatformDemos() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('platform_demo_entitlements')
    .select('id,label,contact_name,contact_email,valid_from,valid_until,status,organization_id,organization:organizations(id,name,code)')
    .order('valid_until', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function setPlatformOrganizationStatus(organizationId, status) {
  if (!supabase || !organizationId) throw new Error('SUPABASE_NOT_CONFIGURED')
  const patch = { status, paused_at: status === 'suspended' ? new Date().toISOString() : null }
  const { data, error } = await supabase.from('organizations').update(patch).eq('id', organizationId).select().single()
  if (error) throw error
  return data
}
