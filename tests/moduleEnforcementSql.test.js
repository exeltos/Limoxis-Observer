// The database enforces the modules a Platform Owner locks for a hospital
// (supabase/migrations/*_module_enforcement_db.sql). Its module → capability map and its
// copy of normalizeProfile must stay identical to src/core/organization/operatingProfile.js;
// these tests read the latest migration that defines them and fail when the two drift.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ADDONS, CORE_MODULES, MODULES, OPTIONAL_MODULES, disabledCapabilitiesFor, normalizeProfile } from '../src/core/organization/operatingProfile'

const MIGRATIONS = 'supabase/migrations'
const files = fs.readdirSync(MIGRATIONS).filter(name => name.endsWith('.sql')).sort()

// Body of the latest `create or replace function <name>(` across the migrations.
function latestFunction(name) {
  let found = null
  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS, file), 'utf8')
    const match = sql.match(new RegExp(`create or replace function ${name.replace('.', '\\.')}\\([\\s\\S]*?\\$function\\$([\\s\\S]*?)\\$function\\$`, 'i'))
    if (match) found = { file, body: match[1] }
  }
  if (!found) throw new Error(`${name} not found in ${MIGRATIONS}`)
  return found
}
const tuples = (body, re) => [...body.matchAll(re)]

const catalogue = tuples(latestFunction('private.module_catalogue').body, /\('([a-z_]+)', '(core|module|addon)', (\d+|null)\)/g)
  .map(([, module, kind, tier]) => ({ module, kind, tier: tier === 'null' ? null : Number(tier) }))
const capabilityRows = tuples(latestFunction('private.module_capabilities').body, /\('([a-z_]+)', '([a-z_]+)'\)/g).map(([, module, capability]) => ({ module, capability }))
const gatedRows = tuples(latestFunction('private.module_gated_tables').body, /\('([a-z_]+)', array\[([^\]]*)\]\)/g)
  .map(([, table, list]) => ({ table, modules: [...list.matchAll(/'([a-z_]+)'/g)].map(item => item[1]) }))
const disabledModulesBody = latestFunction('private.org_disabled_modules').body
const legacyLaboratory = [...disabledModulesBody.match(/operating_profile = 'laboratory' then c\.module <> all \(array\[([^\]]*)\]\)/)[1].matchAll(/'([a-z_]+)'/g)].map(item => item[1])

// The SQL CASE of private.org_disabled_modules, transliterated rule for rule.
function sqlDisabledModules(org) {
  return catalogue.filter(({ module, kind, tier }) => {
    if (kind === 'core') return false
    if (kind === 'addon') return org.enabled_addons != null && !org.enabled_addons.includes(module)
    if (org.enabled_modules != null) return !org.enabled_modules.includes(module)
    if (org.operating_profile === 'laboratory') return !legacyLaboratory.includes(module)
    if (org.operating_profile === 'basic') return tier > 0
    if (org.operating_profile === 'surveillance') return tier > 1
    return false
  }).map(item => item.module)
}
const sqlDisabledCapabilities = org => {
  const off = new Set(sqlDisabledModules(org))
  return new Set(capabilityRows.filter(row => off.has(row.module)).map(row => row.capability))
}

const TIER = { basic: 0, surveillance: 1, full: 2 }

