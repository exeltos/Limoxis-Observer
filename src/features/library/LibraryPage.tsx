import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { BookOpenCheck, Bookmark, ExternalLink, FileText, Image as ImageIcon, Info, Link as LinkIcon, Link2, Newspaper, Pencil, Plus, Rss, Stethoscope, X } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { IconButton } from '../../design-system/IconButton'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { CanonicalTabs } from '../../design-system/CanonicalTabs'
import { FilterBar, FilterSelect } from '../../design-system/FilterBar'
import { StatusBadge } from '../../design-system/StatusBadge'
import { AutoTranslatedMark } from '../../design-system/AutoTranslatedMark'
import { useAutoTranslated } from '../../core/i18n/autoTranslated'
import { RegistryEmptyState } from '../../design-system/RegistryEmptyState'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { ROLES } from '../../core/permissions/roles'
import { formatDay } from '../../core/i18n/formatDay'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { LINK_GROUPS } from './libraryCatalogue'
import { LIBRARY_TABS, NEWS_FILTERS, NO_GUIDELINE_FILTERS, type GuidelineFilters, bulletLines, canManageHospitalLibrary, clinicalGuides, domainOf, filterGuidelines, filterNews, guidelineOptions, initials, isRecentNews, linkGroups, logoTone, newsBucket, newsCounts, newsDate, sourceState, sourceStateLabel, topicLabel } from './libraryModel'
import { fileUrl, loadLibrary, loadNews, loadSources } from './libraryService'
import { DEMO_LIBRARY_ORG } from './libraryDemoData'
import { LibraryItemDialog } from './LibraryItemDialog'
import './library.css'
import type { LibraryEntry, LibraryItem, LibraryNews, LibrarySource } from './libraryTypes'

const READ_KEY = 'limoxis.library.read'
// Which news the viewer has opened: a per-browser convenience, never shared.
function readSet(): Set<string> { try { return new Set(JSON.parse(window.localStorage.getItem(READ_KEY) || '[]')) } catch { return new Set() } }
function rememberRead(set: Set<string>) { try { window.localStorage.setItem(READ_KEY, JSON.stringify([...set].slice(-500))) } catch { /* storage unavailable: nothing to remember */ } }

const external = { target: '_blank', rel: 'noopener noreferrer' }

// «Βιβλιοθήκη» (Library), for every member of the hospital: trusted links,
// guidelines, one-page clinical guides and news from the sources. The platform's
// content is the same in every hospital; the hospital adds its own.
// The English texts of the page that the system translated (only asked for in English, outside the demo).
const AutoTranslatedContext = createContext<Set<string>>(new Set())

