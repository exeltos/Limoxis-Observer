import { URL } from 'node:url'
import { describe,expect,it } from 'vitest'
import { readSource } from './helpers/readSource'

const migration=readSource(new URL('../supabase/migrations/20261231270000_legacy_person_links.sql',import.meta.url))
const manifest=JSON.parse(readSource(new URL('../supabase/security-definer-manifest.json',import.meta.url)))

describe('legacy person links migration',()=>{
  it('only adds nullable link columns and never rewrites a text column',()=>{
    expect(migration).toContain('add column if not exists owner_employee_id uuid references public.employees(id) on delete set null')
    expect(migration).toContain('add column if not exists reported_by_employee_id uuid')
    expect(migration).not.toMatch(/set\s+(owner_label|reported_by_label|verified_by_label|lead_auditor_label|trainer|owner)\s*=/i)
  })

  it('is create-only: no drop, delete, truncate or policy alteration',()=>{
    expect(migration).not.toMatch(/\bdrop\s+(table|column|function|policy)/i)
    expect(migration).not.toMatch(/\bdelete\s+from\b/i)
    expect(migration).not.toMatch(/\btruncate\b/i)
    expect(migration).not.toMatch(/alter\s+policy/i)
  })

  it('links a name only when exactly one employee of the same organization matches',()=>{
    expect(migration).toContain("when cardinality(c.ids) = 1 then 'matched'")
    expect(migration).toContain('e.organization_id = t.organization_id')
    expect(migration).toContain('public.normalize_person_name(t.label)')
  })

  it('keeps the match list behind RLS and resolves only through the admin RPC',()=>{
    expect(migration).toContain('alter table public.legacy_person_matches enable row level security')
    expect(migration).toContain('create policy legacy_person_matches_select')
    expect(migration).not.toMatch(/create policy legacy_person_matches_(insert|update|delete)/)
    expect(migration).toContain('if not public.is_org_admin(p_organization_id)')
    expect(migration).toContain('auth.uid()')
    expect(migration).toContain("'legacy_person.resolved'")
    expect(migration).toContain('system_audit_log')
  })

  it('declares the security definer RPC in the manifest and closes it to anon',()=>{
    expect(manifest.functions.resolve_legacy_person.category).toBe('rpc')
    expect(migration).toContain('revoke execute on function public.resolve_legacy_person(uuid, text, text, text, uuid) from public, anon')
    expect(migration).toContain('grant execute on function public.resolve_legacy_person(uuid, text, text, text, uuid) to authenticated')
  })
})
