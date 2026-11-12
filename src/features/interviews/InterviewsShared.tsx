import { useCallback, useEffect, useMemo, useState } from 'react'
import { StatusBadge } from '../../design-system/StatusBadge'
import { useTenant } from '../../core/tenant/TenantContext'
import { useAuditActor } from '../../core/audit/useAuditActor'
import { CAPABILITIES, ROLES, can } from '../../core/permissions/roles'
import { loadInterviews } from './interviewsService'
import type { AnyRecord } from '../../types/featureTypes'
import { statusLabel, statusTone } from './interviewsModel'
import './interviews.css'

// Who may do what: read the applications (view), record and decide (manage), and
// turn a candidate into an employee (manage + the staff registry).
export function useInterviewsAccess() {
  const { role, membership, actualRole, isRolePreview } = useTenant()
  const owner = !isRolePreview && actualRole === ROLES.PLATFORM_OWNER
  const addOns = membership?.capabilities ?? [], custom = membership?.customCapabilities ?? []
  const canManage = owner || can(role, CAPABILITIES.MANAGE_INTERVIEWS, addOns, custom)
  const canView = canManage || can(role, CAPABILITIES.VIEW_INTERVIEWS, addOns, custom)
  const canHire = canManage && (owner || can(role, CAPABILITIES.MANAGE_STAFF_ADMIN, addOns, custom))
  // A Division Director reads only the candidates of the own division, through a function of the database.
  const divisionOnly = !canView && can(role, CAPABILITIES.VIEW_DIVISION_INTERVIEWS, addOns, custom)
  return { canView, canManage, canHire, divisionOnly }
}

// Every application with its languages, employers and interviews.
export function useInterviews() {
  const { tenant } = useTenant()
  const [state, setState] = useState<{ candidates: AnyRecord[], divisions?: AnyRecord[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const reload = useCallback(() => {
    setLoading(true)
    return loadInterviews(tenant?.id).then(setState).catch(error => { console.error(error); setState(null) }).finally(() => setLoading(false))
  }, [tenant?.id])
  useEffect(() => { void reload() }, [reload])
  return { state, loading, reload, organizationId: tenant?.id || null }
}

export function useInterviewsActor() {
  const actor = useAuditActor()
  return useMemo(() => ({ id: actor?.id || null, name: actor?.name || (actor as { fullName?: string } | null)?.fullName || '' }), [actor])
}

export function CandidateStatusBadge({ status, language }: { status: string, language: string }) {
  return <StatusBadge tone={statusTone(status)}>{statusLabel(status, language)}</StatusBadge>
}
