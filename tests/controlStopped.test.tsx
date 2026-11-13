import { describe, expect, it } from 'vitest'
import { stoppedControls } from '../src/features/controls/ControlAdherencePanel'

// «Stopped» in Adherence (owner, 2/11/2026): who has not recorded a daily or weekly control for a week or more.
describe('stopped controls', () => {
  const asOf = new Date('2026-11-02T12:00:00Z')
  const line = (id, department, frequency, assignment) => ({ item: { id, title: id, assignments: { [department]: { frequency, ...assignment } } }, department, frequency })
  it('lists daily and weekly controls silent for 7 days or more, or never done, the longest first per department', () => {
    const lines = [
      line('A', 'ΜΕΘ', { kind: 'daily' }, { lastCompletedAt: '2026-11-01T08:00:00Z' }),
      line('B', 'ΜΕΘ', { kind: 'daily' }, { lastCompletedAt: '2026-10-23T08:00:00Z' }),
      line('C', 'ΜΕΘ', { kind: 'weekly' }, {}),
      line('D', 'ΜΕΘ', { kind: 'monthly' }, { lastCompletedAt: '2026-09-01T08:00:00Z' }),
      line('E', 'ΤΕΠ', { kind: 'daily' }, { status: 'paused' }),
      line('B', 'ΜΕΘ', { kind: 'daily' }, { lastCompletedAt: '2026-10-23T08:00:00Z' }),
    ]
    expect(stoppedControls(lines, asOf).map(row => [row.item.id, row.days])).toEqual([['C', null], ['B', 10]])
  })
})
