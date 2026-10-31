import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertOctagon, BookMarked, CalendarClock, ExternalLink, FilePlus2, Gauge, Inbox, Link2, Pencil, Plus, Radar, RefreshCw, Scale, Sparkles, Trash2, XCircle } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { ActionButton } from '../../design-system/ActionButton'
import { Button } from '../../design-system/Button'
import { IconButton } from '../../design-system/IconButton'
import { CanonicalTabs } from '../../design-system/CanonicalTabs'
import { ExportMenu } from '../../design-system/ExportMenu'
import { FilterBar, FilterSelect } from '../../design-system/FilterBar'
import { KpiFigures } from '../../design-system/KpiCard'
import { RegistryTable } from '../../design-system/RegistryTable'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { StatusBadge } from '../../design-system/StatusBadge'
import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'
import { Field } from '../../design-system/Field'
import { ChoiceField } from '../../design-system/ChoiceField'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { formatDay } from '../../core/i18n/formatDay'
import { exportRegistry, printRegistry } from '../../core/export/registryExports'
import { useLegislationAccess } from './legislationAccess'
import { checkSourcesNow, loadCandidates, loadLibrary, loadRegister, loadSources, removeSource, saveSource, setCandidate } from './legislationService'
import { KINDS, NO_FILTERS, REGISTER_STATES, TOPICS, buildRegister, candidateStatusLabel, candidateStatusTone, filterRegister, hasUnpublished, kindLabel, registerCounts, registerExport, registerStateLabel, registerStateTone, sourceHealth, sourceHealthLabel, sourceHealthTone, textStatusLabel, textStatusTone, unpublishedChanges } from './legislationModel'
import './legislation.css'

