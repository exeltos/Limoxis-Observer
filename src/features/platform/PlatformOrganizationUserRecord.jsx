import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, KeyRound, Link2, LogOut, MonitorSmartphone, PauseCircle, Pencil, PlayCircle, Save, Trash2, UserRound, X } from 'lucide-react'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { Button } from '../../design-system/Button'
import { StatusBadge } from '../../design-system/StatusBadge'
import { DetailList } from '../../design-system/DetailList'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { roleLabel } from '../../core/permissions/roleLabels'
import { SupplierRenewalSenderField } from '../quality/resources/SupplierRenewalSenderField'
import { InvitationLinkDialog } from './InvitationLinkDialog'
import { PlatformRecordActions } from './PlatformRecordActions'
import { fmtDate } from './PlatformAuditSecurityView'
import { describeAuditGroup, groupAuditEvents } from './auditTrailModel'
import { listLoginAttempts, listPlatformAuditEvents, releaseLoginLock } from './platformAuditService'
import { athensDateTime, athensTime, initialsOf } from './platformOverviewShared'
import { activeAccountLock, failedAttempts24h } from './platformUserModel'
import { deviceLabel, durationText, sessionStatus } from './loginSessionsModel'
import { useEndLoginSessions } from './useEndLoginSessions'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { ROLES } from './platformOrganizationShared'
import './platformDashboard.css'
import './loginSessions.css'

// dd/mm/yyyy, hh:mm in Athens time, as on every owner list.
const short = athensDateTime
const hhmm = athensTime

