import { describe, expect, it } from 'vitest'
import { readSource } from './helpers/readSource'
const center=readSource('src/features/workspaces/PlatformCenterPage.jsx')
const record=readSource('src/features/platform/PlatformOrganizationRecord.jsx')
const css=readSource('src/styles/design-system.css')
describe('Platform Owner canonical analytics architecture',()=>{
  it('uses one shared AnalysisPage',()=>{expect(center).toContain('<AnalysisPage platform organizations={organizations}/>');expect(center).not.toContain('openOrganizationAnalysis');expect(center).not.toContain('onOpenAnalysis=')})
  it('removes duplicate organization analytics tab',()=>{expect(record).not.toContain("id:'analysis'");expect(record).not.toContain("initialTab==='analysis'");expect(record).not.toContain('onOpenAnalysis')})
  it('removes obsolete analytics placeholder styling',()=>{expect(css).not.toContain('.platform-org-analysis-link')})
  it('maps legacy analytics hashes safely',()=>{expect(center).toContain("requestedOrgDetailTab==='analysis'?'details':requestedOrgDetailTab")})
})
