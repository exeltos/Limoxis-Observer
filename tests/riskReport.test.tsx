// @vitest-environment jsdom
// The printed risk assessment: its page footer comes from the form's own text,
// which must never be able to close the <style> it is written into.
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { RiskReport } from '../src/features/quality/risk/RiskReport'
import { summarizeRisks } from '../src/features/quality/risk/riskModel'

afterEach(cleanup)
const risk = { id: 'r1', lineageKey: 'R001', section: 'clinical', hazard: 'Πτώση', inherentL: 4, inherentC: 4, residualL: 2, residualC: 3 }
const report = assessment => render(<RiskReport assessment={{ periodLabel: '2026', assessedOn: '2026-10-06', status: 'draft', risks: [risk], opportunities: [], ...assessment }} summary={summarizeRisks([risk])} previous={null} organizationName="Νοσοκομείο" en={false} locale="el-GR"/>)

describe('RiskReport', () => {
  it('puts the form, title and page number in the page footer', () => {
    const { container } = report({ formCode: 'ΠΟΙ-ΕΚ-01', title: 'Εκτίμηση 2026' })
    const css = container.querySelector('style').textContent
    expect(css).toContain('"ΠΟΙ-ΕΚ-01 · Εκτίμηση 2026 · 2026"')
    expect(css).toContain('counter(page) " / " counter(pages)')
  })

  it('keeps form text from closing its style tag when the report is copied to the print window', () => {
    const { container } = report({ formCode: '</style><script>alert(1)</script>', title: 'Τ"ίτλος' })
    // printElement copies the report as HTML; parsing it back must leave one style and no script.
    const copy = document.createElement('div')
    copy.innerHTML = container.innerHTML
    expect(copy.querySelectorAll('script')).toHaveLength(0)
    expect(copy.querySelector('style').textContent).not.toMatch(/<\/style/i)
    expect(copy.querySelector('style').textContent).toContain('\\3c /style>')
  })
})
