import { describe, it, expect } from 'vitest'
import fs from 'node:fs'

const page = fs.readFileSync('src/features/analysis/AnalysisPage.jsx', 'utf8')

// Analysis-page audit finding (P1): platform_report_summary returns `null`
// for `antimicrobial` and `committees` when the request is department-scoped
// (they are hospital-wide concepts, not tracked per department — see
// 20260905092247_analysis_department_scope.sql). buildProductionRows'
// `??0` fallback turned that into a fabricated "0 Antimicrobial therapies" /
// "0 Committees" whenever a department filter was applied, indistinguishable
// from an honest zero. Fixed the same way as occupationalHealth in the P0
// PR: fall back to '—' instead of 0.
describe('Analysis KPI rows show "—", not a fabricated 0, for department-scoped-null fields', () => {
  it('the Antimicrobials tab falls back to "—" for a department-scoped summary.antimicrobial', () => {
    expect(page).toContain("summary.antimicrobial??'—'")
    expect(page).not.toContain('summary.antimicrobial??0')
  })

  it('the Governance tab falls back to "—" for a department-scoped summary.committees', () => {
    expect(page).toContain("summary.committees??'—'")
    expect(page).not.toContain('summary.committees??0')
  })

  it('leaves summary.documents alone — platform_report_summary always returns a real count for it, department-scoped or not', () => {
    expect(page).toContain('summary.documents??0')
  })
})
