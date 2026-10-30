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

describe('arranging a round', () => {
  it('starts with the planned departments spread over the days and the others outside the round', async () => {
    const { roundPlan } = await import('../src/features/quality/audits/auditModel')
    const planned = ['Αιμοδοσία', 'ΜΕΘ', 'ΤΕΠ', 'Χειρουργική'].map((department, index) => ({ id: `a${index}`, department, status: 'planned', lifecycleStatus: 'active', auditType: 'internal', plannedDate: '2026-11-15' }))
    const plan = roundPlan(planned, [{ id: 'd1', name: 'ΜΕΘ' }, { id: 'd2', name: 'Κουζίνα' }], '2026-11-10', 3)
    expect(plan.days).toEqual(['2026-11-10', '2026-11-11', '2026-11-12'])
    const inRound = plan.items.filter(item => item.day != null)
    expect(inRound).toHaveLength(4)
    expect(new Set(inRound.map(item => item.day)).size).toBe(3)
    const outside = plan.items.filter(item => item.day == null)
    expect(outside.map(item => item.department)).toEqual(['Κουζίνα'])
    expect(outside[0].auditId).toBeNull()
  })
})

describe('readiness of the basic questionnaire', () => {
  it('counts each answer for every standard its clause reference names', async () => {
    const { auditReadiness, rowStandards } = await import('../src/features/quality/audits/auditModel')
    expect(rowStandards({ clauseRef: 'JCI IPSG.1 · ISO 9001 8.5' })).toEqual(['iso9001', 'jci'])
    expect(rowStandards({ clauseRef: 'TEMOS T2 · JCI PFR' })).toEqual(['jci', 'temos'])
    expect(rowStandards({ clauseRef: '4.1', standard: 'iso9001' })).toEqual(['iso9001'])
    const row = (clauseRef, result) => ({ clauseRef, result, answer: result === 'yes' ? 'yes' : 'no', required: true, chapterRef: 'ΑΣΦ', chapterTitle: 'Ασφάλεια', weight: 1, standard: 'other' })
    const audit = { id: 'a1', department: 'ΜΕΘ', status: 'completed', lifecycleStatus: 'active', standard: 'other', completedDate: '2026-05-12', plannedDate: '2026-05-12',
      checklist: [row('JCI IPSG.1 · ISO 9001 8.5', 'yes'), row('JCI MMU', 'no'), row('TEMOS T2 · JCI PFR', 'yes'), row('ISO 9001 7.5', 'yes')] }
    const { rows } = auditReadiness([audit], [], '2026-10-30')
    const byStandard = Object.fromEntries(rows.map(item => [item.standard, item]))
    expect(Object.keys(byStandard).sort()).toEqual(['iso9001', 'jci', 'temos'])
    expect(byStandard.iso9001.rate).toBe(100)
    expect(byStandard.jci.rate).toBeLessThan(100)
    expect(byStandard.temos.rate).toBe(100)
  })
})
