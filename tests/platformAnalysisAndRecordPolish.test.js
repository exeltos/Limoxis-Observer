import { describe,it,expect } from 'vitest'
import fs from 'node:fs'
// Only the declarations matter here, not whether they carry !important.
const withoutImportant = css => css.replaceAll('!important', '')


const analysisPrint=fs.readFileSync('src/styles/responsive.css','utf8')
const ownerPolish=fs.readFileSync('src/styles/design-system.css','utf8')

describe('Analysis workspace layout and organization summary strip polish',()=>{
  it('never clips the analytics sticky filter/tabs row behind a fixed height', () => {
    expect(analysisPrint).not.toContain('flex:0 0 120px!important;height:120px!important;min-height:120px!important;max-height:120px!important')
    const sticky=[...analysisPrint.matchAll(/\.analysis-workspace>\.analysis-sticky\{([^}]*)\}/g)].map(m=>m[1]).join(';')
    for(const declaration of ['height:auto!important','min-height:0!important','max-height:none!important','margin:0!important','padding:14px 16px!important','overflow:visible!important'])expect(sticky).toContain(declaration)
  })

  it('gives the organization/organization-owned summary strips the same platform-wide styling regardless of hospital vs platform scope', () => {
    expect(analysisPrint).not.toContain('.analysis-workspace.platform-analysis-page')
  })

  it('never hard-caps the analytics header height, so the eyebrow/title/subtitle never hide behind the filter card below it', () => {
    expect(analysisPrint).not.toContain('flex:0 0 var(--platform-analysis-header-h)!important;height:var(--platform-analysis-header-h)!important;min-height:var(--platform-analysis-header-h)!important')
    expect(withoutImportant(analysisPrint)).toContain('flex:0 0 auto;height:auto;min-height:var(--platform-analysis-header-h);')
  })

  it('keeps breathing room between the organization KPI summary strip and the elements around it', () => {
    expect(ownerPolish).toContain('display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0 0 12px;')
  })
})
