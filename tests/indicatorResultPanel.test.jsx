// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/features/indicators/indicatorCloudService', () => ({
  collectCloudIndicatorMetrics: vi.fn(async () => ({ clabsi: 3, line_days: 1067 })),
  loadOperationalIndicatorDefinitions: vi.fn(async () => [{ definitionId: 'def-1', id: 'clabsi-rate', unit: '/1.000 ημέρες', unitEn: '/1,000 days', target: 2, direction: 'lower' }]),
  loadIndicatorSnapshots: vi.fn(async () => [{ id: 's1', indicator_key: 'clabsi-rate', period_start: '2026-09-01', period_end: '2026-09-30', value: 1.9, numerator: 2, denominator: 1050, target_value: 2, status: 'approved' }, { id: 's2', indicator_key: 'other', period_start: '2026-09-01', period_end: '2026-09-30', value: 9, status: 'approved' }]),
  calculateCloudDefinition: vi.fn((def) => ({ ...def, value: 2.8, evidence: '3 / 1067', status: 'attention' })),
}))
const { IndicatorResultPanel } = await import('../src/features/indicators/IndicatorResultPanel.jsx')

describe('IndicatorResultPanel', () => {
  afterEach(cleanup)

  it('shows the period result against its target and only this indicator\'s saved results', async () => {
    render(<IndicatorResultPanel organizationId="org" record={{ id: 'def-1', key: 'clabsi-rate' }} period={{ from: '2026-10-01', to: '2026-10-09' }} language="el"/>)
    expect(await screen.findByText('2,8')).toBeTruthy()
    expect(screen.getByText('3 / 1067')).toBeTruthy()
    expect(screen.getByText('≤ 2 /1.000 ημέρες')).toBeTruthy()
    expect(screen.getByText('Χρειάζεται προσοχή')).toBeTruthy()
    expect(screen.getByText('1/10/2026 – 9/10/2026 · Όλο το νοσοκομείο')).toBeTruthy()
    expect(screen.getByText('1/9/2026 – 30/9/2026')).toBeTruthy()
    expect(screen.getAllByRole('row')).toHaveLength(2)
  })
})
