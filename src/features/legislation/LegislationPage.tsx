import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BookMarked, ExternalLink, FilePlus2, Inbox, Link2, Pencil, Plus, Radar, RefreshCw, Scale, Trash2, XCircle } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { PlatformLegalTabs as PlatformLegalTabsJs } from '../platform/PlatformLegalTabs'
import { ActionButton } from '../../design-system/ActionButton'
import { Button } from '../../design-system/Button'
import { IconButton } from '../../design-system/IconButton'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { CanonicalTabs } from '../../design-system/CanonicalTabs'
import { ExportMenu } from '../../design-system/ExportMenu'
import { FilterBar, FilterSelect } from '../../design-system/FilterBar'
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
import type { AnyRecord } from '../../types/featureTypes'
import type { ComplianceSummary, LegislationVersion, RegisterEntry, RegisterFilters } from './legislationModel'

// PlatformLegalTabs is still JS: its `counts = null` default would type the prop as null.
const PlatformLegalTabs = PlatformLegalTabsJs as (props: { active: string, counts?: Record<string, number> | null }) => ReturnType<typeof PlatformLegalTabsJs>

// The legislation that applies to the hospital and how it complies; for the
// Platform Owner also the library every hospital reads, what the automatic
// check of the sources found, and the sources themselves.
interface LibraryState { loading: boolean, texts: AnyRecord[], versions: LegislationVersion[] }
interface ItemsState { loading: boolean, items: AnyRecord[] }

export function LegislationPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { language } = useLanguage()
  const en = language === 'en'
  const { tenant } = useTenant()
  const access = useLegislationAccess()
  const ownerRoute = access.isPlatformOwner && location.pathname.startsWith('/platform')
  const base = location.pathname.startsWith('/platform') ? '/platform/legislation' : '/legislation'
  const tabs = [
    ...(tenant?.id || access.isDemo ? [{ value: 'register', icon: Scale, label: en ? 'Hospital register' : 'Μητρώο νοσοκομείου' }] : []),
    ...(access.isPlatformOwner ? [{ value: 'library', icon: BookMarked, label: en ? 'Platform library' : 'Βιβλιοθήκη πλατφόρμας' }, { value: 'review', icon: Inbox, label: en ? 'To review' : 'Προς έλεγχο' }, { value: 'sources', icon: Radar, label: en ? 'Sources' : 'Πηγές' }] : []),
  ]
  const requestedParams = new URLSearchParams(location.search)
  // Inside «Έγγραφα & Κανονισμοί» ?tab= picks the section's tab; this page's own tab travels as ?view=.
  const requested = requestedParams.get('view') || requestedParams.get('tab')
  const [tab, setTab] = useState<string>(() => (requested && tabs.some(item => item.value === requested) ? requested : tabs[0]?.value || 'register'))
  // The owner's «Νομοθεσία & πηγές»: the choice travels in the address (?view=), so the menu and old links open it.
  const ownerView = ownerRoute && requested !== 'register' ? (requested && ['review', 'sources'].includes(requested) ? requested : 'library') : null
  useEffect(() => { if (ownerView) setTab(ownerView) }, [ownerView])
  const [register, setRegister] = useState<{ loading: boolean, versions: LegislationVersion[], rows: AnyRecord[] }>({ loading: true, versions: [], rows: [] })
  const [library, setLibrary] = useState<LibraryState>({ loading: true, texts: [], versions: [] })
  const [candidates, setCandidates] = useState<ItemsState>({ loading: true, items: [] })
  const [sources, setSources] = useState<ItemsState>({ loading: true, items: [] })
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
  const { notify } = useFeedback()

  const actions = <div className="row-actions">
    {tab === 'register' && <ExportMenu disabled={!visible.length} onPrint={() => { if (!printRegistry(registerExport(visible, language), { language, kind: en ? 'Legislation' : 'Νομοθεσία', title: en ? 'Legislation that applies' : 'Νομοθεσία που αφορά' })) notify(en ? 'Allow pop-ups to print.' : 'Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.', 'error') }} onExcel={() => exportRegistry(registerExport(visible, language))} />}
    {tab === 'library' && <ActionButton tone="primary" label={en ? 'New text' : 'Νέο κείμενο'} onClick={() => navigate(`${base}/library/new`)}><Plus size={18} /><span>{en ? 'New text' : 'Νέο κείμενο'}</span></ActionButton>}
  </div>

  return <Page fill className="registry-fill-page" title={ownerRoute ? (en ? 'Legislation & sources' : 'Νομοθεσία & πηγές') : en ? 'Legislation' : 'Νομοθεσία'} subtitle={ownerRoute ? undefined : !tabs.some(item => item.value === 'register') ? (en ? 'The library every hospital reads, what the automatic check of the sources found, and the sources.' : 'Η βιβλιοθήκη που διαβάζουν όλα τα νοσοκομεία, ό,τι βρήκε ο αυτόματος έλεγχος των πηγών, και οι πηγές.') : (en ? 'The laws, decisions and standards that apply to the hospital, and how it complies with each requirement.' : 'Οι νόμοι, οι αποφάσεις και τα πρότυπα που αφορούν το νοσοκομείο, και πώς συμμορφώνεται σε κάθε απαίτηση.')} actions={actions}>{ownerRoute && <PlatformLegalTabs active={tab === 'review' ? 'review' : tab === 'sources' ? 'checks' : 'legislation'} counts={{ review: pending.length, checks: failing.length }} />}
    {tabs.length > 1 && !ownerRoute && <CanonicalTabs items={tabs.map(item => ({ ...item, count: item.value === 'review' ? pending.length : item.value === 'sources' ? failing.length : item.value === 'register' ? counts.updates + counts.newTexts : 0 }))} value={tab} onChange={setTab} ariaLabel={en ? 'Legislation' : 'Νομοθεσία'} />}
    <section className="surface registry-workspace workspace-column workspace-fill">
      {tab === 'register' && <RegisterList entries={visible} counts={counts} loading={register.loading} filters={filters} setFilters={setFilters} language={language} onOpen={entry => navigate(`/legislation/${entry.text.id}`)} />}
      {tab === 'library' && access.isPlatformOwner && <LibraryList library={library} language={language} onOpen={item => navigate(`${base}/library/${item.id}`)} />}
      {tab === 'review' && access.isPlatformOwner && <ReviewList candidates={candidates} texts={library.texts} language={language} onChanged={reloadOwner} base={base} />}
      {tab === 'sources' && access.isPlatformOwner && <SourcesList sources={sources} language={language} onChanged={reloadOwner} />}
    </section>
  </Page>
}

