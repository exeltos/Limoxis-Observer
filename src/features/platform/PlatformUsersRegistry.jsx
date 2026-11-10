import { useEffect, useMemo, useState } from 'react'
import { Page } from '../../design-system/Page'
import { FilterBar } from '../../design-system/FilterBar'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { RegistryTotals } from '../../design-system/RegistryTotals'
import { ExportMenu } from '../../design-system/ExportMenu'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { FileUp, Mail, UserCheck, UserPlus } from 'lucide-react'
import { exportRegistry } from '../../core/export/registryExports'
import { roleLabel } from '../../core/permissions/roleLabels'
import { listLoginSessions } from './platformAuditService'
import { initialsOf, latestSessionByUser, sinceText } from './platformOverviewShared'
import './platformDeletion.css'
import './platformDashboard.css'
import './loginSessions.css'

const fmtDay = (value, language) => value ? new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'el-GR').format(new Date(value)) : '—'

// Where a person stands: active, invitation pending or expired, or inactive.
export function platformUserState(user) {
  if (user.status === 'active') return 'active'
  if (user.status === 'invited') return user.invitation === 'expired' ? 'expired' : 'pending'
  return 'inactive'
}
const STATE_BADGE = { active: 'active', pending: 'temporary', expired: 'warning', inactive: 'danger' }