export function LibraryPage() {
  const { language } = useLanguage()
  const en = language === 'en'
  const L = (el: string, english: string) => (en ? english : el)
  const location = useLocation()
  const { tenant, role, actualRole, isRolePreview } = useTenant()
  const organizationId = tenant?.id || (isDemoDataEnvironment() ? DEMO_LIBRARY_ORG : null)
  const canManage = canManageHospitalLibrary(isRolePreview ? role : (actualRole === ROLES.PLATFORM_OWNER ? ROLES.PLATFORM_OWNER : role))
  const requested = new URLSearchParams(location.search).get('tab')
  const [tab, setTab] = useState<string>(requested && LIBRARY_TABS.includes(requested) ? requested : 'links')
  const [state, setState] = useState<{ loading: boolean, items: LibraryItem[], news: LibraryNews[], sources: LibrarySource[] }>({ loading: true, items: [], news: [], sources: [] })
  const [editing, setEditing] = useState<{ item: LibraryEntry | null, kind?: string } | null>(null)
  const autoTranslated = useAutoTranslated('library_items', state.items.filter(item => item.organizationId).map(item => item.id), { enabled: en && !isDemoDataEnvironment() })

  const reload = useCallback(() => {
    Promise.all([loadLibrary(organizationId), loadNews(organizationId).catch(() => []), loadSources().catch(() => [])])
      .then(([items, news, sources]) => setState({ loading: false, items, news, sources }))
      .catch(() => setState({ loading: false, items: [], news: [], sources: [] }))
  }, [organizationId])
  useEffect(() => { reload() }, [reload])

  // Which news the viewer has opened (this browser): the «Νέα» tab counts the unread ones (as the
  // «Μη αναγνωσμένα» filter does), the other tabs no count (a count on a tab means something needs attention).
  const [read, setRead] = useState(readSet)
  const markRead = (item: LibraryNews) => setRead(current => { const next = new Set(current); next.add(item.id); rememberRead(next); return next })
  const unread = newsCounts(state.news, read).unread
  // The sources' check (when each was last read) is the platform owner's concern.
  const showSources = !isRolePreview && actualRole === ROLES.PLATFORM_OWNER
  const tabs = [
    { value: 'links', icon: LinkIcon, label: L('Σύνδεσμοι', 'Links') },
    { value: 'guidelines', icon: BookOpenCheck, label: L('Κατευθυντήριες οδηγίες', 'Guidelines') },
    { value: 'clinical', icon: Stethoscope, label: L('Κλινικοί οδηγοί', 'Clinical guides') },
    { value: 'news', icon: Newspaper, label: L('Νέα', 'News'), count: unread },
  ]
  const addKind = tab === 'guidelines' ? 'guideline' : tab === 'clinical' ? 'clinical_guide' : tab === 'news' ? 'announcement' : 'link'
  const add = () => setEditing({ item: null, kind: addKind })
  const edit = (item: LibraryEntry) => setEditing({ item })
  const actions = canManage ? <Button onClick={add}><Plus size={16} />{L('Προσθήκη', 'Add')}</Button> : null

  // The form of an entry is a page of its own: it takes the place of the lists.
  if (editing) return <LibraryItemDialog scope="hospital" organizationId={organizationId} item={editing.item} kind={editing.kind} language={language} onClose={() => setEditing(null)} onSaved={reload} />

  return <AutoTranslatedContext.Provider value={autoTranslated}><Page fill className="registry-fill-page" title={L('Βιβλιοθήκη', 'Library')} subtitle={L('Αξιόπιστες πηγές για πρόληψη λοιμώξεων, ποιότητα και νοσηλευτική: της πλατφόρμας για όλα τα νοσοκομεία, συν όσα προσθέτει το δικό σας.', 'Trusted sources for infection prevention, quality and nursing: the platform\'s for every hospital, plus whatever your own adds.')} actions={actions}>
    <CanonicalTabs items={tabs} value={tab} onChange={setTab} ariaLabel={L('Βιβλιοθήκη', 'Library')} />
    <section className="surface registry-workspace workspace-fill lib-workspace">
      {tab === 'links' && <LinksTab items={state.items} sources={state.sources} loading={state.loading} language={language} canManage={canManage} onEdit={edit} />}
      {tab === 'guidelines' && <GuidelinesTab items={state.items} loading={state.loading} language={language} canManage={canManage} onAdd={add} onEdit={edit} />}
      {tab === 'clinical' && <ClinicalTab items={state.items} loading={state.loading} language={language} canManage={canManage} onAdd={add} onEdit={edit} />}
      {tab === 'news' && <NewsTab news={state.news} sources={state.sources} showSources={showSources} read={read} onRead={markRead} loading={state.loading} language={language} canManage={canManage} onAdd={add} onEdit={news => setEditing({ item: { ...news, kind: 'announcement', name: news.title, abbreviation: news.sourceAbbreviation } })} />}
    </section>
  </Page></AutoTranslatedContext.Provider>
}

function Logo({ item }: { item: Pick<LibraryItem, 'abbreviation' | 'name' | 'organizationId' | 'group'> }) {
  const text = initials(item)
  return <span className={`lib-logo tone-${logoTone(item)}${text.length > 4 ? ' is-long' : ''}`} aria-hidden="true">{text}</span>
}

