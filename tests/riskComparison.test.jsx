// @vitest-environment jsdom
// The period comparison: any two periods, what moved on each risk (L or C),
// and the trend chart once there are three periods or more.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { RiskComparison as Comparison } from '../src/features/quality/risk/RiskComparison'
import { LanguageProvider } from '../src/core/i18n/LanguageContext'
import { counterpart, periodKey, periodOf, suggestPeriodLabel } from '../src/features/quality/risk/riskModel'

const risk = (l, c) => ({ id: `r${l}${c}`, code: 'R001', lineageKey: 'R001', hazard: 'Πτώση ασθενούς', inherentL: 4, inherentC: 4, residualL: l, residualC: c })
const period = (id, year, l, c, extra = {}) => ({ id, code: id, periodLabel: String(year), periodKind: 'annual', assessedOn: `${year}-10-06`, risks: [risk(l, c)], ...extra })

afterEach(cleanup)
const RiskComparison = props => <LanguageProvider><Comparison {...props}/></LanguageProvider>
const tick = label => fireEvent.click(screen.getByLabelText(`Επιλογή ${label}`))

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
    fireEvent.click(screen.getByRole('button', { name: /Χειροτέρεψε/ }))
    expect(screen.getByText('Κανένας κίνδυνος σε αυτή την κατάσταση.')).toBeInTheDocument()
  })

  it('draws the trend chart from three periods', () => {
    const current = period('c', 2026, 2, 2)
    render(<RiskComparison assessment={current} assessments={[current, period('b', 2025, 3, 3), period('a', 2024, 4, 4)]} en={false} locale="el-GR"/>)
    expect(document.querySelector('.risk-trend-chart svg')).toBeInTheDocument()
    expect(document.querySelectorAll('.risk-trend-chart .dot-avg')).toHaveLength(3)
  })

  it('compares any two periods the user picks, not only consecutive ones', () => {
    const current = period('c', 2026, 2, 3)
    render(<RiskComparison assessment={current} assessments={[current, period('b', 2025, 3, 3), period('a', 2024, 4, 4)]} en={false} locale="el-GR"/>)
    const headers = () => [...document.querySelectorAll('.risk-compare-table thead th')].slice(2, 4).map(th => th.textContent)
    expect(headers()).toEqual(['2025', '2026'])
    expect(screen.getByLabelText('Επιλογή 2024')).not.toBeChecked()
    // Ticking 2024 drops the pick ticked first (2025): 2026 against 2024.
    tick('2024')
    expect(headers()).toEqual(['2024', '2026'])
    expect(document.querySelector('.risk-compare-table .risk-delta').textContent).toBe('-10')
    expect(screen.getByLabelText('Επιλογή 2025')).not.toBeChecked()
    // The newer of the two is always compared with the older.
    tick('2025')
    expect(headers()).toEqual(['2024', '2025'])
    expect(screen.getByLabelText('Επιλογή 2026')).not.toBeChecked()
  })
})

describe('pages', () => {
  it('shows 15 risks a page with the registries\' pager, on the page of the risk last opened', () => {
    const many = (id, year, l) => ({ id, code: id, periodLabel: String(year), periodKind: 'annual', assessedOn: `${year}-10-06`, risks: Array.from({ length: 20 }, (_, i) => ({ ...risk(l, 3), id: `${id}${i}`, lineageKey: `R${String(i + 1).padStart(3, '0')}`, hazard: `Κίνδυνος ${i + 1}` })) })
    const current = many('b', 2026, 2)
    render(<RiskComparison assessment={current} assessments={[current, many('a', 2025, 3)]} en={false} locale="el-GR" returned="R018"/>)
    expect(document.querySelector('[data-registry-pagination="canonical"]').textContent).toContain('16–20 από 20')
    expect(document.querySelector('.registry-row-returned').textContent).toContain('R018')
    fireEvent.click(screen.getByRole('button', { name: '‹' }))
    expect(document.querySelectorAll('.risk-compare-table tbody tr')).toHaveLength(15)
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
