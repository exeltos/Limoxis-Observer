import { describe, expect, it } from 'vitest'
import { readSource } from './helpers/readSource'

// «Ζητήστε παρουσίαση»: ο πίνακας demo_requests (μόνο ο Ιδιοκτήτης Πλατφόρμας), η submit_demo_request() για τον
// επισκέπτη χωρίς σύνδεση και η ειδοποίηση μέσω του notification_outbox / platform-scheduled-tasks.
const migration = readSource('supabase/migrations/20261231520000_demo_requests.sql')
const sql = migration.replace(/^\s*--.*$/gm, '').toLowerCase()
const manifest = JSON.parse(readSource('supabase/security-definer-manifest.json'))
const scheduled = readSource('supabase/functions/platform-scheduled-tasks/index.ts')
const email = readSource('supabase/functions/_shared/publicDemoRequestEmail.ts')

describe('demo_requests migration', () => {
  it('keeps the requests behind RLS, readable and changeable only by the Platform Owner', () => {
    expect(sql).toContain('create table if not exists public.demo_requests')
    for (const column of ['full_name', 'organization_name', 'role_title', 'email', 'phone', 'message', 'language', 'privacy_accepted_at', 'created_at']) expect(sql).toMatch(new RegExp(`\\n\\s+${column} `))
    expect(sql).toContain("status in ('new', 'contacted', 'closed')")
    expect(sql).toContain('alter table public.demo_requests enable row level security')
    expect(sql).toContain('create policy demo_requests_owner_read on public.demo_requests for select to authenticated')
    expect(sql).toContain('create policy demo_requests_owner_update on public.demo_requests for update to authenticated')
    expect(sql.match(/current_user_is_platform_owner\(\)/g)?.length).toBe(3)
    // Καμία πολιτική εισαγωγής ή για τον ανώνυμο: νέο αίτημα μόνο από τη συνάρτηση.
    expect(sql).not.toMatch(/for (insert|all)\b/)
    expect(sql).not.toMatch(/policy[^;]*\bto anon\b/)
  })

  it('takes the visitor request through a security definer function open to anon', () => {
    expect(sql).toContain('create or replace function public.submit_demo_request(')
    expect(sql).toContain('security definer')
    expect(sql).toContain("set search_path = ''")
    expect(sql).toContain('grant execute on function public.submit_demo_request(text, text, text, text, text, text, text, boolean, text) to anon, authenticated;')
    expect(manifest.functions?.submit_demo_request ?? manifest.submit_demo_request).toMatchObject({ category: 'public-token', anon: true, authenticated: true })
  })

  it('checks lengths, email and privacy, drops the trap quietly and limits the rate', () => {
    expect(sql).toMatch(/if nullif\(btrim\(coalesce\(p_website, ''\)\), ''\) is not null then\s+return jsonb_build_object\('ok', true\);/)
    expect(sql).toContain('char_length(v_name) not between 2 and 120')
    expect(sql).toContain("v_email !~* '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$'")
    expect(sql).toContain("raise exception 'demo_request_privacy_required'")
    expect(sql).toContain("lower(r.email) = v_email and r.created_at > v_now - interval '1 hour') >= 3")
    expect(sql).toContain("r.created_at > v_now - interval '1 hour') >= 30")
    expect(sql).toContain("raise exception 'demo_request_rate_limit' using errcode = '54000'")
    expect(sql).toContain('pg_advisory_xact_lock')
  })

  it('e-mails the presentation page address through the existing outbox and sender', () => {
    expect(sql).toContain("v_to := (select nullif(btrim(s.public_email), '') from public.platform_settings s where s.id = 'global')")
    expect(sql).toContain("insert into public.notification_outbox(")
    expect(sql).toContain("'public_demo_request', 'demo_request', v_id")
    expect(sql).toContain("perform private.platform_dispatch_task('send')")
    expect(scheduled).toMatch(/const MAILED=\[[^\]]*'public_demo_request'/)
    expect(scheduled).toContain("if(type==='public_demo_request')return publicDemoRequestEmail(")
    expect(email).toContain('replyTo:')
    expect(email).toContain('esc(message)')
  })

  it('runs nothing the agent may not run (no revoke, drop or delete)', () => {
    // «on delete set null» του foreign key δεν είναι εντολή διαγραφής.
    expect(sql).not.toMatch(/\brevoke\b|\bdrop\s+(table|function|policy|trigger|index|column|constraint|view|schema)\b|\bdelete\s+from\b|\btruncate\b/)
    expect(sql.replace(/on delete set null/g, '')).not.toMatch(/\b(revoke|drop|delete)\b/)
  })
})
