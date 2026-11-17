import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { BarList } from '../src/features/analysis/AnalysisCharts'

// Γ (ιδιοκτήτης 16/11/2026): the comparison marker on the bars; Codex #661: one scale for both periods.
describe('bar list with a comparison', () => {
  it('puts the comparison on the same scale as the bars, even when it is larger than every bar', () => {
    const html = renderToStaticMarkup(<BarList en={false} rows={[['ΜΕΘ', 10]]} compare={[['ΜΕΘ', 20]]} compareLabel="2025" />)
    // 10 now against 20 before: the bar is half the track, the marker at its end.
    expect(html).toContain('width:50%')
    expect(html).toContain('left:100%')
    expect(html).toContain('−10')
  })
})
