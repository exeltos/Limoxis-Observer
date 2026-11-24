import { useEffect, useMemo, useState } from 'react'
import { Activity, Archive, Boxes, Building2, KeyRound, LogIn, PauseCircle, PlayCircle, Trash2, Users } from 'lucide-react'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { StatusBadge } from '../../design-system/StatusBadge'
import { PageSkeleton } from '../../design-system/LoadingSkeleton'

import { PlatformRecordActions } from './PlatformRecordActions'

import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'

import { useFeedback } from '../../core/feedback/FeedbackContext'
import { roleLabel } from '../../core/permissions/roleLabels'
import { HospitalDiagnosticsPanel } from './HospitalDiagnosticsPanel'
import { OrganizationOffboardingPanel } from './OrganizationOffboardingPanel'
import { OperatingProfileSection } from './OperatingProfileSection'
import { initialsOf, statusOf } from './platformOverviewShared'
import './platformDashboard.css'

import { PlatformOrganizationDetailsTab } from './PlatformOrganizationDetailsTab'
import { PlatformOrganizationUsersTab } from './PlatformOrganizationUsersTab'
import { PlatformOrganizationUserRecord } from './PlatformOrganizationUserRecord'
import { ROLES, toDraft } from './platformOrganizationShared'

import { useOrganizationUsers } from './useOrganizationUsers'
import { organizationActions } from './organizationRecordActions'
import { organizationUserActions } from './organizationUserActions'
import './activeUsers.css'
import type { InvitationLinkView, NewAdminDraft, OrganizationRecordRow, OrganizationUserDraft } from './platformOrganizationShared'

