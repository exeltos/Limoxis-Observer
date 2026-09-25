import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { can, ROLES } from '../src/core/permissions/roles.js'

const migration = readFileSync(new URL('../supabase/migrations/20260925200000_link_nurse_capability_alignment.sql', import.meta.url), 'utf8')

function rolesFor(capability) {
  const line = migration.split('\n').find(row => row.includes(`when '${capability}' then`))
  return line ? [...line.matchAll(/'([a-z_]+)'/g)].map(match => match[1]).slice(1) : []
}

describe('Link Nurse database capability alignment', () => {
  const capabilities = ['view_training', 'view_prevention', 'view_controls', 'view_indicators', 'record_hand_hygiene', 'record_waste', 'record_antiseptic', 'record_prevention_bundle', 'execute_control', 'edit_control_execution']

  it.each(capabilities)('grants %s to link_nurse in both the UI matrix and SQL helpers', capability => {
    expect(can(ROLES.LINK_NURSE ?? 'link_nurse', capability)).toBe(true)
    expect(rolesFor(capability)).toContain('link_nurse')
  })

  it('keeps governance-only control actions away from link_nurse', () => {
    for (const capability of ['void_control_execution', 'edit_control_definition', 'manage_controls']) {
      expect(can('link_nurse', capability)).toBe(false)
      expect(rolesFor(capability)).not.toContain('link_nurse')
    }
  })

  it('removes RPC access to trigger-only functions', () => {
    expect(migration).toContain('revoke execute on function public.enforce_no_surveillance_link_from_negative_sample() from public, anon, authenticated')
    expect(migration).toContain('revoke execute on function public.enforce_therapy_approved_before_administration() from public, anon, authenticated')
  })
})
