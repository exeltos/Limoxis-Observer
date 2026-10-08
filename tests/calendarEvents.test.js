import { describe, expect, it } from 'vitest'
import { buildCalendarEvents, monthGrid } from '../src/features/calendar/calendarEvents'

const today = '2026-10-08'
const range = { from: '2026-09-28', to: '2026-11-08', today }

describe('calendar events', () => {
  it('lists control due dates and projects weekly controls across the range', () => {
    const controls = [
      { id: 'CTRL-1', title: 'Fridge', frequency: { kind: 'daily' }, assignments: { ΜΕΘ: { dbId: 'a1', nextDueAt: '2026-10-07T07:00:00', status: 'scheduled' } } },
      { id: 'CTRL-2', title: 'Surfaces', frequency: { kind: 'weekly', interval: 1 }, assignments: { ΤΕΠ: { dbId: 'a2', nextDueAt: '2026-10-10T10:00:00', status: 'scheduled' } } },
    ]
    const events = buildCalendarEvents({ controls }, range)
    const daily = events.filter((e) => e.title === 'Fridge')
    expect(daily).toHaveLength(1)
    expect(daily[0]).toMatchObject({ date: '2026-10-07', state: 'overdue', department: 'ΜΕΘ' })
    expect(events.filter((e) => e.title === 'Surfaces').map((e) => e.date)).toEqual(['2026-10-10', '2026-10-17', '2026-10-24', '2026-10-31', '2026-11-07'])
  })

  it('collects CAPA deadlines, open steps and effectiveness reviews, skipping closed and done ones', () => {
    const capas = [
      { id: 'CAPA-1', title: 'Fix fridge', status: 'open', dueDate: '2026-10-20', effectivenessDue: '2026-11-05', effectivenessStatus: 'pending', subActions: [{ id: 's1', title: 'Move vaccines', dueDate: '2026-10-01', done: false }, { id: 's2', title: 'Inform pharmacy', dueDate: '2026-10-02', done: true }] },
      { id: 'CAPA-2', title: 'Closed', status: 'closed', dueDate: '2026-10-15' },
    ]
    const events = buildCalendarEvents({ capas }, range)
    expect(events.map((e) => [e.date, e.title, e.state])).toEqual([
      ['2026-10-01', 'Move vaccines', 'overdue'],
      ['2026-10-20', 'Fix fridge', 'due'],
      ['2026-11-05', 'Fix fridge', 'due'],
    ])
  })

  it('adds training deadlines, certificate expiries, document reviews and committee meetings', () => {
    const events = buildCalendarEvents({
      training: { programs: [{ id: 'TRN-1', title: 'Hand hygiene', status: 'active', dueDate: '2026-10-30' }], assignments: [{ id: 'A1', programId: 'TRN-1', status: 'assigned', employeeName: 'M.', department: 'ΜΕΘ' }], certificates: [{ id: 'C1', assignmentId: 'A1', title: 'Hand hygiene', validUntil: '2026-10-25' }] },
      documentFamilies: [{ root: { id: 'DOC-1' }, activePublished: { id: 'DOC-1', title: 'Policy', version: '1.0', reviewDate: '2026-10-15' } }],
      committees: [{ id: 'COM-1', shortName: 'ΕΝΛ', meetings: [{ id: 'M1', title: 'Monthly meeting', status: 'planned', date: '2026-10-21' }], decisions: [{ id: 'D1', title: 'Audit CVC bundle', dueDate: '2026-10-05', status: 'open' }] }],
    }, range)
    expect(events.map((e) => [e.date, e.kind, e.state])).toEqual([
      ['2026-10-05', 'committees', 'overdue'],
      ['2026-10-15', 'documents', 'due'],
      ['2026-10-21', 'committees', 'planned'],
      ['2026-10-25', 'training', 'planned'],
      ['2026-10-30', 'training', 'due'],
    ])
  })

  it('builds Monday-first month grids', () => {
    const weeks = monthGrid(2026, 9)
    expect(weeks[0][0]).toBe('2026-09-28')
    expect(weeks.at(-1).at(-1) >= '2026-10-31').toBe(true)
    expect(weeks.every((w) => w.length === 7)).toBe(true)
  })
})
