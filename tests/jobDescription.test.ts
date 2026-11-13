import { describe, expect, it } from 'vitest'
import { acknowledgementState, hasJobDescription, nextJobDescription } from '../src/features/employees/jobDescription'

describe('job description', () => {
  it('versions every saved change', () => {
    const first = nextJobDescription(null, { duties: 'A' }, 'Admin')
    expect(first).toMatchObject({ version: 1, duties: 'A', updatedBy: 'Admin' })
    expect(nextJobDescription(first, { ...first, duties: 'B' }).version).toBe(2)
  })

  it('tells none, pending, acknowledged and outdated apart', () => {
    const jd = { duties: 'A', version: 2 }
    expect(acknowledgementState(null, []).state).toBe('none')
    expect(hasJobDescription({ version: 3 })).toBe(false)
    expect(acknowledgementState(jd, []).state).toBe('pending')
    expect(acknowledgementState(jd, [{ version: 1, acknowledgedAt: '2026-01-01' }]).state).toBe('outdated')
    expect(acknowledgementState(jd, [{ version: 1, acknowledgedAt: '2026-01-01' }, { version: 2, acknowledgedAt: '2026-05-01' }])).toMatchObject({ state: 'acknowledged', latest: { version: 2 } })
  })
})
