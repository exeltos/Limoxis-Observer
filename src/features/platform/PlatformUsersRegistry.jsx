import { useEffect, useMemo, useState } from 'react'
import { Page } from '../../design-system/Page'
import { FilterBar } from '../../design-system/FilterBar'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { DownloadMenu } from '../../design-system/DownloadMenu'
import { exportRegistry } from '../../core/export/registryExports'
import { roleLabel } from '../../core/permissions/roleLabels'
import './platformDeletion.css'

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
// account stands. A row opens its organization or Demo.
export function PlatformUsersRegistry({ language = 'el', users = [], loading = false, onOpenUser }) {
  const en = language === 'en', tx = (el, enText) => (en ? enText : el)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1), [pageSize, setPageSize] = useState(15)
  const kindLabel = kind => ({ hospital: tx('Νοσοκομείο', 'Hospital'), demo: 'Demo', platform: tx('Πλατφόρμα', 'Platform'), none: tx('Χωρίς οργανισμό', 'No organization') })[kind]
  const stateLabel = state => ({ active: tx('Ενεργός', 'Active'), pending: tx('Πρόσκληση σε αναμονή', 'Invitation pending'), expired: tx('Η πρόσκληση έληξε', 'Invitation expired'), inactive: tx('Ανενεργός', 'Inactive') })[state]
  const roleText = user => user.role ? roleLabel(user.role, language) : '—'
  const sorted = useMemo(() => [...users].sort((a, b) => String(a.organization?.name || '~').localeCompare(String(b.organization?.name || '~'), 'el') || String(a.name).localeCompare(String(b.name), 'el')), [users])
  const counts = useMemo(() => sorted.reduce((acc, user) => { acc[user.kind] = (acc[user.kind] || 0) + 1; const state = platformUserState(user); if (state === 'pending' || state === 'expired') acc.invited += 1; return acc }, { invited: 0 }), [sorted])
  const visible = useMemo(() => {
    const locale = en ? 'en-US' : 'el-GR', q = query.trim().toLocaleLowerCase(locale)
    return sorted.filter(user => {
      if (filter === 'invited') { const state = platformUserState(user); if (state !== 'pending' && state !== 'expired') return false }
      else if (filter !== 'all' && user.kind !== filter) return false
      return !q || [user.name, user.email, user.username, user.organization?.name, user.organization?.code, user.role ? roleLabel(user.role, language) : ''].some(value => String(value || '').toLocaleLowerCase(locale).includes(q))
    })
  }, [sorted, filter, query, en, language])
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize)), safePage = Math.min(page, totalPages)
  const paged = useMemo(() => visible.slice((safePage - 1) * pageSize, safePage * pageSize), [visible, safePage, pageSize])
  useEffect(() => setPage(1), [query, filter, pageSize])
  const chips = [['all', tx('Όλοι', 'All'), sorted.length], ['hospital', tx('Νοσοκομεία', 'Hospitals'), counts.hospital || 0], ['demo', 'Demo', counts.demo || 0], ['platform', tx('Πλατφόρμα', 'Platform'), counts.platform || 0], ['invited', tx('Πρόσκληση σε αναμονή', 'Invitation pending'), counts.invited], ...(counts.none ? [['none', tx('Χωρίς οργανισμό', 'No organization'), counts.none]] : [])]
  function exportUsers() {
    exportRegistry({ name: tx('xristes', 'users'),
      headers: [tx('Ονοματεπώνυμο', 'Name'), 'Email', 'Username', tx('Ρόλος', 'Role'), tx('Οργανισμός', 'Organization'), tx('Τύπος', 'Type'), tx('Κατάσταση', 'Status'), tx('Από', 'Since')],
      rows: visible.map(user => [user.name, user.email, user.username, roleText(user), user.organization?.name || '', kindLabel(user.kind), stateLabel(platformUserState(user)), fmtDay(user.createdAt, language)]) })
  }
  const canOpen = user => Boolean(user.organization?.id)
  return <Page title={tx('Χρήστες', 'Users')} subtitle={tx('Όλοι οι χρήστες της πλατφόρμας: τι ρόλο έχουν, σε ποιον οργανισμό ή Demo ανήκουν και αν έχουν ενεργοποιήσει τον λογαριασμό τους.', 'Everyone on the platform: their role, the organization or Demo they belong to, and whether they have activated their account.')}
    actions={<DownloadMenu items={[{ id: 'users', label: tx('Excel: χρήστες', 'Excel: users'), disabled: !visible.length, onClick: exportUsers }]}/>}>
    <div className="platform-registry-shell workspace-column">
      <div className="platform-demo-toolbar">
        <FilterBar query={query} onQueryChange={setQuery} placeholder={tx('Αναζήτηση χρήστη, email ή οργανισμού…', 'Search user, email or organization…')}/>
        <div className="platform-demo-status-chips" role="group" aria-label={tx('Φίλτρο', 'Filter')}>{chips.map(([value, label, count]) => <button key={value} type="button" className={`platform-demo-status-chip${filter === value ? ' is-active' : ''}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}<b>{count}</b></button>)}</div>
      </div>
      <div className="platform-center-section platform-registry-card workspace-column">
        {loading ? <div className="registry-empty-state"><span>{tx('Φόρτωση…', 'Loading…')}</span></div> : visible.length ? <>
          <div className="scroll-table">
            <table className="data-table sticky-table">
              <thead><tr><th>{tx('Χρήστης', 'User')}</th><th>Username</th><th>{tx('Ρόλος', 'Role')}</th><th>{tx('Οργανισμός', 'Organization')}</th><th>{tx('Κατάσταση', 'Status')}</th><th>{tx('Από', 'Since')}</th></tr></thead>
              <tbody>{paged.map(user => {
                const state = platformUserState(user)
                const open = canOpen(user) ? () => onOpenUser?.(user) : undefined
                return <tr key={user.id} tabIndex={open ? 0 : undefined} className={open ? 'platform-owner-clickable-row' : ''} onClick={open} onKeyDown={open ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open() } } : undefined}>
                  <td><strong>{user.name}</strong><small>{user.email || '—'}</small></td>
                  <td>{user.username ? <code>{user.username}</code> : '—'}</td>
                  <td>{roleText(user)}</td>
                  <td>{user.organization ? <><strong>{user.organization.name}</strong><small><span className={`status-badge ${user.kind === 'demo' ? 'temporary' : 'info'}`}>{kindLabel(user.kind)}</span> {user.organization.code}</small></> : <span className="status-badge">{kindLabel(user.kind)}</span>}</td>
                  <td><span className={`status-badge ${STATE_BADGE[state]}`}>{stateLabel(state)}</span></td>
                  <td>{fmtDay(user.createdAt, language)}</td>
                </tr>
              })}</tbody>
            </table>
          </div>
          <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={visible.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/>
        </> : <div className="registry-empty-state"><strong>{tx('Δεν βρέθηκαν χρήστες', 'No users found')}</strong><span>{tx('Δοκιμάστε άλλη αναζήτηση ή φίλτρο.', 'Try another search or filter.')}</span></div>}
      </div>
    </div>
  </Page>
}