export function PlatformOrganizationRecord({
  organization,
  language = 'el',
  initialTab = 'details',
  onTabChange,
  onBack,
  onEnter,
  onDelete,
  onChanged,
  onOpenEmployee,
  // The user record and «Νέος χρήστης» follow the address (&user=…, &new=…), so the registry of platform users can open them directly.
  initialUserId = '',
  onUserChange,
  initialNew = '',
  onNewHandled,
}: {
  organization: OrganizationRecordRow
  language?: string
  initialTab?: string
  onTabChange?: (tab: string) => void
  onBack?: () => void
  onEnter?: () => void
  onDelete?: (organization?: OrganizationRecordRow) => void
  onChanged?: (organization: OrganizationRecordRow) => void
  onOpenEmployee?: (employeeId: string) => void
  initialUserId?: string
  onUserChange?: (userId: string, backTab?: string) => void
  initialNew?: string
  onNewHandled?: () => void
}) {
  const en = language === 'en',
    tx = (elText: string, enText: string) => (en ? enText : elText)
  const { notify, notifyError, confirm } = useFeedback()
  const [record, setRecord] = useState<OrganizationRecordRow>(organization)
  const [draft, setDraft] = useState(() => toDraft(organization))
  const [saving, setSaving] = useState(false)
  const [working, setWorking] = useState(false)
  const [invitationLink, setInvitationLink] = useState<InvitationLinkView | null>(null)
  const [employeeLinkDrafts, setEmployeeLinkDrafts] = useState<Record<string, string>>({})
  const [newAdmin, setNewAdmin] = useState<NewAdminDraft>({ name: '', email: '' })
  const [selectedUserId, setSelectedUserIdState] = useState(initialUserId)
  const setSelectedUserId = (id: string, backTab?: string) => {
    setSelectedUserIdState(id)
    onUserChange?.(id, backTab)
  }
  useEffect(() => setSelectedUserIdState(initialUserId), [initialUserId])
  // The users, sessions, employees without an account and the list's search / filter / pages (useOrganizationUsers).
  const { users, employees, loadingUsers, loadUsers, userQuery, setUserQuery, setUserPage, userFilter, setUserFilter, userPageSize, setUserPageSize, loadingSessions, loadSessions, sessions, usersView, setUsersView, roster, rosterLoading, loadRoster, rosterWithoutAccount, onlineUserIds, orgUserState, filteredUsers, userTotalPages, safeUserPage, pagedUsers } = useOrganizationUsers({ organizationId: organization.id, language, initialTab, selectedUserId, setSelectedUserIdState, setEmployeeLinkDrafts, notifyError })
  const [startMode] = useState(initialTab === 'users' && (initialNew === 'single' || initialNew === 'file') ? initialNew : '')
  const [editing, setEditing] = useState(false)
  const [userEditing, setUserEditing] = useState(false)
  const [userDraft, setUserDraft] = useState<OrganizationUserDraft>({
    fullName: '',
    email: '',
    phone: '',
    jobTitle: '',
    role: '',
  })
  const [createUserOpen, setCreateUserOpen] = useState(initialTab === 'users' && initialNew === 'invite')
  useEffect(() => {
    if (initialNew) onNewHandled?.()
  }, [initialNew]) // eslint-disable-line react-hooks/exhaustive-deps
  const [createUserDraft, setCreateUserDraft] = useState({
    fullName: '',
    email: '',
    role: 'department_user',
  })

  useEffect(() => {
    setRecord(organization)
    setDraft(toDraft(organization))
    setEditing(false)
  }, [organization])

  const admins = useMemo(() => users.filter(user => user.role === 'hospital_admin'), [users])
  const selectedUser = useMemo(
    () => users.find(user => user.userId === selectedUserId) || null,
    [users, selectedUserId],
  )
  const selectedEmployee = useMemo(
    () =>
      selectedUser
        ? employees.find(employee => employee.userId === selectedUser.userId) || null
        : null,
    [employees, selectedUser],
  )
  const employeeOptions = useMemo(
    () =>
      selectedUser
        ? employees.filter(employee => !employee.userId || employee.userId === selectedUser.userId)
        : [],
    [employees, selectedUser],
  )
  const canSave = Boolean(draft.name.trim() && draft.code.trim())
  const createUserValid = Boolean(
    createUserDraft.fullName.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createUserDraft.email.trim()) &&
    createUserDraft.role,
  )

  useEffect(() => {
    if (!selectedUser) {
      setUserEditing(false)
      return
    }
    setUserDraft({
      fullName: selectedUser.name || '',
      email: selectedUser.email || '',
      phone: selectedUser.phone || '',
      jobTitle: selectedUser.jobTitle || '',
      role: selectedUser.role || '',
    })
    setUserEditing(false)
  }, [selectedUser])

  // The actions on the organization and on its users (organizationRecordActions, organizationUserActions).
  const ctx = { record, setRecord, draft, setDraft, saving, setSaving, working, setWorking, newAdmin, setNewAdmin, setEditing, loadUsers, admins, canSave, notify, notifyError, confirm, tx, onChanged, employees, setInvitationLink, employeeLinkDrafts, setSelectedUserId, setUserEditing, userDraft, setCreateUserOpen, createUserDraft, setCreateUserDraft, selectedUser, createUserValid }
  const { saveOrganization, togglePause, resetAdmin, inviteAdmin } = organizationActions(ctx)
  const { createOrganizationMember, linkUserEmployee, showInvitationLink, resetUserAccess, saveSelectedUser, deleteSelectedUser, toggleSelectedUserStatus } = organizationUserActions(ctx)

  // The tab ids stay those of older links (details, users, diagnostics, offboarding); «modules» is the package.
  const tabs = [
    { id: 'details', label: tx('Στοιχεία', 'Details'), icon: Building2 },
    { id: 'modules', label: tx('Πακέτο & ενότητες', 'Package & modules'), icon: Boxes },
    {
      id: 'users',
      label: `${tx('Χρήστες', 'Users')} (${users.length})`,
      icon: Users,
    },
    { id: 'diagnostics', label: tx('Δραστηριότητα', 'Activity'), icon: Activity },
    { id: 'offboarding', label: tx('Αντίγραφο & διαγραφή', 'Export & deletion'), icon: Archive },
  ]
  const actions = (
    <PlatformRecordActions
      label={tx('Ενέργειες οργανισμού', 'Organization actions')}
      moreLabel={tx('Περισσότερες ενέργειες', 'More actions')}
      actions={[
        {
          id: 'enter',
          placement: 'primary',
          icon: <LogIn size={16} />,
          label: tx('Είσοδος', 'Enter'),
          title: tx('Είσοδος στον οργανισμό', 'Enter organization'),
          onClick: onEnter,
        },
        {
          id: 'pause',
          placement: 'menu',
          icon:
            record.status === 'suspended' ? <PlayCircle size={16} /> : <PauseCircle size={16} />,
          label:
            record.status === 'suspended'
              ? tx('Ενεργοποίηση', 'Reactivate')
              : tx('Παύση', 'Suspend'),
          title:
            record.status === 'suspended'
              ? tx('Επανενεργοποίηση οργανισμού', 'Reactivate organization')
              : tx('Παύση οργανισμού', 'Suspend organization'),
          disabled: working,
          onClick: togglePause,
        },
        {
          id: 'reset-admin',
          placement: 'menu',
          icon: <KeyRound size={16} />,
          title: tx(
            'Επαναφορά κωδικού ή πρόσκλησης Διαχειριστή Νοσοκομείου',
            'Reset Hospital Admin password or invitation',
          ),
          disabled: !admins.length || working,
          onClick: resetAdmin,
        },
        {
          id: 'delete',
          placement: 'menu',
          danger: true,
          icon: <Trash2 size={16} />,
          title: tx('Οριστική διαγραφή οργανισμού', 'Delete organization permanently'),
          disabled: working,
          onClick: onDelete,
        },
      ]}
    />
  )

  const recordStatus = statusOf(tx, record, admins[0]?.status)

  // The address names a user whose list is still loading: the loading screen, not the organization for an instant.
  if (initialTab === 'users' && selectedUserId && !selectedUser && loadingUsers) return <PageSkeleton metrics={0} rows={6} />

  if (initialTab === 'users' && selectedUser) {
    return <PlatformOrganizationUserRecord key={selectedUser.userId} ctx={{ employees, loadSessions, sessions, deleteSelectedUser, employeeLinkDrafts, employeeOptions, invitationLink, language, linkUserEmployee, organization, resetUserAccess, saveSelectedUser, selectedEmployee, selectedUser, setEmployeeLinkDrafts, setInvitationLink, setSelectedUserId, setUserDraft, setUserEditing, showInvitationLink, toggleSelectedUserStatus, tx, userDraft, userEditing, working }} />
  }

  return (
    <>
      <EntityRecordShell
        className="platform-owner-record-shell platform-organization-record-workspace"
        avatar={<span aria-hidden="true">{initialsOf(draft.name || record.name)}</span>}
        eyebrow={tx('ΚΑΡΤΕΛΑ ΟΡΓΑΝΙΣΜΟΥ', 'ORGANIZATION RECORD')}
        title={draft.name || record.name}
        subtitle={`${record.code || '—'} · ${draft.city || '—'} · ${draft.region || '—'}`}
        status={<StatusBadge tone={recordStatus[0]}>{recordStatus[1]}</StatusBadge>}
        headerActions={actions}
        tabs={tabs}
        activeTab={initialTab}
        onTabChange={onTabChange}
        onBack={onBack}
        backLabel={tx('Πίσω', 'Back')}
      >
        {initialTab === 'details' && <PlatformOrganizationDetailsTab ctx={{ admins, canSave, draft, editing, inviteAdmin, language, loadingUsers, newAdmin, onChanged, record, saveOrganization, saving, setDraft, setEditing, setNewAdmin, setRecord, tx, users, working }} />}
        {initialTab === 'modules' && (
          <div className="platform-owner-details">
            <OperatingProfileSection
              organization={record}
              language={language}
              onSaved={saved => {
                setRecord(r => ({ ...r, ...saved }))
                onChanged?.({ ...record, ...saved })
              }}
            />
          </div>
        )}

        {initialTab === 'users' && <PlatformOrganizationUsersTab ctx={{ startMode, filteredUsers, onlineUserIds, orgUserState, setUserFilter, userFilter, language, loadRoster, loadUsers, loadingUsers, onOpenEmployee, pagedUsers, record, roster, rosterLoading, rosterWithoutAccount, safeUserPage, sessions, setCreateUserDraft, setCreateUserOpen, setSelectedUserId, setUserPage, setUserPageSize, setUserQuery, setUsersView, tx, userPageSize, userQuery, userTotalPages, users, usersView }} />}
        {initialTab === 'diagnostics' && (
          <HospitalDiagnosticsPanel organization={record} language={language} sessions={sessions} loadingSessions={loadingSessions || loadingUsers} onReloadSessions={loadSessions} knownUserIds={new Set(users.map(user => user.userId))} onOpenUser={(userId: string) => setSelectedUserId(userId, 'diagnostics')} />
        )}
        {initialTab === 'offboarding' && (
          <div className="platform-owner-details">
            <OrganizationOffboardingPanel
              organization={record}
              language={language}
              onChanged={() => onChanged?.(record)}
              onDeleteNow={() => onDelete?.(record)}
            />
          </div>
        )}
      </EntityRecordShell>

      {createUserOpen && (
        <ObserverDialog
          eyebrow={tx('ΧΡΗΣΤΕΣ', 'USERS')}
          title={tx('Νέος χρήστης', 'New user')}
          subtitle={tx(
            `Πρόσθεσε χρήστη στον οργανισμό ${record.name}. Θα σταλεί πρόσκληση στο email του.`,
            `Add a user to ${record.name}. An invitation will be sent to their email.`,
          )}
          onClose={() => !working && setCreateUserOpen(false)}
          width="wide"
          footer={
            <DialogActions
              onCancel={() => setCreateUserOpen(false)}
              onSave={createOrganizationMember}
              saveLabel={
                working
                  ? tx('Αποστολή…', 'Sending…')
                  : tx('Δημιουργία & πρόσκληση', 'Create & invite')
              }
              disabled={!createUserValid || working}
            />
          }
        >
          <div className="platform-form-shell">
            <div className="user-form-grid">
              <label className="field">
                <span>{tx('Ονοματεπώνυμο', 'Full name')} *</span>
                <input
                  autoFocus
                  value={createUserDraft.fullName}
                  onChange={e => setCreateUserDraft(x => ({ ...x, fullName: e.target.value }))}
                />
              </label>
              <label className="field">
                <span>Email *</span>
                <input
                  type="email"
                  value={createUserDraft.email}
                  onChange={e => setCreateUserDraft(x => ({ ...x, email: e.target.value }))}
                />
              </label>
              <label className="field user-form-wide">
                <span>{tx('Ρόλος', 'Role')} *</span>
                <select
                  value={createUserDraft.role}
                  onChange={e => setCreateUserDraft(x => ({ ...x, role: e.target.value }))}
                >
                  {ROLES.map(role => (
                    <option key={role} value={role}>
                      {roleLabel(role, language)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </ObserverDialog>
      )}
    </>
  )
}
