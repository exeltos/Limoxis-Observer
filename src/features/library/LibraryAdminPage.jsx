import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { FilterBar } from '../../design-system/FilterBar'
import { StatusBadge } from '../../design-system/StatusBadge'
import { RegistryEmptyState } from '../../design-system/RegistryEmptyState'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { formatDay } from '../../core/i18n/formatDay'
import { groupLabel, intervalLabel, kindLabel, matchesQuery, sourceState, sourceStateLabel } from './libraryModel'
import { loadLibrary, loadSources } from './libraryService'
import { LibraryItemDialog } from './LibraryItemDialog'
import './library.css'

const FILTERS = ['all', 'link', 'guideline', 'clinical_guide', 'news_source', 'archived']

// «Διαχείριση βιβλιοθήκης» (Platform Owner): the platform's Library content
// every hospital reads, and the news sources the automatic check reads.
export function LibraryAdminPage() {
  const { language } = useLanguage()
  const en = language === 'en'
  const L = (el, english) => (en ? english : el)
  const [state, setState] = useState({ loading: true, items: [], sources: [] })
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const reload = useCallback(() => {
    Promise.all([loadLibrary(null, { all: true, platformOnly: true }), loadSources().catch(() => [])])
      .then(([items, sources]) => setState({ loading: false, items, sources }))
      .catch(() => setState({ loading: false, items: [], sources: [] }))
  }, [])
  useEffect(() => { reload() }, [reload])

  const sourceRows = useMemo(() => state.sources.map(source => ({ ...source, kind: 'news_source', sourceKind: source.kind, rowId: `source:${source.id}` })), [state.sources])
  const all = useMemo(() => [...state.items.map(item => ({ ...item, rowId: item.id })), ...sourceRows], [state.items, sourceRows])
  const counts = Object.fromEntries(FILTERS.map(value => [value, all.filter(row => matchesFilter(row, value)).length]))
  const rows = all.filter(row => matchesFilter(row, filter) && matchesQuery(row, query, language))
  useEffect(() => { setPage(1) }, [filter, query, pageSize])
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize)), safePage = Math.min(page, totalPages)
  const visible = rows.slice((safePage - 1) * pageSize, safePage * pageSize)
  const labels = { all: L('Όλα', 'All'), link: L('Σύνδεσμοι', 'Links'), guideline: L('Οδηγίες', 'Guidelines'), clinical_guide: L('Κλινικοί οδηγοί', 'Clinical guides'), news_source: L('Πηγές νέων', 'News sources'), archived: L('Αποσυρμένα', 'Withdrawn') }
  const sourceFor = item => state.sources.find(source => source.itemId === item.id) || null
  const open = row => setEditing(row.kind === 'news_source' ? { item: row } : { item: row, source: sourceFor(row) })

  return <Page fill className="registry-fill-page" title={L('Διαχείριση βιβλιοθήκης', 'Library management')} subtitle={L('Το περιεχόμενο της «Βιβλιοθήκης» σε επίπεδο πλατφόρμας. Τα νοσοκομεία βλέπουν ό,τι δημοσιεύετε και προσθέτουν δικά τους.', 'The Library content at platform level. Hospitals see what you publish and add their own.')}
    actions={<Button onClick={() => setEditing({ item: null, kind: filter === 'guideline' || filter === 'clinical_guide' || filter === 'news_source' ? filter : 'link' })}><Plus size={16} />{L('Νέα εγγραφή', 'New entry')}</Button>}>
    <section className="surface registry-workspace workspace-fill lib-workspace">
      <div className="lib-admin-toolbar">
        <FilterBar query={query} onQueryChange={setQuery} placeholder={L('Αναζήτηση εγγραφής…', 'Search entries…')} onClear={query ? () => setQuery('') : undefined} />
        <div className="lib-chips" role="group" aria-label={L('Τύπος', 'Type')}>{FILTERS.map(value => <button key={value} type="button" className={`lib-chip${filter === value ? ' is-active' : ''}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>{labels[value]}<b>{counts[value]}</b></button>)}</div>
      </div>
      {!state.loading && !rows.length ? <RegistryEmptyState filtered={Boolean(query) || filter !== 'all'} onClearFilters={() => { setQuery(''); setFilter('all') }} title={query || filter !== 'all' ? undefined : L('Η βιβλιοθήκη είναι άδεια', 'The library is empty')} text={query || filter !== 'all' ? undefined : L('Προσθέστε συνδέσμους, οδηγίες, κλινικούς οδηγούς και πηγές νέων.', 'Add links, guidelines, clinical guides and news sources.')} action={{ label: L('Νέα εγγραφή', 'New entry'), icon: Plus, onClick: () => setEditing({ item: null, kind: 'link' }) }} />
        : <><div className="scroll-table"><table className="data-table sticky-table">
          <thead><tr><th>{L('Εγγραφή', 'Entry')}</th><th>{L('Τύπος', 'Type')}</th><th>{L('Νοσοκομεία', 'Hospitals')}</th><th>{L('Κατάσταση', 'State')}</th><th>{L('Ενημέρωση', 'Updated')}</th></tr></thead>
          <tbody>{visible.map(row => <tr key={row.rowId} tabIndex={0} className="registry-row-clickable" onClick={() => open(row)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(row) } }}>
            <td className="lib-admin-cell"><strong>{row.name}</strong><small>{[row.abbreviation, row.kind === 'link' ? groupLabel(row.group, language) : row.organisation, row.kind === 'news_source' ? row.url : ''].filter(Boolean).join(' · ')}</small></td>
            <td>{kindLabel(row.kind, language)}{row.kind === 'link' && sourceFor(row)?.active && ` + ${L('Νέα', 'News')}`}{row.kind === 'news_source' && <small className="lib-admin-cell">{(row.sourceKind === 'page' ? L('Σελίδα', 'Page') : 'RSS') + ' · ' + intervalLabel(row.intervalHours, language)}</small>}</td>
            <td>{L('Όλα', 'All')}</td>
            <td><RowState row={row} language={language} /></td>
            <td className="nowrap-cell">{formatDay(row.kind === 'news_source' ? row.lastCheckedAt : row.updatedAt, language)}</td>
          </tr>)}</tbody>
        </table></div>
        <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={rows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} /></>}
    </section>
    {editing && <LibraryItemDialog scope="platform" item={editing.item} kind={editing.kind} source={editing.source} language={language} onClose={() => setEditing(null)} onSaved={reload} />}
  </Page>
}

function matchesFilter(row, filter) {
  if (filter === 'archived') return row.status === 'archived'
  if (row.status === 'archived') return false
  return filter === 'all' || row.kind === filter
}

function RowState({ row, language }) {
  const en = language === 'en'
  const L = (el, english) => (en ? english : el)
  if (row.kind === 'news_source') {
    const state = sourceState(row)
    const tone = state === 'ok' ? 'success' : state === 'failing' ? 'warning' : 'neutral'
    return <><StatusBadge tone={tone}>{state === 'ok' ? L('Απαντά', 'Answering') : state === 'failing' ? L('Δεν απαντά', 'Not answering') : state === 'off' ? L('Ανενεργή', 'Off') : L('Μη επαληθευμένο', 'Unverified')}</StatusBadge><small className="lib-admin-cell">{sourceStateLabel(row, language)}</small></>
  }
  if (row.status === 'archived') return <StatusBadge tone="neutral">{L('Αποσυρμένο', 'Withdrawn')}</StatusBadge>
  if (row.group === 'archive') return <StatusBadge tone="warning">{L('Έλεγχος διεύθυνσης', 'Check address')}</StatusBadge>
  if (row.proposed) return <StatusBadge tone="info">{L('Προτεινόμενο', 'Suggested')}</StatusBadge>
  return <StatusBadge tone="success">{L('Δημοσιευμένο', 'Published')}</StatusBadge>
}