interface ChipOption { value: string, label: string, count?: number }
function Chips({ options, value, onChange, label }: { options: ChipOption[], value: string, onChange: (value: string) => void, label: string }) {
  return <div className="lib-chips" role="group" aria-label={label}>{options.map(option => <button key={option.value} type="button" className={`lib-chip${value === option.value ? ' is-active' : ''}`} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}<b>{option.count}</b></button>)}</div>
}

// The links as one list (a line per organisation), under the group headings.
interface TabProps { items: LibraryItem[], loading: boolean, language: string, canManage: boolean, onAdd?: () => void, onEdit: (item: LibraryEntry) => void }

function LinksTab({ items, sources, loading, language, canManage, onEdit }: TabProps & { sources: LibrarySource[] }) {
  const en = language === 'en'
  const L = (el: string, english: string) => (en ? english : el)
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('all')
  const { groups, counts, total } = useMemo(() => linkGroups(items, { query, group, language }), [items, query, group, language])
  const withNews = useMemo(() => new Set(sources.filter(source => source.active && source.itemId).map(source => source.itemId)), [sources])
  const options = [{ value: 'all', label: L('Όλοι', 'All'), count: total }, ...LINK_GROUPS.filter(entry => counts[entry.value]).map(entry => ({ value: entry.value, label: entry[en ? 'en' : 'el'], count: counts[entry.value] }))]
  return <>
    <FilterBar query={query} onQueryChange={setQuery} placeholder={L('Αναζήτηση φορέα, θέματος ή διεύθυνσης…', 'Search organisation, topic or address…')} onClear={() => { setQuery(''); setGroup('all') }} />
    <Chips options={options} value={group} onChange={setGroup} label={L('Ομάδα', 'Group')} />
    {!loading && !groups.length ? <div className="lib-scroll"><RegistryEmptyState filtered={Boolean(query) || group !== 'all'} onClearFilters={() => { setQuery(''); setGroup('all') }} icon={LinkIcon} title={query || group !== 'all' ? undefined : L('Δεν υπάρχουν ακόμη σύνδεσμοι', 'No links yet')} text={query || group !== 'all' ? undefined : L('Οι σύνδεσμοι της πλατφόρμας εμφανίζονται εδώ.', 'The platform\'s links appear here.')} /></div>
      : <div className="scroll-table"><table className="data-table sticky-table lib-links-table">
        <thead><tr><th>{L('Φορέας', 'Organisation')}</th><th>{L('Τι θα βρείτε', 'What you will find')}</th><th>{L('Θέματα', 'Topics')}</th><th aria-label={L('Ενέργειες', 'Actions')} /></tr></thead>
        <tbody>{groups.map(entry => [
          <tr key={`group-${entry.value}`} className="lib-group-row"><th colSpan={4}>{entry[en ? 'en' : 'el']} <b>{entry.items.length}</b></th></tr>,
          ...entry.items.map(item => <LinkRow key={item.id} item={item} language={language} news={withNews.has(item.id)} onEdit={canManage && item.organizationId ? () => onEdit(item) : null} />),
        ])}</tbody>
      </table></div>}
  </>
}

