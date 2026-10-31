import { describe, expect, it } from 'vitest'
import { assignmentFrequency, assignmentProgress, controlFrequencyLabel, linesFrequencyLabel, scheduleVariants } from '../src/features/controls/controlScheduling'

const daily1 = { kind: 'daily', timesPerDay: 1, times: ['08:00'], interval: 1 }
const daily2 = { kind: 'daily', timesPerDay: 2, times: ['07:00', '14:00'], interval: 1 }
const item = {
  frequency: daily1,
  assignments: {
    'ΜΕΘ': { department: 'ΜΕΘ', nextDueAt: '2026-10-26T08:00:00Z', history: [] },
    'ΤΕΠ': { department: 'ΤΕΠ', frequency: daily2, nextDueAt: '2026-10-26T07:00:00Z', history: [] },
  },
}

describe('a control with a schedule per department', () => {
  it('uses the department\'s own schedule, else the control\'s', () => {
    expect(assignmentFrequency(item, 'ΤΕΠ')).toEqual(daily2)
    expect(assignmentFrequency(item, 'ΜΕΘ')).toEqual(daily1)
  })

  it('knows when the departments differ', () => {
    expect(scheduleVariants(item)).toBe(2)
    expect(scheduleVariants({ ...item, assignments: { 'ΜΕΘ': item.assignments['ΜΕΘ'] } })).toBe(1)
  })

  it('names the frequency in a list, «varies» when the departments differ', () => {
    expect(controlFrequencyLabel(item, ['ΜΕΘ', 'ΤΕΠ'], 'el')).toBe('Διαφέρει ανά τμήμα')
    expect(controlFrequencyLabel(item, ['ΜΕΘ', 'ΤΕΠ'], 'en')).toBe('Varies by department')
    expect(controlFrequencyLabel(item, ['ΜΕΘ'], 'el')).toBe('Καθημερινά')
    expect(controlFrequencyLabel(item, ['ΤΕΠ'], 'el')).toBe('2 φορές / ημέρα')
  })

  it('names the frequency of the lines of a group', () => {
    const lines = [{ frequency: daily1 }, { frequency: daily2 }]
    expect(linesFrequencyLabel(lines, item, 'el')).toBe('Διαφέρει ανά τμήμα')
    expect(linesFrequencyLabel([{ frequency: daily2 }], item, 'el')).toBe('2 φορές / ημέρα')
  })

  it('counts the period\'s progress on the department\'s own schedule', () => {
    const now = new Date('2026-10-26T12:00:00Z')
    expect(assignmentProgress(item, 'ΤΕΠ', now).required).toBe(2)
    expect(assignmentProgress(item, 'ΜΕΘ', now).required).toBe(1)
  })
})
