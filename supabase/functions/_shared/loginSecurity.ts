// Sign-in protection (username-login): the limits and the small pure helpers, kept apart so they can be tested.
export const MAX_ACCOUNT_FAILURES = 5
export const MAX_IP_FAILURES = 20
export const WINDOW_MINUTES = 15
export const LOCK_MINUTES = 15

export function normalizeIdentifier(value: string) {
  return String(value || '').trim().toLowerCase().slice(0, 120)
}

// The caller's address as the platform's proxy reports it (first entry of x-forwarded-for).
export function clientIp(headers: Headers) {
  const forwarded = String(headers.get('x-forwarded-for') || '').split(',')[0].trim()
  const value = forwarded || String(headers.get('cf-connecting-ip') || headers.get('x-real-ip') || '').trim()
  return value ? value.slice(0, 64) : null
}

// The session id inside the access token (claim session_id), without verifying it: the token was just issued to us.
export function decodeSessionId(accessToken: string) {
  try {
    const part = String(accessToken || '').split('.')[1]
    if (!part) return null
    const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=')))
    const id = String(json?.session_id || '')
    return /^[0-9a-f-]{36}$/i.test(id) ? id : null
  } catch {
    return null
  }
}

// Failures count from the last 15 minutes, but not from before the end of the previous lock (or its release).
export function failureWindowStart(now: Date, lastLock?: { released_at?: string | null, locked_until?: string | null } | null) {
  const windowStart = new Date(now.getTime() - WINDOW_MINUTES * 60000)
  if (!lastLock) return windowStart
  const ended = lastLock.released_at || lastLock.locked_until
  const endedAt = ended ? new Date(ended) : null
  return endedAt && endedAt > windowStart ? endedAt : windowStart
}
