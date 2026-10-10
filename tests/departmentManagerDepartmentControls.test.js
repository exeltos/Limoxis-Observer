import { describe, it, expect } from 'vitest'
import fs from 'node:fs'

const migration = fs.readFileSync('supabase/migrations/20261025120000_department_manager_department_controls.sql', 'utf8')
const controlsPage = fs.readFileSync('src/features/controls/ControlsPage.jsx', 'utf8')
const policy = name => migration.slice(migration.indexOf(`alter policy ${name} `), migration.indexOf(');\n', migration.indexOf(`alter policy ${name} `)))

describe('department managers maintain their own department\'s controls in the database', () => {
  it('the scope the application writes for a department manager is the one the policies accept', () => {
    expect(controlsPage).toContain("createdByScope:'department',createdForDepartment:ownDepartment")
    expect(migration).toContain("response_config -> '__meta' ->> 'createdByScope' = 'department'")
  })

  it('keeps manage_controls as the first alternative of every changed policy', () => {
    for (const name of ['control_definitions_insert', 'control_definitions_update', 'control_assignments_insert', 'control_assignments_update']) {
      expect(policy(name)).toContain("public.current_user_has_capability(organization_id, 'manage_controls')")
    }
  })

  it('a department manager can update a control only while every assignment is in their departments', () => {
    expect(migration).toContain('and not public.current_user_has_department_scope(target_org, a.department_id)')
    expect(policy('control_definitions_update')).toContain('public.current_user_manages_department_control(organization_id, id)')
  })

  it('assignments are limited to the manager\'s own departments', () => {
    expect(policy('control_assignments_insert')).toContain('public.current_user_has_department_scope(organization_id, department_id)')
    expect(policy('control_assignments_update')).toContain('public.current_user_has_department_scope(organization_id, department_id)')
  })

  it('deleting stays with manage_controls, and the policies are altered, not recreated', () => {
    expect(migration).not.toMatch(/alter policy control_(definitions|assignments)_delete/)
    expect(migration).not.toMatch(/drop policy/i)
  })

  it('the helper sees every assignment (SECURITY DEFINER) and is declared', () => {
    const manifest = JSON.parse(fs.readFileSync('supabase/security-definer-manifest.json', 'utf8'))
    expect(migration).toMatch(/current_user_manages_department_control\(target_org uuid, target_control uuid\)\s+returns boolean\s+language sql\s+stable\s+security definer/)
    expect(manifest.functions.current_user_manages_department_control).toMatchObject({ category: 'rls-helper', authenticated: true })
  })
})
