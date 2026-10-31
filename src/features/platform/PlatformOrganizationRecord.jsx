import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, Archive, Building2, KeyRound, LogIn, PauseCircle, PlayCircle, Trash2, Users } from 'lucide-react'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'

import { PlatformRecordActions } from './PlatformRecordActions'

import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'

import { useFeedback } from '../../core/feedback/FeedbackContext'
import { roleLabel } from '../../core/permissions/roleLabels'
import { createOrganizationUser, listOrganizationMembersDetailed, manageOrganizationUser, setPlatformOrganizationStatus, updatePlatformOrganization } from '../../core/tenant/tenantService'
import { HospitalDiagnosticsPanel } from './HospitalDiagnosticsPanel'
import { OrganizationOffboardingPanel } from './OrganizationOffboardingPanel'

import { PlatformOrganizationDetailsTab } from './PlatformOrganizationDetailsTab'
import { PlatformOrganizationUsersTab } from './PlatformOrganizationUsersTab'
import { PlatformOrganizationUserRecord } from './PlatformOrganizationUserRecord'
import { ROLES, toDraft } from './platformOrganizationShared'
import { loadEmployeesAsync } from '../employees/employeeService'

import { loadEmployeeAccounts } from './bulkAccountsService'

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
}) {
  const en = language === 'en',
    tx = (elText, enText) => (en ? enText : elText)
  const { notify, notifyError, confirm } = useFeedback()
  const [record, setRecord] = useState(organization)
  const [draft, setDraft] = useState(() => toDraft(organization))
  const [users, setUsers] = useState([])
  const [employees, setEmployees] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [saving, setSaving] = useState(false)
  const [working, setWorking] = useState(false)
  const [invitationLink, setInvitationLink] = useState(null)
  const [employeeLinkDrafts, setEmployeeLinkDrafts] = useState({})
  const [newAdmin, setNewAdmin] = useState({ name: '', email: '' })
  const [selectedUserId, setSelectedUserId] = useState('')
  const [editing, setEditing] = useState(false)
  const [userEditing, setUserEditing] = useState(false)
  const [userDraft, setUserDraft] = useState({
    fullName: '',
    email: '',
    phone: '',
    jobTitle: '',
    role: '',
  })
  const [userQuery, setUserQuery] = useState('')
  const [userPage, setUserPage] = useState(1)
  const [userPageSize, setUserPageSize] = useState(15)
  const [createUserOpen, setCreateUserOpen] = useState(false)
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

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true)
    try {
      const [rows, employeeRows] = await Promise.all([
        listOrganizationMembersDetailed(organization.id),
        loadEmployeesAsync(organization.id),
      ])
      setUsers(rows)
      setEmployees(employeeRows)
      setEmployeeLinkDrafts(
        Object.fromEntries(
          rows.map(user => [
            user.userId,
            employeeRows.find(employee => employee.userId === user.userId)?.dbId || '',
          ]),
        ),
      )
      setSelectedUserId(current =>
        current && rows.some(user => user.userId === current) ? current : '',
      )
      return rows
    } catch (error) {
      notifyError(error, 'load', { operation: 'platform_organization_users_load' })
      return []
    } finally {
      setLoadingUsers(false)
    }
  }, [organization.id, notifyError])
  useEffect(() => {
    loadUsers()
  }, [loadUsers])
  // «Χρήστες & Ρόλοι» › «Εργαζόμενοι χωρίς λογαριασμό» (N1, Platform Owner only).
  const [usersView, setUsersView] = useState('accounts')
  const [roster, setRoster] = useState({ employees: [], departments: [] })
  const [rosterLoading, setRosterLoading] = useState(false)
  const loadRoster = useCallback(async () => {
    setRosterLoading(true)
    try {
      setRoster(await loadEmployeeAccounts(organization.id))
    } catch (error) {
      notifyError(error, 'load', { operation: 'platform_employee_accounts_load' })
    } finally {
      setRosterLoading(false)
    }
  }, [organization.id, notifyError])
  useEffect(() => {
    if (initialTab === 'users') loadRoster()
  }, [initialTab, loadRoster])
  const rosterWithoutAccount = roster.employees.filter(row => row.accountState === 'none').length
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
  const filteredUsers = useMemo(() => {
    const locale = language === 'el' ? 'el-GR' : 'en-US',
      query = userQuery.trim().toLocaleLowerCase(locale)
    if (!query) return users
    return users.filter(user =>
      [user.name, user.email, user.username, roleLabel(user.role, language)].some(value =>
        String(value || '')
          .toLocaleLowerCase(locale)
          .includes(query),
      ),
    )
  }, [users, userQuery, language])
  const userTotalPages = Math.max(1, Math.ceil(filteredUsers.length / userPageSize)),
    safeUserPage = Math.min(userPage, userTotalPages),
    pagedUsers = filteredUsers.slice((safeUserPage - 1) * userPageSize, safeUserPage * userPageSize)
  const canSave = Boolean(draft.name.trim() && draft.code.trim())
  const createUserValid = Boolean(
    createUserDraft.fullName.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createUserDraft.email.trim()) &&
    createUserDraft.role,
  )

  useEffect(() => setUserPage(1), [userQuery, userPageSize])
  useEffect(() => {
    if (userPage > userTotalPages) setUserPage(userTotalPages)
  }, [userPage, userTotalPages])
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

  async function saveOrganization() {
    if (!canSave || saving) return
    setSaving(true)
    try {
      const next = await updatePlatformOrganization(record.id, draft)
      setRecord(next)
      setDraft(toDraft(next))
      onChanged?.(next)
      setEditing(false)
      notify(
        tx('Τα στοιχεία του οργανισμού ενημερώθηκαν.', 'Organization details updated.'),
        'success',
        { operation: 'platform_organization_update' },
      )
    } catch (error) {
      notifyError(error, 'save', { operation: 'platform_organization_update' })
    } finally {
      setSaving(false)
    }
  }
  async function togglePause() {
    if (working) return
    const next = record.status === 'suspended' ? 'active' : 'suspended'
    const ok = await confirm({
      title:
        next === 'suspended'
          ? tx('Παύση οργανισμού', 'Suspend organization')
          : tx('Ενεργοποίηση οργανισμού', 'Reactivate organization'),
      message:
        next === 'suspended'
          ? tx(
              'Οι χρήστες του οργανισμού δεν θα μπορούν να λειτουργούν κανονικά μέχρι την επανενεργοποίηση.',
              'Organization access will be suspended until reactivation.',
            )
          : tx('Να ενεργοποιηθεί ξανά ο οργανισμός;', 'Reactivate this organization?'),
      confirmLabel:
        next === 'suspended' ? tx('Παύση', 'Suspend') : tx('Ενεργοποίηση', 'Reactivate'),
    })
    if (!ok) return
    setWorking(true)
    try {
      const updated = await setPlatformOrganizationStatus(record.id, next)
      setRecord(updated)
      setDraft(toDraft(updated))
      onChanged?.(updated)
      notify(
        next === 'suspended'
          ? tx('Ο οργανισμός τέθηκε σε παύση.', 'Organization suspended.')
          : tx('Ο οργανισμός ενεργοποιήθηκε.', 'Organization reactivated.'),
        'success',
        { operation: 'platform_organization_status' },
      )
    } catch (error) {
      notifyError(error, 'action', { operation: 'platform_organization_status' })
    } finally {
      setWorking(false)
    }
  }
  async function resetAdmin() {
    const admin = admins[0]
    if (!admin || working) return
    const invited = admin.status === 'invited'
    const ok = await confirm({
      title: invited
        ? tx('Επαναποστολή πρόσκλησης Διαχειριστή Νοσοκομείου', 'Resend Hospital Admin invitation')
        : tx('Επαναφορά κωδικού Διαχειριστή Νοσοκομείου', 'Reset Hospital Admin password'),
      message: invited
        ? tx(
            `Η πρόσκληση θα σταλεί ξανά στο ${admin.email || 'καταχωρημένο email'}.`,
            `The invitation will be sent again to ${admin.email || 'the registered email'}.`,
          )
        : tx(
            `Θα σταλεί email επαναφοράς κωδικού στο ${admin.email || 'καταχωρημένο email'}.`,
            `A password reset email will be sent to ${admin.email || 'the registered email'}.`,
          ),
      confirmLabel: invited ? tx('Επαναποστολή', 'Resend') : tx('Αποστολή email', 'Send email'),
    })
    if (!ok) return
    setWorking(true)
    try {
      await manageOrganizationUser({
        organizationId: record.id,
        userId: admin.userId,
        action: invited ? 'resend_invitation' : 'reset_password',
      })
      await loadUsers()
      notify(
        invited
          ? tx('Η πρόσκληση επαναποστάλθηκε.', 'Invitation resent.')
          : tx('Στάλθηκε email επαναφοράς κωδικού.', 'Password reset email sent.'),
        'success',
        { operation: 'platform_admin_account' },
      )
    } catch (error) {
      notifyError(error, 'action', { operation: 'platform_admin_account' })
    } finally {
      setWorking(false)
    }
  }
  async function inviteAdmin() {
    const name = newAdmin.name.trim(),
      email = newAdmin.email.trim()
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || working) return
    setWorking(true)
    try {
      const result = await createOrganizationUser({
        organizationId: record.id,
        fullName: name,
        role: 'hospital_admin',
        email,
      })
      if (!result?.emailSent)
        throw new Error(
          tx('Η πρόσκληση δεν μπόρεσε να αποσταλεί.', 'Invitation could not be sent.'),
        )
      setNewAdmin({ name: '', email: '' })
      await loadUsers()
      notify(
        tx(
          'Ο Διαχειριστής Νοσοκομείου δημιουργήθηκε και η πρόσκληση στάλθηκε.',
          'Hospital Admin created and invitation sent.',
        ),
        'success',
        { operation: 'platform_admin_create' },
      )
    } catch (error) {
      notifyError(error, 'save', { operation: 'platform_admin_create' })
    } finally {
      setWorking(false)
    }
  }
  async function createOrganizationMember() {
    if (!createUserValid || working) return
    const fullName = createUserDraft.fullName.trim(),
      email = createUserDraft.email.trim().toLowerCase(),
      role = createUserDraft.role
    setWorking(true)
    try {
      const result = await createOrganizationUser({
        organizationId: record.id,
        fullName,
        role,
        email,
      })
      const rows = await loadUsers()
      const created = rows.find(user => String(user.email || '').toLowerCase() === email)
      setCreateUserOpen(false)
      setCreateUserDraft({ fullName: '', email: '', role: 'department_user' })
      if (created) setSelectedUserId(created.userId)
      if (result?.reused) {
        notify(
          tx(
            'Ο υπάρχων λογαριασμός προστέθηκε στον οργανισμό με τον επιλεγμένο ρόλο.',
            'The existing account was added to this organization with the selected role.',
          ),
          'success',
          { operation: 'platform_user_create' },
        )
      } else if (result?.emailSent) {
        notify(
          tx(
            'Ο χρήστης δημιουργήθηκε και η πρόσκληση στάλθηκε.',
            'User created and invitation sent.',
          ),
          'success',
          { operation: 'platform_user_create' },
        )
      } else {
        notify(
          tx(
            'Ο χρήστης δημιουργήθηκε, αλλά η πρόσκληση δεν μπόρεσε να αποσταλεί.',
            'User created, but the invitation could not be delivered.',
          ),
          'warning',
          { operation: 'platform_user_create' },
        )
      }
    } catch (error) {
      notifyError(error, 'save', { operation: 'platform_user_create' })
    } finally {
      setWorking(false)
    }
  }
  async function linkUserEmployee(user) {
    const employeeDbId = employeeLinkDrafts[user.userId] || ''
    if (!employeeDbId || working) return
    const employee = employees.find(item => item.dbId === employeeDbId)
    if (!employee) return
    const ok = await confirm({
      title: tx('Σύνδεση καρτέλας εργαζομένου', 'Link employee record'),
      message: tx(
        `Ο χρήστης ${user.name} θα συνδεθεί με την καρτέλα ${employee.lastName} ${employee.firstName} (${employee.id}).`,
        `User ${user.name} will be linked to employee record ${employee.firstName} ${employee.lastName} (${employee.id}).`,
      ),
      confirmLabel: tx('Σύνδεση', 'Link'),
    })
    if (!ok) return
    setWorking(true)
    try {
      await manageOrganizationUser({
        organizationId: record.id,
        userId: user.userId,
        action: 'link_employee',
        employeeDbId,
      })
      await loadUsers()
      notify(
        tx(
          'Η καρτέλα εργαζομένου συνδέθηκε με τον λογαριασμό.',
          'Employee record linked to the account.',
        ),
        'success',
        { operation: 'platform_user_employee_link' },
      )
    } catch (error) {
      notifyError(error, 'save', { operation: 'platform_user_employee_link' })
    } finally {
      setWorking(false)
    }
  }
  // The activation link of a pending invitation, for when the email does not arrive.
  async function showInvitationLink(user) {
    if (!user || working) return
    setWorking(true)
    try {
      const result = await manageOrganizationUser({ organizationId: record.id, userId: user.userId, action: 'invitation_link' })
      setInvitationLink({ link: result.link, name: user.name })
    } catch (error) {
      notifyError(error, 'action', { operation: 'platform_user_invitation_link' })
    } finally {
      setWorking(false)
    }
  }
  async function resetUserAccess(user) {
    if (!user || working) return
    const invited = user.status === 'invited'
    const ok = await confirm({
      title: invited
        ? tx('Επαναποστολή πρόσκλησης', 'Resend invitation')
        : tx('Επαναφορά κωδικού', 'Reset password'),
      message: invited
        ? tx(
            `Η πρόσκληση θα σταλεί ξανά στο ${user.email || 'καταχωρημένο email'}.`,
            `The invitation will be sent again to ${user.email || 'the registered email'}.`,
          )
        : tx(
            `Θα σταλεί email επαναφοράς κωδικού στο ${user.email || 'καταχωρημένο email'}.`,
            `A password reset email will be sent to ${user.email || 'the registered email'}.`,
          ),
      confirmLabel: invited ? tx('Επαναποστολή', 'Resend') : tx('Αποστολή email', 'Send email'),
    })
    if (!ok) return
    setWorking(true)
    try {
      await manageOrganizationUser({
        organizationId: record.id,
        userId: user.userId,
        action: invited ? 'resend_invitation' : 'reset_password',
      })
      await loadUsers()
      notify(
        invited
          ? tx('Η πρόσκληση επαναποστάλθηκε.', 'Invitation resent.')
          : tx('Στάλθηκε email επαναφοράς κωδικού.', 'Password reset email sent.'),
        'success',
        { operation: 'platform_user_access_reset' },
      )
    } catch (error) {
      notifyError(error, 'action', { operation: 'platform_user_access_reset' })
    } finally {
      setWorking(false)
    }
  }
  async function saveSelectedUser() {
    if (!selectedUser || working) return
    const fullName = userDraft.fullName.trim(),
      email = userDraft.email.trim().toLowerCase()
    if (fullName.length < 2 || !/^\S+@\S+\.\S+$/.test(email)) {
      notify(
        tx('Συμπλήρωσε έγκυρο ονοματεπώνυμο και email.', 'Enter a valid full name and email.'),
        'error',
      )
      return
    }
    setWorking(true)
    try {
      await manageOrganizationUser({
        organizationId: record.id,
        userId: selectedUser.userId,
        action: 'update',
        fullName,
        email,
        phone: userDraft.phone.trim() || null,
        jobTitle: userDraft.jobTitle.trim() || null,
        role: userDraft.role || selectedUser.role,
      })
      await loadUsers()
      setUserEditing(false)
      notify(tx('Τα στοιχεία του χρήστη ενημερώθηκαν.', 'User details updated.'), 'success', {
        operation: 'platform_user_update',
      })
    } catch (error) {
      notifyError(error, 'save', { operation: 'platform_user_update' })
    } finally {
      setWorking(false)
    }
  }
  async function deleteSelectedUser() {
    if (!selectedUser || working) return
    const ok = await confirm({
      title: tx('Διαγραφή χρήστη', 'Delete user'),
      message: tx(
        'Ο χρήστης ' +
          selectedUser.name +
          ' θα διαγραφεί οριστικά από το Limoxis Observer. Η ενέργεια δεν αναιρείται.',
        'User ' +
          selectedUser.name +
          ' will be permanently deleted from Limoxis Observer. This action cannot be undone.',
      ),
      confirmLabel: tx('Διαγραφή', 'Delete'),
      danger: true,
    })
    if (!ok) return
    setWorking(true)
    try {
      await manageOrganizationUser({
        organizationId: record.id,
        userId: selectedUser.userId,
        action: 'delete',
      })
      setSelectedUserId('')
      await loadUsers()
      notify(tx('Ο χρήστης διαγράφηκε.', 'User deleted.'), 'success', {
        operation: 'platform_user_delete',
      })
    } catch (error) {
      notifyError(error, 'delete', { operation: 'platform_user_delete' })
    } finally {
      setWorking(false)
    }
  }
  async function toggleSelectedUserStatus() {
    if (!selectedUser || working) return
    const action = selectedUser.status === 'disabled' ? 'reactivate' : 'suspend'
    const ok = await confirm({
      title:
        action === 'suspend'
          ? tx('Παύση χρήστη', 'Suspend user')
          : tx('Ενεργοποίηση χρήστη', 'Reactivate user'),
      message:
        action === 'suspend'
          ? tx(
              'Ο χρήστης δεν θα μπορεί να συνδεθεί μέχρι να ενεργοποιηθεί ξανά.',
              'The user will not be able to sign in until reactivated.',
            )
          : tx('Να ενεργοποιηθεί ξανά ο χρήστης;', 'Reactivate this user?'),
      confirmLabel:
        action === 'suspend' ? tx('Παύση', 'Suspend') : tx('Ενεργοποίηση', 'Reactivate'),
    })
    if (!ok) return
    setWorking(true)
    try {
      await manageOrganizationUser({
        organizationId: record.id,
        userId: selectedUser.userId,
        action,
      })
      await loadUsers()
      notify(
        action === 'suspend'
          ? tx('Ο χρήστης τέθηκε σε παύση.', 'User suspended.')
          : tx('Ο χρήστης ενεργοποιήθηκε.', 'User reactivated.'),
        'success',
        { operation: 'platform_user_status' },
      )
    } catch (error) {
      notifyError(error, 'action', { operation: 'platform_user_status' })
    } finally {
      setWorking(false)
    }
  }

  const tabs = [
    { id: 'details', label: tx('Στοιχεία & Ρυθμίσεις', 'Details & Settings'), icon: Building2 },
    {
      id: 'users',
      label: `${tx('Χρήστες & Ρόλοι', 'Users & Roles')} (${users.length})`,
      icon: Users,
    },
    { id: 'diagnostics', label: tx('Λειτουργία & Συμβάντα', 'Activity & Events'), icon: Activity },
    { id: 'offboarding', label: tx('Αντίγραφο & διαγραφή', 'Export & deletion'), icon: Archive },
  ]
  const actions = (
    <PlatformRecordActions
      label={tx('Ενέργειες οργανισμού', 'Organization actions')}
      moreLabel={tx('Περισσότερες ενέργειες', 'More actions')}
      moreText={tx('Περισσότερα', 'More')}
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
          placement: 'secondary',
          icon:
            record.status === 'suspended' ? <PlayCircle size={16} /> : <PauseCircle size={16} />,
          label:
            record.status === 'suspended'
              ? tx('Ενεργοποίηση', 'Reactivate')
              : tx('Παύση', 'Suspend'),
          title:
            record.status === 'suspended'
              ? tx('Ενεργοποίηση οργανισμού', 'Reactivate organization')
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

  if (initialTab === 'users' && selectedUser) {
    return <PlatformOrganizationUserRecord ctx={{ deleteSelectedUser, employeeLinkDrafts, employeeOptions, invitationLink, language, linkUserEmployee, organization, resetUserAccess, saveSelectedUser, selectedEmployee, selectedUser, setEmployeeLinkDrafts, setInvitationLink, setSelectedUserId, setUserDraft, setUserEditing, showInvitationLink, toggleSelectedUserStatus, tx, userDraft, userEditing, working }} />
  }

  return (
    <>
      <EntityRecordShell
        className="platform-owner-record-shell platform-organization-record-workspace"
        avatar={<Building2 size={20} />}
        eyebrow={tx('ΚΑΡΤΕΛΑ ΟΡΓΑΝΙΣΜΟΥ', 'ORGANIZATION RECORD')}
        title={draft.name || record.name}
        subtitle={`${record.code || '—'} · ${draft.city || '—'} · ${draft.region || '—'}`}
        status={
          <span className={`status-badge ${record.status === 'active' ? 'active' : 'danger'}`}>
            {record.status === 'active' ? tx('Ενεργός', 'Active') : tx('Σε παύση', 'Suspended')}
          </span>
        }
        headerActions={initialTab === 'details' ? actions : null}
        tabs={tabs}
        activeTab={initialTab}
        onTabChange={onTabChange}
        onBack={onBack}
        backLabel={tx('Πίσω', 'Back')}
      >
        {initialTab === 'details' && <PlatformOrganizationDetailsTab ctx={{ admins, canSave, draft, editing, inviteAdmin, language, loadingUsers, newAdmin, onChanged, record, saveOrganization, saving, setDraft, setEditing, setNewAdmin, setRecord, tx, users, working }} />}

        {initialTab === 'users' && <PlatformOrganizationUsersTab ctx={{ filteredUsers, language, loadRoster, loadUsers, loadingUsers, onOpenEmployee, pagedUsers, record, roster, rosterLoading, rosterWithoutAccount, safeUserPage, setCreateUserDraft, setCreateUserOpen, setSelectedUserId, setUserPage, setUserPageSize, setUserQuery, setUsersView, tx, userPageSize, userQuery, userTotalPages, users, usersView }} />}
        {initialTab === 'diagnostics' && (
          <HospitalDiagnosticsPanel organization={record} language={language} />
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
          eyebrow={tx('ΧΡΗΣΤΕΣ & ΡΟΛΟΙ', 'USERS & ROLES')}
          title={tx('Νέος χρήστης', 'New user')}
          subtitle={tx(
            `Πρόσθεσε χρήστη στον οργανισμό ${record.name}. Θα σταλεί πρόσκληση στο email του.`,
            `Add a user to ${record.name}. An invitation will be sent to their email.`,
          )}
          onClose={() => !working && setCreateUserOpen(false)}
          width="compact"
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
            <div className="platform-form-grid">
              <label className="field field-wide">
                <span>{tx('Ονοματεπώνυμο', 'Full name')} *</span>
                <input
                  autoFocus
                  value={createUserDraft.fullName}
                  onChange={e => setCreateUserDraft(x => ({ ...x, fullName: e.target.value }))}
                />
              </label>
              <label className="field field-wide">
                <span>Email *</span>
                <input
                  type="email"
                  value={createUserDraft.email}
                  onChange={e => setCreateUserDraft(x => ({ ...x, email: e.target.value }))}
                />
              </label>
              <label className="field field-wide">
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
