import { describe, expect, it } from 'vitest'
import { assignmentCalendar, calendarTone, isFrequentControl, programmeCalendar } from '../src/features/controls/controlCalendar'
import { calendarCellText } from '../src/features/controls/ControlCalendarPanel'

const now = new Date(2026, 9, 8, 12) // 8 October 2026, local time
const at = (month, day, hour = 10) => new Date(2026, month, day, hour).toISOString()

describe('annual control calendar', () => {
  it('splits frequent and infrequent schedules', () => {
    expect(isFrequentControl({ kind: 'daily' })).toBe(true)
    expect(isFrequentControl({ kind: 'weekly', interval: 2 })).toBe(true)
    expect(isFrequentControl({ kind: 'days', interval: 3 })).toBe(true)
    expect(isFrequentControl({ kind: 'days', interval: 30 })).toBe(false)
    expect(isFrequentControl({ kind: 'monthly', interval: 1 })).toBe(false)
    expect(isFrequentControl({ kind: 'yearly', interval: 1 })).toBe(false)
  })

  it('counts a daily control per month: done / due so far, planned ahead, nothing before it started', () => {
    const history = [at(8, 1), at(8, 2), at(8, 3), { at: at(8, 4), status: 'cancelled' }].map((value) => (typeof value === 'string' ? { at: value } : value))
    const months = assignmentCalendar({ frequency: { kind: 'daily', times: ['09:00'] }, history, startedAt: at(7, 31, 0) }, 2026, now)
    expect(months[6]).toMatchObject({ when: 'past', inactive: true, expected: 0 })
    expect(months[8]).toMatchObject({ when: 'past', done: 3, expected: 30, rate: 10, planned: 0 })
    expect(calendarTone(months[8])).toBe('low')
    expect(months[9].when).toBe('current')
    expect(months[9].expected).toBe(7)
    expect(months[9].planned).toBe(23)
    expect(months[11]).toMatchObject({ when: 'future', expected: 0, planned: 31 })
    expect(calendarTone(months[11])).toBe('planned')
  })

  it('plans a monthly control on its due day and marks done, late and missed months', () => {
    const history = [
      { at: at(5, 15), previousNextDueAt: at(5, 15) },
      { at: at(6, 20), previousNextDueAt: at(6, 15) }, // five days late
    ]
    const months = assignmentCalendar({ frequency: { kind: 'monthly', interval: 1 }, history, startedAt: at(0, 1), nextDueAt: at(7, 20) }, 2026, now)
    expect(months[5].marks).toEqual([{ day: 15, late: false }])
    expect(months[6].marks).toEqual([{ day: 20, late: true }])
    expect(calendarTone(months[6])).toBe('fair')
    // Due 20 August and never done: missed in August and September, then planned again.
    expect(months[7].missed).toEqual([20])
    expect(months[8].missed).toEqual([20])
    expect(calendarTone(months[8])).toBe('low')
    expect(months[9].planned).toEqual([20])
    expect(months[10].planned).toEqual([20])
    expect(months[11].planned).toEqual([20])
    expect(calendarCellText(months[6], false)).toBe('Έγινε 20 (με καθυστέρηση)')
    expect(calendarCellText(months[8], true)).toBe('Missed 20')
  })

  it('shows a yearly control once, and nothing ahead for a paused assignment', () => {
    const yearly = assignmentCalendar({ frequency: { kind: 'yearly', interval: 1 }, nextDueAt: at(10, 3) }, 2026, now)
    expect(yearly.map((cell) => cell.planned.length)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0])
    const paused = assignmentCalendar({ frequency: { kind: 'monthly', interval: 1 }, nextDueAt: at(10, 3), paused: true }, 2026, now)
    expect(paused.every((cell) => !cell.planned.length && !cell.missed.length)).toBe(true)
  })

  it('builds one line per control and department', () => {
    const item = { id: 'C1', title: 'Ψυγείο', frequency: { kind: 'daily', times: ['09:00'] }, assignments: { ΜΕΘ: { history: [] }, Χειρουργείο: { history: [] } } }
    const lines = programmeCalendar([{ item, departments: ['Χειρουργείο', 'ΜΕΘ', 'Άλλο'] }], 2026, now)
    expect(lines.map((line) => line.department)).toEqual(['ΜΕΘ', 'Χειρουργείο'])
    expect(lines[0].months).toHaveLength(12)
  })
})
