import { describe,it,expect } from 'vitest'
import fs from 'node:fs'

const analysisPrint=fs.readFileSync('src/styles/analysis-print.css','utf8')
const ownerPolish=fs.readFileSync('src/styles/platform-owner-polish.css','utf8')

describe('Analysis workspace layout and organization summary strip polish',()=>{
  it('never clips the analytics sticky filter/tabs row behind a fixed height', () => {
    expect(analysisPrint).not.toContain('flex:0 0 120px!important;height:120px!important;min-height:120px!important;max-height:120px!important')
    expect(analysisPrint).toContain('flex:0 0 auto!important;height:auto!important;min-height:0!important;max-height:none!important;\n margin:0!important;padding:14px 16px!important;overflow:visible!important;')
  })

  it('gives the organization/organization-owned summary strips the same platform-wide styling regardless of hospital vs platform scope', () => {
    expect(analysisPrint).not.toContain('.analysis-workspace.platform-analysis-page')
  })

  it('never hard-caps the analytics header height, so the eyebrow/title/subtitle never hide behind the filter card below it', () => {
    expect(analysisPrint).not.toContain('flex:0 0 var(--platform-analysis-header-h)!important;height:var(--platform-analysis-header-h)!important;min-height:var(--platform-analysis-header-h)!important')
    expect(analysisPrint).toContain('flex:0 0 auto!important;height:auto!important;min-height:var(--platform-analysis-header-h)!important;')
  })

  it('keeps breathing room between the organization KPI summary strip and the elements around it', () => {
    expect(ownerPolish).toContain('display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0 0 12px;')
  })
})
