import { useCallback, useEffect, useMemo, useState } from 'react'
import { roleLabel } from '../../core/permissions/roleLabels'
import { listOrganizationMembersDetailed } from '../../core/tenant/tenantService'
import { matchesSearch } from '../../core/i18n/searchMatch'
import { isOwnerPreview, previewMemberAccess, previewMemberDepartments } from '../../core/preview/ownerPreview'
import { loadEmployeesAsync } from '../employees/employeeService'
import { listLoginSessions } from './platformAuditService'
import { platformUserState } from './PlatformUsersRegistry'
import { userStateLabel } from './PlatformUserCells'
import { loadMemberAccess, loadMemberDepartments, passwordState, passwordStateLabel, type MemberAccess } from './memberAccess'
import { loadEmployeeAccounts } from './bulkAccountsService'
import type { Dispatch, SetStateAction } from 'react'
import type { Roster } from './bulkAccountsModel'
import type { LoginSession } from './platformTypes'
import type { OrganizationEmployee, OrganizationMember } from './platformOrganizationShared'

type NotifyError = (error: unknown, kind: string, meta?: { operation?: string }) => unknown
type OrganizationUsersOptions = {
  organizationId: string
  language: string
  initialTab: string
  selectedUserId: string
  setSelectedUserIdState: Dispatch<SetStateAction<string>>
  setEmployeeLinkDrafts: Dispatch<SetStateAction<Record<string, string>>>
  notifyError: NotifyError
}