// The Platform Owner's "Users": everyone on the platform, what they are (role)
// and where from (hospital, Demo or the platform itself), with where their
// account stands, and when they last signed in. A row opens the user's record; «Νέος χρήστης» asks first
// for the organization, then continues into that organization's own dialogs (onNewUser).
export function PlatformUsersRegistry({ tabs = null, language = 'el', users = [], organizations = [], loading = false, onOpenUser, onNewUser }) {
  const en = language === 'en', tx = (el, enText) => (en ? enText : el)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1), [pageSize, setPageSize] = useState(15)
  const [sessions, setSessions] = useState([])
  const [newMode, setNewMode] = useState(''), [newOrganizationId, setNewOrganizationId] = useState('')
  useEffect(() => { let active = true; listLoginSessions({ days: 90 }).then(rows => { if (active) setSessions(rows || []) }).catch(() => { if (active) setSessions([]) }); return () => { active = false } }, [])
  // The latest sign-in of each user, and who is signed in right now.
  const latest = useMemo(() => latestSessionByUser(sessions), [sessions])
  const onlineIds = useMemo(() => new Set(sessions.filter(row => row.online).map(row => row.userId)), [sessions])
  const kindLabel = kind => ({ hospital: tx('Νοσοκομείο', 'Hospital'), demo: 'Demo', platform: tx('Πλατφόρμα', 'Platform'), none: tx('Χωρίς οργανισμό', 'No organization') })[kind]
  const stateLabel = state => ({ active: tx('Ενεργός', 'Active'), pending: tx('Πρόσκληση σε αναμονή', 'Invitation pending'), expired: tx('Η πρόσκληση έληξε', 'Invitation expired'), inactive: tx('Ανενεργός', 'Inactive') })[state]
  const roleText = user => user.role ? roleLabel(user.role, language) : '—'
  const sorted = useMemo(() => [...users].sort((a, b) => String(a.organization?.name || '~').localeCompare(String(b.organization?.name || '~'), 'el') || String(a.name).localeCompare(String(b.name), 'el')), [users])
  const counts = useMemo(() => sorted.reduce((acc, user) => { acc[user.kind] = (acc[user.kind] || 0) + 1; const state = platformUserState(user); if (state === 'pending' || state === 'expired') acc.invited += 1; if (state === 'inactive') acc.inactive += 1; if (onlineIds.has(user.userId)) acc.online += 1; return acc }, { invited: 0, inactive: 0, online: 0 }), [sorted, onlineIds])
  const visible = useMemo(() => {
    const locale = en ? 'en-US' : 'el-GR', q = query.trim().toLocaleLowerCase(locale)
    return sorted.filter(user => {
      if (filter === 'invited') { const state = platformUserState(user); if (state !== 'pending' && state !== 'expired') return false }
      else if (filter === 'inactive') { if (platformUserState(user) !== 'inactive') return false }
      else if (filter === 'online') { if (!onlineIds.has(user.userId)) return false }
      else if (filter !== 'all' && user.kind !== filter) return false
      return !q || [user.name, user.email, user.username, user.organization?.name, user.organization?.code, user.role ? roleLabel(user.role, language) : ''].some(value => String(value || '').toLocaleLowerCase(locale).includes(q))
    })
  }, [sorted, filter, query, en, language, onlineIds])
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize)), safePage = Math.min(page, totalPages)
  const paged = useMemo(() => visible.slice((safePage - 1) * pageSize, safePage * pageSize), [visible, safePage, pageSize])
  useEffect(() => setPage(1), [query, filter, pageSize])
  // The totals beside the search, as on Organizations (owner, 10/11/2026): each one filters the list; a second click clears it.
  const toggle = key => setFilter(current => (current === key ? 'all' : key))
  const totals = [['hospital', tx('χρήστες νοσοκομείων', 'hospital users'), counts.hospital || 0, undefined, true], ['online', tx('συνδεδεμένοι τώρα', 'online now'), counts.online, 'good'], ['demo', 'Demo', counts.demo || 0], ['platform', tx('Ιδιοκτήτης', 'Owner'), counts.platform || 0], ['invited', tx('εκκρεμείς προσκλήσεις', 'pending invitations'), counts.invited, 'warning'], ['inactive', tx('ανενεργοί', 'inactive'), counts.inactive, 'danger'], ['none', tx('χωρίς οργανισμό', 'no organization'), counts.none || 0]].map(([key, label, value, tone, always]) => ({ key, label, value, always, tone: value ? tone : undefined, active: filter === key, onClick: () => toggle(key) }))
  function exportUsers() {
    exportRegistry({ name: tx('xristes', 'users'),
      headers: [tx('Ονοματεπώνυμο', 'Name'), 'Email', tx('Όνομα χρήστη', 'Username'), tx('Ρόλος', 'Role'), tx('Οργανισμός', 'Organization'), tx('Τύπος', 'Type'), tx('Κατάσταση', 'Status'), tx('Τελευταία σύνδεση', 'Last sign-in')],
      rows: visible.map(user => [user.name, user.email, user.username, roleText(user), user.organization?.name || '', kindLabel(user.kind), stateLabel(platformUserState(user)), onlineIds.has(user.userId) ? tx('Συνδεδεμένος τώρα', 'Online now') : fmtDay(latest.get(user.userId)?.startedAt, language)]) })
  }
  const canOpen = user => Boolean(user.organization?.id)
  const productionOrganizations = useMemo(() => organizations.filter(org => !org.is_demo).sort((a, b) => String(a.name).localeCompare(String(b.name), 'el')), [organizations])
  const organizationOptions = useMemo(() => productionOrganizations.map(org => ({ value: org.id, label: org.name, description: org.code })), [productionOrganizations])
  const closeNew = () => { setNewMode(''); setNewOrganizationId('') }
  const lastSignIn = user => {
    const session = latest.get(user.userId)
    if (!session && !onlineIds.has(user.userId)) return '—'
    return <>{onlineIds.has(user.userId) ? tx('Συνδεδεμένος τώρα', 'Online now') : sinceText(session.startedAt, tx)}<small className="login-ip">{session?.lastIp || session?.ip || '—'}</small></>
  }
  return <Page title={tx('Χρήστες πλατφόρμας', 'Platform users')}
    actions={<div className="row-actions">
      <ExportMenu items={[{ id: 'users', label: tx('Excel: χρήστες', 'Excel: users'), disabled: !visible.length, onClick: exportUsers }]}/>
      {onNewUser && <OverflowMenu label={tx('Νέος χρήστης', 'New user')} triggerTone="primary" width={280} trigger={<><UserPlus size={15} aria-hidden="true"/>{tx('Νέος χρήστης', 'New user')}</>} items={[
        { id: 'active', label: tx('Ενεργός με προσωρινό κωδικό', 'Active, with a temporary password'), icon: UserCheck, onClick: () => setNewMode('single') },
        { id: 'invite', label: tx('Πρόσκληση με email', 'Invitation by e-mail'), icon: Mail, onClick: () => setNewMode('invite') },
        { id: 'file', label: tx('Εισαγωγή από αρχείο (Excel/CSV)', 'Import from a file (Excel/CSV)'), icon: FileUp, separatorBefore: true, onClick: () => setNewMode('file') },
      ]}/>}
    </div>}>
    {tabs}
    <div className="platform-registry-shell workspace-column">
      <FilterBar query={query} onQueryChange={setQuery} placeholder={tx('Αναζήτηση χρήστη, email ή οργανισμού…', 'Search user, email or organization…')} end={sorted.length ? <RegistryTotals label={tx('Σύνολα χρηστών', 'User totals')} items={totals}/> : null}/>
      <div className="platform-center-section platform-registry-card workspace-column">
        {loading ? <div className="registry-empty-state"><span>{tx('Φόρτωση…', 'Loading…')}</span></div> : visible.length ? <>
          <div className="scroll-table">
            <table className="data-table sticky-table">
              <thead><tr><th>{tx('Χρήστης', 'User')}</th><th>{tx('Όνομα χρήστη', 'Username')}</th><th>{tx('Ρόλος', 'Role')}</th><th>{tx('Οργανισμός', 'Organization')}</th><th>{tx('Τελευταία σύνδεση', 'Last sign-in')}</th><th>{tx('Κατάσταση', 'Status')}</th></tr></thead>
              <tbody>{paged.map(user => {
                const state = platformUserState(user)
                const open = canOpen(user) ? () => onOpenUser?.(user) : undefined
                return <tr key={user.id} tabIndex={open ? 0 : undefined} className={open ? 'platform-owner-clickable-row' : ''} onClick={open} onKeyDown={open ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open() } } : undefined}>
                  <td><div className="platform-overview-org"><span className="platform-overview-avatar" aria-hidden="true">{initialsOf(user.name)}</span><span><strong>{user.name}{onlineIds.has(user.userId) && <span className="platform-user-online" role="img" aria-label={tx('Συνδεδεμένος τώρα', 'Online now')} title={tx('Συνδεδεμένος τώρα', 'Online now')}/>}</strong><small>{user.email || '—'}</small></span></div></td>
                  <td>{user.username ? <code>{user.username}</code> : '—'}</td>
                  <td>{roleText(user)}</td>
                  <td>{user.organization ? <><strong>{user.organization.name}</strong><small><span className={`status-badge ${user.kind === 'demo' ? 'temporary' : 'info'}`}>{kindLabel(user.kind)}</span> {user.organization.code}</small></> : <span className="status-badge">{kindLabel(user.kind)}</span>}</td>
                  <td className="platform-users-last">{lastSignIn(user)}</td>
                  <td><span className={`status-badge ${STATE_BADGE[state]}`}>{stateLabel(state)}</span></td>
                </tr>
              })}</tbody>
            </table>
          </div>
          <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={visible.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/>
        </> : <div className="registry-empty-state"><strong>{tx('Δεν βρέθηκαν χρήστες', 'No users found')}</strong><span>{tx('Δοκιμάστε άλλη αναζήτηση ή φίλτρο.', 'Try another search or filter.')}</span></div>}
      </div>
    </div>
    {newMode && <ObserverDialog width="compact" title={tx('Νέος χρήστης', 'New user')} onClose={closeNew} footer={<DialogActions disabled={!newOrganizationId} saveLabel={tx('Συνέχεια', 'Continue')} onSave={() => { const mode = newMode, id = newOrganizationId; closeNew(); onNewUser?.(id, mode) }}/>}>
      <SearchableSelect label={tx('Σε ποιον οργανισμό;', 'Which organization?')} value={newOrganizationId} options={organizationOptions} onChange={setNewOrganizationId} placeholder={tx('Αναζήτηση οργανισμού…', 'Search organization…')} emptyLabel={tx('Δεν βρέθηκε οργανισμός', 'No organization found')}/>
    </ObserverDialog>}
  </Page>
}