function LinkRow({ item, language, news, onEdit }: { item: LibraryItem, language: string, news: boolean, onEdit: (() => void) | null }) {
  const en = language === 'en'
  const L = (el: string, english: string) => (en ? english : el)
  const description = (en ? item.descriptionEn : item.descriptionEl) || item.descriptionEl || item.descriptionEn
  const note = (en ? item.noteEn : item.noteEl) || item.noteEl
  const auto = useContext(AutoTranslatedContext)
  const open = () => window.open(item.url, '_blank', 'noopener,noreferrer')
  return <tr className={`registry-row-clickable${item.proposed ? ' is-proposed' : ''}${item.group === 'archive' ? ' is-archived' : ''}`} tabIndex={0} onClick={event => { if (!(event.target as Element).closest('a,button')) open() }} onKeyDown={event => { if (event.key === 'Enter' && event.target === event.currentTarget) open() }}>
    <td><div className="lib-link-name"><Logo item={item} /><div><a className="lib-card-title" href={item.url} {...external}>{item.name}</a><span className="lib-domain">{domainOf(item.url as string)}</span></div></div></td>
    <td className="lib-link-about">{description}{en && auto.has(`${item.id}:description_el`) && item.descriptionEn && <AutoTranslatedMark />}{note && <small>{note}</small>}</td>
    <td><div className="lib-tags">
      {(item.tags || []).map((tag: string) => <span key={tag} className="lib-tag">{topicLabel(tag, language)}</span>)}
      {news && <span className="lib-tag is-rss"><Rss size={11} aria-hidden="true" />{L('Νέα', 'News')}</span>}
      {item.proposed && <span className="lib-tag is-proposed">{L('Προτεινόμενο', 'Suggested')}</span>}
      {item.organizationId && <span className="lib-tag is-hospital">{L('Του νοσοκομείου', "Hospital's own")}</span>}
    </div></td>
    <td className="lib-row-menu">{onEdit && <OverflowMenu label={L('Ενέργειες', 'Actions')} items={[{ id: 'edit', label: L('Επεξεργασία', 'Edit'), icon: Pencil, onClick: onEdit }]} />}</td>
  </tr>
}

function GuidelinesTab({ items, loading, language, canManage, onAdd, onEdit }: TabProps) {
  const en = language === 'en'
  const L = (el: string, english: string) => (en ? english : el)
  const [filters, setFilters] = useState<Readonly<GuidelineFilters>>(NO_GUIDELINE_FILTERS)
  const [selectedId, setSelectedId] = useState('')
  const options = useMemo(() => guidelineOptions(items), [items])
  const rows = useMemo(() => filterGuidelines(items, filters, language), [items, filters, language])
  const selected = rows.find(item => item.id === selectedId) || null
  const set = (key: string, value: string) => setFilters(current => ({ ...current, [key]: value }))
  const filtered = filters !== NO_GUIDELINE_FILTERS && JSON.stringify(filters) !== JSON.stringify(NO_GUIDELINE_FILTERS)
  const all = L('Όλα', 'All')
  return <div className={`lib-guides${selected ? '' : ' no-drawer'}`}>
    <div className="lib-guides-main">
      <FilterBar query={filters.query} onQueryChange={value => set('query', value)} placeholder={L('Αναζήτηση τίτλου ή λέξης-κλειδιού…', 'Search title or keyword…')} onClear={filtered ? () => setFilters(NO_GUIDELINE_FILTERS) : undefined} activeAdvancedCount={(['organisation', 'topic', 'year'] as const).filter(key => String(filters[key]) !== 'all').length}>
          <FilterSelect label={L('Φορέας', 'Organisation')} value={filters.organisation} onChange={value => set('organisation', value)}><option value="all">{L('Όλοι', 'All')}</option>{options.organisations.map(value => <option key={value} value={value}>{value}</option>)}</FilterSelect>
          <FilterSelect label={L('Θέμα', 'Topic')} value={filters.topic} onChange={value => set('topic', value)}><option value="all">{all}</option>{options.topics.map(value => <option key={value} value={value}>{topicLabel(value, language)}</option>)}</FilterSelect>
          <FilterSelect label={L('Έτος', 'Year')} value={String(filters.year)} onChange={value => set('year', value)}><option value="all">{all}</option>{options.years.map(value => <option key={value} value={String(value)}>{value}</option>)}</FilterSelect>
      </FilterBar>
      {!loading && !rows.length ? <div className="lib-scroll"><RegistryEmptyState filtered={filtered} onClearFilters={() => setFilters(NO_GUIDELINE_FILTERS)} icon={BookOpenCheck} title={filtered ? undefined : L('Δεν υπάρχουν ακόμη κατευθυντήριες οδηγίες', 'No guidelines yet')} text={filtered ? undefined : L('Οι οδηγίες που προσθέτει η πλατφόρμα ή το νοσοκομείο εμφανίζονται εδώ, με σύνδεσμο στη σελίδα του φορέα.', 'Guidelines added by the platform or the hospital appear here, linked to the publisher\'s page.')} action={canManage ? { label: L('Προσθήκη οδηγίας', 'Add a guideline'), icon: Plus, onClick: onAdd } : null} /></div>
        : <div className="scroll-table"><table className="data-table sticky-table">
          <thead><tr><th>{L('Τίτλος', 'Title')}</th><th>{L('Φορέας', 'Organisation')}</th><th>{L('Θέμα', 'Topic')}</th><th>{L('Έτος', 'Year')}</th></tr></thead>
          <tbody>{rows.map(item => <tr key={item.id} tabIndex={0} className={`registry-row-clickable lib-guide-row${item.id === selectedId ? ' is-selected' : ''}`} aria-selected={item.id === selectedId} onClick={() => setSelectedId(item.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedId(item.id) } }}>
            <td><strong>{item.name}</strong><small>{item.language === 'el' ? L('Ελληνικά', 'Greek') : item.language === 'en' ? L('Αγγλικά', 'English') : L('Άλλη γλώσσα', 'Other language')} · {item.filePath ? L('αρχείο + σελίδα', 'file + page') : L('σελίδα φορέα', "publisher's page")}{item.organizationId ? ` · ${L('Του νοσοκομείου', "Hospital's own")}` : ''}</small></td>
            <td>{item.organisation || '—'}</td>
            <td>{(item.tags || []).slice(0, 1).map((tag: string) => <span key={tag} className="lib-tag">{topicLabel(tag, language)}</span>)}</td>
            <td>{item.year || '—'}</td>
          </tr>)}</tbody>
        </table></div>}
    </div>
    {selected && <GuidelineDrawer item={selected} language={language} onClose={() => setSelectedId('')} onEdit={canManage && selected.organizationId ? () => onEdit(selected) : null} />}
  </div>
}

