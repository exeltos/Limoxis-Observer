import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { rosterPeriod } from '../src/features/rosters/rosterService'

// The department's shift roster (owner, 8/11/2026): the IASO payroll period and who may write it.
describe('roster period and access', () => {
  it('runs from the 21st of a month to the 20th of the next', () => {
    expect(rosterPeriod(new Date(2026, 10, 8))).toEqual({ start: '2026-10-21', end: '2026-11-20' })
    expect(rosterPeriod(new Date(2026, 10, 25))).toEqual({ start: '2026-11-21', end: '2026-12-20' })
    expect(rosterPeriod(new Date(2026, 11, 22), 1)).toEqual({ start: '2027-01-21', end: '2027-02-20' })
    expect(rosterPeriod(new Date(2026, 0, 5), -1)).toEqual({ start: '2025-11-21', end: '2025-12-20' })
  })
  it('is written by the department manager of the department, the administrator or the HR office; read by the department', () => {
    const sql = readFileSync('supabase/migrations/20261231260100_department_rosters.sql', 'utf8')
    expect(sql).toContain("current_user_has_org_role(organization_id, array['department_manager']::public.app_role[])\n        and public.current_user_has_department_scope(organization_id, department_id)")
    expect(sql).toContain('public.current_user_has_department_scope(organization_id, department_id)\n  );')
    expect(sql).toContain('revoke all on public.department_rosters from anon')
  })
})

describe('roster members (owner, 8/11/2026)', () => {
  it('knows the head of the department and always puts them first', async () => {
    const { headsFirst, isDepartmentHead } = await import('../src/features/rosters/rosterService')
    expect(isDepartmentHead('Προϊστάμενος/η Τμήματος')).toBe(true)
    expect(isDepartmentHead('Head of Department (Nursing)')).toBe(true)
    expect(isDepartmentHead('Νοσηλευτής/τρια ΜΕΘ')).toBe(false)
    expect(headsFirst([{ name: 'a' }, { name: 'h', isHead: true }, { name: 'b' }]).map(m => m.name)).toEqual(['h', 'a', 'b'])
  })
})

describe('employee record: status and free job position (owner, 8/11/2026)', () => {
  it('names the «leave» status and lets status, category and position be edited', () => {
    expect(readFileSync('src/core/i18n/stringsEl.js', 'utf8')).toContain("leave:'Σε άδεια'")
    expect(readFileSync('src/core/i18n/stringsEn.js', 'utf8')).toContain("leave:'On leave'")
    const page = readFileSync('src/features/employees/EmployeeRecordPage.jsx', 'utf8')
    expect(page).toContain("options={['active', 'leave', 'inactive'].map(value => ({ value, label: t(value) }))}")
    expect(page).not.toContain('<input value={t(employee.employmentStatus)} disabled readOnly />')
    expect(page.match(/allowCustom\n/g)?.length).toBe(2)
  })
})
