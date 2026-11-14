import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { FilterBar } from '../../design-system/FilterBar'
import { RegistryTotals } from '../../design-system/RegistryTotals'
import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { DetailList } from '../../design-system/DetailList'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { formatDateTime } from '../../core/i18n/formatDay'
import { DEMO_REQUEST_STATUSES, listDemoRequests, updateDemoRequestStatus, type DemoRequest, type DemoRequestStatus } from './demoRequestsService'
import './platformDashboard.css'
import './demoRequests.css'

// Κονσόλα › Αιτήματα παρουσίασης: ό,τι έστειλαν οι επισκέπτες με «Ζητήστε παρουσίαση» στη δημόσια Σελίδα
// παρουσίασης. Η γραμμή ανοίγει το αίτημα· εκεί αλλάζει η κατάσταση (Νέο → Έγινε επικοινωνία → Κλειστό).
const STATUS_LABEL: Record<DemoRequestStatus, [string, string]> = { new: ['Νέο', 'New'], contacted: ['Έγινε επικοινωνία', 'Contacted'], closed: ['Κλειστό', 'Closed'] }
const STATUS_BADGE: Record<DemoRequestStatus, string> = { new: 'warning', contacted: 'info', closed: '' }

export function PlatformDemoRequestsPage() {
  const { language } = useLanguage()
  const en = language === 'en'
  const tx = (el: string, enText: string) => en ? enText : el
  const statusLabel = (status: DemoRequestStatus) => STATUS_LABEL[status][en ? 1 : 0]
  const { notify, notifyError } = useFeedback()
  const [rows, setRows] = useState<DemoRequest[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<DemoRequestStatus | ''>('')
  const [open, setOpen] = useState<DemoRequest | null>(null)
  const [status, setStatus] = useState<DemoRequestStatus>('new')
  const [saving, setSaving] = useState(false)
  useEffect(() => { let live = true; listDemoRequests().then(value => { if (live) setRows(value) }).catch(() => { if (live) { setRows([]); setLoadError(true) } }); return () => { live = false } }, [])
  const counts = useMemo(() => Object.fromEntries(DEMO_REQUEST_STATUSES.map(key => [key, (rows || []).filter(row => row.status === key).length])) as Record<DemoRequestStatus, number>, [rows])
  const visible = useMemo(() => {
    const text = query.trim().toLocaleLowerCase('el')
    return (rows || []).filter(row => (!filter || row.status === filter) && (!text || [row.fullName, row.organizationName, row.email, row.phone, row.roleTitle].join(' ').toLocaleLowerCase('el').includes(text)))
  }, [rows, query, filter])
  const totals = DEMO_REQUEST_STATUSES.map(key => ({ key, label: statusLabel(key).toLocaleLowerCase(en ? 'en' : 'el'), value: counts[key], always: key === 'new', tone: key === 'new' && counts.new ? 'warning' : undefined, active: filter === key, onClick: () => setFilter(current => current === key ? '' : key) }))
  const openRequest = (row: DemoRequest) => { setOpen(row); setStatus(row.status) }
  async function save() {
    if (!open) return
    if (status === open.status) { setOpen(null); return }
    setSaving(true)
    try {
      const updated = await updateDemoRequestStatus(open.id, status)
      setRows(current => (current || []).map(row => row.id === updated.id ? updated : row))
      notify(tx('Η κατάσταση αποθηκεύτηκε.', 'Status saved.'), 'success', { operation: 'demo_request_status' })
      setOpen(null)
    } catch (error) { notifyError(error, 'save', { operation: 'demo_request_status' }) } finally { setSaving(false) }
  }
  return <Page title={tx('Αιτήματα παρουσίασης', 'Demo requests')} subtitle={tx('Από τη φόρμα «Ζητήστε παρουσίαση» της δημόσιας σελίδας.', 'From the “Request a demo” form of the public page.')}>
    <div className="platform-registry-shell workspace-column">
      <FilterBar query={query} onQueryChange={setQuery} placeholder={tx('Αναζήτηση ονόματος, οργανισμού ή email…', 'Search name, organization or email…')} end={rows?.length ? <RegistryTotals label={tx('Σύνολα αιτημάτων', 'Request totals')} items={totals}/> : null}/>
      <div className="platform-center-section platform-registry-card workspace-column">
        {loadError && <div className="data-access-state warning"><AlertTriangle size={16}/><span>{tx('Δεν ήταν δυνατή η φόρτωση των αιτημάτων.', 'The requests could not be loaded.')}</span></div>}
        {rows === null ? <div className="registry-empty-state"><span>{tx('Φόρτωση…', 'Loading…')}</span></div> : visible.length ? <div className="scroll-table">
          <table className="data-table sticky-table">
            <thead><tr><th>{tx('Ημερομηνία', 'Date')}</th><th>{tx('Ονοματεπώνυμο', 'Full name')}</th><th>{tx('Οργανισμός', 'Organization')}</th><th>Email</th><th>{tx('Τηλέφωνο', 'Phone')}</th><th>{tx('Μήνυμα', 'Message')}</th><th>{tx('Κατάσταση', 'Status')}</th></tr></thead>
            <tbody>{visible.map(row => <tr key={row.id} tabIndex={0} className="platform-owner-clickable-row" onClick={() => openRequest(row)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openRequest(row) } }}>
              <td>{formatDateTime(row.createdAt, language)}</td>
              <td><strong>{row.fullName}</strong><small>{row.roleTitle}</small></td>
              <td>{row.organizationName}</td>
              <td><a href={`mailto:${row.email}`} onClick={event => event.stopPropagation()}>{row.email}</a></td>
              <td>{row.phone || '—'}</td>
              <td className="platform-demo-request-message">{row.message || '—'}</td>
              <td><span className={`status-badge ${STATUS_BADGE[row.status]}`.trim()}>{statusLabel(row.status)}</span></td>
            </tr>)}</tbody>
          </table>
        </div> : <div className="registry-empty-state"><strong>{rows.length ? tx('Δεν βρέθηκαν αιτήματα', 'No requests found') : tx('Δεν υπάρχουν αιτήματα ακόμα', 'No requests yet')}</strong><span>{rows.length ? tx('Δοκιμάστε άλλη αναζήτηση ή φίλτρο.', 'Try another search or filter.') : tx('Τα αιτήματα της φόρμας «Ζητήστε παρουσίαση» εμφανίζονται εδώ.', 'Requests from the “Request a demo” form appear here.')}</span></div>}
      </div>
    </div>
    {open && <ObserverDialog width="standard" title={open.fullName} subtitle={open.organizationName} onClose={() => setOpen(null)} footer={<DialogActions onSave={save} disabled={saving}/>}>
      <DetailList sections={[{ items: [
        { label: tx('Ημερομηνία', 'Date'), value: formatDateTime(open.createdAt, language) },
        { label: tx('Ιδιότητα', 'Position'), value: open.roleTitle },
        { label: 'Email', value: <a href={`mailto:${open.email}`}>{open.email}</a> },
        { label: tx('Τηλέφωνο', 'Phone'), value: open.phone },
        { label: tx('Γλώσσα', 'Language'), value: open.language === 'en' ? tx('Αγγλικά', 'English') : tx('Ελληνικά', 'Greek') },
        { label: tx('Μήνυμα', 'Message'), value: open.message, wide: true },
      ] }]}/>
      <SearchableSelect label={tx('Κατάσταση', 'Status')} value={status} options={DEMO_REQUEST_STATUSES.map(value => ({ value, label: statusLabel(value) }))} onChange={value => { if (value) setStatus(value as DemoRequestStatus) }}/>
    </ObserverDialog>}
  </Page>
}
