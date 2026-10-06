import { afterEach, describe, expect, it } from 'vitest'
import { ADDONS, MODULES, missingDependencies, profileFor, disabledCapabilitiesFor, moduleEnabled, normalizeProfile, profileModules } from '../src/core/organization/operatingProfile'
import { CAPABILITIES, ROLES, can, configureProfileAccess } from '../src/core/permissions/roles'
import { navigationFor } from '../src/app/navigation'

afterEach(() => configureProfileAccess(new Set()))

const org = (operating_profile, enabled_addons) => ({ id: 'o1', operating_profile, enabled_addons })
const navKeys = () => navigationFor({ role: ROLES.HOSPITAL_ADMIN, hasAssignments: true }).map(item => item.key)

describe('operating profile', () => {
  it('keeps everything on for existing organizations and outside an organization', () => {
    expect(normalizeProfile({ id: 'o1' })).toEqual({ profile: 'full', addons: ['occupational_health', 'pharmacy', 'prevalence_survey', 'lira'], modules: Object.keys(MODULES) })
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
    expect(moduleEnabled(o, 'controls')).toBe(false)
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
    expect(profileModules('basic')).toEqual(['patients'])
    expect(profileModules('surveillance')).toEqual(expect.arrayContaining(['laboratory', 'national', 'surveillance', 'indicators']))
    expect(profileModules('surveillance')).not.toContain('controls')
    expect(profileModules('full')).toEqual(Object.keys(MODULES))
  })

  it('gives every add-on its own analysis tab behind its module', async () => {
    const { TAB_MODULES } = await import('../src/features/analysis/analysisPageModel')
    for (const addon of ADDONS) expect(Object.values(TAB_MODULES).some(modules => modules.includes(addon))).toBe(true)
  })

  it('lets the Platform Owner enable any single module regardless of the preset', () => {
    const o = { id: 'o1', operating_profile: 'custom', enabled_addons: [], enabled_modules: ['patients', 'laboratory', 'national', 'controls', 'training'] }
    expect(moduleEnabled(o, 'controls')).toBe(true)
    expect(moduleEnabled(o, 'training')).toBe(true)
    expect(moduleEnabled(o, 'surveillance')).toBe(false)
    expect(normalizeProfile(o).profile).toBe('custom')
    const off = disabledCapabilitiesFor(o)
    expect(off.has(CAPABILITIES.VIEW_CONTROLS)).toBe(false)
    expect(off.has(CAPABILITIES.VIEW_TRAINING)).toBe(false)
    expect(off.has(CAPABILITIES.VIEW_SURVEILLANCE)).toBe(true)
    expect(off.has(CAPABILITIES.VIEW_QUALITY)).toBe(true)
    expect(off.has(CAPABILITIES.VIEW_LAB)).toBe(false)
  })

  it('always keeps the core modules and recognizes a preset from the module list', () => {
    const o = { id: 'o1', enabled_modules: ['surveillance'] }
    expect(normalizeProfile(o).modules).toEqual(['patients', 'surveillance'])
    expect(profileFor(profileModules('surveillance'))).toBe('surveillance')
    expect(profileFor(['patients'])).toBe('basic')
    expect(profileFor(['patients', 'controls'])).toBe('custom')
  })

  it('basic package has no laboratory until it is unlocked; the former laboratory profile keeps it', () => {
    const basic = disabledCapabilitiesFor(org('basic', []))
    for (const cap of [CAPABILITIES.VIEW_LAB, CAPABILITIES.MANAGE_LAB_SAMPLES, CAPABILITIES.VIEW_SURVEILLANCE]) expect(basic.has(cap)).toBe(true)
    expect(basic.has(CAPABILITIES.VIEW_PATIENTS)).toBe(false)
    const unlocked = disabledCapabilitiesFor({ id: 'o1', operating_profile: 'custom', enabled_addons: [], enabled_modules: ['patients', 'laboratory'] })
    expect(unlocked.has(CAPABILITIES.VIEW_LAB)).toBe(false)
    const legacy = org('laboratory', [])
    expect(moduleEnabled(legacy, 'laboratory')).toBe(true)
    expect(moduleEnabled(legacy, 'national')).toBe(true)
    expect(moduleEnabled(legacy, 'surveillance')).toBe(false)
    expect(disabledCapabilitiesFor(legacy).has(CAPABILITIES.VIEW_LAB)).toBe(false)
    expect(normalizeProfile(legacy).profile).toBe('custom')
  })

  it('hides laboratory and EODY/EARS-Net analysis tabs with their modules', async () => {
    const { TAB_MODULES } = await import('../src/features/analysis/analysisPageModel')
    expect(TAB_MODULES.laboratory).toEqual(['laboratory'])
    expect(TAB_MODULES.amr).toEqual(['laboratory'])
    expect(TAB_MODULES.national).toEqual(['national'])
  })

  it('warns, without blocking, when a module is on and its prerequisite is locked', () => {
    expect(missingDependencies(['patients', 'indicators'])).toEqual([['indicators', ['surveillance']]])
    expect(missingDependencies(['patients', 'surveillance'])).toEqual([['surveillance', ['laboratory']]])
    expect(missingDependencies(['patients', 'national'])).toEqual([['national', ['laboratory']]])
    for (const id of ['basic', 'surveillance', 'full']) expect(missingDependencies(profileModules(id))).toEqual([])
    // a warning never changes what is enabled
    const o = { id: 'o1', operating_profile: 'custom', enabled_addons: [], enabled_modules: ['patients', 'indicators'] }
    expect(moduleEnabled(o, 'indicators')).toBe(true)
  })
})
