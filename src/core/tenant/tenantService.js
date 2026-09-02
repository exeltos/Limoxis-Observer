import { supabase, invokeAuthenticatedFunction } from '../supabase/client'

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
      assignments:work_assignments(id, assignment_type, source_type, source_id, status, due_at, department_id)
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
  return invokeAuthenticatedFunction('create-organization-user', { organizationId, fullName: fullName.trim(), role, email })
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
  // Do not rely on an implicit PostgREST relationship between organization_members
  // and profiles: both point at auth.users, but there is no direct FK in all deployed
  // schemas. Fetch in two explicit steps so the query works consistently.
  const { data: memberRows, error: memberError } = await supabase.from('organization_members')
    .select('id,user_id,role,status,created_at')
    .eq('organization_id', organizationId).order('created_at', { ascending: true })
  if (memberError) throw memberError
  const userIds = [...new Set((memberRows || []).map(row => row.user_id).filter(Boolean))]
  let profiles = []
  let invitations = []
  if (userIds.length) {
    const [{ data: profileRows, error: profileError }, { data: inviteRows, error: inviteError }] = await Promise.all([
      supabase.from('profiles').select('id,full_name,username,contact_email,phone,job_title').in('id', userIds),
      supabase.from('account_invitations').select('id,user_id,expires_at,accepted_at,revoked_at,created_at,delivery_email').eq('organization_id', organizationId).in('user_id', userIds).order('created_at', { ascending: false }),
    ])
    if (profileError) throw profileError
    // account_invitations may be absent on an older installation; member loading
    // must still work. Invitation metadata is optional in that case.
    profiles = profileRows || []
    if (!inviteError) invitations = inviteRows || []
  }
  const profileById = new Map(profiles.map(row => [row.id, row]))
  const latestInviteByUser = new Map()
  for (const invite of invitations) if (!latestInviteByUser.has(invite.user_id)) latestInviteByUser.set(invite.user_id, invite)
  return (memberRows || []).map(row => {
    const profile = profileById.get(row.user_id) || {}
    const invite = latestInviteByUser.get(row.user_id)
    const invitationStatus = !invite ? null : invite.accepted_at ? 'accepted' : invite.revoked_at ? 'revoked' : new Date(invite.expires_at) < new Date() ? 'expired' : 'pending'
    return { id: row.id, userId: row.user_id, role: row.role, status: row.status, username: profile.username || '—', name: profile.full_name || '—', email: profile.contact_email || invite?.delivery_email || '', phone: profile.phone || '', jobTitle: profile.job_title || '', invitationStatus, invitationCreatedAt: invite?.created_at || null, invitationExpiresAt: invite?.expires_at || null }
  })
}

export async function manageOrganizationUser(payload) {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')
  return invokeAuthenticatedFunction('manage-organization-user', payload)
}

export async function purgePlatformOrganization({ organizationId, password, confirmation }) {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')
  return invokeAuthenticatedFunction('platform-purge-organization', { organizationId, password, confirmation })
}

export async function createPlatformDemoEntitlement(payload) {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')
  if (payload.contactEmail) {
    const data = await invokeAuthenticatedFunction('create-demo-access', payload)
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