function GuidelineDrawer({ item, language, onClose, onEdit }: { item: LibraryItem, language: string, onClose: () => void, onEdit: (() => void) | null }) {
  const en = language === 'en'
  const L = (el: string, english: string) => (en ? english : el)
  const { notifyError } = useFeedback()
  const points = bulletLines((en ? item.summaryEn : item.summaryEl) || item.summaryEl)
  const link = (en ? item.limoxisEn : item.limoxisEl) || item.limoxisEl
  const description = (en ? item.descriptionEn : item.descriptionEl) || item.descriptionEl
  const auto = useContext(AutoTranslatedContext)
  const [saved, setSaved] = useState(() => readSaved().has(item.id))
  useEffect(() => { setSaved(readSaved().has(item.id)) }, [item.id])
  const toggleSaved = () => { const set = readSaved(); if (set.has(item.id)) set.delete(item.id); else set.add(item.id); writeSaved(set); setSaved(set.has(item.id)) }
  const openFile = async () => { try { const url = await fileUrl(item); if (url) window.open(url, '_blank', 'noopener,noreferrer') } catch (error) { notifyError(error, 'load', { operation: 'library_file' }) } }
  return <aside className="lib-drawer" aria-label={item.name}>
    <div className="lib-drawer-head">
      <div><span className="lib-eyebrow">{[L('Κατευθυντήρια οδηγία', 'Guideline'), item.organisation, item.year].filter(Boolean).join(' · ')}</span><h2>{item.name}</h2></div>
      <IconButton label={L('Κλείσιμο', 'Close')} onClick={onClose}><X size={17} /></IconButton>
    </div>
    <div className="lib-row">{item.status === 'published' && <StatusBadge tone="success">{L('Ισχύει', 'Current')}</StatusBadge>}{(item.tags || []).map((tag: string) => <span key={tag} className="lib-tag">{topicLabel(tag, language)}</span>)}{item.organizationId && <span className="lib-tag is-hospital">{L('Του νοσοκομείου', "Hospital's own")}</span>}</div>
    <dl>
      <dt>{L('Φορέας', 'Organisation')}</dt><dd>{item.organisation || '—'}</dd>
      {item.year && <><dt>{L('Έτος', 'Year')}</dt><dd>{item.year}</dd></>}
      <dt>{L('Γλώσσα', 'Language')}</dt><dd>{item.language === 'el' ? L('Ελληνικά', 'Greek') : item.language === 'en' ? L('Αγγλικά', 'English') : L('Άλλη', 'Other')}</dd>
      <dt>{L('Προστέθηκε', 'Added by')}</dt><dd>{item.organizationId ? L('Το νοσοκομείο', 'The hospital') : 'Platform Owner'}{item.updatedAt ? ` · ${formatDay(item.updatedAt, language)}` : ''}</dd>
    </dl>
    {description && <p className="leg-note">{description}{en && auto.has(`${item.id}:description_el`) && item.descriptionEn && <AutoTranslatedMark />}</p>}
    {points.length > 0 && <div><span className="lib-eyebrow">{L('Τι λέει, σύντομα', 'In short')}</span><ul>{points.map(point => <li key={point}>{point}</li>)}</ul>{en && auto.has(`${item.id}:summary_el`) && item.summaryEn && <AutoTranslatedMark />}</div>}
    {link && <div className="lib-callout"><Link2 size={16} aria-hidden="true" /><div><strong>{L('Στο Limoxis', 'In Limoxis')}</strong><br />{link}</div></div>}
    <div className="lib-row">
      {item.url && <a className="button button-primary" href={item.url} {...external}><ExternalLink size={16} />{L('Άνοιγμα πηγής', 'Open source')}</a>}
      {item.filePath && <Button variant="secondary" onClick={openFile}><FileText size={16} />{L('Αρχείο', 'File')}</Button>}
      <Button variant="secondary" aria-pressed={saved} onClick={toggleSaved}><Bookmark size={16} />{saved ? L('Αποθηκευμένο', 'Saved') : L('Αποθήκευση', 'Save')}</Button>
      {onEdit && <IconButton label={L('Επεξεργασία', 'Edit')} onClick={onEdit}><Pencil size={15} /></IconButton>}
    </div>
  </aside>
}

