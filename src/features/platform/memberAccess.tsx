import './memberAccess.css'
import { KeyRound, Lock, ShieldCheck } from 'lucide-react'
import { cloudClient } from '../../core/supabase/cloudContext'
import { hospitalDate } from '../../core/dates/hospitalDate'
import type { Translate } from '../../types/featureTypes'

// Where each member's sign-in stands (owner, 23/11/2026, as in Sergi Tracker): still on the temporary password
// the owner handed over, on a password of their own, or locked because the temporary one expired unused.
export type MemberAccess = { mustChange: boolean, expiresAt: string | null, lockedAt: string | null, lastSignInAt: string | null }
export type PasswordState = 'temporary' | 'own' | 'locked'

// organization_member_access: the organization's admin or the Platform Owner only.
export async function loadMemberAccess(organizationId: string | null | undefined): Promise<Map<string, MemberAccess>> {
  if (!organizationId) return new Map()
  const { data, error } = await cloudClient().rpc('organization_member_access', { p_organization_id: organizationId })
  if (error) throw error
  return new Map((data || []).map(row => [row.user_id, { mustChange: Boolean(row.must_change_password), expiresAt: row.temporary_password_expires_at, lockedAt: row.temporary_password_locked_at, lastSignInAt: row.last_sign_in_at }]))
}

// An invitation not yet accepted has no password at all: no state then.
export function passwordState(access: MemberAccess | null | undefined, invited = false): PasswordState | null {
  if (!access || invited) return null
  if (access.lockedAt) return 'locked'
  if (access.mustChange) return 'temporary'
  return 'own'
}

const dayMonth = (value: string) => { const [, month, day] = hospitalDate(value).split('-'); return `${day}/${month}` }

export function passwordStateLabel(tx: Translate, state: PasswordState, access?: MemberAccess | null) {
  if (state === 'locked') return tx('Κλειδωμένος', 'Locked')
  if (state === 'own') return tx('Δικός του κωδικός', 'Own password')
  return access?.expiresAt ? tx(`Προσωρινός κωδικός · λήγει ${dayMonth(access.expiresAt)}`, `Temporary password · expires ${dayMonth(access.expiresAt)}`) : tx('Προσωρινός κωδικός', 'Temporary password')
}

const BADGE: Record<PasswordState, string> = { temporary: 'warning', own: 'active', locked: 'danger' }
const ICON = { temporary: KeyRound, own: ShieldCheck, locked: Lock }

// «Πρόσβαση»: the account state on top (a dot and the word), the password state beneath it.
export function AccessCell({ stateLabel, stateTone, access, invited = false, tx }: { stateLabel: string, stateTone: string, access?: MemberAccess | null, invited?: boolean, tx: Translate }) {
  const state = passwordState(access, invited)
  const Icon = state ? ICON[state] : null
  return (
    <div className="member-access">
      <span className={`member-access-state is-${stateTone}`}>{stateLabel}</span>
      {state && Icon && <span className={`status-badge ${BADGE[state]} member-access-password`}><Icon size={12} aria-hidden="true" />{passwordStateLabel(tx, state, access)}</span>}
    </div>
  )
}

// The totals above the list: who is signed in now, and how many on each password state.
export function accessCounts(userIds: string[], access: Map<string, MemberAccess>, online: Set<string>, invitedIds: Set<string> = new Set()) {
  const counts = { online: 0, temporary: 0, own: 0, locked: 0 }
  for (const id of userIds) {
    if (online.has(id)) counts.online += 1
    const state = passwordState(access.get(id), invitedIds.has(id))
    if (state) counts[state] += 1
  }
  return counts
}

// The department of each member of a department role (organization_member_departments), by membership.
export async function loadMemberDepartments(organizationId: string) {
  const { data, error } = await cloudClient().rpc('organization_member_departments', { p_organization_id: organizationId })
  if (error) throw error
  return data || []
}
