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


export async function updatePlatformOrganization(organizationId, patch) {
  if (!supabase || !organizationId) throw new Error('SUPABASE_NOT_CONFIGURED')
  const payload = {
    name: patch.name?.trim(), code: patch.code?.trim().toUpperCase(), type: patch.type, status: patch.status,
    region: patch.region || null, health_region: patch.healthRegion || patch.health_region || null, city: patch.city || null,
    country: patch.country || 'Greece', contact_email: patch.contactEmail ?? patch.contact_email ?? null,
    contact_phone: patch.contactPhone ?? patch.contact_phone ?? null, bed_capacity: patch.bedCapacity === '' ? null : Number(patch.bedCapacity ?? patch.bed_capacity ?? 0) || null,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase.from('organizations').update(payload).eq('id', organizationId).select().single()
  if (error) throw error
  return data
}

export async function listOrganizationMembersDetailed(organizationId) {
  if (!supabase || !organizationId) return []
  const { data, error } = await supabase.from('organization_members')
    .select('id,user_id,role,status,profiles(id,full_name,username,contact_email,phone,job_title)')
    .eq('organization_id', organizationId).order('created_at', { ascending: true })
  if (error) throw error
  return (data || []).map(row => ({ id: row.id, userId: row.user_id, role: row.role, status: row.status, username: row.profiles?.username || '—', name: row.profiles?.full_name || '—', email: row.profiles?.contact_email || '', phone: row.profiles?.phone || '', jobTitle: row.profiles?.job_title || '' }))
}

export async function manageOrganizationUser(payload) {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')
  const { data, error } = await supabase.functions.invoke('manage-organization-user', { body: payload })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data
}

export async function purgePlatformOrganization({ organizationId, password, confirmation }) {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')
  const { data, error } = await supabase.functions.invoke('platform-purge-organization', { body: { organizationId, password, confirmation } })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data
}

export async function createPlatformDemoEntitlement(payload) {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')
  if (payload.contactEmail) {
    const { data, error } = await supabase.functions.invoke('create-demo-access', { body: payload })
    if (error) throw error
    if (data?.error) throw new Error(data.error)
    return data.entitlement || data
  }
  const { data, error } = await supabase.from('platform_demo_entitlements').insert({ label: payload.label.trim(), contact_name: payload.contactName || null, contact_email: null, valid_from: payload.validFrom, valid_until: payload.validUntil, status: 'active' }).select().single()
  if (error) throw error
  return data
}

export async function convertDemoEntitlementToOrganization(demoId, organizationDraft) {
  const org = await createPlatformOrganization(organizationDraft)
  if (supabase) await supabase.from('platform_demo_entitlements').update({ organization_id: org.id, status: 'revoked', updated_at: new Date().toISOString() }).eq('id', demoId)
  return org
}
