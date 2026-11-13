import { describe, expect, it } from 'vitest'
import { activeAccountLock, failedAttempts24h } from '../src/features/platform/platformUserModel'
import { latestSessionByUser } from '../src/features/platform/platformOverviewShared'

const now = Date.parse('2026-11-10T12:00:00Z')
const minutes = value => new Date(now + value * 60000).toISOString()
const user = { username: 'm.georgiou', email: 'Maria@Example.org' }

describe('Platform user sign-in facts', () => {
  it('keeps the latest session of each user', () => {
    const latest = latestSessionByUser([
      { sessionId: 'a', userId: 'u1', startedAt: minutes(-300) },
      { sessionId: 'b', userId: 'u1', startedAt: minutes(-20) },
      { sessionId: 'c', userId: 'u2', startedAt: minutes(-60) },
      { sessionId: 'd', startedAt: minutes(-1) },
    ])
    expect(latest.get('u1').sessionId).toBe('b')
    expect(latest.get('u2').sessionId).toBe('c')
    expect(latest.size).toBe(2)
  })
  it('finds the account lock still in force, by username or e-mail', () => {
    const lock = { id: 1, kind: 'account', subject: 'm.georgiou', lockedUntil: minutes(10), releasedAt: null }
    expect(activeAccountLock([lock], user, now)).toBe(lock)
    expect(activeAccountLock([{ ...lock, subject: 'maria@example.org' }], user, now)).toBeTruthy()
    expect(activeAccountLock([{ ...lock, lockedUntil: minutes(-1) }], user, now)).toBeNull()
    expect(activeAccountLock([{ ...lock, releasedAt: minutes(-2) }], user, now)).toBeNull()
    expect(activeAccountLock([{ ...lock, kind: 'ip' }], user, now)).toBeNull()
    expect(activeAccountLock([{ ...lock, subject: 'someone.else' }], user, now)).toBeNull()
    expect(activeAccountLock([lock], {}, now)).toBeNull()
  })
  it('counts the wrong attempts of the last 24 hours of that user only', () => {
    const attempts = [
      { identifier: 'M.Georgiou', success: false, createdAt: minutes(-5) },
      { identifier: 'maria@example.org', success: false, createdAt: minutes(-600) },
      { identifier: 'm.georgiou', success: true, createdAt: minutes(-6) },
      { identifier: 'm.georgiou', success: false, createdAt: minutes(-60 * 25) },
      { identifier: 'admin', success: false, createdAt: minutes(-3) },
    ]
    expect(failedAttempts24h(attempts, user, now)).toBe(2)
    expect(failedAttempts24h(attempts, {}, now)).toBe(0)
  })
})
