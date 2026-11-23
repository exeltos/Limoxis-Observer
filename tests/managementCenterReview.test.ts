import { describe, expect, it } from 'vitest'
import { readSource } from './helpers/readSource'
// Only the declarations matter here, not whether they carry !important.
const withoutImportant = css => css.replaceAll('!important', '')


const read = file => readSource(file)

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
    expect(read('src/features/management/LiraKnowledgePanel.jsx')).toContain('if(!supabase||isOwnerPreview()){setRows([])')
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
    const i18n = read('src/core/i18n/stringsEl.js') + read('src/core/i18n/stringsEn.js')
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

  it('the clinical sources update center is a tab of «Νομοθεσία & πηγές», not buttons on the Lists (owner, 23/11/2026)', () => {
    const page = read('src/features/management/ManagementPage.jsx')
    const tabs = read('src/features/platform/PlatformLegalTabs.jsx')
    expect(page).not.toContain('const updateActions=')
    expect(page).not.toContain('updateCenterOpen')
    expect(page).toContain("const clinicalView=global&&isPlatformOwner&&group==='clinical'")
    expect(page).toContain('<Page fill actions={clinicalView?null:sourcesActions}')
    expect(page).toContain("<PlatformLegalTabs active={clinicalView?'clinical':'references'}/>")
    expect(tabs).toContain("clinical: '/platform#management?group=clinical'")
    expect(tabs).toContain("{ id: 'clinical', label: en ? 'Clinical sources' : 'Κλινικές πηγές', icon: History, count: count(shown.clinical) }")
    expect(read('src/features/platform/PlatformGlobalManagement.jsx')).toContain("'clinical'")
  })

  it('the update center is a tab screen, not a dialog, with one progress bar', () => {
    const page = read('src/features/management/ManagementPage.jsx')
    const center = read('src/features/management/PlatformUpdateCenter.jsx')
    expect(page).toContain('{clinicalView?<PlatformUpdateCenter ')
    expect(page).not.toContain('management-center-update-progress')
    expect(center).not.toContain('ObserverDialog')
    expect(center).toContain('puc-page')
    expect(center).toContain('{onClose&&<header className="puc-page-header">')
    expect(center).toContain('{c.sourcesProgress} {running.subCurrent}/{running.subTotal}')
  })

  it('management tabs use the record-tab underline style', () => {
    expect(read('src/styles/responsive.css')).toContain('border-bottom-color:#2582bd')
  })

  it('the documents card stays full width in record bodies', () => {
    expect(withoutImportant(read('src/design-system/DocumentsWorkspace.css'))).toContain('width:100%')
  })
})

describe('Management Center follow-ups', () => {
  it('the outbreak workspace uses shared sections, registry tables and translated evidence entries', () => {
    const source = read('src/features/management/LiraOutbreakInvestigationsPanel.jsx')
    expect(source).not.toContain('className="management-table"')
    expect(source).toContain('<RegistryPagination')
    expect(source).toContain('<EntityRecordShell')
    // The evidence trail is no longer a tab (owner, 19/11/2026): it is translated in the PDF report.
    expect(source).toContain('events={events as OutbreakEventLike[]}')
    expect(source).not.toContain("b.code.replaceAll('_',' ')")
  })

  it('indicator sources are translated for English readers', () => {
    expect(read('src/features/management/IndicatorsPanel.jsx')).toContain('sourceText(item.sourceAuthority,el)')
  })
})
