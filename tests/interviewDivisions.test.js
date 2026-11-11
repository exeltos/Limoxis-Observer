import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { DIVISION_CANDIDATE_FIELDS } from '../src/features/interviews/divisionsModel'
import { PROFESSIONAL_CATEGORIES, categoryLabel } from '../src/features/interviews/interviewsModel'
import { cleanApplication, newApplication } from '../src/features/interviews/applicationModel'
import { CAPABILITIES, ROLES, can } from '../src/core/permissions/roles'
import { roleLabel } from '../src/core/permissions/roleLabels'

const read = path => fs.readFileSync(path, 'utf8')

describe('interviews: fixed list of categories on the tablet', () => {
  it('offers one fixed list and keeps only a value from it', () => {
    expect(Object.keys(PROFESSIONAL_CATEGORIES)).toEqual(['nursing', 'medical', 'paramedical', 'administrative', 'technical', 'support', 'other'])
    expect(categoryLabel('nursing')).toBe('Νοσηλευτικό')
    expect(categoryLabel('nursing', 'en')).toBe('Nursing')
    expect(categoryLabel('')).toBe('')
    const draft = { ...newApplication(), professionalCategory: 'nursing' }
    expect(cleanApplication(draft).professionalCategory).toBe('nursing')
    expect(cleanApplication({ ...draft, professionalCategory: 'hacker' }).professionalCategory).toBe('')
  })

  it('is stored by the tablet function, from the same list', () => {
    const sql = read('supabase/migrations/20261231200000_hr_application_professional_category.sql')
    for (const key of Object.keys(PROFESSIONAL_CATEGORIES)) expect(sql).toContain(`'${key}'`)
    expect(read('src/features/interviews/apply/ApplicationPage.jsx')).toContain('professionalCategory')
  })
})

describe('interviews: the Division Director role', () => {
  it('sees only the division candidates, never the whole interviews register', () => {
    expect(ROLES.DIVISION_DIRECTOR).toBe('division_director')
    expect(can(ROLES.DIVISION_DIRECTOR, CAPABILITIES.VIEW_DIVISION_INTERVIEWS)).toBe(true)
    expect(can(ROLES.DIVISION_DIRECTOR, CAPABILITIES.VIEW_INTERVIEWS)).toBe(false)
    expect(can(ROLES.DIVISION_DIRECTOR, CAPABILITIES.MANAGE_INTERVIEWS)).toBe(false)
    expect(roleLabel('division_director')).toBe('Διευθυντής Διεύθυνσης')
    expect(DIVISION_CANDIDATE_FIELDS).not.toContain('idNumber')
  })

  it('is created by the account functions', () => {
    expect(read('supabase/functions/_shared/organizationAccount.ts')).toContain("'division_director'")
    expect(read('supabase/functions/manage-organization-user/index.ts')).toContain('division_director:')
  })

  it('gets the candidates through a function that returns no identity, family, health or contact data', () => {
    const sql = read('supabase/migrations/20261231190100_interview_divisions_opinions.sql')
    expect(sql).toContain('create or replace function public.hr_division_candidates')
    expect(sql).not.toMatch(/create policy[^;]*hr_interview_opinions/)
    const projection = sql.slice(sql.indexOf('create or replace function public.hr_division_candidates'), sql.indexOf('create or replace function public.hr_candidate_opinions'))
    for (const hidden of ['id_number', 'father_name', 'birth_date', 'phone_mobile', 'email', 'address', 'marital_status']) expect(projection, hidden).not.toContain(`c.${hidden}`)
  })
})

describe('divisions with departments (phase 1, 11/11/2026)', () => {
  const sql = read('supabase/migrations/20261231290000_division_departments.sql')

  it('links a division to departments and keeps a division director\'s department scopes in step, only for the scopes it granted', () => {
    expect(sql).toContain('create table if not exists public.hr_division_departments')
    expect(sql).toContain('granted_by_division boolean not null default false')
    expect(sql).toContain("v_role = 'division_director'")
    // only the scopes the divisions granted are removed; a scope given by hand is never touched
    expect(sql).toMatch(/delete from public\.organization_member_scopes s\s+where s\.membership_id = v_membership\s+and s\.granted_by_division/)
    for (const trigger of ['hr_division_members_sync_scopes', 'hr_division_departments_sync_scopes', 'organization_members_sync_division_scopes', 'hr_division_departments_check_organization']) expect(sql).toContain(trigger)
  })

  it('adds only: no existing policy is changed, the new table is read by the interviews capabilities and closed to anonymous visitors', () => {
    expect(sql).not.toMatch(/alter policy|drop policy|drop table|revoke .* from authenticated/i)
    expect(sql).toContain('revoke all on public.hr_division_departments from anon')
    expect(sql).toContain("current_user_has_capability(organization_id, 'manage_interviews')")
  })

  it('saves the departments of a division and shows the departments an overseeing director has on the home screen', () => {
    const service = read('src/features/interviews/interviewsService.js')
    expect(service).toContain("from('hr_division_departments')")
    const screen = read('src/features/interviews/InterviewDivisions.jsx')
    expect(screen).toContain("'Τμήματα της διεύθυνσης'")
    const home = read('src/features/dashboard/DashboardPage.jsx')
    expect(home).toContain('ROLES.DIVISION_DIRECTOR')
    expect(home).toContain('dashboard-my-departments')
  })
})
