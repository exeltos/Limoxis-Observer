import { initialsOf, sinceText } from './platformOverviewShared'

// The cells both user lists of the Platform Owner share («Χρήστες πλατφόρμας» and an organization's «Χρήστες»):
// initials avatar + name + «συνδεδεμένος τώρα» dot + email, the account state and the last sign-in.
export const USER_STATE_BADGE = { active: 'active', pending: 'temporary', expired: 'warning', inactive: 'danger' }
export const userStateLabel = (tx, state) => ({ active: tx('Ενεργός', 'Active'), pending: tx('Πρόσκληση σε αναμονή', 'Invitation pending'), expired: tx('Η πρόσκληση έληξε', 'Invitation expired'), inactive: tx('Ανενεργός', 'Inactive') })[state]

export function UserNameCell({ name, email, online, tx }) {
  return <div className="platform-overview-org"><span className="platform-overview-avatar" aria-hidden="true">{initialsOf(name)}</span><span><strong>{name}{online && <span className="platform-user-online" role="img" aria-label={tx('Συνδεδεμένος τώρα', 'Online now')} title={tx('Συνδεδεμένος τώρα', 'Online now')}/>}</strong><small>{email || '—'}</small></span></div>
}

export function lastSignInContent(session, online, tx) {
  if (!session && !online) return '—'
  return <>{online ? tx('Συνδεδεμένος τώρα', 'Online now') : sinceText(session.startedAt, tx)}<small className="login-ip">{session?.lastIp || session?.ip || '—'}</small></>
}
