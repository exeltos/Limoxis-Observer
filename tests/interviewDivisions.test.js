import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { categoriesOf, divisionOfCategory, hasDisagreement, opinionProblems, roleKindLabel, stanceLabel } from '../src/features/interviews/divisionsModel'
import { CAPABILITIES, ROLES, can } from '../src/core/permissions/roles'
import { roleLabel } from '../src/core/permissions/roleLabels'

const read = path => fs.readFileSync(path, 'utf8')

describe('interviews: opinions per role', () => {
  it('flags a disagreement only between submitted opinions of different groups', () => {
    const mk = (stance, submittedAt = '2026-11-01') => ({ stance, submittedAt })
    expect(hasDisagreement([mk('propose'), mk('approve')])).toBe(false)
    expect(hasDisagreement([mk('propose'), mk('reject')])).toBe(true)
    expect(hasDisagreement([mk('propose'), mk('reserve')])).toBe(true)
    expect(hasDisagreement([mk('propose'), mk('reject', null)])).toBe(false)
    expect(hasDisagreement([])).toBe(false)
  })

  it('needs a stance to submit and names the roles', () => {
    expect(opinionProblems({ stance: '' })).toHaveLength(1)
    expect(opinionProblems({ stance: 'reserve' })).toEqual([])
    expect(stanceLabel('approve')).toBe('Εγκρίνω')
    expect(stanceLabel('reject', 'en')).toBe('Reject')
    expect(roleKindLabel('hr_office', '', 'el')).toBe('Γραφείο Προσωπικού')
    expect(roleKindLabel('division', 'Νοσηλευτική Υπηρεσία')).toBe('Νοσηλευτική Υπηρεσία')
  })

  it('offers the categories already mapped or used, and finds the division of a category', () => {
    const divisions = [{ id: 'a', name: 'Νοσηλευτική', categories: ['Νοσηλευτής'] }, { id: 'b', name: 'Λειτουργιών', categories: ['Τεχνικός'] }]
    expect(categoriesOf([{ professionalCategory: 'Μάγειρας' }, { professionalCategory: '' }], divisions)).toEqual(['Μάγειρας', 'Νοσηλευτής', 'Τεχνικός'])
    expect(divisionOfCategory('Τεχνικός', divisions)?.id).toBe('b')
    expect(divisionOfCategory('Άλλο', divisions)).toBeNull()
  })
})

describe('interviews: the Division Director role', () => {
  it('sees only the division candidates, never the whole interviews register', () => {
    expect(ROLES.DIVISION_DIRECTOR).toBe('division_director')
    expect(can(ROLES.DIVISION_DIRECTOR, CAPABILITIES.VIEW_DIVISION_INTERVIEWS)).toBe(true)
    expect(can(ROLES.DIVISION_DIRECTOR, CAPABILITIES.VIEW_INTERVIEWS)).toBe(false)
    expect(can(ROLES.DIVISION_DIRECTOR, CAPABILITIES.MANAGE_INTERVIEWS)).toBe(false)
    expect(roleLabel('division_director')).toBe('Διευθυντής Διεύθυνσης')
  })

  it('is created by the account functions', () => {
    expect(read('supabase/functions/_shared/organizationAccount.ts')).toContain("'division_director'")
    expect(read('supabase/functions/manage-organization-user/index.ts')).toContain('division_director:')
  })

  it('keeps the register behind the HR capabilities and gives the director functions only', () => {
    const sql = read('supabase/migrations/20261231190100_interview_divisions_opinions.sql')
    expect(sql).toContain('create or replace function public.hr_division_candidates')
    expect(sql).toContain('create or replace function public.hr_candidate_opinions')
    expect(sql).toContain('create or replace function public.hr_save_opinion')
    // No policy of the opinions table for people; the division director gets no table policy at all.
    expect(sql).not.toMatch(/create policy[^;]*hr_interview_opinions/)
    expect(sql).not.toContain("'division_director'\n") // the role is read only through private.hr_my_divisions
    const projection = sql.slice(sql.indexOf('create or replace function public.hr_division_candidates'), sql.indexOf('create or replace function public.hr_candidate_opinions'))
    for (const hidden of ['id_number', 'father_name', 'birth_date', 'phone_mobile', 'email', 'address', 'marital_status']) expect(projection, hidden).not.toContain(`c.${hidden}`)
  })
})
