import type { AnyRecord } from '../../types/featureTypes'
// Χρήστες πλατφόρμας: the sign-in facts of one user (lock and failed attempts), matched on the username or e-mail.

const lower = (value: unknown) => String(value || '').trim().toLowerCase()
const identifiersOf = (user: AnyRecord | null | undefined) => [user?.username, user?.email].map(lower).filter(Boolean)

// The account lock still in force for this user (kind «account», not released, not yet expired), or null.
export function activeAccountLock(locks: AnyRecord[] = [], user: AnyRecord | null | undefined, now = Date.now()) {
  const ids = identifiersOf(user)
  if (!ids.length) return null
  return locks.find(lock => lock?.kind === 'account' && !lock.releasedAt && new Date(lock.lockedUntil).getTime() > now && ids.includes(lower(lock.subject))) || null
}

// Wrong sign-in attempts of the last 24 hours under this user's username or e-mail.
export function failedAttempts24h(attempts: AnyRecord[] = [], user: AnyRecord | null | undefined, now = Date.now()) {
  const ids = identifiersOf(user)
  if (!ids.length) return 0
  return attempts.filter(row => !row?.success && ids.includes(lower(row.identifier)) && now - new Date(row.createdAt).getTime() < 86400000).length
}
