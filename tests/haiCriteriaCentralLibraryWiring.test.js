import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('HAI criteria central library wiring (platform review roadmap, P3)', () => {
  it('makes evaluateHaiCriteria/haiCriteriaSetForType accept an override sets object, defaulting to the static baseline', () => {
    const definitions = read('src/features/surveillance/haiCriteriaDefinitions.js')
    expect(definitions).toContain('export function haiCriteriaSetForType(typeKey, sets = HAI_CRITERIA_SETS)')
    expect(definitions).toContain('export function evaluateHaiCriteria(typeKey, selectedIds = [], sets = HAI_CRITERIA_SETS)')
  })

  it('loads the centrally-governed criteria sets into the HAI dialog before building its options', () => {
    const page = read('src/features/surveillance/PatientClinicalCanonicalPage.jsx')
    expect(page).toContain("import { loadHaiCriteriaSets } from './haiCriteriaLibraryService'")
    expect(page).toContain('loadHaiCriteriaSets(organizationId)')
    expect(page).toContain('criteriaSets?Object.entries(criteriaSets).map(')
  })

  it('threads organizationId/isDemo from the surveillance workspace down into the HAI dialog', () => {
    const page = read('src/features/surveillance/PatientClinicalCanonicalPage.jsx')
    expect(page).toContain('function CanonicalJourney({record,repository,libraries={},organizationId,isDemo,onLibraryAdded,onReload,t,language,fmtDate,fmtDateTime,permissions})')
    expect(page).toContain('<HaiDialog t={t} items={libraries.surveillanceDefinitions||[]} patientAgeDays={patientAgeDays(record.dateOfBirth)} organizationId={organizationId} isDemo={isDemo}')
  })

  it('exposes a Platform-Owner-governed HAI criteria library panel wired into Management', () => {
    const managementPage = read('src/features/management/ManagementPage.jsx')
    expect(managementPage).toContain("import { HaiCriteriaLibraryPanel } from './HaiCriteriaLibraryPanel'")
    expect(managementPage).toContain("id:'haiCriteria'")
    expect(managementPage).toContain('<HaiCriteriaLibraryPanel global={global}/>')
  })

  it('gates edits to the Platform Owner while still letting hospitals read their propagated copy', () => {
    const panel = read('src/features/management/HaiCriteriaLibraryPanel.jsx')
    expect(panel).toContain('isPlatformOwner')
    expect(panel).toContain('loadHaiCriteriaLibraryItems')
    expect(panel).toContain('loadGlobalHaiCriteriaLibraryItems')
    expect(panel).toContain('updateGlobalHaiCriteriaLibraryItem')
  })
})
