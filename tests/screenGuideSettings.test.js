import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { hospitalScreenGuidesOn, screenGuideChoice, screenGuideValue, screenGuidesOn } from '../src/features/demo/screenGuideSettings'

const demo = { id: 'D', is_demo: true }
const hospital = { id: 'H', is_demo: false }

describe('screen guides per hospital and per user', () => {
  it('by default they run in a Demo and not in a hospital', () => {
    expect(hospitalScreenGuidesOn(demo)).toBe(true)
    expect(hospitalScreenGuidesOn(hospital)).toBe(false)
    expect(screenGuidesOn({ organization: hospital, membership: {} })).toBe(false)
    expect(screenGuidesOn({ organization: demo, membership: { screen_guides: null } })).toBe(true)
  })

  it('the hospital setting overrides the default', () => {
    expect(screenGuidesOn({ organization: { ...hospital, screen_guides_enabled: true }, membership: {} })).toBe(true)
    expect(screenGuidesOn({ organization: { ...demo, screen_guides_enabled: false }, membership: {} })).toBe(false)
  })

  it('the user setting overrides the hospital', () => {
    expect(screenGuidesOn({ organization: { ...hospital, screen_guides_enabled: false }, membership: { screen_guides: true } })).toBe(true)
    expect(screenGuidesOn({ organization: { ...demo, screen_guides_enabled: true }, membership: { screen_guides: false } })).toBe(false)
  })

  it('the browser-only sample hospital and a missing organization never show guides', () => {
    expect(screenGuidesOn({ organization: { ...demo, mode: 'demo', screen_guides_enabled: true }, membership: { screen_guides: true } })).toBe(false)
    expect(screenGuidesOn({ organization: null, membership: { screen_guides: true } })).toBe(false)
  })

  it('maps the stored value to the three choices and back', () => {
    expect([true, false, null, undefined].map(screenGuideChoice)).toEqual(['on', 'off', 'default', 'default'])
    expect(['on', 'off', 'default'].map(screenGuideValue)).toEqual([true, false, null])
  })
})

describe('screen guides are wired end to end', () => {
  const shell = fs.readFileSync('src/app/AppShell.jsx', 'utf8')
  const tenantService = fs.readFileSync('src/core/tenant/tenantService.js', 'utf8')
  const migration = fs.readFileSync('supabase/migrations/20261026120000_screen_guides_settings.sql', 'utf8')

  it('the shell shows guides wherever the settings allow, not only in Demo organizations', () => {
    expect(shell).toContain('const guidesOn=!platformMode&&!helpPreviewMode&&screenGuidesOn({organization:tenant,membership})')
    expect(shell).toContain('{guidesOn&&<Suspense fallback={null}><ScreenGuide enabled={guidesOn}')
  })

  it('the settings are read with the membership and its organization', () => {
    expect(tenantService).toContain('id, role, status, custom_role_id, screen_guides,')
    expect(tenantService).toContain('idle_lock_minutes, branding, screen_guides_enabled)')
  })

  it('both settings change only through admin-checked, audited RPCs', () => {
    for (const fn of ['set_organization_screen_guides', 'set_member_screen_guides']) {
      const body = migration.slice(migration.indexOf(`create or replace function public.${fn}`))
      expect(body).toContain("if not (public.current_user_is_platform_owner() or public.is_org_admin(p_organization_id)) then raise exception 'ORG_ADMIN_REQUIRED'")
      expect(body).toContain('insert into public.system_audit_log(organization_id, actor_user_id, event_type,')
      expect(migration).toContain(`revoke all on function public.${fn}(`)
    }
  })
})

describe('system_audit_log is written with event_type', () => {
  // The column has always been event_type; three settings functions wrote
  // "action" and failed on save until 20261026110000.
  it('no function, in its latest definition, writes an "action" column', () => {
    const latest = new Map()
    for (const file of fs.readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort()) {
      const sql = fs.readFileSync(`supabase/migrations/${file}`, 'utf8')
      for (const match of sql.matchAll(/create\s+or\s+replace\s+function\s+(public\.\w+)\s*\(([\s\S]*?)\n\$(\w*)\$;/gi)) latest.set(match[1].toLowerCase(), { file, body: match[0] })
    }
    const offenders = [...latest].filter(([, { body }]) => /system_audit_log\s*\([^)]*\baction\b/i.test(body)).map(([name, { file }]) => `${name} (${file})`)
    expect(offenders).toEqual([])
    expect(latest.has('public.set_organization_idle_lock')).toBe(true)
  })
})
