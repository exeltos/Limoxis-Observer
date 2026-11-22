import { describe, expect, it } from 'vitest'
import { readSource } from './helpers/readSource'

const sql = readSource('supabase/migrations/20261231616000_control_calendar_speed.sql')

describe('Control calendar months speed', () => {
  it('adds the covering index in the order the marks are ranked (assignment, Athens day, time, id)', () => {
    expect(sql).toMatch(/create index if not exists control_executions_marks_idx on public\.control_executions\s+\(organization_id, assignment_id, \(\(performed_at at time zone 'Europe\/Athens'\)::date\), performed_at, id\)\s+include \(department_id\)\s+where status <> 'cancelled' and cancelled_at is null and not is_extra;/)
  })

  it('keeps the signature, stays security invoker and leaves control_execution_marks as it is', () => {
    expect(sql).toContain('create or replace function public.control_calendar_months(p_organization_id uuid, p_year integer, p_time_zone text default \'UTC\'::text)')
    expect(sql).toContain('returns table(assignment_id uuid, month integer, done bigint, late bigint, marks jsonb)')
    expect(sql).not.toMatch(/security definer/i)
    expect(sql).not.toMatch(/create or replace function private\.control_execution_marks/)
    expect(sql).not.toMatch(/\b(drop|revoke|delete)\b/i)
  })

  it('decides "frequent" once per assignment and builds the day list only for infrequent controls', () => {
    expect(sql).toContain('with freq as materialized (')
    expect(sql).toContain('where r.frequent is not true')
    expect(sql).toContain("case when c.frequent then '[]'::jsonb else k.marks end")
  })
})
