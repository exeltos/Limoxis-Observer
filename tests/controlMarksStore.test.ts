import { describe, expect, it } from 'vitest'
import { readSource } from './helpers/readSource'

const raw = readSource('supabase/migrations/20261231617000_control_marks_store.sql')
const sql = raw.replace(/^\s*--.*$/gm, '')

// The body of one function, from its create statement to the closing $function$.
function body(name: string) {
  const start = sql.indexOf(`create or replace function ${name}(`)
  expect(start, name).toBeGreaterThan(-1)
  const open = sql.indexOf('$function$', start)
  const close = sql.indexOf('$function$', open + 1)
  return sql.slice(start, close)
}

describe('Control marks store (stored on-time results)', () => {
  it('keeps one row per execution, removed with it (cascade FK), in the private schema, read-only for signed-in users', () => {
    expect(sql).toContain('create table if not exists private.control_execution_marks_store (')
    expect(sql).toContain('execution_id uuid primary key references public.control_executions(id) on delete cascade')
    expect(sql).toContain('alter table private.control_execution_marks_store enable row level security;')
    expect(sql).toContain('grant select on private.control_execution_marks_store to authenticated;')
    expect(sql).not.toMatch(/grant (insert|update|delete|all)[^;]*control_execution_marks_store/i)
    expect(sql).toMatch(/create index if not exists control_execution_marks_store_read_idx on private\.control_execution_marks_store\s+\(assignment_id, performed_at\)/)
  })

  it('keeps the signature of control_execution_marks, reads the store for Europe/Athens and falls back to the live computation otherwise', () => {
    const marks = body('private.control_execution_marks')
    expect(marks).toContain("create or replace function private.control_execution_marks(p_organization_id uuid, p_from timestamp with time zone, p_to timestamp with time zone, p_tz text default 'Europe/Athens'::text)")
    expect(marks).toContain('returns table(assignment_id uuid, performed_at timestamp with time zone, counted boolean, on_time boolean)')
    expect(marks).not.toMatch(/security definer/i)
    expect(marks).toContain("if p_tz is distinct from 'Europe/Athens'")
    expect(marks).toContain('and not o.ready) then')
    expect(marks).toContain('return query select * from private.control_execution_marks_live(p_organization_id, p_from, p_to, p_tz);')
    // Window edges at read time, as the live computation applies them.
    expect(marks).toContain('and s.performed_at >= greatest(p_from, v.created_at)')
    expect(marks).toContain('and s.performed_at <= least(p_to, now());')
    // Access: through the caller's RLS on assignments, definitions and executions.
    expect(marks).toContain('join public.control_definitions d on d.id = a.control_id and d.organization_id = a.organization_id')
    expect(marks).toContain('(select true from public.control_executions e')
  })

  it('keeps the previous body as control_execution_marks_live and offers a verification function', () => {
    const live = body('private.control_execution_marks_live')
    expect(live).toContain('row_number() over (partition by e.assignment_id, (e.performed_at at time zone p_tz)::date order by e.performed_at, e.id) as rk')
    expect(live).toContain('and e.performed_at <= least(p_to, now())) k')
    expect(live).not.toMatch(/control_execution_marks_store/)
    const verify = body('private.control_execution_marks_verify')
    expect(verify).toContain('except all')
    expect(verify).toContain('private.control_execution_marks_live(p_organization_id, p_from, p_to)')
  })

  it('computes with the same rules in Europe/Athens: rank per assignment and day by (performed_at, id), previous entry for non-daily', () => {
    const compute = body('private.control_marks_compute')
    expect(compute).not.toMatch(/security definer/i)
    expect(compute).toContain("(e.performed_at at time zone 'Europe/Athens')::date as local_day")
    expect(compute).toContain("(e.status <> 'cancelled' and e.cancelled_at is null and not e.is_extra) as eligible")
    expect(compute).toContain('row_number() over (partition by x.assignment_id, x.local_day, x.eligible order by x.performed_at, x.id) as rk')
    expect(compute).toContain("private.control_next_due(x.f,")
    expect(compute).toContain('on conflict (execution_id) do update')
  })

  it('maintains the store with SECURITY DEFINER triggers that pin search_path', () => {
    for (const name of ['private.control_execution_marks_sync', 'private.control_assignment_marks_sync', 'private.control_definition_marks_sync']) {
      const fn = body(name)
      expect(fn, name).toMatch(/returns trigger\s+language plpgsql\s+security definer\s+set search_path to ''/)
    }
    expect(sql).toContain('create trigger control_executions_marks_sync_insert after insert on public.control_executions')
    expect(sql).toContain('create trigger control_executions_marks_sync_update after update of performed_at, status, cancelled_at, is_extra, assignment_id, organization_id on public.control_executions')
    expect(sql).toContain('create trigger control_executions_marks_sync_delete after delete on public.control_executions')
    expect(sql).toContain('create trigger control_assignments_marks_sync after update of frequency_config, control_id on public.control_assignments')
    expect(sql).toContain('create trigger control_definitions_marks_sync after update of frequency_config on public.control_definitions')
    // Only the definer functions above; every function pins its search_path.
    expect((sql.match(/security definer/gi) || []).length).toBe(3)
    const creates = sql.match(/create or replace function [^\n]*\n(?:[^\n]*\n){0,8}?as \$function\$/g) || []
    expect(creates.length).toBe(7)
    for (const create of creates) expect(create).toContain("set search_path to ''")
  })

  it('backfills every organisation and runs no forbidden statement', () => {
    expect(sql).toMatch(/select private\.control_marks_compute\(o\.id\) from public\.organizations o;[\s\S]*create trigger[\s\S]*select private\.control_marks_compute\(o\.id\) from public\.organizations o;/)
    expect(sql).toContain('insert into private.control_marks_orgs as m (organization_id, ready, updated_at)')
    expect(sql).not.toMatch(/^\s*(drop|revoke|delete|truncate|alter policy)\b/im)
    expect(sql).not.toMatch(/;\s*(drop|revoke|delete|truncate)\b/i)
  })
})
