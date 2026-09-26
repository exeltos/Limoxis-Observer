import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

const read = file => fs.readFileSync(file, 'utf8')

describe('Management Center review', () => {
  it('outbreak investigations and LIRA knowledge use the shared registry pattern', () => {
    for (const file of ['src/features/management/LiraOutbreakInvestigationsPanel.jsx', 'src/features/management/LiraKnowledgePanel.jsx']) {
      const source = read(file)
      expect(source).toContain('<FilterBar')
      expect(source).toContain('<RegistryTable')
    }
  })

  it('outbreak investigations never query the database in the demo', () => {
    expect(read('src/features/management/LiraOutbreakInvestigationsPanel.jsx')).toContain('if(!tenant?.id||isDemo)return')
    expect(read('src/features/management/LiraKnowledgePanel.jsx')).toContain('if(!supabase){setRows([])')
  })

  it('structural indicators and PPS use the registry table with a ⋯ menu', () => {
    for (const file of ['src/features/management/HospitalStructurePanel.jsx', 'src/features/management/PrevalenceSurveyPanel.jsx']) {
      const source = read(file)
      expect(source).toContain('<RegistryTable')
      expect(source).toContain('<OverflowMenu')
      expect(source).toContain('<ObserverDialog')
      expect(source).not.toContain('record-table')
    }
  })

  it('library categories and the LIRA knowledge tab are translated', () => {
    const i18n = read('src/core/i18n/LanguageContext.jsx') + read('src/core/i18n/stringsEn.js')
    expect(i18n).toContain("libraryDeviceTypes:'Τύποι επεμβατικών συσκευών'")
    expect(i18n).toContain("librarySurveillanceDefinitions:'Surveillance definitions'")
    expect(i18n).toContain("liraKnowledgeLabel:'Γνώση LIRA'")
    expect(read('src/features/management/ManagementPage.jsx')).not.toContain("label:'LIRA Knowledge'")
  })

  it('hospital roles hide the platform owner role', () => {
    expect(read('src/features/management/ManagementRolesPanel.jsx')).toContain("key!=='platform_owner'")
  })

  it('clinical scales show the demo catalogue', () => {
    expect(read('src/features/management/ClinicalScalesPanel.jsx')).toContain('setRows(demoClinicalScaleDefinitions.map')
  })

  it('the platform update bar has distinctive update and history buttons', () => {
    const page = read('src/features/management/ManagementPage.jsx')
    expect(page).toContain('management-update-run')
    expect(page).toContain('management-update-history')
    expect(read('src/features/management/managementCenter.css')).toContain('.management-update-run{')
  })

  it('management tabs use the record-tab underline style', () => {
    expect(read('src/styles/responsive.css')).toContain('border-bottom-color:#2582bd')
  })

  it('the documents card stays full width in record bodies', () => {
    expect(read('src/design-system/DocumentsWorkspace.css')).toContain('width:100%!important')
  })
})

describe('Management Center follow-ups', () => {
  it('the outbreak workspace uses shared sections, registry tables and translated evidence entries', () => {
    const source = read('src/features/management/LiraOutbreakInvestigationsPanel.jsx')
    expect(source).not.toContain('className="management-table"')
    expect(source).toContain('<RecordDetailsGrid')
    expect(source).toContain('function eventText(')
    expect(source).not.toContain("b.code.replaceAll('_',' ')")
  })

  it('indicator sources are translated for English readers', () => {
    expect(read('src/features/management/IndicatorsPanel.jsx')).toContain('sourceText(item.sourceAuthority,el)')
  })
})