// The legislation that applies to the hospital and how it complies; for the
// Platform Owner also the library every hospital reads, what the automatic
// check of the sources found, and the sources themselves.
export function LegislationPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { language } = useLanguage()
  const en = language === 'en'
  const { tenant } = useTenant()
  const access = useLegislationAccess()
  const base = location.pathname.startsWith('/platform') ? '/platform/legislation' : '/legislation'
  const tabs = [
    ...(tenant?.id || access.isDemo ? [{ value: 'register', icon: Scale, label: en ? 'Hospital register' : 'Μητρώο νοσοκομείου' }] : []),
    ...(access.isPlatformOwner ? [{ value: 'library', icon: BookMarked, label: en ? 'Platform library' : 'Βιβλιοθήκη πλατφόρμας' }, { value: 'review', icon: Inbox, label: en ? 'To review' : 'Προς έλεγχο' }, { value: 'sources', icon: Radar, label: en ? 'Sources' : 'Πηγές' }] : []),
  ]
  const requestedParams = new URLSearchParams(location.search)
  // Inside «Έγγραφα & Κανονισμοί» ?tab= picks the section's tab; this page's own tab travels as ?view=.
  const requested = requestedParams.get('view') || requestedParams.get('tab')
  const [tab, setTab] = useState(() => (tabs.some(item => item.value === requested) ? requested : tabs[0]?.value || 'register'))
  const [register, setRegister] = useState({ loading: true, versions: [], rows: [] })
  const [library, setLibrary] = useState({ loading: true, texts: [], versions: [] })
  const [candidates, setCandidates] = useState({ loading: true, items: [] })
  const [sources, setSources] = useState({ loading: true, items: [] })
  const [filters, setFilters] = useState(NO_FILTERS)

  const reloadRegister = useCallback(() => loadRegister(tenant?.id).then(data => setRegister({ loading: false, ...data })).catch(() => setRegister({ loading: false, versions: [], rows: [] })), [tenant?.id])
  const reloadOwner = useCallback(() => {
    if (!access.isPlatformOwner) return
    loadLibrary().then(data => setLibrary({ loading: false, ...data })).catch(() => setLibrary({ loading: false, texts: [], versions: [] }))
    loadCandidates().then(items => setCandidates({ loading: false, items })).catch(() => setCandidates({ loading: false, items: [] }))
    loadSources().then(items => setSources({ loading: false, items })).catch(() => setSources({ loading: false, items: [] }))
  }, [access.isPlatformOwner])
  useEffect(() => { void reloadRegister() }, [reloadRegister])
  useEffect(() => { reloadOwner() }, [reloadOwner])

  const entries = useMemo(() => buildRegister(register.versions, register.rows), [register.versions, register.rows])
  const counts = registerCounts(entries)
  const pending = candidates.items.filter(item => item.status === 'pending')
  const failing = sources.items.filter(item => sourceHealth(item) === 'failing')
  const visible = useMemo(() => filterRegister(entries, filters), [entries, filters])
  const quick = key => setFilters(current => ({ ...current, quick: current.quick === key ? null : key }))
  const loading = register.loading
  const { notify } = useFeedback()

  // At most four cards: the applicable texts and the updates to review are notes on them.
  const figures = tab === 'register' ? [
    { key: 'percent', icon: Gauge, value: counts.percent == null ? null : counts.percent, unit: '%', loading, label: en ? 'Average compliance' : 'Μέση συμμόρφωση', status: counts.percent == null ? null : counts.percent >= 90 ? 'good' : counts.percent >= 75 ? 'warning' : 'danger', target: en ? 'target ≥ 90%' : 'στόχος ≥ 90%', hint: en ? `of ${counts.applicable} texts` : `σε ${counts.applicable} κείμενα`, active: filters.quick === 'applicable', go: () => quick('applicable') },
    { key: 'new', icon: Sparkles, value: counts.newTexts, loading, label: en ? 'New texts to decide on' : 'Νέα κείμενα προς απόφαση', tone: 'warning', hint: counts.updates ? (en ? `+${counts.updates} to review` : `+${counts.updates} για επανεξέταση`) : null, active: filters.quick === 'new', go: () => quick('new') },
    { key: 'nonCompliant', icon: AlertOctagon, value: counts.nonCompliant, loading, label: en ? 'With non-compliance' : 'Με μη συμμόρφωση', status: counts.nonCompliant ? 'danger' : 'good', target: en ? 'target: 0' : 'στόχος: 0', active: filters.quick === 'nonCompliant', go: () => quick('nonCompliant') },
    { key: 'reviewLate', icon: CalendarClock, value: counts.reviewLate, loading, label: en ? 'Review overdue' : 'Εκπρόθεσμη επανεξέταση', status: counts.reviewLate ? 'danger' : 'good', target: en ? 'target: 0' : 'στόχος: 0', active: filters.quick === 'reviewLate', go: () => quick('reviewLate') },
  ] : []

  const actions = <div className="row-actions">
    {tab === 'register' && <ExportMenu disabled={!visible.length} onPrint={() => { if (!printRegistry(registerExport(visible, language), { language, kind: en ? 'Legislation' : 'Νομοθεσία', title: en ? 'Legislation that applies' : 'Νομοθεσία που αφορά' })) notify(en ? 'Allow pop-ups to print.' : 'Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.', 'error') }} onExcel={() => exportRegistry(registerExport(visible, language))} />}
    {tab === 'library' && <ActionButton tone="primary" label={en ? 'New text' : 'Νέο κείμενο'} onClick={() => navigate(`${base}/library/new`)}><Plus size={18} /><span>{en ? 'New text' : 'Νέο κείμενο'}</span></ActionButton>}
  </div>

  return <Page fill className="registry-fill-page" title={en ? 'Legislation' : 'Νομοθεσία'} subtitle={!tabs.some(item => item.value === 'register') ? (en ? 'The library every hospital reads, what the automatic check of the sources found, and the sources.' : 'Η βιβλιοθήκη που διαβάζουν όλα τα νοσοκομεία, ό,τι βρήκε ο αυτόματος έλεγχος των πηγών, και οι πηγές.') : (en ? 'The laws, decisions and standards that apply to the hospital, and how it complies with each requirement.' : 'Οι νόμοι, οι αποφάσεις και τα πρότυπα που αφορούν το νοσοκομείο, και πώς συμμορφώνεται σε κάθε απαίτηση.')} actions={actions}>
    {tabs.length > 1 && <CanonicalTabs items={tabs.map(item => ({ ...item, count: item.value === 'review' ? pending.length : item.value === 'sources' ? failing.length : item.value === 'register' ? counts.updates + counts.newTexts : 0 }))} value={tab} onChange={setTab} ariaLabel={en ? 'Legislation' : 'Νομοθεσία'} />}
    <KpiFigures label={en ? 'Legislation' : 'Νομοθεσία'} figures={figures} />
    <section className="surface registry-workspace workspace-column workspace-fill">
      {tab === 'register' && <RegisterList entries={visible} loading={register.loading} filters={filters} setFilters={setFilters} language={language} onOpen={entry => navigate(`/legislation/${entry.text.id}`)} />}
      {tab === 'library' && access.isPlatformOwner && <LibraryList library={library} language={language} onOpen={item => navigate(`${base}/library/${item.id}`)} />}
      {tab === 'review' && access.isPlatformOwner && <ReviewList candidates={candidates} texts={library.texts} language={language} onChanged={reloadOwner} base={base} />}
      {tab === 'sources' && access.isPlatformOwner && <SourcesList sources={sources} language={language} onChanged={reloadOwner} />}
    </section>
  </Page>
}

