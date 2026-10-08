import { describe, it, expect } from 'vitest'
import fs from 'node:fs'

const read = path => fs.readFileSync(path, 'utf8')
const migration = read('supabase/migrations/20261010120000_demo_seed_data.sql')
const demoAccess = read('supabase/functions/create-demo-access/index.ts')
const demoRecord = read('src/features/platform/PlatformDemoRecord.jsx')
const center = read('src/features/workspaces/PlatformCenterPage.jsx')
const tenantService = read('src/core/tenant/tenantService.js')

describe('Demo data pack', () => {
  it('gives existing and new Demo evaluators the Hospital Admin role', () => {
    expect(migration).toMatch(/set role = 'hospital_admin'[\s\S]*o\.is_demo[\s\S]*om\.role = 'demo'/)
    expect(demoAccess).toContain("role:'hospital_admin'")
    expect(demoAccess).not.toContain("role:'demo'")
  })
  it('fills every new Demo through the reset RPC, as the Platform Owner', () => {
    expect(demoAccess).toContain("caller.rpc('platform_reset_demo_organization',{p_organization_id:organization.id})")
  })
  it('only ever touches Demo organizations and keeps members, libraries and evaluators', () => {
    expect(migration).toContain("raise exception 'Only Demo organizations can be reset'")
    expect(migration).toContain("raise exception 'Only Demo organizations can be filled with Demo data'")
    expect(migration).toContain('where c.relname <> all(v_keep)')
    for (const table of ['organization_members', 'master_library_items', 'platform_demo_entitlements']) expect(migration).toContain(`'${table}'`)
    expect(migration).toContain('delete from public.employees e where e.organization_id = p_organization_id and e.user_id is null;')
  })
  it('writes the main areas with dates relative to today', () => {
    for (const table of ['departments', 'patients', 'surveillance_cases', 'surveillance_events', 'hai_classifications', 'laboratory_samples',
      'microbiology_results', 'antimicrobial_susceptibility_results', 'amr_classifications', 'isolation_episodes', 'hand_hygiene_sessions',
      'hand_hygiene_observations', 'employees', 'patient_day_periods', 'quality_incidents', 'quality_capa_actions', 'controlled_documents',
      'committees', 'committee_meetings']) expect(migration).toContain(`insert into public.${table}(`)
    expect(migration).toContain('d0 date := current_date;')
    expect(migration).toContain("'surveillance_start'")
    expect(migration).toContain('@demo.invalid')
  })
  it('never stores a query result with SELECT ... INTO, which the Supabase SQL editor rewrites', () => {
    const body = migration.replace(/--[^\n]*/g, '')
    expect(body).not.toMatch(/\bselect\b[^;]*\binto\b(?!\s+public\.)/i)
    expect(body).not.toMatch(/\b(execute|returning)\b[^;]*\binto\b(?!\s+public\.)/i)
  })
})

describe('Demo record', () => {
  it('offers "Reset data" and opens its own Demo organization', () => {
    expect(demoRecord).toContain('resetPlatformDemoData(record.organization_id)')
    expect(tenantService).toContain("supabase.rpc('platform_reset_demo_organization'")
    expect(center).toContain('onOpenDemo={()=>openDemoOrganization(selectedDemo)}')
    expect(center).toContain('function openDemoOrganization(demo)')
  })
})
