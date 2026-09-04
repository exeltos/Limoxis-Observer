import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
const center=fs.readFileSync('src/features/workspaces/PlatformCenterPage.jsx','utf8')
const record=fs.readFileSync('src/features/platform/PlatformOrganizationRecord.jsx','utf8')
const css=fs.readFileSync('src/styles/platform-owner-polish.css','utf8')
describe('Platform Owner canonical analytics architecture',()=>{
  it('uses one shared AnalysisPage',()=>{expect(center).toContain('<AnalysisPage platform organizations={organizations} />');expect(center).not.toContain('openOrganizationAnalysis');expect(center).not.toContain('onOpenAnalysis=')})
  it('removes duplicate organization analytics tab',()=>{expect(record).not.toContain("id:'analysis'");expect(record).not.toContain("initialTab==='analysis'");expect(record).not.toContain('onOpenAnalysis')})
  it('removes obsolete analytics placeholder styling',()=>{expect(css).not.toContain('.platform-org-analysis-link')})
  it('maps legacy analytics hashes safely',()=>{expect(center).toContain("requestedOrgDetailTab === 'analysis' ? 'details' : requestedOrgDetailTab")})
})
