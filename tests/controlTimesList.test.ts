import { describe, expect, it } from 'vitest'
import { MAX_TIMES, nextTime } from '../src/features/controls/ControlTimesList'
import { readSource } from './helpers/readSource'

const editor = readSource('src/features/controls/ControlEditor.jsx')
const schedules = readSource('src/features/controls/ControlDepartmentSchedules.jsx')

describe('control times list', () => {
  it('offers the next time 4 hours after the last, up to 23:00', () => {
    expect(nextTime(['09:00'])).toBe('13:00')
    expect(nextTime(['08:30', '21:30'])).toBe('23:30')
    expect(nextTime([])).toBe('08:00')
    expect(MAX_TIMES).toBe(12)
  })
  it('has no «times per day» field: the count follows from the times', () => {
    for (const source of [editor, schedules]) {
      expect(source).not.toContain('Φορές ανά ημέρα')
      expect(source).toContain('<ControlTimesList')
      expect(source).toMatch(/timesPerDay: ?next\.length/)
    }
  })
})
