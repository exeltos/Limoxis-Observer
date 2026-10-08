import { supabase, invokeAuthenticatedFunction } from '../supabase/client'

// organizations.country is required by the database; an empty field means Greece.
export const DEFAULT_COUNTRY = 'Ελλάδα'
export const countryOrDefault = (value) => String(value || '').trim() || DEFAULT_COUNTRY
import { isOwnerPreview,previewDeletionImpact,previewDemoSeedResult,previewDemos,previewMemberships,previewOrganizationMembers,previewPlatformMembers } from '../preview/ownerPreview'

export async function listMemberships(userId) {
  if (!supabase || !userId) return []
  const { data, error } = await supabase
    .from('organization_members')
    .select(`
      id, role, status, custom_role_id,
      custom_role:custom_roles(id, name, capabilities:custom_role_capabilities(capability)),
      organization:organizations(id, name, code, type, status, is_demo, operating_profile, enabled_addons, enabled_modules, idle_lock_minutes, branding),
      scopes:organization_member_scopes(department_id),
      add_ons:organization_member_capabilities(capability),
      assignments:work_assignments(id, assignment_type, source_type, source_id, status, due_at, department_id)
    `)
    .eq('user_id', userId)
    .eq('status', 'active')
  if (error) throw error
  return (data ?? [])
    .filter((membership) => membership.organization?.status === 'active')
    .map((membership) => ({
    ...membership,
    departmentIds: (membership.scopes ?? []).map((item) => item.department_id).filter(Boolean),
    capabilities: (membership.add_ons ?? []).map((item) => item.capability).filter(Boolean),
    customCapabilities: (membership.custom_role?.capabilities ?? []).map((item) => item.capability).filter(Boolean),
    assignments: (membership.assignments ?? []).filter((item) => item.status !== 'completed' && item.status !== 'cancelled'),
    }))
}

const OWNER_ORGANIZATION_COLUMNS = 'id, name, code, type, status, region, health_region, city, country, contact_email, contact_phone, bed_capacity, paused_at, is_demo, operating_profile, enabled_addons, enabled_modules, idle_lock_minutes, branding'
const platformOwnerMembership = (organization) => ({
  id: `platform-owner:${organization.id}`,
  role: 'platform_owner',
  status: 'active',
  organization,
  departmentIds: [],
  capabilities: [],
  customCapabilities: [],
  assignments: [],
  platformSynthetic: true,
})

export async function listPlatformOwnerOrganizations() {
  if (isOwnerPreview()) return previewMemberships()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('organizations')
    .select(OWNER_ORGANIZATION_COLUMNS)
    .eq('is_demo', false)
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map(platformOwnerMembership)
}

// The Platform Owner enters a Demo organization (theirs or an evaluator's) the
// same way as a hospital: a synthetic membership. Demos stay out of the
// organization list above.
export async function getPlatformOwnerDemoMembership(organizationId) {
  if (!supabase || !organizationId) return null
  const { data, error } = await supabase
    .from('organizations')
    .select(OWNER_ORGANIZATION_COLUMNS)
    .eq('id', organizationId)
    .eq('is_demo', true)
    .maybeSingle()
  if (error) throw error
  return data ? platformOwnerMembership(data) : null
}

// The Platform Owner's own Demo: a real Demo organization with the same data
// pack as the evaluators' Demos (created and filled the first time).
export async function openPlatformOwnerDemo() {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')
  const { data, error } = await supabase.rpc('platform_open_owner_demo')
  if (error) throw error
  return data
}

// What the signed-in evaluator may know about their own Demos (dates, state, open).
export async function loadCurrentDemoAccess() {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('current_demo_access')
  if (error) throw error
  return Array.isArray(data) ? data : []
}

export async function createPlatformOrganization({ name, code, type = 'hospital', status = 'active', region = null, healthRegion = null, city = null, country = '', contactEmail = null, contactPhone = null, bedCapacity = null }) {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')
  const { data, error } = await supabase
    .from('organizations')
    .insert({ name: name.trim(), code: code.trim().toUpperCase(), type, status, region: region || null, health_region: healthRegion || null, city: city || null, country: countryOrDefault(country), contact_email: contactEmail || null, contact_phone: contactPhone || null, bed_capacity: bedCapacity ? Number(bedCapacity) : null, is_demo: false })
    .select('id, name, code, type, status, region, health_region, city, country, contact_email, contact_phone, bed_capacity, paused_at, is_demo, operating_profile, enabled_addons, enabled_modules, idle_lock_minutes, branding')
    .single()
  if (error) throw error
  return data
}

export async function createOrganizationUser({ organizationId, fullName, role, email = null }) {
  return invokeAuthenticatedFunction('create-organization-user', { organizationId, fullName: fullName.trim(), role, email })
}

export async function listPlatformOrganizationMembers() {
  if (isOwnerPreview()) return previewPlatformMembers()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('organization_members')
    .select('id, organization_id, user_id, role, status, organization:organizations(id,name,code,is_demo)')
  if (error) throw error
  return (data ?? []).filter((membership) => !membership.organization?.is_demo)
}

