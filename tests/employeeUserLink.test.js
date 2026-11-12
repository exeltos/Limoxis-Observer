import {describe,expect,it} from 'vitest'
import { readSource } from './helpers/readSource'
const employeeService=readSource(new URL('../src/features/employees/employeeService.js',import.meta.url))
// The account pieces of create-organization-user live in _shared/organizationAccount.ts (shared with the bulk creation).
const createUser=readSource(new URL('../supabase/functions/create-organization-user/index.ts',import.meta.url))+readSource(new URL('../supabase/functions/_shared/organizationAccount.ts',import.meta.url))
const migration=readSource(new URL('../supabase/migrations/20260901221306_link_employees_to_user_accounts.sql',import.meta.url))

describe('employee to user account linkage',()=>{
  it('projects explicit user_id from employees',()=>{
    expect(employeeService).toContain('user_id')
    expect(employeeService).toContain('accountLinked: Boolean(row.user_id)')
  })
  it('creates an account for a known employee id',()=>{
    expect(employeeService).toContain('createEmployeeAccountAsync')
    expect(employeeService).toContain('employeeDbId:employee.dbId')
    expect(createUser).toContain('EMPLOYEE_ALREADY_LINKED_TO_ANOTHER_ACCOUNT')
  })
  it('supports account plus employee creation from user management',()=>{
    expect(createUser).toContain("if(!employee?.create)return null")
    expect(createUser).toContain('employee_code:employeeCode')
    expect(createUser).toContain('user_id:userId')
  })
  it('enforces one employee link per organization account',()=>{
    expect(migration).toContain('employees_org_user_unique')
    expect(migration).toContain('where user_id is not null')
  })
})
