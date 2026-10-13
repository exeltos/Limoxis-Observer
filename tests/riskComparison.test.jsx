// @vitest-environment jsdom
// The period comparison: what moved on each risk (L or C), and the trend chart
// once there are three periods or more.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { RiskComparison } from '../src/features/quality/risk/RiskComparison'
import { counterpart, periodKey, periodOf, suggestPeriodLabel } from '../src/features/quality/risk/riskModel'

const risk = (l, c) => ({ id: `r${l}${c}`, code: 'R001', lineageKey: 'R001', hazard: 'Πτώση ασθενούς', inherentL: 4, inherentC: 4, residualL: l, residualC: c })
const period = (id, year, l, c, extra = {}) => ({ id, code: id, periodLabel: String(year), periodKind: 'annual', assessedOn: `${year}-10-06`, risks: [risk(l, c)], ...extra })

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
    expect(onOpen).toHaveBeenCalledWith(current.risks[0], current)
  })

  it('draws the trend chart from three periods', () => {
    const current = period('c', 2026, 2, 2)
    render(<RiskComparison assessment={current} assessments={[current, period('b', 2025, 3, 3), period('a', 2024, 4, 4)]} en={false} locale="el-GR"/>)
    expect(document.querySelector('.risk-trend-chart svg')).toBeInTheDocument()
    expect(document.querySelectorAll('.risk-trend-chart .dot-avg')).toHaveLength(3)
  })

  it('compares a half-year with the same one last year, or with the one before', () => {
    const half = (id, label, date, l) => ({ id, code: id, periodLabel: label, periodKind: 'semester', assessedOn: date, risks: [risk(l, 3)] })
    const h1 = half('h1', "Α' εξάμηνο 2026", '2026-06-30', 2)
    const list = [h1, half('h2', "Β' εξάμηνο 2025", '2025-12-20', 3), half('h0', "Α' εξάμηνο 2025", '2025-06-30', 4), period('y', 2025, 3, 3)]
    render(<RiskComparison assessment={h1} assessments={list} en={false} locale="el-GR"/>)
    const hint = () => document.querySelector('.risk-compare-sentence strong').textContent
    expect(hint()).toBe("Α' εξάμηνο 2025")
    fireEvent.click(screen.getByRole('tab', { name: 'Προηγούμενη περίοδος' }))
    expect(hint()).toBe("Β' εξάμηνο 2025")
    fireEvent.click(screen.getByRole('tab', { name: /Τρίμηνο/ }))
    expect(screen.getByRole('tab', { name: /Τρίμηνο/ })).toBeDisabled()
  })
})

describe('periods', () => {
  it('reads the period from the label, else from the date', () => {
    expect(periodKey(periodOf({ periodKind: 'quarter', periodLabel: "Γ' τρίμηνο 2026", assessedOn: '2026-10-02' }))).toBe('2026-Q3')
    expect(periodKey(periodOf({ periodKind: 'quarter', periodLabel: 'Q2 2026', assessedOn: '2026-07-01' }))).toBe('2026-Q2')
    expect(periodKey(periodOf({ periodKind: 'semester', periodLabel: '2026-Α', assessedOn: '2026-07-10' }))).toBe('2026-S1')
    expect(periodKey(periodOf({ periodKind: 'semester', periodLabel: '2ο εξάμηνο 2025', assessedOn: '2026-01-10' }))).toBe('2025-S2')
    expect(periodKey(periodOf({ periodKind: 'quarter', periodLabel: '2026', assessedOn: '2026-05-10' }))).toBe('2026-Q2')
    expect(periodKey(periodOf({ periodKind: 'annual', periodLabel: '2026', assessedOn: '2026-10-06' }))).toBe('2026')
  })
  it('finds the period to compare with', () => {
    expect(periodKey(counterpart({ kind: 'quarter', year: 2026, index: 1 }, 'previous'))).toBe('2025-Q4')
    expect(periodKey(counterpart({ kind: 'quarter', year: 2026, index: 3 }, 'lastYear'))).toBe('2025-Q3')
    expect(periodKey(counterpart({ kind: 'semester', year: 2026, index: 2 }, 'previous'))).toBe('2026-S1')
    expect(periodKey(counterpart({ kind: 'annual', year: 2026 }, 'previous'))).toBe('2025')
  })
  it('suggests a label for a new assessment', () => {
    expect(suggestPeriodLabel('quarter', '2026-10-13', false)).toBe("Δ' τρίμηνο 2026")
    expect(suggestPeriodLabel('semester', '2026-03-01', false)).toBe("Α' εξάμηνο 2026")
    expect(suggestPeriodLabel('annual', '2026-03-01', false)).toBe('2026')
  })
})
