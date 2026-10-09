// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { LanguageProvider } from '../src/core/i18n/LanguageContext'
import { ConvertDemoDialog, DemoExtendControls } from '../src/features/platform/DemoLifecycleControls'

const read = path => fs.readFileSync(path, 'utf8')
const migration = read('supabase/migrations/20261015120000_lifecycle_offboarding.sql')
const housekeeping = read('supabase/functions/platform-housekeeping/index.ts')
const exporter = read('supabase/functions/platform-export-organization/index.ts')
const demoService = read('src/features/platform/platformDemoService.js')
const wrap = node => <LanguageProvider>{node}</LanguageProvider>

afterEach(() => cleanup())

describe('Demo lifecycle', () => {
  it('extends by 7/14/30 days from the end date, or from today once it has ended', () => {
    const onExtend = vi.fn()
    render(wrap(<DemoExtendControls validUntil="2099-01-10" language="el" onExtend={onExtend}/>))
    fireEvent.click(screen.getByText('+7 ημ.'))
    expect(onExtend).toHaveBeenCalledWith('2099-01-17')
    cleanup()
    const onPast = vi.fn()
    render(wrap(<DemoExtendControls validUntil="2000-01-01" language="el" onExtend={onPast}/>))
    fireEvent.click(screen.getByText('+14 ημ.'))
    const expected = new Date(); expected.setUTCDate(expected.getUTCDate() + 14)
    expect(onPast).toHaveBeenCalledWith(expected.toISOString().slice(0, 10))
  })
  it('converts only after the owner confirms that the demonstration data is deleted', () => {
    const onConvert = vi.fn()
    render(wrap(<ConvertDemoDialog language="el" defaultName="Νοσοκομείο Πελάτη" onConvert={onConvert} onClose={vi.fn()}/>))
    const submit = screen.getByText('Μετατροπή σε οργανισμό').closest('button')
    expect(submit).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(submit).not.toBeDisabled()
    fireEvent.click(submit)
    expect(onConvert).toHaveBeenCalledWith(expect.objectContaining({ name: 'Νοσοκομείο Πελάτη', code: expect.stringMatching(/^HOSP-/) }))
  })
  it('clears the synthetic data in the same transaction, then makes the organization real', () => {
    expect(migration).toMatch(/perform private\.demo_wipe_data\(p_organization_id\);[\s\S]*is_demo = false/)
    expect(migration).toContain("'platform.demo.converted'")
    expect(demoService).not.toContain('convertPlatformDemoToOrganization')
  })
  it('deletes expired Demos automatically only after the configured days, never one with a new request or the Owner\'s own', () => {
    expect(migration).toContain('demo_auto_purge_after_days integer not null default 14')
    expect(migration).toMatch(/st\.n > 0[\s\S]*e\.valid_until < current_date - st\.n[\s\S]*o\.code <> 'DEMO-OWNER'[\s\S]*r\.status = 'new'/)
    expect(housekeeping).toContain("caller.rpc('platform_demo_purge_candidates')")
    expect(housekeeping).toContain('if(!org?.is_demo)continue')
    expect(housekeeping).toContain("auditEvent:'platform.demo.auto_purged'")
  })
})

describe('Organization offboarding', () => {
  it('schedules deletion after the grace period, needing a recent export or a waiver reason', () => {
    expect(migration).toContain('organization_deletion_grace_days integer not null default 30')
    expect(migration).toContain("raise exception 'An export from the last 30 days is required'")
    expect(migration).toMatch(/deletion_scheduled_at = v_at[\s\S]*status = 'suspended'/)
    expect(migration).toContain("'platform.organization.deletion_cancelled'")
  })
  it('closes access while a deletion is scheduled', () => {
    expect(migration).toContain("where o.id = p_organization_id and o.status = 'active' and o.deletion_scheduled_at is null")
  })
  it('exports every organization table and attachment into a private bucket, owner only', () => {
    expect(migration).toContain("values ('organization-exports', 'organization-exports', false)")
    expect(migration).toContain('grant execute on function public.platform_organization_export_manifest(uuid) to service_role;')
    expect(exporter).toContain("if(!owner?.is_platform_owner)return reply({error:'Platform Owner access required.'},403)")
    expect(exporter).toContain("event_type:'platform.organization.exported'")
  })
})