function usePaging(rows, deps) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setPage(1), [...deps, pageSize])
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize)), safePage = Math.min(page, totalPages)
  return { rows: rows.slice((safePage - 1) * pageSize, safePage * pageSize), page: safePage, totalPages, pageSize, setPage, setPageSize }
}

function RegisterList({ entries, loading, filters, setFilters, language, onOpen }) {
  const en = language === 'en'
  const set = (key, value) => setFilters(current => ({ ...current, [key]: value }))
  const paging = usePaging(entries, [filters])
  const advanced = ['topic', 'kind', 'state'].filter(key => filters[key] !== 'all').length
  return <>
    <FilterBar query={filters.query} onQueryChange={value => set('query', value)} placeholder={en ? 'Search text, reference, issuer…' : 'Αναζήτηση κειμένου, ΦΕΚ, φορέα…'} activeAdvancedCount={advanced} onClear={() => setFilters(NO_FILTERS)}>
      <FilterSelect label={en ? 'Topic' : 'Θέμα'} value={filters.topic} onChange={value => set('topic', value)}><option value="all">{en ? 'All' : 'Όλα'}</option>{TOPICS.map(item => <option key={item.value} value={item.value}>{item.label[en ? 1 : 0]}</option>)}</FilterSelect>
      <FilterSelect label={en ? 'Kind' : 'Είδος'} value={filters.kind} onChange={value => set('kind', value)}><option value="all">{en ? 'All' : 'Όλα'}</option>{KINDS.map(item => <option key={item.value} value={item.value}>{item.label[en ? 1 : 0]}</option>)}</FilterSelect>
      <FilterSelect label={en ? 'State' : 'Κατάσταση'} value={filters.state} onChange={value => set('state', value)}><option value="all">{en ? 'All' : 'Όλες'}</option>{REGISTER_STATES.map(item => <option key={item.value} value={item.value}>{item.label[en ? 1 : 0]}</option>)}</FilterSelect>
    </FilterBar>
    <div className="scroll-table">
      <RegistryTable sortable={false} bare className="quality-table quality-register-table" rows={paging.rows} rowKey={entry => entry.text.id} empty={!loading && !entries.length}
        columns={[{ key: 'code', label: en ? 'Code' : 'Κωδικός' }, { key: 'text', label: en ? 'Text' : 'Κείμενο' }, { key: 'compliance', label: en ? 'Compliance' : 'Συμμόρφωση' }, { key: 'review', label: en ? 'Next review' : 'Επανεξέταση' }, { key: 'state', label: en ? 'State' : 'Κατάσταση' }]}
        emptyTitle={en ? 'No legislation yet' : 'Δεν υπάρχει ακόμη νομοθεσία'} emptyText={en ? 'Texts appear here when the platform publishes them.' : 'Τα κείμενα εμφανίζονται εδώ όταν τα δημοσιεύει η πλατφόρμα.'}
        rowProps={entry => ({ className: 'registry-row-clickable', onClick: () => onOpen(entry) })}
        renderRow={entry => <>
          <td><strong>{entry.text.code}</strong><small>v{entry.text.version}</small></td>
          <td>{entry.text.title}<small>{[kindLabel(entry.text.kind, language), entry.text.reference].filter(Boolean).join(' · ')}{entry.text.status !== 'in_force' ? ` · ${textStatusLabel(entry.text.status, language)}` : ''}</small></td>
          <td>{entry.state === 'new' || entry.state === 'not_applicable' ? '—' : <ComplianceBar summary={entry.summary} language={language} />}</td>
          <td className="nowrap-cell">{formatDay(entry.row?.nextReviewOn, language) || '—'}{entry.reviewLate && <small className="quality-overdue-text">{en ? 'Overdue' : 'Εκπρόθεσμη'}</small>}</td>
          <td><StatusBadge tone={registerStateTone(entry.state)}>{registerStateLabel(entry.state, language)}</StatusBadge>{entry.state === 'update' && <small>{en ? `${entry.changed.size} requirements changed` : `${entry.changed.size} απαιτήσεις άλλαξαν`}</small>}</td>
        </>} />
    </div>
    {entries.length > 0 && <RegistryPagination language={language} page={paging.page} totalPages={paging.totalPages} totalItems={entries.length} pageSize={paging.pageSize} onPageChange={paging.setPage} onPageSizeChange={paging.setPageSize} />}
  </>
}

