import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { can, CAPABILITIES, ROLES } from '../src/core/permissions/roles'

// User-requested: the hospital Management Center must not mix in the
// platform's tools. Platform-wide items (LIRA Knowledge, external
// references, platform updates / Platform Center) live only on the platform
// screen; inside a hospital the Platform Owner sees what the Hospital
// Administrator sees. The Infection Control Lead also gets outbreak
// investigations (VIEW_LIRA) instead of them being tied to user management.
const page = fs.readFileSync('src/features/management/ManagementPage.jsx', 'utf8')
const hospitalTabs = page.slice(page.indexOf('const ok=cap=>'), page.indexOf(']},[global,role'))
const globalTabs = page.slice(page.indexOf('if(global)return ['), page.indexOf('const ok=cap=>'))

describe('Management Center: hospital vs platform', () => {
  it('keeps platform-wide tabs out of the hospital Management Center', () => {
    for (const id of ['liraKnowledge', 'references', 'platform']) expect(hospitalTabs).not.toContain(`id:'${id}'`)
    for (const id of ['users', 'roles', 'announcements', 'libraries', 'questionnaires', 'clinicalScales', 'environmentTemplates', 'bundles', 'haiCriteria', 'indicators', 'patientDays', 'hospitalStructure', 'prevalenceSurvey', 'liraAi', 'liraOutbreaks']) expect(hospitalTabs).toContain(`id:'${id}'`)
  })

  it('offers LIRA Knowledge and external references on the platform screen', () => {
    expect(globalTabs).toContain("id:'liraKnowledge'")
    expect(globalTabs).toContain("id:'references'")
  })

  it('treats the Platform Owner like a Hospital Administrator inside a hospital', () => {
    expect(page).toContain(' const isPlatformOwner=global\n')
    expect(can(ROLES.PLATFORM_OWNER, CAPABILITIES.VIEW_PLATFORM, [], [])).toBe(true)
    expect(can(ROLES.HOSPITAL_ADMIN, CAPABILITIES.VIEW_PLATFORM, [], [])).toBe(false)
  })

  it('gives outbreak investigations to the Infection Control Lead via VIEW_LIRA', () => {
    expect(hospitalTabs).toContain("...(ok(CAPABILITIES.VIEW_LIRA)?[{id:'liraOutbreaks'")
    expect(can(ROLES.INFECTION_CONTROL_LEAD, CAPABILITIES.VIEW_LIRA, [], [])).toBe(true)
  })
})
