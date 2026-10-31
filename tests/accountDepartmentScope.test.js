import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { DEPARTMENT_ROLES, resolveMemberDepartment, setMemberDepartment } from '../supabase/functions/_shared/organizationAccount.ts'

// A department role sees only its department (organization_member_scopes): an account
// created or changed without one saw nothing. The server settles it with the role.

// A minimal admin client over in-memory tables, enough for the helpers.
function fakeAdmin(tables) {
  const log = []
  const from = table => {
    const filters = []
    const query = {
      select: () => query,
      eq: (column, value) => { filters.push([column, value]); return query },
      maybeSingle: async () => ({ data: (tables[table] || []).find(row => filters.every(([c, v]) => row[c] === v)) || null, error: null }),
      delete: () => ({ eq: async (column, value) => { tables[table] = (tables[table] || []).filter(row => row[column] !== value); log.push(['delete', table]); return { error: null } } }),
      insert: async row => { (tables[table] ||= []).push(row); log.push(['insert', table, row]); return { error: null } },
    }
    return query
  }
  return { from, log, tables }
}

const ORG = 'org-1'
const base = () => ({
  departments: [{ id: 'dep-icu', organization_id: ORG, is_active: true }, { id: 'dep-old', organization_id: ORG, is_active: false }],
  employees: [{ id: 'emp-1', organization_id: ORG, department_id: 'dep-icu' }],
  organization_members: [{ id: 'mem-1', organization_id: ORG, user_id: 'user-1' }],
  organization_member_scopes: [{ membership_id: 'mem-1', department_id: 'dep-old' }],
})

describe('the department of an account', () => {
  it('the department roles are the three that see one department', () => {
    expect(DEPARTMENT_ROLES).toEqual(['department_manager', 'link_nurse', 'department_user'])
  })

  it('a department role takes the chosen department, else the employee’s own', async () => {
    const admin = fakeAdmin(base())
    expect(await resolveMemberDepartment(admin, { organizationId: ORG, role: 'department_user', departmentId: 'dep-icu' })).toEqual({ departmentId: 'dep-icu' })
    expect(await resolveMemberDepartment(admin, { organizationId: ORG, role: 'link_nurse', employeeDbId: 'emp-1' })).toEqual({ departmentId: 'dep-icu' })
  })

  it('refuses a department role without a department, or with one that is inactive or elsewhere', async () => {
    const admin = fakeAdmin(base())
    expect(await resolveMemberDepartment(admin, { organizationId: ORG, role: 'department_manager' })).toEqual({ error: 'DEPARTMENT_REQUIRED' })
    expect(await resolveMemberDepartment(admin, { organizationId: ORG, role: 'department_manager', departmentId: 'dep-old' })).toEqual({ error: 'DEPARTMENT_NOT_FOUND' })
    expect(await resolveMemberDepartment(admin, { organizationId: 'org-2', role: 'department_manager', departmentId: 'dep-icu' })).toEqual({ error: 'DEPARTMENT_NOT_FOUND' })
  })

  it('any other role needs no department', async () => {
    expect(await resolveMemberDepartment(fakeAdmin(base()), { organizationId: ORG, role: 'laboratory' })).toEqual({ departmentId: null })
  })

  it('the member keeps exactly the department given, or none', async () => {
    const admin = fakeAdmin(base())
    await setMemberDepartment(admin, { organizationId: ORG, userId: 'user-1', departmentId: 'dep-icu' })
    expect(admin.tables.organization_member_scopes).toEqual([{ membership_id: 'mem-1', department_id: 'dep-icu' }])
    await setMemberDepartment(admin, { organizationId: ORG, userId: 'user-1', departmentId: null })
    expect(admin.tables.organization_member_scopes).toEqual([])
  })

  it('creating, changing the role and re-inviting all set the department', () => {
    const create = fs.readFileSync('supabase/functions/create-organization-user/index.ts', 'utf8')
    const manage = fs.readFileSync('supabase/functions/manage-organization-user/index.ts', 'utf8')
    expect(create.indexOf('resolveMemberDepartment(')).toBeLessThan(create.indexOf('inviteUserByEmail('))
    expect(create.match(/setMemberDepartment\(/g)).toHaveLength(2)
    expect(manage).toContain('resolveMemberDepartment(admin,{organizationId,role:nextRole')
    expect(manage).toContain("setMemberDepartment(admin,{organizationId,userId:newUserId,departmentId:keptDepartments[0]||null})")
  })
})