export function ComplianceBar({ summary, language }) {
  const en = language === 'en'
  const width = value => `${summary.total ? (value / summary.total) * 100 : 0}%`
  return <span className="leg-bar" title={en ? `${summary.compliant} compliant · ${summary.partial} partly · ${summary.non_compliant} not · ${summary.unassessed} not assessed` : `${summary.compliant} συμμορφώνονται · ${summary.partial} μερικώς · ${summary.non_compliant} όχι · ${summary.unassessed} χωρίς αξιολόγηση`}>
    <span className="leg-bar-track"><i className="is-ok" style={{ width: width(summary.compliant) }} /><i className="is-partial" style={{ width: width(summary.partial) }} /><i className="is-non" style={{ width: width(summary.non_compliant) }} /><i className="is-na" style={{ width: width(summary.not_applicable) }} /></span>
    <b>{summary.percent == null ? '—' : `${summary.percent}%`}</b>
  </span>
}

function LibraryList({ library, language, onOpen }) {
  const en = language === 'en'
  const [query, setQuery] = useState('')
  const history = useMemo(() => { const map = new Map(); for (const version of library.versions) { const list = map.get(version.textId) || []; list.push(version); map.set(version.textId, list) } return map }, [library.versions])
  const rows = library.texts.filter(item => !query.trim() || `${item.code} ${item.title} ${item.reference}`.toLocaleLowerCase('el').includes(query.trim().toLocaleLowerCase('el')))
  const paging = usePaging(rows, [query])
  return <>
    <FilterBar query={query} onQueryChange={setQuery} placeholder={en ? 'Search the library…' : 'Αναζήτηση στη βιβλιοθήκη…'} onClear={() => setQuery('')} />
    <div className="scroll-table">
      <RegistryTable sortable={false} bare className="quality-table quality-register-table" rows={paging.rows} rowKey={item => item.id} empty={!library.loading && !rows.length}
        columns={[{ key: 'code', label: en ? 'Code' : 'Κωδικός' }, { key: 'text', label: en ? 'Text' : 'Κείμενο' }, { key: 'requirements', label: en ? 'Requirements' : 'Απαιτήσεις' }, { key: 'published', label: en ? 'Published' : 'Δημοσίευση' }, { key: 'status', label: en ? 'Status' : 'Κατάσταση' }]}
        emptyTitle={en ? 'The library is empty' : 'Η βιβλιοθήκη είναι κενή'} emptyText={en ? 'Add the texts that apply to hospitals, or start from what the automatic check found.' : 'Προσθέστε τα κείμενα που αφορούν τα νοσοκομεία, ή ξεκινήστε από όσα βρήκε ο αυτόματος έλεγχος.'}
        rowProps={item => ({ className: 'registry-row-clickable', onClick: () => onOpen(item) })}
        renderRow={item => { const changes = unpublishedChanges(item, history.get(item.id)?.sort((a, b) => a.version - b.version).at(-1)?.snapshot); return <>
          <td><strong>{item.code}</strong></td>
          <td>{item.title}<small>{[kindLabel(item.kind, language), item.reference].filter(Boolean).join(' · ')}</small></td>
          <td>{item.requirements.length}</td>
          <td className="nowrap-cell">{item.version ? `v${item.version} · ${formatDay(item.publishedAt, language)}` : (en ? 'Not published' : 'Μη δημοσιευμένο')}{item.version > 0 && hasUnpublished(changes) && <small className="quality-overdue-text">{en ? 'Unpublished changes' : 'Μη δημοσιευμένες αλλαγές'}</small>}</td>
          <td><StatusBadge tone={textStatusTone(item.status)}>{textStatusLabel(item.status, language)}</StatusBadge></td>
        </> }} />
    </div>
    {rows.length > 0 && <RegistryPagination language={language} page={paging.page} totalPages={paging.totalPages} totalItems={rows.length} pageSize={paging.pageSize} onPageChange={paging.setPage} onPageSizeChange={paging.setPageSize} />}
  </>
}

