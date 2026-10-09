import { describe, expect, it } from 'vitest'
import { controlAssignmentRows, controlExecutionRows } from '../src/features/controls/controlDemoData.js'

// The control Demo data is written relative to now: nothing done may lie in the future.
describe('Control Demo dates', () => {
  it('has no execution or last completion after now', () => {
    const now = Date.now() + 60_000
    for (const row of controlExecutionRows) expect(new Date(row.performed_at).getTime(), row.id).toBeLessThanOrEqual(now)
    for (const row of controlAssignmentRows.filter(row => row.last_completed_at)) expect(new Date(row.last_completed_at).getTime(), row.id).toBeLessThanOrEqual(now)
  })
})
