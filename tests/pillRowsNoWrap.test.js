import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Owner's rule: pill / chip / totals groups never break onto a second line (docs/CSS_ARCHITECTURE.md).
const rule = (file, selector) => {
  const css = readFileSync(file, 'utf8')
  const at = css.indexOf(`${selector}{`)
  expect(at, `${selector} in ${file}`).toBeGreaterThan(-1)
  return css.slice(at, css.indexOf('}', at))
}

describe('pill rows stay on one line', () => {
  it('registry totals do not wrap', () => {
    const block = rule('src/styles/design-system.css', '.registry-totals')
    expect(block).toContain('flex-wrap:nowrap')
    expect(block).not.toContain('flex-wrap:wrap')
  })

  it('analysis figures do not wrap', () => {
    const block = rule('src/features/analysis/AnalysisCharts.css', '.analysis-figures')
    expect(block).toContain('flex-wrap:nowrap')
    expect(block).not.toContain('flex-wrap:wrap')
  })
})