function ReviewList({ candidates, texts, language, onChanged, base }) {
  const en = language === 'en'
  const navigate = useNavigate()
  const { notify } = useFeedback()
  const [status, setStatus] = useState('pending')
  const [linking, setLinking] = useState(null)
  const rows = candidates.items.filter(item => status === 'all' || item.status === status)
  const paging = usePaging(rows, [status])
  async function dismiss(item) {
    try { await setCandidate(item.id, { status: 'dismissed' }); onChanged() } catch { notify(en ? 'Could not save.' : 'Δεν αποθηκεύτηκε.', 'error') }
  }
  return <>
    <div className="leg-sources-head"><p className="leg-note">{en ? 'Found by the automatic check of the sources (every 2 hours). Nothing reaches the hospitals until you publish it from the library; you get a morning e-mail when something new is found.' : 'Ό,τι βρήκε ο αυτόματος έλεγχος των πηγών (κάθε 2 ώρες). Τίποτα δεν φτάνει στα νοσοκομεία πριν το δημοσιεύσετε από τη βιβλιοθήκη· όταν βρεθεί κάτι νέο, σας έρχεται email το πρωί.'}</p>
      <SearchableSelect hideLabel className="leg-status-filter" label={en ? 'Status' : 'Κατάσταση'} value={status} onChange={next=>next&&(setStatus)(next)} options={[{ value: 'pending', label: en ? 'To review' : 'Προς έλεγχο' }, { value: 'linked', label: en ? 'Added' : 'Καταχωρίστηκαν' }, { value: 'dismissed', label: en ? 'Dismissed' : 'Απορρίφθηκαν' }, { value: 'all', label: en ? 'All' : 'Όλα' }]}/></div>
    <div className="scroll-table">
      <RegistryTable sortable={false} bare className="quality-table quality-register-table" rows={paging.rows} rowKey={item => item.id} empty={!candidates.loading && !rows.length}
        columns={[{ key: 'found', label: en ? 'Found' : 'Βρέθηκε' }, { key: 'item', label: en ? 'Item' : 'Εύρημα' }, { key: 'keywords', label: en ? 'Matched' : 'Λέξεις' }, { key: 'status', label: en ? 'Status' : 'Κατάσταση' }, { key: 'actions', label: '' }]}
        emptyTitle={status === 'pending' ? (en ? 'Nothing to review' : 'Δεν υπάρχει κάτι προς έλεγχο') : (en ? 'Nothing here' : 'Δεν υπάρχουν εγγραφές')} emptyText={en ? 'New items from the sources appear here.' : 'Τα νέα ευρήματα από τις πηγές εμφανίζονται εδώ.'}
        renderRow={item => <>
          <td className="nowrap-cell">{formatDay(item.detectedAt, language)}<small>{item.sourceName}</small></td>
          <td className="leg-candidate-cell">{item.url ? <a href={item.url} target="_blank" rel="noreferrer">{item.title} <ExternalLink size={12} /></a> : item.title}{item.excerpt && <small>{item.excerpt}</small>}</td>
          <td>{item.matchedKeywords.join(', ')}</td>
          <td><StatusBadge tone={candidateStatusTone(item.status)}>{candidateStatusLabel(item.status, language)}</StatusBadge></td>
          <td>{item.status === 'pending' && <div className="row-actions leg-candidate-actions">
            <Button onClick={() => navigate(`${base}/library/new`, { state: { candidate: item } })}><FilePlus2 size={15} />{en ? 'New text' : 'Νέο κείμενο'}</Button>
            <IconButton label={en ? 'Update of an existing text' : 'Ενημέρωση υπάρχοντος κειμένου'} onClick={() => setLinking({ candidate: item, textId: '' })}><Link2 size={15} /></IconButton>
            <IconButton tone="danger" label={en ? 'Dismiss' : 'Απόρριψη'} onClick={() => dismiss(item)}><XCircle size={15} /></IconButton>
          </div>}</td>
        </>} />
    </div>
    {rows.length > 0 && <RegistryPagination language={language} page={paging.page} totalPages={paging.totalPages} totalItems={rows.length} pageSize={paging.pageSize} onPageChange={paging.setPage} onPageSizeChange={paging.setPageSize} />}
    {linking && <ObserverDialog title={en ? 'Update of an existing text' : 'Ενημέρωση υπάρχοντος κειμένου'} subtitle={linking.candidate.title} onClose={() => setLinking(null)}
      footer={<DialogActions onCancel={() => setLinking(null)} onSave={() => navigate(`${base}/library/${linking.textId}`, { state: { candidate: linking.candidate } })} saveLabel={en ? 'Open the text' : 'Άνοιγμα κειμένου'} disabled={!linking.textId} />}>
      <SearchableSelect label={en ? 'Text of the library' : 'Κείμενο της βιβλιοθήκης'} value={linking.textId} options={texts.map(item => ({ value: item.id, label: `${item.code} · ${item.title}`, description: item.reference, keywords: `${item.code} ${item.title} ${item.reference}` }))} onChange={value => setLinking(current => ({ ...current, textId: value || '' }))} placeholder={en ? 'Search…' : 'Αναζήτηση…'} emptyLabel={en ? 'No match' : 'Δεν βρέθηκε'} clearLabel={en ? 'Clear' : 'Καθαρισμός'} />
      <p className="leg-note">{en ? 'You change the text there and publish it as a new version; the item is marked as added.' : 'Εκεί αλλάζετε το κείμενο και το δημοσιεύετε ως νέα έκδοση· το εύρημα σημειώνεται ως καταχωρισμένο.'}</p>
    </ObserverDialog>}
  </>
}

