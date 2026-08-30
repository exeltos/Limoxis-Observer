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
    .select('id, name, code, type, status')
    .neq('status', 'deleted')
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
