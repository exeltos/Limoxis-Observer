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