// The record of one user of the organization (opened from «Χρήστες πλατφόρμας» or from the organization's
// «Χρήστες»): Στοιχεία (with the account's security), Συνδέσεις and Δραστηριότητα. The state and the
// actions stay in PlatformOrganizationRecord (ctx).
export function PlatformOrganizationUserRecord({ ctx }) {
  const { deleteSelectedUser, employeeLinkDrafts, employeeOptions, invitationLink, language, linkUserEmployee, loadSessions, organization, resetUserAccess, saveSelectedUser, selectedEmployee, selectedUser, sessions = [], setEmployeeLinkDrafts, setInvitationLink, setSelectedUserId, setUserDraft, setUserEditing, showInvitationLink, toggleSelectedUserStatus, tx, userDraft, userEditing, working } = ctx
  const en = language === 'en'
  const { confirm, notify, notifyError } = useFeedback()
  // The employee picker is a searchable list (a hospital has hundreds of employees); built once, not on every render.
  const employeePickerOptions = useMemo(() => employeeOptions.map(employee => ({ value: employee.dbId, label: `${employee.lastName} ${employee.firstName}`, description: [employee.id, employee.department].filter(Boolean).join(' · ') })), [employeeOptions])
  const [tab, setTab] = useState('details')
  const [signIns, setSignIns] = useState({ attempts: [], locks: [] })
  const [now, setNow] = useState(() => Date.now())
  const loadSignIns = useCallback(async () => {
    try {
      setSignIns(await listLoginAttempts({ days: 2 }))
    } catch {
      setSignIns({ attempts: [], locks: [] })
    }
    setNow(Date.now())
  }, [])
  useEffect(() => {
    void loadSignIns()
  }, [loadSignIns])
  const userSessions = useMemo(
    () => sessions.filter(row => row.userId === selectedUser.userId).sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt))),
    [sessions, selectedUser.userId],
  )
  const online = userSessions.some(row => row.online)
  const lock = activeAccountLock(signIns.locks, selectedUser, now)
  const failures = failedAttempts24h(signIns.attempts, selectedUser, now)
  const { endSessions, menuItems: sessionMenuItems } = useEndLoginSessions({ tx, en, onDone: loadSessions })
  async function unlock() {
    if (!lock) return
    const ok = await confirm({
      title: tx('Ξεκλείδωμα', 'Unlock'),
      message: tx(`Ο λογαριασμός «${lock.subject}» μπορεί να συνδεθεί ξανά αμέσως.`, `The account “${lock.subject}” can sign in again right away.`),
      confirmLabel: tx('Ξεκλείδωμα', 'Unlock'),
    })
    if (!ok) return
    try {
      await releaseLoginLock(lock.id)
      notify(tx('Ξεκλειδώθηκε.', 'Unlocked.'))
      await loadSignIns()
    } catch (err) {
      notifyError(err, 'save', { operation: 'platform_release_login_lock' })
    }
  }
  // Δραστηριότητα: what this user did, from the audit trail (loaded when the tab opens).
  const [events, setEvents] = useState(null)
  const [eventPage, setEventPage] = useState(1)
  const [eventPageSize, setEventPageSize] = useState(15)
  const [sessionPage, setSessionPage] = useState(1)
  const [sessionPageSize, setSessionPageSize] = useState(15)
  useEffect(() => {
    if (tab !== 'activity' || events) return
    let active = true
    listPlatformAuditEvents({ limit: 1000 })
      .then(rows => { if (active) setEvents(rows) })
      .catch(() => { if (active) setEvents([]) })
    return () => { active = false }
  }, [tab, events])
  // Identical consecutive actions within 15 minutes are one row with a count; newest first.
  const userEvents = useMemo(() => groupAuditEvents((events || []).filter(row => row.actorId === selectedUser.userId).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))), [events, selectedUser.userId])
  const eventNames = { organization: id => (id === organization.id ? organization.name : ''), user: ref => (ref.userId === selectedUser.userId || ref.memberId === selectedUser.id ? selectedUser.name : ''), employee: id => { const found = (ctx.employees || []).find(employee => employee.dbId === id); return found ? `${found.lastName} ${found.firstName}` : '' } }
  const eventPages = Math.max(1, Math.ceil(userEvents.length / eventPageSize)), safeEventPage = Math.min(eventPage, eventPages)
  const pagedEvents = userEvents.slice((safeEventPage - 1) * eventPageSize, safeEventPage * eventPageSize)
  const sessionPages = Math.max(1, Math.ceil(userSessions.length / sessionPageSize)), safeSessionPage = Math.min(sessionPage, sessionPages)
  const pagedSessions = userSessions.slice((safeSessionPage - 1) * sessionPageSize, safeSessionPage * sessionPageSize)
  const statusTone = selectedUser.status === 'active' ? 'success' : selectedUser.status === 'disabled' ? 'danger' : 'warning'
  const statusText = selectedUser.status === 'active' ? tx('Ενεργός', 'Active') : selectedUser.status === 'disabled' ? tx('Σε παύση', 'Suspended') : tx('Εκκρεμής', 'Pending')
  const tabs = [
    { id: 'details', label: tx('Στοιχεία', 'Details'), icon: UserRound },
    { id: 'sessions', label: tx('Συνδέσεις', 'Sign-ins'), icon: MonitorSmartphone },
    { id: 'activity', label: tx('Δραστηριότητα', 'Activity'), icon: Activity },
  ]
  // One «⋯»: every action of the account (the edit sits in the details).
  const actions = (
    <PlatformRecordActions
      label={tx('Ενέργειες χρήστη', 'User actions')}
      moreLabel={tx('Περισσότερες ενέργειες', 'More actions')}
      actions={[
        {
          id: 'reset',
          placement: 'menu',
          icon: <KeyRound size={16} />,
          label: selectedUser.status === 'invited' ? tx('Επαναποστολή πρόσκλησης', 'Resend invitation') : tx('Επαναφορά κωδικού', 'Reset password'),
          disabled: working,
          onClick: () => resetUserAccess(selectedUser),
        },
        selectedUser.status === 'invited' && {
          id: 'link',
          placement: 'menu',
          icon: <Link2 size={16} />,
          label: tx('Σύνδεσμος πρόσκλησης', 'Invitation link'),
          disabled: working,
          onClick: () => showInvitationLink(selectedUser),
        },
        {
          id: 'status',
          placement: 'menu',
          icon: selectedUser.status === 'disabled' ? <PlayCircle size={16} /> : <PauseCircle size={16} />,
          label: selectedUser.status === 'disabled' ? tx('Επανενεργοποίηση', 'Reactivate') : tx('Παύση', 'Suspend'),
          disabled: working,
          onClick: toggleSelectedUserStatus,
        },
        {
          id: 'signout',
          placement: 'menu',
          icon: <LogOut size={16} />,
          label: tx('Αποσύνδεση από όλες τις συσκευές', 'Sign out of every device'),
          disabled: working,
          onClick: () => void endSessions({ userId: selectedUser.userId, fullName: selectedUser.name, username: selectedUser.username }, true),
        },
        {
          id: 'delete',
          placement: 'menu',
          danger: true,
          icon: <Trash2 size={16} />,
          label: tx('Διαγραφή', 'Delete'),
          title: tx('Οριστική διαγραφή χρήστη', 'Delete user permanently'),
          disabled: working,
          onClick: deleteSelectedUser,
        },
      ]}
    />
  )
  const employeeText = selectedEmployee ? `${selectedEmployee.lastName} ${selectedEmployee.firstName} (${selectedEmployee.id})` : ''
  return (
    <>
      <EntityRecordShell
        className="platform-owner-record-shell platform-user-record-shell workspace-fill"
        avatar={<span aria-hidden="true">{initialsOf(selectedUser.name)}</span>}
        eyebrow={tx('ΧΡΗΣΤΗΣ ΟΡΓΑΝΙΣΜΟΥ', 'ORGANIZATION USER')}
        title={selectedUser.name}
        status={
          <>
            {online && <span className="login-status is-good">{tx('Συνδεδεμένος τώρα', 'Online now')}</span>}
            <StatusBadge tone={statusTone}>{statusText}</StatusBadge>
          </>
        }
        headerActions={actions}
        tabs={tabs}
        activeTab={tab}
        onTabChange={setTab}
        onBack={() => setSelectedUserId('')}
        backLabel={tx('Πίσω', 'Back')}
      >
        {tab === 'details' && (
          <div className="platform-owner-details platform-user-record-workspace">
            {!userEditing ? (
              <section className="platform-form-section platform-org-details-card">
                <header>
                  <div><strong>{tx('Στοιχεία χρήστη', 'User details')}</strong></div>
                  <div className="platform-form-section-actions">
                    <Button variant="secondary" onClick={() => setUserEditing(true)}>
                      <Pencil size={15} />
                      {tx('Επεξεργασία', 'Edit')}
                    </Button>
                  </div>
                </header>
                <DetailList
                  className="platform-org-details"
                  sections={[{ key: 'details', items: [
                    { key: 'name', label: tx('Ονοματεπώνυμο', 'Full name'), value: selectedUser.name },
                    { key: 'username', label: tx('Όνομα χρήστη', 'Username'), value: selectedUser.username },
                    { key: 'email', label: 'Email', value: selectedUser.email },
                    { key: 'phone', label: tx('Τηλέφωνο', 'Phone'), value: selectedUser.phone },
                    { key: 'job', label: tx('Θέση / Ιδιότητα', 'Job title'), value: selectedUser.jobTitle },
                    { key: 'role', label: tx('Ρόλος', 'Role'), value: roleLabel(selectedUser.role, language) },
                    { key: 'organization', label: tx('Οργανισμός', 'Organization'), value: organization.name },
                    { key: 'employee', label: tx('Καρτέλα εργαζομένου', 'Employee record'), value: employeeText },
                    { key: 'created', label: tx('Δημιουργία', 'Created'), value: selectedUser.createdAt ? new Intl.DateTimeFormat(en ? 'en-GB' : 'el-GR').format(new Date(selectedUser.createdAt)) : '' },
                    { key: 'status', label: tx('Κατάσταση', 'Status'), value: <StatusBadge tone={statusTone}>{statusText}</StatusBadge> },
                  ] }]}
                />
              </section>
            ) : (
              <section className="platform-form-section">
                <header>
                  <div><strong>{tx('Στοιχεία χρήστη', 'User details')}</strong></div>
                  <div className="platform-form-section-actions">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setUserDraft({
                          fullName: selectedUser.name || '',
                          email: selectedUser.email || '',
                          phone: selectedUser.phone || '',
                          jobTitle: selectedUser.jobTitle || '',
                          role: selectedUser.role || '',
                        })
                        setUserEditing(false)
                      }}
                    >
                      <X size={15} />
                      {tx('Ακύρωση', 'Cancel')}
                    </Button>
                    <Button disabled={working} onClick={saveSelectedUser}>
                      <Save size={15} />
                      {tx('Αποθήκευση', 'Save')}
                    </Button>
                  </div>
                </header>
                <div className="platform-user-record-grid">
                  <label className="field">
                    <span>{tx('Ονοματεπώνυμο', 'Full name')}</span>
                    <input value={userDraft.fullName} onChange={e => setUserDraft(x => ({ ...x, fullName: e.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Email</span>
                    <input type="email" value={userDraft.email} onChange={e => setUserDraft(x => ({ ...x, email: e.target.value }))} />
                  </label>
                  <label className="field">
                    <span>{tx('Όνομα χρήστη', 'Username')}</span>
                    <input value={selectedUser.username || '—'} readOnly />
                  </label>
                  <label className="field">
                    <span>{tx('Τηλέφωνο', 'Phone')}</span>
                    <input value={userDraft.phone} onChange={e => setUserDraft(x => ({ ...x, phone: e.target.value }))} />
                  </label>
                  <label className="field">
                    <span>{tx('Θέση / Ιδιότητα', 'Job title')}</span>
                    <input value={userDraft.jobTitle} onChange={e => setUserDraft(x => ({ ...x, jobTitle: e.target.value }))} />
                  </label>
                  <label className="field">
                    <span>{tx('Ρόλος', 'Role')}</span>
                    <select value={userDraft.role || selectedUser.role} onChange={e => setUserDraft(x => ({ ...x, role: e.target.value }))}>
                      {ROLES.map(role => (
                        <option key={role} value={role}>
                          {roleLabel(role, language)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="platform-user-record-link-row">
                  <SearchableSelect
                    className="platform-role-select"
                    label={tx('Καρτέλα εργαζομένου', 'Employee record')}
                    hideLabel
                    value={employeeLinkDrafts[selectedUser.userId] || ''}
                    options={employeePickerOptions}
                    limit={50}
                    onChange={value => setEmployeeLinkDrafts(x => ({ ...x, [selectedUser.userId]: value }))}
                    placeholder={tx('Αναζήτηση εργαζομένου…', 'Search employee…')}
                    emptyLabel={tx('Δεν βρέθηκε εργαζόμενος', 'No employee found')}
                    clearLabel={tx('Καθαρισμός', 'Clear')}
                  />
                  <Button
                    variant="secondary"
                    disabled={working || !employeeLinkDrafts[selectedUser.userId] || selectedEmployee?.dbId === employeeLinkDrafts[selectedUser.userId]}
                    onClick={() => linkUserEmployee(selectedUser)}
                  >
                    {tx(selectedEmployee ? 'Αλλαγή σύνδεσης' : 'Σύνδεση καρτέλας', selectedEmployee ? 'Change link' : 'Link record')}
                  </Button>
                </div>
              </section>
            )}
            <SupplierRenewalSenderField
              className="platform-user-inline"
              organizationId={organization.id}
              membershipId={selectedUser.id}
              userId={selectedUser.userId}
              disabled={working}
            />
            <section className="platform-user-security" aria-label={tx('Ασφάλεια', 'Security')}>
              <h4 className="lo-detail-heading">{tx('Ασφάλεια', 'Security')}</h4>
              <dl className="platform-user-security-list">
                <div>
                  <dt>{tx('Κλείδωμα λογαριασμού', 'Account lock')}</dt>
                  <dd>
                    {lock ? (
                      <>
                        <span className="login-status is-danger">{tx(`Κλειδωμένος μέχρι ${hhmm(lock.lockedUntil)}`, `Locked until ${hhmm(lock.lockedUntil)}`)}</span>
                        <Button variant="secondary" onClick={() => void unlock()}>{tx('Ξεκλείδωμα', 'Unlock')}</Button>
                      </>
                    ) : (
                      tx('Όχι', 'No')
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{tx('Αποτυχημένες προσπάθειες τελευταίες 24 ώρες', 'Failed attempts, last 24 hours')}</dt>
                  <dd>{failures}</dd>
                </div>
              </dl>
            </section>
          </div>
        )}
        {tab === 'sessions' && (
          <div className="platform-user-record-tab">
            {userSessions.length ? (
              <>
              <div className="table-wrap scroll-table diagnostics-table-wrap">
                <table className="data-table sticky-table diagnostics-table login-sessions-table">
                  <thead>
                    <tr>
                      <th>IP</th>
                      <th>{tx('Συσκευή', 'Device')}</th>
                      <th>{tx('Έναρξη', 'Start')}</th>
                      <th>{tx('Τελευταία δραστηριότητα', 'Last activity')}</th>
                      <th>{tx('Διάρκεια', 'Duration')}</th>
                      <th>{tx('Κατάσταση', 'Status')}</th>
                      <th><span className="lo-visually-hidden">{tx('Ενέργειες', 'Actions')}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedSessions.map(row => {
                      const state = sessionStatus(row, en)
                      return (
                        <tr key={row.sessionId}>
                          <td><span className="login-ip">{row.ip || '—'}</span>{row.lastIp && row.lastIp !== row.ip && <small>{tx('τώρα', 'now')} {row.lastIp}</small>}</td>
                          <td>{deviceLabel(row.userAgent, en)}</td>
                          <td className="login-when">{short(row.startedAt)}</td>
                          <td className="login-when">{short(row.endedAt || row.lastSeenAt)}</td>
                          <td className="login-when">{durationText(row, now, en)}</td>
                          <td><span className={`login-status is-${state.tone}`}>{state.label}</span></td>
                          <td className="login-actions">{row.active && <OverflowMenu label={tx('Ενέργειες σύνδεσης', 'Session actions')} items={sessionMenuItems(row)} />}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <RegistryPagination language={language} page={safeSessionPage} totalPages={sessionPages} totalItems={userSessions.length} pageSize={sessionPageSize} onPageChange={setSessionPage} onPageSizeChange={size => { setSessionPageSize(size); setSessionPage(1) }} />
              </>
            ) : (
              <div className="registry-empty-state">
                <strong>{tx('Καμία σύνδεση τις τελευταίες 90 ημέρες.', 'No sign-ins in the last 90 days.')}</strong>
              </div>
            )}
          </div>
        )}
        {tab === 'activity' && (
          <div className="platform-user-record-tab">
            {events === null ? (
              <div className="inline-empty">{tx('Φόρτωση ενεργειών…', 'Loading actions…')}</div>
            ) : userEvents.length ? (
              <>
                <div className="table-wrap scroll-table diagnostics-table-wrap">
                  <table className="data-table sticky-table diagnostics-table">
                    <thead>
                      <tr>
                        <th>{tx('Ημερομηνία / ώρα', 'Date / time')}</th>
                        <th>{tx('Οργανισμός', 'Organization')}</th>
                        <th>{tx('Ενέργεια', 'Action')}</th>
                        <th>{tx('Αντικείμενο', 'Entity')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedEvents.map(group => {
                        const text = describeAuditGroup(group, { en, names: eventNames })
                        return (
                          <tr key={group.id}>
                            <td><strong>{fmtDate(group.to)}</strong>{text.when && <small>{text.when}</small>}</td>
                            <td>{group.organizationId === organization.id ? organization.name : group.metadata?.organization_name || tx('Επίπεδο πλατφόρμας', 'Platform level')}</td>
                            <td><strong>{text.action}</strong></td>
                            <td title={text.technical || undefined}>{text.entity}{text.name && <small>{text.name}</small>}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <RegistryPagination language={language} page={safeEventPage} totalPages={eventPages} totalItems={userEvents.length} pageSize={eventPageSize} onPageChange={setEventPage} onPageSizeChange={setEventPageSize} />
              </>
            ) : (
              <div className="registry-empty-state">
                <strong>{tx('Δεν υπάρχουν καταγεγραμμένες ενέργειες αυτού του χρήστη.', 'No recorded actions by this user.')}</strong>
              </div>
            )}
          </div>
        )}
      </EntityRecordShell>
      {invitationLink && <InvitationLinkDialog link={invitationLink.link} name={invitationLink.name} onClose={() => setInvitationLink(null)} />}
    </>
  )
}
