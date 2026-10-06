import { afterEach, describe, expect, it } from 'vitest'
import { ADDONS, MODULES, disabledCapabilitiesFor, moduleEnabled, normalizeProfile, profileModules } from '../src/core/organization/operatingProfile'
import { CAPABILITIES, ROLES, can, configureProfileAccess } from '../src/core/permissions/roles'
import { navigationFor } from '../src/app/navigation'

afterEach(() => configureProfileAccess(new Set()))

const org = (operating_profile, enabled_addons) => ({ id: 'o1', operating_profile, enabled_addons })
const navKeys = () => navigationFor({ role: ROLES.HOSPITAL_ADMIN, hasAssignments: true }).map(item => item.key)

describe('operating profile', () => {
  it('keeps everything on for existing organizations and outside an organization', () => {
    expect(normalizeProfile({ id: 'o1' })).toEqual({ profile: 'full', addons: ['occupational_health', 'pharmacy', 'prevalence_survey', 'lira'] })
    expect(disabledCapabilitiesFor({ id: 'o1' }).size).toBe(0)
    expect(disabledCapabilitiesFor(null).size).toBe(0)
  })

  it('laboratory profile switches off surveillance and the full programme, keeps the laboratory', () => {
    const off = disabledCapabilitiesFor(org('laboratory', []))
    for (const cap of [CAPABILITIES.VIEW_SURVEILLANCE, CAPABILITIES.CREATE_SURVEILLANCE, CAPABILITIES.VIEW_INDICATORS, CAPABILITIES.VIEW_PREVENTION, CAPABILITIES.VIEW_CONTROLS, CAPABILITIES.VIEW_COMMITTEES, CAPABILITIES.VIEW_PHARMACY, CAPABILITIES.VIEW_OCCUPATIONAL_HEALTH]) expect(off.has(cap)).toBe(true)
    for (const cap of [CAPABILITIES.VIEW_LAB, CAPABILITIES.MANAGE_LAB_SAMPLES, CAPABILITIES.VIEW_PATIENTS, CAPABILITIES.VIEW_ANALYSIS, CAPABILITIES.MANAGE_USERS]) expect(off.has(cap)).toBe(false)
  })

  it('surveillance profile adds surveillance and indicators, not the programme', () => {
    const o = org('surveillance', ['pharmacy'])
    expect(moduleEnabled(o, 'surveillance')).toBe(true)
    expect(moduleEnabled(o, 'programme')).toBe(false)
    expect(moduleEnabled(o, 'pharmacy')).toBe(true)
    expect(moduleEnabled(o, 'occupational_health')).toBe(false)
  })

  it('takes switched-off capabilities away from every role, platform owner included', () => {
    expect(can(ROLES.HOSPITAL_ADMIN, CAPABILITIES.VIEW_SURVEILLANCE)).toBe(true)
    configureProfileAccess(disabledCapabilitiesFor(org('laboratory', [])))
    expect(can(ROLES.HOSPITAL_ADMIN, CAPABILITIES.VIEW_SURVEILLANCE)).toBe(false)
    expect(can(ROLES.PLATFORM_OWNER, CAPABILITIES.VIEW_SURVEILLANCE)).toBe(false)
    expect(can(ROLES.HOSPITAL_ADMIN, CAPABILITIES.VIEW_LAB)).toBe(true)
  })

  it('hides switched-off modules from the menu', () => {
    const full = navKeys()
    expect(full).toEqual(expect.arrayContaining(['surveillance', 'prevention', 'laboratory']))
    configureProfileAccess(disabledCapabilitiesFor(org('laboratory', [])))
    const lab = navKeys()
    expect(lab).toEqual(expect.arrayContaining(['laboratory', 'patients']))
    for (const key of ['surveillance', 'prevention', 'controls', 'committees', 'indicators', 'pharmacy', 'occupationalHealth']) expect(lab).not.toContain(key)
  })

  it('lists each profile cumulatively so the picker matches the rules', () => {
    expect(profileModules('laboratory')).toEqual(['patients', 'laboratory', 'national'])
    expect(profileModules('surveillance')).toEqual(expect.arrayContaining(['laboratory', 'surveillance', 'indicators']))
    expect(profileModules('surveillance')).not.toContain('controls')
    expect(profileModules('full')).toEqual(Object.keys(MODULES))
  })

  it('gives every add-on its own analysis tab behind its module', async () => {
    const { TAB_MODULES } = await import('../src/features/analysis/analysisPageModel')
    for (const addon of ADDONS) expect(Object.values(TAB_MODULES).some(modules => modules.includes(addon))).toBe(true)
  })
})
