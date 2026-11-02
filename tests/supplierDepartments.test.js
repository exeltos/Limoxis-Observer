import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { newSupplier } from '../src/features/quality/resources/resourceModel'

const SQL = fs.readFileSync('supabase/migrations/20261212100000_quality_supplier_departments.sql', 'utf8')
const read = file => fs.readFileSync(file, 'utf8')

describe('Suppliers by department', () => {
  it('keeps the departments on the supplier and saves only real department ids', () => {
    expect(newSupplier().departmentIds).toEqual([])
    const service = read('src/features/quality/resources/resourceService.js')
    expect(service).toContain("departmentIds: row.department_ids || []")
    expect(service).toContain('department_ids: (supplier.departmentIds || []).filter(isUuid)')
  })

  it('lets a department read its own suppliers, evaluations and certificates in the database, and nothing else of them', () => {
    expect(SQL).toMatch(/add column if not exists department_ids uuid\[\] not null default '\{\}'/)
    expect(SQL).toMatch(/create policy quality_suppliers_department_read on public\.quality_suppliers\s+for select/)
    expect(SQL).toContain('private.current_user_department_scopes()')
    expect(SQL).toMatch(/create policy quality_supplier_evaluations_department_read[\s\S]*for select/)
    expect(SQL).toMatch(/create policy quality_supplier_certifications_department_read[\s\S]*for select/)
    // Contacts and nonconformities stay with Quality; the migration drops and alters no policy.
    expect(SQL).not.toMatch(/quality_supplier_(contacts|nonconformities)/)
    expect(SQL).not.toMatch(/\bdrop\b|alter policy/i)
  })

  it('has a read-only page and a menu entry for the department roles only', () => {
    const nav = read('src/app/navigation.js')
    expect(nav).toMatch(/to:'\/my-department\/suppliers'[^\n]*roles:\[ROLES\.DEPARTMENT_MANAGER,ROLES\.DEPARTMENT_USER,ROLES\.LINK_NURSE\]/)
    expect(read('src/app/App.jsx')).toMatch(/path="my-department\/suppliers" element=\{gate\(CAPABILITIES\.VIEW_MY_DEPARTMENT/)
  })
})
