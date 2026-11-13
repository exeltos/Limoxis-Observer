import { describe, expect, it } from 'vitest'
import { rosterPeriod } from '../src/features/rosters/rosterService'
import type { RosterMember } from '../src/features/rosters/rosterService'
import { readSource } from './helpers/readSource'
import { readEmployeeRecordPageSource } from './helpers/employeeRecordPageSource'

// The department's shift roster (owner, 8/11/2026): the IASO payroll period and who may write it.
describe('roster period and access', () => {
  it('runs from the 21st of a month to the 20th of the next', () => {
    expect(rosterPeriod(new Date(2026, 10, 8))).toEqual({ start: '2026-10-21', end: '2026-11-20' })
    expect(rosterPeriod(new Date(2026, 10, 25))).toEqual({ start: '2026-11-21', end: '2026-12-20' })
    expect(rosterPeriod(new Date(2026, 11, 22), 1)).toEqual({ start: '2027-01-21', end: '2027-02-20' })
    expect(rosterPeriod(new Date(2026, 0, 5), -1)).toEqual({ start: '2025-11-21', end: '2025-12-20' })
  })
  it('is written by the department manager of the department, the administrator or the HR office; read by the department', () => {
    const sql = readSource('supabase/migrations/20261231260100_department_rosters.sql')
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
    expect(headsFirst([{ name: 'a' }, { name: 'h', isHead: true }, { name: 'b' }] as RosterMember[]).map(m => m.name)).toEqual(['h', 'a', 'b'])
  })
})

describe('employee record: status and free job position (owner, 8/11/2026)', () => {
  it('names the «leave» status and lets status, category and position be edited', () => {
    expect(readSource('src/core/i18n/stringsEl.js')).toContain("leave:'Σε άδεια'")
    expect(readSource('src/core/i18n/stringsEn.js')).toContain("leave:'On leave'")
    const page = readEmployeeRecordPageSource()
    expect(page).toContain("options={['active', 'leave', 'inactive'].map(value => ({ value, label: t(value) }))}")
    expect(page).not.toContain('<input value={t(employee.employmentStatus)} disabled readOnly />')
    expect(page.match(/allowCustom\n/g)?.length).toBe(2)
  })
})

describe('the head of the department (owner, 8/11/2026)', () => {
  it('comes from the hand-set mark, then the manager role, then the position', async () => {
    const { markHeads } = await import('../src/features/rosters/rosterService')
    const members = [
      { employeeId: 'a', name: 'A', userId: 'u-a' },
      { employeeId: 'b', name: 'B', userId: 'u-b' },
      { employeeId: 'c', name: 'C', isHead: true },
      { employeeId: 'd', name: 'D', userId: 'u-d', headSet: false },
    ]
    const marked = markHeads(members, ['u-b', 'u-d'])
    expect(marked.filter(m => m.isHead).map(m => m.employeeId)).toEqual(['b', 'c'])
    expect(marked[0].employeeId).toBe('b')
    expect(markHeads(members, [], 'u-a').find(m => m.employeeId === 'a').isHead).toBe(true)
  })
})

describe('shift codes (owner, 8/11/2026)', () => {
  it('shows the ΙΑΣΩ payroll numbers in ΙΑΣΩ and letters elsewhere, chosen per department', () => {
    const page = readSource('src/features/rosters/RostersPage.jsx')
    expect(page).toContain("roster?.rules?.codes || (/ΙΑΣΩ|IASO/i.test(tenant?.name || '') ? 'iaso' : 'letters')")
    for (const code of ["'4'", "'12'", "'19'", "'20'", "'Α'", "'Γ'", "'Κ'", "'B'"]) expect(page).toContain(code)
  })
})

describe('who is on the department’s roster (owner, 9/11/2026)', () => {
  it('leaves physicians out and puts people inactive or on leave in the register below', async () => {
    const { isPhysician, notAtWork } = await import('../src/features/rosters/rosterService')
    expect(isPhysician({ profession: 'Ιατρός' })).toBe(true)
    expect(isPhysician({ staffCategory: 'physician' })).toBe(true)
    expect(isPhysician({ profession: '260 ΝΟΣΗΛΕΥΤΗΣ/ΡΙΑ ΑΕΙ' })).toBe(false)
    expect(notAtWork({ employmentStatus: 'leave' })).toBe(true)
    expect(notAtWork({ employmentStatus: 'inactive' })).toBe(true)
    expect(notAtWork({ employmentStatus: 'active' })).toBe(false)
  })
})
