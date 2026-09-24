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
// ...:'—'). Aligned the AST panel's badge with that convention.
describe('the laboratory AST/AMR panel badge uses a tone that matches its meaning', () => {
  it('uses the danger (red) tone only when there is a real AMR classification, and a neutral badge otherwise', () => {
    const source = fs.readFileSync('src/features/laboratory/LaboratorySampleRecordFunctionalView.jsx', 'utf8')
    expect(source).toContain("<span className={current?'status-badge danger':'status-badge'}>{current?.classification||")
    expect(source).not.toContain('<span className="status-badge active">{current?.classification')
  })
})