function SourcesList({ sources, language, onChanged }) {
  const en = language === 'en'
  const { notify, confirm } = useFeedback()
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  async function save() {
    if (!String(editing.name || '').trim() || !/^https?:\/\//.test(String(editing.url || '').trim())) { notify(en ? 'Give a name and an address starting with https://' : 'Δώστε όνομα και διεύθυνση που αρχίζει από https://', 'error'); return }
    setBusy(true)
    try { await saveSource({ ...editing, keywords: String(editing.keywordsText || '').split(/[,\n]/) }); setEditing(null); onChanged() } catch { notify(en ? 'The source could not be saved.' : 'Η πηγή δεν αποθηκεύτηκε.', 'error') } finally { setBusy(false) }
  }
  async function remove(source) {
    if (!(await confirm({ title: en ? 'Delete source' : 'Διαγραφή πηγής', message: source.name, confirmLabel: en ? 'Delete' : 'Διαγραφή', danger: true }))) return
    try { await removeSource(source.id); onChanged() } catch { notify(en ? 'Could not delete.' : 'Δεν διαγράφηκε.', 'error') }
  }
  async function checkNow() {
    setBusy(true)
    try {
      const started = await checkSourcesNow()
      notify(started ? (en ? 'The check started: the results show in about a minute.' : 'Ο έλεγχος ξεκίνησε: τα αποτελέσματα φαίνονται σε περίπου ένα λεπτό.') : (en ? 'In the demo the sources are not checked.' : 'Στο demo οι πηγές δεν ελέγχονται.'), started ? 'success' : 'info')
      if (started) window.setTimeout(onChanged, 60000)
    } catch { notify(en ? 'The check could not start.' : 'Ο έλεγχος δεν ξεκίνησε.', 'error') } finally { setBusy(false) }
  }
  return <>
    <div className="leg-sources-head">
      <p className="leg-note">{en ? 'Checked every 2 hours. A new item is kept when it contains one of the keywords (without accents, any case). If a source fails twice in a row, the morning e-mail says so.' : 'Ελέγχονται κάθε 2 ώρες. Ένα νέο εύρημα κρατιέται όταν περιέχει μία από τις λέξεις-κλειδιά (χωρίς τόνους, πεζά ή κεφαλαία). Αν μια πηγή αποτύχει δύο φορές στη σειρά, το πρωινό email το αναφέρει.'}</p>
      <div className="row-actions"><Button variant="secondary" disabled={busy} onClick={checkNow}><RefreshCw size={15} />{en ? 'Check now' : 'Έλεγχος τώρα'}</Button><Button onClick={() => setEditing({ name: '', url: '', kind: 'rss', keywordsText: '', active: true })}><Plus size={15} />{en ? 'Source' : 'Πηγή'}</Button></div>
    </div>
    <div className="scroll-table">
      <RegistryTable sortable={false} bare className="quality-table quality-register-table" rows={sources.items} rowKey={item => item.id} empty={!sources.loading && !sources.items.length}
        columns={[{ key: 'source', label: en ? 'Source' : 'Πηγή' }, { key: 'keywords', label: en ? 'Keywords' : 'Λέξεις-κλειδιά' }, { key: 'checked', label: en ? 'Last check' : 'Τελευταίος έλεγχος' }, { key: 'health', label: en ? 'State' : 'Κατάσταση' }, { key: 'actions', label: '' }]}
        emptyTitle={en ? 'No sources' : 'Δεν υπάρχουν πηγές'}
        renderRow={item => { const health = sourceHealth(item); return <>
          <td><strong>{item.name}</strong><small><a href={item.url} target="_blank" rel="noreferrer">{item.url}</a> · {item.kind === 'rss' ? 'RSS' : (en ? 'page' : 'σελίδα')}</small></td>
          <td className="leg-keywords-cell">{item.keywords.join(', ')}</td>
          <td className="nowrap-cell">{item.lastCheckedAt ? new Date(item.lastCheckedAt).toLocaleString(en ? 'en-GB' : 'el-GR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '—'}{item.lastError && <small className="quality-overdue-text">{item.lastError}</small>}</td>
          <td><StatusBadge tone={sourceHealthTone(health)}>{sourceHealthLabel(health, language)}</StatusBadge></td>
          <td><div className="row-actions"><IconButton size="sm" label={en ? 'Edit' : 'Επεξεργασία'} onClick={() => setEditing({ ...item, keywordsText: item.keywords.join(', ') })}><Pencil size={14} /></IconButton><IconButton size="sm" tone="danger" label={en ? 'Delete' : 'Διαγραφή'} onClick={() => remove(item)}><Trash2 size={14} /></IconButton></div></td>
        </> }} />
    </div>
    {editing && <ObserverDialog title={editing.id ? (en ? 'Source' : 'Πηγή') : (en ? 'New source' : 'Νέα πηγή')} onClose={() => setEditing(null)}
      footer={<DialogActions onCancel={() => setEditing(null)} onSave={save} saveLabel={en ? 'Save' : 'Αποθήκευση'} disabled={busy} />}>
      <div className="leg-form">
        <Field label={en ? 'Name *' : 'Όνομα *'}><input value={editing.name} onChange={e => setEditing(current => ({ ...current, name: e.target.value }))} /></Field>
        <Field label={en ? 'Address *' : 'Διεύθυνση *'}><input value={editing.url} onChange={e => setEditing(current => ({ ...current, url: e.target.value }))} placeholder="https://" inputMode="url" /></Field>
        <ChoiceField label={en ? 'Read as' : 'Ανάγνωση ως'} value={editing.kind} options={[{ value: 'rss', label: 'RSS / Atom' }, { value: 'page', label: en ? 'Page of links' : 'Σελίδα με συνδέσμους' }]} onChange={kind => setEditing(current => ({ ...current, kind }))} />
        <Field label={en ? 'Keywords (comma separated; a word start is enough)' : 'Λέξεις-κλειδιά (με κόμμα· αρκεί η αρχή της λέξης)'}><textarea rows={3} value={editing.keywordsText} onChange={e => setEditing(current => ({ ...current, keywordsText: e.target.value }))} placeholder={en ? 'infection, waste, legionella' : 'λοιμωξ, αποβλητ, λεγιονελλ'} /></Field>
        <ChoiceField label={en ? 'Checked' : 'Ελέγχεται'} value={editing.active !== false ? 'yes' : 'no'} options={[{ value: 'yes', label: en ? 'Yes' : 'Ναι' }, { value: 'no', label: en ? 'No' : 'Όχι' }]} onChange={value => setEditing(current => ({ ...current, active: value === 'yes' }))} />
      </div>
    </ObserverDialog>}
  </>
}