export async function listPlatformDemos() {
  if (isOwnerPreview()) return previewDemos()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('platform_demo_entitlements')
    .select('id,label,contact_name,contact_email,valid_from,valid_until,status,organization_id,demo_user_id,organization:organizations(id,name,code,is_demo)')
    .neq('status', 'revoked')
    .order('valid_until', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function updatePlatformDemoEntitlement(demoId, patch) {
  if (!supabase || !demoId) throw new Error('SUPABASE_NOT_CONFIGURED')
  const payload = {}
  if (patch.label !== undefined) payload.label = String(patch.label || '').trim()
  if (patch.contactName !== undefined || patch.contact_name !== undefined) payload.contact_name = patch.contactName ?? patch.contact_name ?? null
  if (patch.contactEmail !== undefined || patch.contact_email !== undefined) payload.contact_email = String(patch.contactEmail ?? patch.contact_email ?? '').trim().toLowerCase() || null
  if (patch.validFrom !== undefined || patch.valid_from !== undefined) payload.valid_from = patch.validFrom ?? patch.valid_from
  if (patch.validUntil !== undefined || patch.valid_until !== undefined) payload.valid_until = patch.validUntil ?? patch.valid_until
  if (patch.status !== undefined) payload.status = patch.status
  payload.updated_at = new Date().toISOString()
  const { data, error } = await supabase.from('platform_demo_entitlements').update(payload).eq('id', demoId).select('id,label,contact_name,contact_email,valid_from,valid_until,status,organization_id,demo_user_id,organization:organizations(id,name,code,is_demo)').single()
  if (error) throw error
  return data
}

export async function setPlatformDemoStatus(demoId, status) {
  if (!['active', 'paused', 'expired', 'revoked'].includes(status)) throw new Error('INVALID_DEMO_STATUS')
  return updatePlatformDemoEntitlement(demoId, { status })
}

export async function resetPlatformDemoPassword(demo) {
  if (!demo?.organization_id || !demo?.demo_user_id) throw new Error('DEMO_ACCOUNT_NOT_LINKED')
  return manageOrganizationUser({ organizationId: demo.organization_id, userId: demo.demo_user_id, action: 'reset_password' })
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
    country: countryOrDefault(patch.country), contact_email: patch.contactEmail ?? patch.contact_email ?? null,
    contact_phone: patch.contactPhone ?? patch.contact_phone ?? null, bed_capacity: patch.bedCapacity === '' ? null : Number(patch.bedCapacity ?? patch.bed_capacity ?? 0) || null,
    updated_at: new Date().toISOString(),
  }
  if (patch.operatingProfile !== undefined) payload.operating_profile = patch.operatingProfile
  if (patch.enabledAddons !== undefined) payload.enabled_addons = patch.enabledAddons
  if (patch.enabledModules !== undefined) payload.enabled_modules = patch.enabledModules
  const { data, error } = await supabase.from('organizations').update(payload).eq('id', organizationId).eq('is_demo', false).select().single()
  if (error) throw error
  return data
}

export async function listOrganizationMembersDetailed(organizationId) {
  if (isOwnerPreview()) return previewOrganizationMembers(organizationId)
  if (!supabase || !organizationId) return []
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

// What deleting these organizations would remove (rows, files, accounts) and
// what blocks it (a real organization that is not suspended, child organizations).
export async function getOrganizationDeletionImpact(organizationIds) {
  const ids = [...new Set((organizationIds || []).filter(Boolean))]
  if (!ids.length) return []
  if (isOwnerPreview()) return previewDeletionImpact(ids)
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')
  const { data, error } = await supabase.rpc('platform_organization_deletion_impact', { p_organization_ids: ids })
  if (error) throw error
  return Array.isArray(data) ? data : []
}

// Clears a Demo organization's data and writes the Demo data pack again
// (Platform Owner; the database refuses any organization that is not a Demo).
export async function resetPlatformDemoData(organizationId) {
  if (!organizationId) throw new Error('DEMO_ORGANIZATION_REQUIRED')
  if (isOwnerPreview()) return previewDemoSeedResult()
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')
  const { data, error } = await supabase.rpc('platform_reset_demo_organization', { p_organization_id: organizationId })
  if (error) throw error
  return data
}

// The only delete path: the Edge Function re-checks the owner's password and
// removes data, files and accounts. Several organizations = Demo only.
export async function deletePlatformOrganizations({ organizationIds, password, confirmation }) {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')
  return invokeAuthenticatedFunction('platform-delete-organizations', { organizationIds, password, confirmation })
}

export async function createPlatformDemoEntitlement(payload) {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')
  if (!payload.contactEmail) throw new Error('DEMO_EMAIL_REQUIRED')
  const data = await invokeAuthenticatedFunction('create-demo-access', { ...payload, country: countryOrDefault(payload.country) })
  return data.entitlement || data
}

export async function convertDemoEntitlementToOrganization(demoId, organizationDraft) {
  const org = await createPlatformOrganization(organizationDraft)
  if (supabase) await supabase.from('platform_demo_entitlements').update({ status: 'revoked', updated_at: new Date().toISOString() }).eq('id', demoId)
  return org
}
// Platform Owner only (RLS): which modules the organization uses.
export async function setOrganizationOperatingProfile(organizationId, { profile, addons, modules }) {
  if (!supabase || !organizationId) throw new Error('SUPABASE_NOT_CONFIGURED')
  const { data, error } = await supabase.from('organizations')
    .update({ operating_profile: profile, enabled_addons: addons, enabled_modules: modules, updated_at: new Date().toISOString() })
    .eq('id', organizationId).eq('is_demo', false)
    .select('id, operating_profile, enabled_addons, enabled_modules').single()
  if (error) throw error
  return data
}
