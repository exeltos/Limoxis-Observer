// @vitest-environment jsdom
// The period comparison: what moved on each risk (L or C), and the trend chart
// once there are three periods or more.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { RiskComparison } from '../src/features/quality/risk/RiskComparison'

const risk = (l, c) => ({ id: `r${l}${c}`, code: 'R001', lineageKey: 'R001', hazard: 'Πτώση ασθενούς', inherentL: 4, inherentC: 4, residualL: l, residualC: c })
const period = (id, year, l, c) => ({ id, periodLabel: String(year), assessedOn: `${year}-10-06`, risks: [risk(l, c)] })

afterEach(cleanup)

describe('RiskComparison', () => {
  it('shows the axis that changed and opens the risk', () => {
    const onOpen = vi.fn()
    const current = period('b', 2026, 2, 3)
    render(<RiskComparison assessment={current} assessments={[current, period('a', 2025, 3, 3)]} en={false} locale="el-GR" onOpen={onOpen}/>)
    expect(screen.getByText('L')).toBeInTheDocument()
    expect(screen.getByText('3 → 2', { exact: false })).toBeInTheDocument()
    expect(document.querySelector('.risk-trend-chart')).toBeNull()
    fireEvent.click(screen.getByText('Πτώση ασθενούς'))
    expect(onOpen).toHaveBeenCalledWith(current.risks[0])
  })

  it('draws the trend chart from three periods', () => {
    const current = period('c', 2026, 2, 2)
    render(<RiskComparison assessment={current} assessments={[current, period('b', 2025, 3, 3), period('a', 2024, 4, 4)]} en={false} locale="el-GR"/>)
    expect(document.querySelector('.risk-trend-chart svg')).toBeInTheDocument()
    expect(document.querySelectorAll('.risk-trend-chart .dot-avg')).toHaveLength(3)
  })
})
