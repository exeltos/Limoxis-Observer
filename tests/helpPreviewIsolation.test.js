import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('Help Center live previews run on demo data only', () => {
  it('gives the embedded preview frame an isolated, non-persisted Supabase client', () => {
    const client = read('src/core/supabase/client.js')
    expect(client).toContain("get('helpPreview') === '1'")
    expect(client).toContain('window.self !== window.top')
    expect(client).toContain('persistSession: false')
    expect(client).toContain("storageKey: 'limoxis-help-preview'")
  })

  it('signs the preview frame in as the demo user', () => {
    const auth = read('src/core/auth/AuthContext.jsx')
    expect(auth).toContain("{session:{access_token:'help-preview',user:DEMO_USER},profile:DEMO_USER")
    expect(auth).toMatch(/isDemo:\s*true/)
  })
})

describe('Platform update center review actions', () => {
  it('lets the Platform Owner update review status under RLS', () => {
    const migration = read('supabase/migrations/20260925120000_clinical_source_history_owner_review.sql')
    expect(migration).toContain('for update to authenticated')
    expect(migration).toContain('current_user_is_platform_owner()')
  })

  it('fails loudly when no row was updated and brings postponed changes back after DEFER_DAYS', () => {
    const service = read('src/features/management/clinicalContentSourceService.js')
    expect(service).toContain(".eq('id',id).select('id')")
    expect(service).toContain('if(!data?.length)throw')
    expect(service).toContain('review_status.eq.deferred')
    const page = read('src/features/management/ManagementPage.jsx')
    expect(page).toContain("reviewUpdate(x,'deferred')")
    expect(page).toContain("reviewUpdate(x,'approved')")
  })
})
