import { describe,it,expect } from 'vitest'
import { readSource } from './helpers/readSource'
// Only the declarations matter here, not whether they carry !important.
const withoutImportant = css => css.replaceAll('!important', '')


// Οι κανόνες της Ανάλυσης φορτώνονται με τη σελίδα της (analysisScreens.css).
const analysisPrint=readSource('src/styles/responsive.css')+readSource('src/features/analysis/analysisScreens.css')
const ownerPolish=readSource('src/styles/design-system.css')

describe('Analysis workspace layout and organization summary strip polish',()=>{
  it('never clips the analytics sticky filter/tabs row behind a fixed height', () => {
    expect(withoutImportant(analysisPrint)).not.toContain('flex:0 0 120px;height:120px;min-height:120px;max-height:120px')
    const sticky=[...withoutImportant(analysisPrint).matchAll(/\.analysis-workspace>\.analysis-sticky\{([^}]*)\}/g)].map(m=>m[1]).join(';')
    for(const declaration of ['height:auto','min-height:0','max-height:none','margin:0','padding:14px 16px','overflow:visible'])expect(sticky).toContain(declaration)
  })

  it('gives the organization/organization-owned summary strips the same platform-wide styling regardless of hospital vs platform scope', () => {
    expect(analysisPrint).not.toContain('.analysis-workspace.platform-analysis-page')
  })

  it('never hard-caps the analytics header height, so the eyebrow/title/subtitle never hide behind the filter card below it', () => {
    expect(withoutImportant(analysisPrint)).not.toContain('flex:0 0 var(--platform-analysis-header-h);height:var(--platform-analysis-header-h);min-height:var(--platform-analysis-header-h)')
    expect(withoutImportant(analysisPrint)).toContain('flex:0 0 auto;height:auto;min-height:var(--platform-analysis-header-h);')
  })

  it('keeps breathing room between the organization KPI summary strip and the elements around it', () => {
    // The organization record uses the shared summary cards (as every other page) with room below them.
    expect(ownerPolish).toContain('.platform-owner-details>.module-summary-strip{margin:0 0 12px}')
  })
})
