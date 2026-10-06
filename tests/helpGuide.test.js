import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { guideContent, pickGuide } from '../src/core/help/helpGuide'
import { ADDONS, MODULES, MODULE_DEPENDENCIES, OPERATING_PROFILES, PROFILE_LABELS, profileModules } from '../src/core/organization/operatingProfile'
import { SYSTEM_ROLE_KEYS } from '../src/core/permissions/roleLabels'

const greek = /[Α-Ωα-ωΆΈΉΊΌΎΏάέήίόύώϊϋΐΰ]/
const strings = value => (typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(strings) : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [])
const pairs = value => {
  if (Array.isArray(value)) return value.flatMap(pairs)
  if (value && typeof value === 'object') {
    const keys = Object.keys(value)
    if (keys.length === 2 && keys.includes('el') && keys.includes('en')) return [value]
    return Object.values(value).flatMap(pairs)
  }
  return []
}

describe('setup and user guide (shared by the Help Center and the PDF manual)', () => {
  it('has a Greek and an English text for every entry, with no Greek in the English one', () => {
    const all = pairs(guideContent)
    expect(all.length).toBeGreaterThan(150)
    for (const pair of all) {
      expect(pair.el.trim().length).toBeGreaterThan(0)
      expect(pair.en.trim().length).toBeGreaterThan(0)
      expect(greek.test(pair.en.replace(/ΕΟΔΥ/g, '')), pair.en).toBe(false)
    }
    expect(strings(pickGuide(guideContent, 'en')).some(text => greek.test(text.replace(/ΕΟΔΥ/g, '')))).toBe(false)
  })

  it('describes every package, module and add-on of the operating profile', () => {
    expect(g().packages.map(item => item.id)).toEqual([...OPERATING_PROFILES])
    for (const id of [...Object.keys(MODULES), ...ADDONS]) {
      const entry = guideContent.modules[id]
      expect(entry, id).toBeTruthy()
      for (const key of ['what', 'users', 'analysis', 'start']) expect(entry[key], `${id}.${key}`).toBeTruthy()
    }
    for (const id of Object.keys(guideContent.modules)) expect(Object.keys(MODULES).includes(id) || ADDONS.includes(id), id).toBe(true)
  })

  it('lists the same prerequisites as the dependency warnings', () => {
    for (const [id, entry] of Object.entries(guideContent.modules)) {
      expect(entry.needs || [], id).toEqual(MODULE_DEPENDENCIES[id] || [])
    }
  })

  it('gives every package ordered steps, a first-week check and a success test', () => {
    for (const pkg of guideContent.packages) {
      expect(pkg.steps.length, pkg.id).toBeGreaterThanOrEqual(4)
      expect(pkg.firstWeek.length, pkg.id).toBeGreaterThanOrEqual(3)
      expect(pkg.success, pkg.id).toBeTruthy()
    }
    // each package name used in the text exists in the picker
    for (const id of OPERATING_PROFILES) expect(PROFILE_LABELS[id].el.length).toBeGreaterThan(0)
    expect(profileModules('basic')).toEqual(['patients'])
  })

  it('covers every system role and points to existing stages', () => {
    const described = guideContent.roles.map(([id]) => id)
    for (const role of SYSTEM_ROLE_KEYS) expect(described, role).toContain(role)
    expect(described).toContain('platform_owner')
    expect(guideContent.journey.map(stage => stage.id)).toEqual(['prepare', 'organization', 'profile', 'activate', 'setup', 'golive', 'daily', 'reports', 'change'])
    for (const [, action] of guideContent.whereAmI) {
      for (const [, number] of action.el.matchAll(/Στάδιο (\d+)/g)) expect(Number(number)).toBeLessThanOrEqual(guideContent.journey.length)
    }
  })

  it('keeps the PDF manuals out of the app: no public download, no link in the Help Center', () => {
    expect(fs.existsSync(new URL('../public/manual', import.meta.url))).toBe(false)
    expect(fs.readFileSync(new URL('../src/core/help/HelpGuideView.jsx', import.meta.url), 'utf8')).not.toMatch(/\.pdf|\/manual\/|download/)
  })
})

function g() { return guideContent }