function usePaging<T>(rows: T[], deps: unknown[]) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setPage(1), [...deps, pageSize])
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize)), safePage = Math.min(page, totalPages)
  return { rows: rows.slice((safePage - 1) * pageSize, safePage * pageSize), page: safePage, totalPages, pageSize, setPage, setPageSize }
}

interface RegisterListProps { entries: RegisterEntry[], counts?: Partial<ReturnType<typeof registerCounts>>, loading: boolean, filters: RegisterFilters, setFilters: Dispatch<SetStateAction<RegisterFilters>>, language: string, onOpen: (entry: RegisterEntry) => void }
function RegisterList({ entries, counts = {}, loading, filters, setFilters, language, onOpen }: RegisterListProps) {
  const en = language === 'en'
  const set = (key: string, value: string | null) => setFilters(current => ({ ...current, [key]: value }))
  const paging = usePaging(entries, [filters])
  const advanced = (['topic', 'kind', 'state'] as const).filter(key => filters[key] !== 'all').length + (filters.quick ? 1 : 0)
  return <>
    <FilterBar query={filters.query} onQueryChange={value => set('query', value)} placeholder={en ? 'Search text, reference, issuer…' : 'Αναζήτηση κειμένου, ΦΕΚ, φορέα…'} activeAdvancedCount={advanced} onClear={() => setFilters(NO_FILTERS)}>
      {/* What needs attention (in place of the cards above the list). */}
      <FilterSelect label={en ? 'Needs attention' : 'Χρειάζεται προσοχή'} value={filters.quick || 'all'} onChange={value => set('quick', value === 'all' ? null : value)}><option value="all">{en ? 'All' : 'Όλα'}</option><option value="new">{en ? `New texts to decide on (${counts.newTexts || 0})` : `Νέα κείμενα προς απόφαση (${counts.newTexts || 0})`}</option><option value="nonCompliant">{en ? `With non-compliance (${counts.nonCompliant || 0})` : `Με μη συμμόρφωση (${counts.nonCompliant || 0})`}</option><option value="reviewLate">{en ? `Review overdue (${counts.reviewLate || 0})` : `Εκπρόθεσμη επανεξέταση (${counts.reviewLate || 0})`}</option></FilterSelect>
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

export function ComplianceBar({ summary, language }: { summary: ComplianceSummary, language: string }) {
  const en = language === 'en'
  const width = (value: number) => `${summary.total ? (value / summary.total) * 100 : 0}%`
  return <span className="leg-bar" title={en ? `${summary.compliant} compliant · ${summary.partial} partly · ${summary.non_compliant} not · ${summary.unassessed} not assessed` : `${summary.compliant} συμμορφώνονται · ${summary.partial} μερικώς · ${summary.non_compliant} όχι · ${summary.unassessed} χωρίς αξιολόγηση`}>
    <span className="leg-bar-track"><i className="is-ok" style={{ width: width(summary.compliant) }} /><i className="is-partial" style={{ width: width(summary.partial) }} /><i className="is-non" style={{ width: width(summary.non_compliant) }} /><i className="is-na" style={{ width: width(summary.not_applicable) }} /></span>
    <b>{summary.percent == null ? '—' : `${summary.percent}%`}</b>
  </span>
}

function LibraryList({ library, language, onOpen }: { library: LibraryState, language: string, onOpen: (item: AnyRecord) => void }) {
  const en = language === 'en'
  const [query, setQuery] = useState('')
  const history = useMemo(() => { const map = new Map<string, LegislationVersion[]>(); for (const version of library.versions) { const list = map.get(version.textId) || []; list.push(version); map.set(version.textId, list) } return map }, [library.versions])
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

function ReviewList({ candidates, texts, language, onChanged, base }: { candidates: ItemsState, texts: AnyRecord[], language: string, onChanged: () => void, base: string }) {
  const en = language === 'en'
  const navigate = useNavigate()
  const { notify } = useFeedback()
  const [status, setStatus] = useState('pending')
  const [query, setQuery] = useState('')
  const [linking, setLinking] = useState<{ candidate: AnyRecord, textId: string } | null>(null)
  const needle = query.trim().toLowerCase()
  const rows = candidates.items.filter(item => (status === 'all' || item.status === status) && (!needle || [item.title, item.sourceName, item.excerpt, ...(item.matchedKeywords || [])].join(' ').toLowerCase().includes(needle)))
  const paging = usePaging(rows, [status, query])
  async function dismiss(item: AnyRecord) {
    try { await setCandidate(item.id, { status: 'dismissed' }); onChanged() } catch { notify(en ? 'Could not save.' : 'Δεν αποθηκεύτηκε.', 'error') }
  }
  // The row has no buttons: what can be done with a finding is in its «⋯».
  const candidateMenu = (item: AnyRecord) => [
    ...(item.url ? [{ id: 'open', label: en ? 'Open the source' : 'Άνοιγμα πηγής', icon: ExternalLink, onClick: () => window.open(item.url, '_blank', 'noopener,noreferrer') }] : []),
    ...(item.status === 'pending' ? [
      { id: 'new', label: en ? 'New text' : 'Νέο κείμενο', icon: FilePlus2, onClick: () => navigate(`${base}/library/new`, { state: { candidate: item } }) },
      { id: 'link', label: en ? 'Update of an existing text' : 'Ενημέρωση υπάρχοντος κειμένου', icon: Link2, onClick: () => setLinking({ candidate: item, textId: '' }) },
      { id: 'dismiss', label: en ? 'Dismiss' : 'Απόρριψη', icon: XCircle, tone: 'danger', separatorBefore: true, onClick: () => dismiss(item) },
    ] : []),
  ]
  return <>
    <FilterBar query={query} onQueryChange={setQuery} placeholder={en ? 'Search the findings…' : 'Αναζήτηση ευρημάτων…'} activeAdvancedCount={status !== 'pending' ? 1 : 0} onClear={() => { setQuery(''); setStatus('pending') }}>
      <FilterSelect label={en ? 'Status' : 'Κατάσταση'} value={status} onChange={setStatus}><option value="pending">{en ? 'To review' : 'Προς έλεγχο'}</option><option value="linked">{en ? 'Added' : 'Καταχωρίστηκαν'}</option><option value="dismissed">{en ? 'Dismissed' : 'Απορρίφθηκαν'}</option><option value="all">{en ? 'All' : 'Όλα'}</option></FilterSelect>
    </FilterBar>
    <div className="scroll-table">
      <RegistryTable sortable={false} bare className="quality-table quality-register-table" rows={paging.rows} rowKey={item => item.id} empty={!candidates.loading && !rows.length}
        columns={[{ key: 'found', label: en ? 'Found' : 'Βρέθηκε' }, { key: 'item', label: en ? 'Item' : 'Εύρημα' }, { key: 'keywords', label: en ? 'Matched' : 'Λέξεις' }, { key: 'status', label: en ? 'Status' : 'Κατάσταση' }, { key: 'actions', label: '' }]}
        emptyTitle={status === 'pending' ? (en ? 'Nothing to review' : 'Δεν υπάρχει κάτι προς έλεγχο') : (en ? 'Nothing here' : 'Δεν υπάρχουν εγγραφές')} emptyText={en ? 'New items from the sources appear here.' : 'Τα νέα ευρήματα από τις πηγές εμφανίζονται εδώ.'}
        renderRow={item => <>
          <td className="nowrap-cell">{formatDay(item.detectedAt, language)}<small>{item.sourceName}</small></td>
          <td className="leg-candidate-cell">{item.url ? <a href={item.url} target="_blank" rel="noreferrer">{item.title} <ExternalLink size={12} /></a> : item.title}{item.excerpt && <small>{item.excerpt}</small>}</td>
          <td>{item.matchedKeywords.join(', ')}</td>
          <td><StatusBadge tone={candidateStatusTone(item.status)}>{candidateStatusLabel(item.status, language)}</StatusBadge></td>
          <td className="leg-candidate-menu">{candidateMenu(item).length > 0 && <OverflowMenu label={en ? 'Actions' : 'Ενέργειες'} items={candidateMenu(item)} />}</td>
        </>} />
    </div>
    {rows.length > 0 && <RegistryPagination language={language} page={paging.page} totalPages={paging.totalPages} totalItems={rows.length} pageSize={paging.pageSize} onPageChange={paging.setPage} onPageSizeChange={paging.setPageSize} />}
    {linking && <ObserverDialog title={en ? 'Update of an existing text' : 'Ενημέρωση υπάρχοντος κειμένου'} subtitle={linking.candidate.title} onClose={() => setLinking(null)}
      footer={<DialogActions onCancel={() => setLinking(null)} onSave={() => navigate(`${base}/library/${linking.textId}`, { state: { candidate: linking.candidate } })} saveLabel={en ? 'Open the text' : 'Άνοιγμα κειμένου'} disabled={!linking.textId} />}>
      <SearchableSelect label={en ? 'Text of the library' : 'Κείμενο της βιβλιοθήκης'} value={linking.textId} options={texts.map(item => ({ value: item.id, label: `${item.code} · ${item.title}`, description: item.reference, keywords: `${item.code} ${item.title} ${item.reference}` }))} onChange={value => setLinking(current => ({ ...current, textId: value || '' }) as typeof current)} placeholder={en ? 'Search…' : 'Αναζήτηση…'} emptyLabel={en ? 'No match' : 'Δεν βρέθηκε'} clearLabel={en ? 'Clear' : 'Καθαρισμός'} />
      <p className="leg-note">{en ? 'You change the text there and publish it as a new version; the item is marked as added.' : 'Εκεί αλλάζετε το κείμενο και το δημοσιεύετε ως νέα έκδοση· το εύρημα σημειώνεται ως καταχωρισμένο.'}</p>
    </ObserverDialog>}
  </>
}

function SourcesList({ sources, language, onChanged }: { sources: ItemsState, language: string, onChanged: () => void }) {
  const en = language === 'en'
  const { notify, confirm } = useFeedback()
  const [editing, setEditing] = useState<AnyRecord | null>(null)
  const [busy, setBusy] = useState(false)
  const paging = usePaging(sources.items, [])
  async function save() {
    if (!editing) return
    if (!String(editing.name || '').trim() || !/^https?:\/\//.test(String(editing.url || '').trim())) { notify(en ? 'Give a name and an address starting with https://' : 'Δώστε όνομα και διεύθυνση που αρχίζει από https://', 'error'); return }
    setBusy(true)
    try { await saveSource({ ...editing, keywords: String(editing.keywordsText || '').split(/[,\n]/) }); setEditing(null); onChanged() } catch { notify(en ? 'The source could not be saved.' : 'Η πηγή δεν αποθηκεύτηκε.', 'error') } finally { setBusy(false) }
  }
  async function remove(source: AnyRecord) {
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
      <RegistryTable sortable={false} bare className="quality-table quality-register-table" rows={paging.rows} rowKey={item => item.id} empty={!sources.loading && !sources.items.length}
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
    {sources.items.length > 0 && <RegistryPagination language={language} page={paging.page} totalPages={paging.totalPages} totalItems={sources.items.length} pageSize={paging.pageSize} onPageChange={paging.setPage} onPageSizeChange={paging.setPageSize} />}
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

