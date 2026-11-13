import { describe, expect, it } from 'vitest'
import { can, CAPABILITIES, ROLES } from '../src/core/permissions/roles'
import { SECTION_TABS, sectionTabsFor } from '../src/core/navigation/sectionTabs'
import { readSource } from './helpers/readSource'

// User-requested: the hospital Management Center must not mix in the
// platform's tools. Platform-wide items (LIRA Knowledge, external
// references, platform updates / Platform Center) live only on the platform
// screen; inside a hospital the Platform Owner sees what the Hospital
// Administrator sees. The Infection Control Lead also gets outbreak
// investigations (VIEW_LIRA) instead of them being tied to user management.
const page = readSource('src/features/management/ManagementPage.jsx')
const hospitalTabs = page.slice(page.indexOf('const ok=(cap: string)=>'), page.indexOf(']},[global,role'))
const globalTabs = page.slice(page.indexOf('if(global)return ['), page.indexOf('const ok=(cap: string)=>'))

describe('Management Center: hospital vs platform', () => {
  it('keeps platform-wide tabs out of the hospital Management Center', () => {
    for (const id of ['liraKnowledge', 'references', 'platform']) expect(hospitalTabs).not.toContain(`id:'${id}'`)
    // One row of tabs; Hospital and Lists are left lists of their screens; the indicator data moved to Indicators › Data.
    for (const id of ['users', 'roles', 'hospital', 'lists', 'patientDays', 'liraAi']) expect(hospitalTabs).toContain(`id:'${id}'`)
    const rails = page.slice(page.indexOf('const hospitalLead='), page.indexOf('// group row only') > 0 ? page.indexOf('// group row only') : page.length)
    for (const id of ['identity', 'security', 'announcements', 'questionnaires', 'clinicalScales', 'environmentTemplates', 'bundles', 'haiCriteria']) expect(rails).toContain(`id:'${id}'`)
    // The indicator definitions moved to «Δείκτες & Στόχοι».
    expect(rails).not.toContain("id:'indicators'")
    for (const id of ['hospitalStructure', 'prevalenceSurvey']) expect(hospitalTabs).not.toContain(`id:'${id}'`)
    // The outbreak investigations moved to Surveillance › Outbreaks; LIRA & AI keeps the AI settings.
    expect(hospitalTabs).not.toContain("id:'liraOutbreaks'")
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

  it('gives outbreak investigations to the Infection Control Lead via VIEW_LIRA, as a tab of Surveillance', () => {
    expect(sectionTabsFor('surveillance', { role: ROLES.INFECTION_CONTROL_LEAD }).map(tab => tab.id)).toContain('outbreaks')
    expect(SECTION_TABS.surveillance.tabs.find(tab => tab.id === 'outbreaks').capability).toBe(CAPABILITIES.VIEW_LIRA)
    expect(can(ROLES.INFECTION_CONTROL_LEAD, CAPABILITIES.VIEW_LIRA, [], [])).toBe(true)
    expect(page).toContain("navigate('/surveillance?tab=outbreaks',{replace:true})")
  })
})

describe('Indicators › Data: structural indicators and PPS (bed days: own Management tab)', () => {
  const data = readSource('src/features/indicators/IndicatorDataPanel.jsx')
  const executive = readSource('src/features/executive/ExecutiveDashboardPage.jsx')
  const route = readSource('src/features/indicators/IndicatorsRoute.jsx')
  it('lists the three hand-entered data screens, each behind its own capability', () => {
    expect(data).not.toContain("id: 'patientDays'")
    for (const [id, capability] of [['hospitalStructure', 'MANAGE_HOSPITAL_STRUCTURE'], ['prevalenceSurvey', 'RECORD_PREVALENCE_SURVEY']]) {
      expect(data).toContain(`ok(CAPABILITIES.${capability}) ? [{ id: '${id}'`)
    }
  })
  it('is a tab of the Indicators, on the executive dashboard and on the indicators list', () => {
    expect(executive).toContain("const DATA_TAB=['data','Δεδομένα','Data',Database,[]]")
    expect(executive).toContain('<IndicatorDataPanel initial={query.get(\'item\')}/>')
    expect(route).toContain("params.get('tab') === 'data' ? 'data' : 'list'")
  })
})
