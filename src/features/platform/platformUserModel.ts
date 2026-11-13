import type { LoginAttempt, LoginLock } from './platformTypes'
// Χρήστες πλατφόρμας: the sign-in facts of one user (lock and failed attempts), matched on the username or e-mail.

const lower = (value: unknown) => String(value || '').trim().toLowerCase()
// Whom the facts are about: only the username and e-mail are read.
type SignInSubject = { username?: string | null, email?: string | null }
const identifiersOf = (user: SignInSubject | null | undefined) => [user?.username, user?.email].map(lower).filter(Boolean)

// The account lock still in force for this user (kind «account», not released, not yet expired), or null.
export function activeAccountLock<L extends Pick<LoginLock, 'kind' | 'subject' | 'lockedUntil' | 'releasedAt'>>(locks: L[] = [], user: SignInSubject | null | undefined, now = Date.now()) {
  const ids = identifiersOf(user)
  if (!ids.length) return null
  return locks.find(lock => lock?.kind === 'account' && !lock.releasedAt && new Date(lock.lockedUntil).getTime() > now && ids.includes(lower(lock.subject))) || null
}

// Wrong sign-in attempts of the last 24 hours under this user's username or e-mail.
export function failedAttempts24h(attempts: Pick<LoginAttempt, 'identifier' | 'success' | 'createdAt'>[] = [], user: SignInSubject | null | undefined, now = Date.now()) {
  const ids = identifiersOf(user)
  if (!ids.length) return 0
  return attempts.filter(row => !row?.success && ids.includes(lower(row.identifier)) && now - new Date(row.createdAt).getTime() < 86400000).length
}
