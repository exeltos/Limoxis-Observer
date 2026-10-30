// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AuditRounds, roundOfHalf } from '../src/features/quality/audits/AuditRounds'

const departments = ['Καρδιολογική', 'ΜΕΘ', 'Νεφρολογική', 'Ορθοπαιδική', 'Παθολογική', 'Παιδιατρική', 'Χειρουργική', 'ΜΕΝΝ']
const round = (start, status) => departments.map((department, index) => ({
  id: `${start}-${index}`, department, departmentEn: department, status, lifecycleStatus: 'active',
  plannedDate: `${start.slice(0, 8)}${String(Number(start.slice(8)) + Math.floor(index / 3)).padStart(2, '0')}`,
}))
const audits = [...round('2026-05-12', 'completed'), ...round('2026-11-10', 'planned'), { id: 'x', department: 'ΜΕΘ', status: 'planned', plannedDate: '2026-08-20', lifecycleStatus: 'active' }]

afterEach(cleanup)

describe('audit rounds', () => {
  it('finds the three-day stretch of each half of the year and ignores a lone audit', () => {
    expect(roundOfHalf(audits, 2026, 0)).toHaveLength(8)
    expect(roundOfHalf(audits, 2026, 1)).toHaveLength(8)
    expect(roundOfHalf([audits[0], audits[1]], 2026, 0)).toHaveLength(0)
  })

  it('shows each round on one line and opens the departments by day on a click', () => {
    render(<AuditRounds audits={audits} year={2026} language="el" onRound={() => {}} />)
    expect(screen.getByText('Άνοιξη 2026')).toBeTruthy()
    expect(screen.getByText('Φθινόπωρο 2026')).toBeTruthy()
    expect(screen.getByText('Ολοκληρώθηκε')).toBeTruthy()
    expect(screen.getByText('Προγραμματισμένος')).toBeTruthy()
    expect(screen.queryByRole('list')).toBeNull()
    fireEvent.click(screen.getByText('Φθινόπωρο 2026'))
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('offers to plan a round where there is none', () => {
    render(<AuditRounds audits={[]} year={2027} language="el" onRound={() => {}} />)
    expect(screen.getAllByRole('button', { name: /Προγραμματισμός/ })).toHaveLength(2)
  })
})
