import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

// User-reported: the AST/AMR card's per-organism badge always used
// "status-badge active" (the app's green/success tone) — including for
// "Χωρίς AMR ταξινόμηση" (no classification yet). In a clinical IPC tool,
// showing a multi-drug-resistant organism (MDR/XDR/PDR) with a green
// "success" badge is actively misleading, and showing the same green tone
// for "nothing recorded yet" is just wrong. Every other AMR/resistance
// badge in the app uses "status-badge danger" for a real classification
// and no colored badge at all for none (AnalysisPage.jsx:
// resistanceClass&&resistanceClass!=='—'?<span className="status-badge danger">
// ...:'—'). Aligned the AST panel's badge with that convention. A later
// redesign (the isolate-card visual hierarchy pass) restated the same
// fix as a plain conditional — no badge at all when there is no
// classification, rather than a neutral placeholder badge — which still
// satisfies the original bug report: the badge is never the green
// "active" tone for an AMR classification.
describe('the laboratory AST/AMR panel badge uses a tone that matches its meaning', () => {
  it('uses the danger (red) tone only when there is a real AMR classification, and renders nothing otherwise', () => {
    const source = fs.readFileSync('src/features/laboratory/LaboratorySampleRecordFunctionalView.jsx', 'utf8')
    expect(source).toContain('{current&&<span className="status-badge danger">{current.classification}</span>}')
    expect(source).not.toContain('<span className="status-badge active">{current?.classification')
    expect(source).not.toMatch(/status-badge active[^"]*>\{current/)
  })
})
