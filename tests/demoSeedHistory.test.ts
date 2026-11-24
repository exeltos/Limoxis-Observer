import { describe, expect, it } from 'vitest'
import { readSource } from './helpers/readSource'

const sql = readSource('supabase/migrations/20261231636000_demo_seed_quality_surveillance_history.sql').replace(/^\s*--.*$/gm, '')

describe('Demo history of incidents and surveillance episodes (owner, 24/11/2026)', () => {
  it('only adds rows, again on every «Reset data», without duplicates', () => {
    expect(sql).not.toMatch(/\b(drop|delete|truncate|alter\s+policy)\b/i)
    expect(sql).toContain('on conflict (organization_id, code) do nothing')
    expect(sql).toContain('and not exists (select 1 from public.surveillance_cases c where c.patient_id = pt.id)')
    expect(sql).toContain('perform private.demo_seed_incidents_history(p_organization_id, p_actor);')
    expect(sql).toContain('perform private.demo_seed_surveillance_history(p_organization_id, p_actor);')
  })
  it('the episodes are closed and unclassified, so the Demo infection indicators do not change', () => {
    expect(sql).toContain("'Αποκλείστηκε λοίμωξη — ολοκληρώθηκε η παρακολούθηση'")
    expect(sql).not.toContain('hai_classifications')
  })
  it('each incident has its kind of report from its category (Codex #701): complaints and non-clinical ones are not counted as clinical', () => {
    expect(sql).toContain("case when t.cat = 'complaint' then 'complaint' when t.cat in ('clinical', 'medication') then 'clinical' else 'nonClinical' end")
  })
  it('the two functions are not callable by users', () => {
    expect(sql).toContain('revoke all on function private.demo_seed_incidents_history(uuid, uuid) from public, anon, authenticated;')
    expect(sql).toContain('revoke all on function private.demo_seed_surveillance_history(uuid, uuid) from public, anon, authenticated;')
  })
})
