import { describe, expect, it } from 'vitest'
import { readSource } from './helpers/readSource'

const raw = readSource('supabase/migrations/20261231622000_control_calendar_monthly.sql')
const sql = raw.replace(/^\s*--.*$/gm, '')

// The body of one function, from its create statement to the closing $function$.
function body(name: string) {
  const start = sql.indexOf(`create or replace function ${name}(`)
  expect(start, name).toBeGreaterThan(-1)
  const open = sql.indexOf('$function$', start)
  const close = sql.indexOf('$function$', open + 1)
  return sql.slice(start, close)
}

describe('Control calendar: monthly summary of the stored marks', () => {
  it('keeps one row per organisation, assignment and Athens month, removed with them, read-only for signed-in users', () => {
    expect(sql).toContain('create table if not exists private.control_marks_monthly (')
    expect(sql).toContain('organization_id uuid not null references public.organizations(id) on delete cascade')
    expect(sql).toContain('assignment_id uuid not null references public.control_assignments(id) on delete cascade')
    expect(sql).toContain('primary key (assignment_id, month_start, organization_id)')
    expect(sql).toContain('alter table private.control_marks_monthly enable row level security;')
    expect(sql).toContain('grant select on private.control_marks_monthly to authenticated;')
    expect(sql).not.toMatch(/grant (insert|update|delete|all)[^;]*control_marks_monthly/i)
  })

  it('recomputes whole touched months from the store under the per-assignment lock, in statement-level triggers', () => {
    const sync = body('private.control_marks_monthly_sync')
    expect(sync).toMatch(/returns trigger\s+language plpgsql\s+security definer\s+set search_path to ''/)
    // Lock first, then read the store.
    expect(sync.indexOf('perform private.control_marks_lock(v_assignments);')).toBeGreaterThan(-1)
    expect(sync.indexOf('perform private.control_marks_lock(v_assignments);')).toBeLessThan(sync.indexOf('from private.control_execution_marks_store s'))
    expect(sync).toContain('s.eligible and s.counted')
    expect(sync).toContain("order by s.performed_at) as marks")
    // Old and new months of an update; nothing rewritten for a deleted organisation or assignment.
    expect(sync).toContain('from old_rows o')
    expect(sync).toContain('from new_rows n')
    expect(sync).toContain('join public.organizations o on o.id = k.organization_id')
    expect(sync).toContain('join public.control_assignments a on a.id = k.assignment_id')
    expect(sync).toContain('on conflict (assignment_id, month_start, organization_id) do update')
    for (const op of ['insert', 'update', 'delete']) {
      expect(sql).toMatch(new RegExp(`create trigger control_marks_store_monthly_${op} after ${op} on private\\.control_execution_marks_store\\s+referencing [^\\n]+\\s+for each statement execute function private\\.control_marks_monthly_sync\\(\\);`))
    }
  })

  it('keeps the signature, stays SECURITY INVOKER and falls back to the previous body outside Europe/Athens', () => {
    const fn = body('public.control_calendar_months')
    expect(fn).toContain("create or replace function public.control_calendar_months(p_organization_id uuid, p_year integer, p_time_zone text default 'UTC'::text)")
    expect(fn).toContain('returns table(assignment_id uuid, month integer, done bigint, late bigint, marks jsonb)')
    expect(fn).not.toMatch(/security definer/i)
    expect(fn).toContain("if p_time_zone is distinct from 'Europe/Athens'")
    expect(fn).toContain('and not o.ready) then')
    expect(fn).toContain('from private.control_execution_marks(p_organization_id, make_timestamptz(p_year, 1, 1, 0, 0, 0, p_time_zone)')
  })

  it('reads the summary only for whole months inside the read-time bounds (definition creation, now) and the rest from the store', () => {
    const fn = body('public.control_calendar_months')
    // Same visibility rule as control_execution_marks.
    expect(fn).toContain('join public.control_definitions d on d.id = a.control_id and d.organization_id = a.organization_id')
    expect(fn).toContain('(select true from public.control_executions e')
    expect(fn).toContain('s2.performed_at < d.created_at')
    expect(fn).toContain('s3.performed_at > now()')
    expect(fn).toContain('greatest(v_from, d.created_at) as lo')
    expect(fn).toContain('least(v_to, now()) as hi')
    expect(fn).toContain('and m.month_start >= v.full_from and m.month_start < v.full_to')
    expect(fn).toContain('and m.done > 0')
    expect(fn).toContain('and s.performed_at >= v.lo and s.performed_at <= v.hi')
    // Frequent controls keep '[]' as their marks.
    expect(fn).toContain("case when v.frequent then '[]'::jsonb else m.marks end")
  })

  it('backfills in the same migration and runs no forbidden statement', () => {
    expect(sql).toMatch(/create trigger control_marks_store_monthly_delete[\s\S]*insert into private\.control_marks_monthly as m[\s\S]*group by s\.organization_id, s\.assignment_id/)
    expect(sql).not.toMatch(/^\s*(drop|revoke|delete|truncate|alter policy)\b/im)
    expect(sql).not.toMatch(/;\s*(drop|revoke|delete|truncate)\b/i)
    const creates = sql.match(/create or replace function [^\n]*\n(?:[^\n]*\n){0,8}?as \$function\$/g) || []
    expect(creates.length).toBe(2)
    for (const create of creates) expect(create).toContain("set search_path to ''")
  })
})

describe('Control calendar: other time zones from the same monthly summary', () => {
  const zones = readSource('supabase/migrations/20261231625000_control_calendar_other_zones.sql').replace(/^\s*--.*$/gm, '')

  it('keeps the signature and SECURITY INVOKER, and runs the previous body only for a null zone or an organisation being rebuilt', () => {
    expect(zones).toContain("create or replace function public.control_calendar_months(p_organization_id uuid, p_year integer, p_time_zone text default 'UTC'::text)")
    expect(zones).toContain('returns table(assignment_id uuid, month integer, done bigint, late bigint, marks jsonb)')
    expect(zones).not.toMatch(/security definer/i)
    expect(zones).toContain('if p_time_zone is null\n     or exists (select 1 from private.control_marks_orgs o where o.organization_id = p_organization_id and not o.ready) then')
    expect(zones).toContain("if p_time_zone <> 'Europe/Athens' then")
  })

  it('adds the zone/Athens differences at the 13 month starts to the Athens summary, only for frequent controls inside the bounds', () => {
    expect(zones).toMatch(/create index if not exists control_execution_marks_store_org_time_idx on private\.control_execution_marks_store\s+\(organization_id, performed_at\)/)
    expect(zones).toContain('from generate_series(1, 13) g(b)')
    expect(zones).toContain("make_timestamptz(p_year + (g.b - 1) / 12, (g.b - 1) % 12 + 1, 1, 0, 0, 0, 'Europe/Athens') as ath_at")
    expect(zones).toContain('and s.performed_at >= least(g.tz_at, g.ath_at) and s.performed_at < greatest(g.tz_at, g.ath_at)) s')
    expect(zones).toContain('join vis v on v.assignment_id = w.assignment_id and v.clean and v.frequent')
    expect(zones).toContain('where p.b between 1 and 12')
    expect(zones).toContain('having sum(p.done) > 0')
    // Infrequent controls (their days in the zone) and controls with entries outside the bounds: from the store.
    expect(zones).toContain('where not (v.clean and v.frequent)')
    expect(zones).toContain('order by r.local_at)')
    expect(zones).not.toMatch(/^\s*(drop|revoke|delete|truncate|alter policy)\b/im)
  })
})