// «Αποθήκευση» in the drawer: the viewer's own bookmarks, kept in this browser.
const SAVED_KEY = 'limoxis.library.saved'
function readSaved(): Set<string> { try { return new Set(JSON.parse(window.localStorage.getItem(SAVED_KEY) || '[]')) } catch { return new Set() } }
function writeSaved(set: Set<string>) { try { window.localStorage.setItem(SAVED_KEY, JSON.stringify([...set].slice(-300))) } catch { /* storage unavailable */ } }

function ClinicalTab({ items, loading, language, canManage, onAdd, onEdit }: TabProps) {
  const en = language === 'en'
  const L = (el: string, english: string) => (en ? english : el)
  const { notifyError } = useFeedback()
  const [query, setQuery] = useState('')
  const rows = useMemo(() => clinicalGuides(items, query, language), [items, query, language])
  const open = async (item: LibraryItem) => { try { const url = await fileUrl(item); if (url) window.open(url, '_blank', 'noopener,noreferrer') } catch (error) { notifyError(error, 'load', { operation: 'library_file' }) } }
  return <>
    <FilterBar query={query} onQueryChange={setQuery} placeholder={L('Αναζήτηση οδηγού…', 'Search guides…')} onClear={query ? () => setQuery('') : undefined} />
    <div className="scroll-table">
      {!loading && !rows.length && <RegistryEmptyState filtered={Boolean(query)} onClearFilters={() => setQuery('')} icon={Stethoscope} title={query ? undefined : L('Δεν υπάρχουν ακόμη κλινικοί οδηγοί', 'No clinical guides yet')} text={query ? undefined : L('Οδηγοί μίας σελίδας (π.χ. infographic για τη σήψη) ως εικόνα, PDF ή σύνδεσμος, με την πηγή και την ημερομηνία τους.', 'One-page guides (e.g. a sepsis infographic) as an image, PDF or link, with their source and date.')} action={canManage ? { label: L('Προσθήκη οδηγού', 'Add a guide'), icon: Plus, onClick: onAdd } : null} />}
      {rows.length > 0 && <table className="data-table sticky-table lib-clinical-table">
        <thead><tr><th>{L('Οδηγός', 'Guide')}</th><th>{L('Φορέας', 'Organisation')}</th><th>{L('Θέμα', 'Topic')}</th><th>{L('Ημερομηνία', 'Date')}</th><th aria-label={L('Ενέργειες', 'Actions')} /></tr></thead>
        <tbody>{rows.map(item => <tr key={item.id} className="registry-row-clickable" tabIndex={0} onClick={event => { if (!(event.target as Element).closest('button')) open(item) }} onKeyDown={event => { if (event.key === 'Enter' && event.target === event.currentTarget) open(item) }}>
          <td><div className="lib-link-name"><span className="lib-logo" aria-hidden="true">{/^image\//.test(item.fileType || '') ? <ImageIcon size={16} /> : <FileText size={16} />}</span><div><strong>{item.name}</strong>{((en ? item.descriptionEn : item.descriptionEl) || item.descriptionEl) && <small>{(en ? item.descriptionEn : item.descriptionEl) || item.descriptionEl}</small>}</div></div></td>
          <td>{item.organisation || '—'}</td>
          <td><div className="lib-tags">{(item.tags || []).map((tag: string) => <span key={tag} className="lib-tag">{topicLabel(tag, language)}</span>)}{item.organizationId && <span className="lib-tag is-hospital">{L('Του νοσοκομείου', "Hospital's own")}</span>}</div></td>
          <td className="nowrap-cell">{[item.year, item.updatedAt ? formatDay(item.updatedAt, language) : ''].filter(Boolean).join(' · ') || '—'}</td>
          <td className="lib-row-menu"><OverflowMenu label={L('Ενέργειες', 'Actions')} items={[{ id: 'open', label: L('Άνοιγμα', 'Open'), icon: ExternalLink, onClick: () => open(item) }, ...(canManage && item.organizationId ? [{ id: 'edit', label: L('Επεξεργασία', 'Edit'), icon: Pencil, onClick: () => onEdit(item) }] : [])]} /></td>
        </tr>)}</tbody>
      </table>}
    </div>
  </>
}

interface NewsTabProps { news: LibraryNews[], sources: LibrarySource[], showSources: boolean, read: Set<string>, onRead: (item: LibraryNews) => void, loading: boolean, language: string, canManage: boolean, onAdd: () => void, onEdit: (item: LibraryEntry) => void }

function NewsTab({ news, sources, showSources, read, onRead, loading, language, canManage, onAdd, onEdit }: NewsTabProps) {
  const en = language === 'en'
  const L = (el: string, english: string) => (en ? english : el)
  const [filter, setFilter] = useState('all')
  const counts = newsCounts(news, read)
  const rows = filterNews(news, filter, read)
  const labels: Record<string, string> = { all: L('Όλα', 'All'), greek: L('Ελληνικοί φορείς', 'Greek bodies'), international: 'WHO / ECDC / CDC', hospital: L('Του νοσοκομείου', "Hospital's own"), unread: L('Μη αναγνωσμένα', 'Unread') }
  const options = NEWS_FILTERS.filter(value => value === 'all' || counts[value]).map(value => ({ value, label: labels[value], count: counts[value] }))
  const markRead = onRead
  const activeSources = sources.filter(source => source.active)
  return <div className={`lib-news${showSources ? '' : ' is-wide'}`}>
    <div className="lib-group">
      <Chips options={options} value={filter} onChange={setFilter} label={L('Φίλτρο', 'Filter')} />
      {!loading && !rows.length ? <RegistryEmptyState filtered={filter !== 'all'} onClearFilters={() => setFilter('all')} icon={Newspaper} title={filter !== 'all' ? undefined : L('Δεν υπάρχουν ακόμη νέα', 'No news yet')} text={filter !== 'all' ? undefined : L('Τα νέα των φορέων εμφανίζονται εδώ μόλις ελεγχθούν οι πηγές· τα νέα του νοσοκομείου τα προσθέτει ο Διαχειριστής ή ο Υπεύθυνος Ποιότητας.', 'News from the sources appears here once they are checked; the hospital\'s own news is added by its Administrator or Quality Manager.')} action={canManage ? { label: L('Νέα ανακοίνωση', 'New announcement'), icon: Plus, onClick: onAdd } : null} />
        : <div className="lib-news-list">{rows.map(item => {
          const unread = !read.has(item.id) && isRecentNews(item)
          const source = item.organizationId ? L('Του νοσοκομείου', "Hospital's own") : `${item.sourceName || item.sourceAbbreviation}`
          const logo = { abbreviation: item.sourceAbbreviation || (item.organizationId ? '' : '?'), name: item.sourceName || item.title, organizationId: item.organizationId, group: newsBucket(item) === 'greek' ? 'greek' : 'international' }
          return <article key={item.id} className={`lib-news-item${unread ? ' is-unread' : ''}`}>
            <Logo item={logo} />
            <div>
              {item.url ? <a className="lib-news-title" href={item.url} {...external} onClick={() => markRead(item)}>{item.title}</a> : <strong>{item.title}</strong>}
              {item.excerpt && <p>{item.excerpt}</p>}
              <div className="lib-tags"><span className={`lib-tag${item.organizationId ? ' is-hospital' : ' is-rss'}`}>{!item.organizationId && <Rss size={11} aria-hidden="true" />}{item.organizationId ? source : `${L('Πηγή', 'Source')}: ${source}`}</span>{unread && <StatusBadge tone="info">{L('Νέο', 'New')}</StatusBadge>}</div>
            </div>
            <div className="lib-news-side">
              <time dateTime={newsDate(item)}>{formatDay(newsDate(item), language)}</time>
              {item.url && <a href={item.url} {...external} onClick={() => markRead(item)} aria-label={L(`Άνοιγμα: ${item.title}`, `Open: ${item.title}`)} className="lo-icon-button lo-icon-button-neutral lo-icon-button-sm"><ExternalLink size={15} /></a>}
              {canManage && item.organizationId && <OverflowMenu label={L('Ενέργειες', 'Actions')} items={[{ id: 'edit', label: L('Επεξεργασία', 'Edit'), icon: Pencil, onClick: () => onEdit(item) }]} />}
            </div>
          </article>
        })}</div>}
    </div>
    {showSources && <aside className="lib-group">
      <div className="lib-panel">
        <div className="lib-row"><strong>{L('Αυτόματη ενημέρωση', 'Automatic updates')}</strong><span className="lib-tag is-rss"><Rss size={11} aria-hidden="true" />{L('RSS & σελίδες', 'RSS & pages')}</span></div>
        <p>{L('Οι πηγές ελέγχονται αυτόματα κάθε 2 ώρες (σελίδες χωρίς RSS: κάθε 6 ώρες ή μία φορά τη μέρα). Εμφανίζεται τίτλος, ημερομηνία και σύνδεσμος· το κείμενο μένει στην πηγή.', 'The sources are checked automatically every 2 hours (pages without RSS: every 6 hours or once a day). Title, date and link are shown; the text stays at the source.')}</p>
        {activeSources.length > 0 ? <div className="lib-feeds">{activeSources.map(source => { const state = sourceState(source); return <div key={source.id}><span><i className={`lib-dot is-${state}`} aria-hidden="true" />{source.name}</span><span>{sourceStateLabel(source, language)}</span></div> })}</div>
          : <p>{L('Δεν έχουν οριστεί πηγές.', 'No sources have been set.')}</p>}
      </div>
      <div className="lib-callout"><Info size={16} aria-hidden="true" /><div>{L('Τα νέα δεν αλλάζουν τίποτα στο Limoxis. Αν μια ανακοίνωση αφορά οδηγία, ο Ιδιοκτήτης πλατφόρμας την προσθέτει στις «Κατευθυντήριες οδηγίες».', 'News changes nothing in Limoxis. If an announcement concerns a guideline, the Platform Owner adds it to «Guidelines».')}</div></div>
    </aside>}
  </div>
}