// The organization's users as its record shows them: the members (with password state and department), the
// employees, the sign-ins of the last 90 days, the employees without an account, and the list's search, filter
// and pages. Split out of PlatformOrganizationRecord (24/11/2026).
export function useOrganizationUsers({ organizationId, language, initialTab, selectedUserId, setSelectedUserIdState, setEmployeeLinkDrafts, notifyError }: OrganizationUsersOptions) {
  const [users, setUsers] = useState<OrganizationMember[]>([])
  const [employees, setEmployees] = useState<OrganizationEmployee[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [userQuery, setUserQuery] = useState('')
  const [userPage, setUserPage] = useState(1)
  const [userFilter, setUserFilter] = useState('all')
  const [userPageSize, setUserPageSize] = useState(15)
  const loadUsers = useCallback(async () => {
    setLoadingUsers(true)
    try {
      const [memberRows, employeeRows, access, scopes] = await Promise.all([
        listOrganizationMembersDetailed(organizationId),
        loadEmployeesAsync(organizationId),
        // Temporary or own password, lock (owner, 23/11/2026); the list still shows without it.
        isOwnerPreview() ? previewMemberAccess(organizationId) as Map<string, MemberAccess> : loadMemberAccess(organizationId).catch(() => new Map<string, MemberAccess>()),
        isOwnerPreview() ? previewMemberDepartments(organizationId) : loadMemberDepartments(organizationId).catch(() => []),
      ])
      // «Τμήμα»: the department of a department role, else that of the linked employee record.
      const scopeOf = new Map<string, string>(scopes.map((row: { membership_id: string, department_name: string }) => [row.membership_id, row.department_name]))
      const rows: OrganizationMember[] = memberRows.map(row => ({ ...row, access: access.get(row.userId) || null, departmentName: scopeOf.get(row.id) || (employeeRows as OrganizationEmployee[]).find(employee => employee.userId === row.userId)?.department || '' }))
      setUsers(rows)
      setEmployees(employeeRows as OrganizationEmployee[])
      setEmployeeLinkDrafts(
        Object.fromEntries(
          rows.map(user => [
            user.userId,
            employeeRows.find(employee => employee.userId === user.userId)?.dbId || '',
          ]),
        ),
      )
      setSelectedUserIdState(current =>
        current && rows.some(user => user.userId === current) ? current : '',
      )
      return rows
    } catch (error) {
      notifyError(error, 'load', { operation: 'platform_organization_users_load' })
      return []
    } finally {
      setLoadingUsers(false)
    }
  }, [organizationId, notifyError, setEmployeeLinkDrafts, setSelectedUserIdState])
  useEffect(() => {
    loadUsers()
  }, [loadUsers])
  // The sign-ins of the last 90 days (Χρήστες › Τελευταία σύνδεση, Δραστηριότητα › Συνδέσεις); kept to this organization's users below.
  const [allSessions, setAllSessions] = useState<LoginSession[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const loadSessions = useCallback(async () => {
    setLoadingSessions(true)
    try {
      setAllSessions(await listLoginSessions({ days: 90 }))
    } catch {
      setAllSessions([])
    } finally {
      setLoadingSessions(false)
    }
  }, [])
  useEffect(() => {
    loadSessions()
  }, [loadSessions])
  const sessions = useMemo(() => {
    const ids = new Set(users.map(user => user.userId))
    return allSessions.filter(row => ids.has(row.userId))
  }, [allSessions, users])
  // «Χρήστες & Ρόλοι» › «Εργαζόμενοι χωρίς λογαριασμό» (N1, Platform Owner only).
  const [usersView, setUsersView] = useState('accounts')
  const [roster, setRoster] = useState<Roster>({ employees: [], departments: [] })
  const [rosterLoading, setRosterLoading] = useState(false)
  const loadRoster = useCallback(async () => {
    setRosterLoading(true)
    try {
      setRoster(await loadEmployeeAccounts(organizationId))
    } catch (error) {
      notifyError(error, 'load', { operation: 'platform_employee_accounts_load' })
    } finally {
      setRosterLoading(false)
    }
  }, [organizationId, notifyError])
  // The roster of employees without an account is the list's; an open user record does not need it.
  useEffect(() => {
    if (initialTab === 'users' && !selectedUserId) loadRoster()
  }, [initialTab, loadRoster, selectedUserId])
  const rosterWithoutAccount = roster.employees.filter(row => row.accountState === 'none').length
  const onlineUserIds = useMemo(() => new Set(sessions.filter(row => row.online).map(row => row.userId)), [sessions])
  const orgUserState = (user: OrganizationMember) => platformUserState({ status: user.status, invitation: user.invitationStatus })
  const filteredUsers = useMemo(() => {
    const say = (elText: string, enText: string) => (language === 'en' ? enText : elText)
    const byFilter = users.filter(user => {
      const state = platformUserState({ status: user.status, invitation: user.invitationStatus })
      if (userFilter === 'active') return state === 'active'
      if (userFilter === 'invited') return state === 'pending' || state === 'expired'
      if (userFilter === 'inactive') return state === 'inactive'
      if (userFilter === 'online') return onlineUserIds.has(user.userId)
      if (userFilter === 'temporary' || userFilter === 'own' || userFilter === 'locked') return passwordState(user.access, state === 'pending' || state === 'expired') === userFilter
      return true
    })
    // Everything the row shows (owner, 19/11/2026: the searches find everything).
    return byFilter.filter(user =>
      matchesSearch(userQuery, [user.name, user.email, user.username, user.departmentName, roleLabel(user.role, language), (() => { const pw = passwordState(user.access, user.status === 'invited'); return pw ? passwordStateLabel(say, pw, user.access) : '' })(), userStateLabel(say, platformUserState({ status: user.status, invitation: user.invitationStatus })), onlineUserIds.has(user.userId) ? say('Συνδεδεμένος τώρα', 'Online now') : '']),
    )
  }, [users, userQuery, userFilter, onlineUserIds, language])
  const userTotalPages = Math.max(1, Math.ceil(filteredUsers.length / userPageSize)),
    safeUserPage = Math.min(userPage, userTotalPages),
    pagedUsers = filteredUsers.slice((safeUserPage - 1) * userPageSize, safeUserPage * userPageSize)
  useEffect(() => setUserPage(1), [userQuery, userFilter, userPageSize])
  useEffect(() => {
    if (userPage > userTotalPages) setUserPage(userTotalPages)
  }, [userPage, userTotalPages])
  return { users, setUsers, employees, loadingUsers, loadUsers, userQuery, setUserQuery, userPage, setUserPage, userFilter, setUserFilter, userPageSize, setUserPageSize, allSessions, loadingSessions, loadSessions, sessions, usersView, setUsersView, roster, rosterLoading, loadRoster, rosterWithoutAccount, onlineUserIds, orgUserState, filteredUsers, userTotalPages, safeUserPage, pagedUsers }
}
