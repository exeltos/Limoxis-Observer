// Participation requests (owner, 20/11/2026): the table, its row-level security and the functions that write it
// (supabase/migrations/20261231606000_training_participation_requests.sql), read as text.
import { describe, expect, it } from 'vitest'
import { readSource } from './helpers/readSource'

const sql = readSource('supabase/migrations/20261231606000_training_participation_requests.sql')
const code = sql.replace(/--[^\n]*/g, '')
const between = (from: string, to: string) => sql.slice(sql.indexOf(from), to ? sql.indexOf(to) : undefined)
const request = between('create or replace function private.training_request_participation', 'create or replace function public.training_request_participation')
const decide = between('create or replace function private.training_decide_participation', 'create or replace function public.training_decide_participation')
const cancel = between('create or replace function private.training_cancel_participation_request', 'create or replace function public.training_cancel_participation_request')
const counts = between('create or replace function private.training_program_participation', 'create or replace function public.training_program_participation')

describe('the table', () => {
  it('belongs to a hospital and a programme, one request waiting per person and programme', () => {
    expect(sql).toContain('create table if not exists public.training_participation_requests (')
    expect(sql).toContain('organization_id uuid not null references public.organizations(id) on delete cascade')
    expect(sql).toContain('requester_user_id uuid not null default auth.uid()')
    expect(sql).toContain("status text not null default 'pending' check (status in ('pending','accepted','rejected','cancelled'))")
    expect(sql).toContain('foreign key (program_id, organization_id) references public.training_programs(id, organization_id) on delete cascade')
    expect(sql).toMatch(/create unique index if not exists training_participation_requests_pending_key\s+on public\.training_participation_requests \(program_id, requester_user_id\) where status = 'pending'/)
  })

  it('has row-level security: the own requests or manage_training, no write policy, and the module gate', () => {
    expect(sql).toContain('alter table public.training_participation_requests enable row level security;')
    expect(sql).toContain('create policy training_participation_requests_read on public.training_participation_requests for select to authenticated using (')
    expect(sql).toContain('requester_user_id = (select auth.uid())')
    expect(sql).toContain("private.fast_orgs_capability('manage_training')")
    expect(sql).toContain('create policy training_participation_requests_module_gate on public.training_participation_requests as restrictive for all to authenticated')
    expect(sql).toContain("private.current_user_locked_module_orgs(''{training}''::text[])")
    // Written only by the functions: no insert / update / delete policy, and only select granted.
    expect(code).not.toMatch(/create policy[^;]*for (insert|update|delete|all) to authenticated using \(\s*requester/i)
    expect(code.match(/create policy/g)?.length).toBe(2)
    expect(sql).toContain('grant select on public.training_participation_requests to authenticated;')
    expect(code).not.toMatch(/grant (insert|update|delete|all)[^;]*training_participation_requests/i)
  })

  it('only creates, creates or replaces, adds policies to the new table and grants', () => {
    // «on delete cascade / set null» of a foreign key is not a deletion.
    expect(code).not.toMatch(/\b(drop|revoke|alter policy|truncate)\b|(?<!on )\bdelete\b/i)
    expect(code.match(/alter table [^;]*/gi)).toEqual(['alter table public.training_participation_requests enable row level security'])
  })
})

describe('the functions', () => {
  const guarded = (body: string) => {
    expect(body).toContain('security definer')
    expect(body).toContain("set search_path to ''")
    expect(body).toContain('if auth.uid() is null then')
    expect(body).toContain('private.password_change_pending()')
    expect(body).toContain("'training' = any (coalesce(private.org_disabled_modules(")
  }

  it('the request: an active member, a programme of the hospital still open, not already assigned, nothing waiting', () => {
    guarded(request)
    expect(request).toContain("om.user_id = auth.uid() and om.organization_id = p_organization_id and om.status = 'active'")
    expect(request).toContain('p.organization_id = p_organization_id and p.program_key = p_program_key')
    expect(request).toContain("if v_program.status in ('cancelled', 'completed') then")
    expect(request).toContain("raise exception 'TRAINING_ALREADY_ASSIGNED'")
    expect(request).toContain("raise exception 'TRAINING_REQUEST_PENDING'")
    expect(request).toContain('values (p_organization_id, v_program.id, auth.uid(),')
  })

  it('the decision: manage_training in the request’s hospital, a reason to reject, the assignment on acceptance', () => {
    guarded(decide)
    expect(decide).toContain("public.current_user_has_capability(v_request.organization_id, 'manage_training')")
    expect(decide).toContain("raise exception 'TRAINING_REQUEST_ALREADY_DECIDED'")
    expect(decide).toContain("raise exception 'TRAINING_REQUEST_REASON_REQUIRED'")
    expect(decide).toContain('insert into public.training_assignments (organization_id, assignment_key, program_id, employee_code, employee_name, department_name,')
    expect(decide).toContain("'TRA-REQ-' || replace(v_request.id::text, '-', '')")
    expect(decide).toContain("v_program.due_date, 'assigned')")
    expect(decide).toContain("(now() at time zone 'Europe/Athens')::date")
    expect(decide).toContain("set status = 'accepted'")
  })

  it('the withdrawal: only the requester’s own request', () => {
    guarded(cancel)
    expect(cancel).toContain('r.id = p_request_id and r.requester_user_id = auth.uid()')
  })

  it('the participation: numbers per programme and department, for those who see training', () => {
    guarded(counts)
    expect(counts).toContain("public.current_user_has_capability(p_organization_id, 'view_training')")
    expect(counts).toContain('count(*)::integer')
    expect(counts).not.toMatch(/employee_name|employee_code|email/)
  })

  it('the API calls SECURITY INVOKER wrappers granted to the signed-in users only', () => {
    for (const [name, args, call] of [
      ['training_request_participation', 'uuid, text, text', 'private.training_request_participation(p_organization_id, p_program_key, p_note)'],
      ['training_decide_participation', 'uuid, boolean, text', 'private.training_decide_participation(p_request_id, p_accept, p_reason)'],
      ['training_cancel_participation_request', 'uuid', 'private.training_cancel_participation_request(p_request_id)'],
      ['training_program_participation', 'uuid', 'private.training_program_participation(p_organization_id)'],
    ]) {
      expect(sql).toMatch(new RegExp(`create or replace function public\\.${name}\\([^)]*\\)[\\s\\S]*?security invoker[\\s\\S]*?${call.replace(/[.()]/g, '\\$&')}`))
      expect(sql).toContain(`grant execute on function public.${name}(${args}) to authenticated;`)
      expect(sql).not.toMatch(new RegExp(`grant execute on function public\\.${name}[^;]*anon`))
    }
  })
})
