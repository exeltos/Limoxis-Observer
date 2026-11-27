// The staff of a kitchen department take the kitchen's capabilities (owner, 27/11/2026).
import { describe, expect, it } from 'vitest'
import { kitchenDepartmentCapabilities } from '../src/core/permissions/kitchenDepartment'
import { can } from '../src/core/permissions/permissionEngine'
import { departmentKindValue } from '../src/features/management/managementCloudService'
import { readSource } from './helpers/readSource'

const kitchen = [{ department: { is_kitchen: true } }]
const ward = [{ department: { is_kitchen: false } }]

describe('kitchen department staff', () => {
  it('the Department Manager of a kitchen manages it, the Department User records, others nothing', () => {
    const manager = kitchenDepartmentCapabilities('department_manager', kitchen)
    expect(can('department_manager', 'manage_kitchen', [], manager)).toBe(true)
    const user = kitchenDepartmentCapabilities('department_user', kitchen)
    expect(can('department_user', 'record_kitchen', [], user)).toBe(true)
    expect(can('department_user', 'manage_kitchen', [], user)).toBe(false)
    expect(kitchenDepartmentCapabilities('department_manager', ward)).toEqual([])
    expect(kitchenDepartmentCapabilities('link_nurse', kitchen)).toEqual([])
    expect(kitchenDepartmentCapabilities('department_manager', [{ department: { is_kitchen: true, is_active: false } }])).toEqual([])
  })
  it('the editor offers «Κουζίνα (HACCP)» kept apart from the clinical department type', () => {
    expect(departmentKindValue('kitchen')).toBe('kitchen')
    expect(departmentKindValue('icu')).toBe('icu')
    expect(departmentKindValue('other')).toBe('general')
  })
  it('the database grants the same and the sign-off follows it', () => {
    const sql = readSource('supabase/migrations/20261231642000_kitchen_department_roles.sql')
    expect(sql).toContain('add column if not exists is_kitchen boolean not null default false')
    expect(sql).toMatch(/om\.role = 'department_manager' or \(om\.role = 'department_user' and p_level in \('view','record'\)\)/)
    expect(sql).toContain("not (p_org = any (private.current_user_kitchen_orgs('manage')))")
    expect(readSource('src/core/tenant/tenantService.ts')).toContain('department:departments(name, is_kitchen, is_active)')
    expect(readSource('supabase/migrations/20261231642100_kitchen_signoff_owner.sql')).toContain("not (public.current_user_is_platform_owner() or p_org = any (private.current_user_kitchen_orgs('manage')))")
  })
})
