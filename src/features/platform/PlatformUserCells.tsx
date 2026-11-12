import { initialsOf, sinceText } from './platformOverviewShared'
import type { AnyRecord, Translate } from '../../types/featureTypes'

// The cells both user lists of the Platform Owner share («Χρήστες πλατφόρμας» and an organization's «Χρήστες»):
// initials avatar + name + «συνδεδεμένος τώρα» dot + email, the account state and the last sign-in.
export const USER_STATE_BADGE: Record<string, string> = { active: 'active', pending: 'temporary', expired: 'warning', inactive: 'danger' }
export const userStateLabel = (tx: Translate, state: string) => ({ active: tx('Ενεργός', 'Active'), pending: tx('Πρόσκληση σε αναμονή', 'Invitation pending'), expired: tx('Η πρόσκληση έληξε', 'Invitation expired'), inactive: tx('Ανενεργός', 'Inactive') } as Record<string, string>)[state]

export function UserNameCell({ name, email, online, tx }: { name: string, email?: string, online?: boolean, tx: Translate }) {
  return <div className="platform-overview-org"><span className="platform-overview-avatar" aria-hidden="true">{initialsOf(name)}</span><span><strong>{name}{online && <span className="platform-user-online" role="img" aria-label={tx('Συνδεδεμένος τώρα', 'Online now')} title={tx('Συνδεδεμένος τώρα', 'Online now')}/>}</strong><small>{email || '—'}</small></span></div>
}

export function lastSignInContent(session: AnyRecord | null | undefined, online: boolean, tx: Translate) {
  if (!session && !online) return '—'
  return <>{online ? tx('Συνδεδεμένος τώρα', 'Online now') : sinceText(session!.startedAt, tx)}<small className="login-ip">{session?.lastIp || session?.ip || '—'}</small></>
}