describe('module enforcement in the database mirrors operatingProfile.js', () => {
  it('lists every module and add-on with the same kind and preset', () => {
    expect(catalogue.map(item => item.module).sort()).toEqual([...Object.keys(MODULES), ...ADDONS].sort())
    for (const item of catalogue) {
      if (ADDONS.includes(item.module)) expect(item.kind).toBe('addon')
      else {
        expect(item.kind).toBe(CORE_MODULES.includes(item.module) ? 'core' : 'module')
        expect(item.tier).toBe(TIER[MODULES[item.module].from])
      }
    }
  })

  it('takes away the same capabilities per module and add-on', () => {
    for (const module of [...OPTIONAL_MODULES, ...ADDONS]) {
      const org = ADDONS.includes(module)
        ? { operating_profile: 'full', enabled_modules: null, enabled_addons: ADDONS.filter(item => item !== module) }
        : { operating_profile: 'custom', enabled_modules: OPTIONAL_MODULES.filter(item => item !== module), enabled_addons: [...ADDONS] }
      const js = [...disabledCapabilitiesFor(org)]
      expect(js.every(Boolean), `${module}: a capability constant is undefined in operatingProfile.js`).toBe(true)
      expect(capabilityRows.filter(row => row.module === module).map(row => row.capability).sort(), module).toEqual(js.sort())
    }
  })

  it('reads the legacy laboratory preset like normalizeProfile', () => {
    expect(legacyLaboratory.sort()).toEqual(normalizeProfile({ operating_profile: 'laboratory' }).modules.sort())
  })

  it('gives the same disabled capabilities for presets, custom lists and add-ons', () => {
    const fixtures = []
    for (const operating_profile of ['basic', 'surveillance', 'full', 'custom', 'laboratory', 'unknown', undefined]) {
      fixtures.push({ operating_profile, enabled_modules: null, enabled_addons: null })
      fixtures.push({ operating_profile, enabled_modules: null, enabled_addons: ['pharmacy', 'not_an_addon'] })
      fixtures.push({ operating_profile, enabled_modules: [], enabled_addons: [] })
    }
    let seed = 11
    const random = () => (seed = (seed * 48271) % 2147483647) / 2147483647
    for (let i = 0; i < 300; i++) {
      fixtures.push({
        operating_profile: ['custom', 'full', 'basic'][i % 3],
        enabled_modules: [...Object.keys(MODULES), 'not_a_module'].filter(() => random() < 0.5),
        enabled_addons: random() < 0.2 ? null : ADDONS.filter(() => random() < 0.5),
      })
    }
    for (const org of fixtures) expect([...sqlDisabledCapabilities(org)].sort(), JSON.stringify(org)).toEqual([...disabledCapabilitiesFor(org)].sort())
  })

  it('gates tables only by known modules, once per table and group', () => {
    const known = new Set(catalogue.filter(item => item.kind !== 'core').map(item => item.module))
    const keys = gatedRows.map(row => `${row.table}:${row.modules.join(',')}`)
    expect(new Set(keys).size).toBe(keys.length)
    for (const row of gatedRows) for (const module of row.modules) expect(known.has(module), `${row.table}: ${module}`).toBe(true)
    // Tables the employee record (always on) reads stay open.
    for (const table of ['patients', 'employees', 'training_programs', 'training_assignments', 'training_certificates', 'indicator_definitions', 'prevention_bundle_templates']) {
      expect(gatedRows.some(row => row.table === table), table).toBe(false)
    }
  })
})

describe('module enforcement keeps the Platform Owner exception', () => {
  it('current_user_has_capability checks the owner before any module lock', () => {
    const { body } = latestFunction('public.current_user_has_capability')
    expect(body.trim().startsWith('select public.current_user_is_platform_owner()\n  or (')).toBe(true)
    expect(body).toContain('and not (capability_key = any (private.org_disabled_capabilities(target_org))))')
  })

  it('the RLS helpers return nothing locked for the owner', () => {
    const owner = "if coalesce((select p.is_platform_owner from public.profiles p where p.id = auth.uid()), false) then"
    expect(latestFunction('private.current_user_has_locked_modules').body).toContain(`${owner}\n    return false;`)
    expect(latestFunction('private.current_user_locked_module_orgs').body).toContain(`${owner}\n    return '{}'::uuid[];`)
    expect(latestFunction('private.current_user_disabled_capability_orgs').body).toContain(`${owner}\n    return '{}'::uuid[];`)
  })

  it('each gate is restrictive and short-circuits while nothing is locked', () => {
    const sql = fs.readFileSync(path.join(MIGRATIONS, latestFunction('private.module_gated_tables').file), 'utf8')
    expect(sql).toContain("'create policy %I on public.%I as restrictive for all to authenticated using (%s) with check (%s)'")
    expect(sql).toContain("'(select not private.current_user_has_locked_modules()) or organization_id is null or not (%s)'")
    expect(sql).toContain("'organization_id = any ((select private.current_user_locked_module_orgs(%L::text[]))::uuid[])'")
    expect(sql).not.toMatch(/\b(drop|revoke)\b/i)
  })
})
