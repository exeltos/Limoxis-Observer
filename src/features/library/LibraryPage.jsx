import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { BookOpenCheck, Bookmark, ExternalLink, FileText, Image as ImageIcon, Info, Link as LinkIcon, Link2, Newspaper, Pencil, Plus, Rss, Stethoscope, X } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { IconButton } from '../../design-system/IconButton'
import { CanonicalTabs } from '../../design-system/CanonicalTabs'
import { FilterBar, FilterSelect } from '../../design-system/FilterBar'
import { StatusBadge } from '../../design-system/StatusBadge'
import { RegistryEmptyState } from '../../design-system/RegistryEmptyState'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { ROLES } from '../../core/permissions/roles'
import { formatDay } from '../../core/i18n/formatDay'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { LINK_GROUPS } from './libraryCatalogue'
import { LIBRARY_TABS, NEWS_FILTERS, NO_GUIDELINE_FILTERS, bulletLines, canManageHospitalLibrary, clinicalGuides, domainOf, filterGuidelines, filterNews, guidelineOptions, initials, isRecentNews, linkGroups, logoTone, newsBucket, newsCounts, newsDate, sourceState, sourceStateLabel, topicLabel } from './libraryModel'
import { fileUrl, loadLibrary, loadNews, loadSources } from './libraryService'
import { DEMO_LIBRARY_ORG } from './libraryDemoData'
import { LibraryItemDialog } from './LibraryItemDialog'
import './library.css'

const READ_KEY = 'limoxis.library.read'
// Which news the viewer has opened: a per-browser convenience, never shared.
function readSet() { try { return new Set(JSON.parse(window.localStorage.getItem(READ_KEY) || '[]')) } catch { return new Set() } }
function rememberRead(set) { try { window.localStorage.setItem(READ_KEY, JSON.stringify([...set].slice(-500))) } catch { /* storage unavailable: nothing to remember */ } }

const external = { target: '_blank', rel: 'noopener noreferrer' }

// «Βιβλιοθήκη» (Library), for every member of the hospital: trusted links,
// guidelines, one-page clinical guides and news from the sources. The platform's
// content is the same in every hospital; the hospital adds its own.
export function LibraryPage() {
  const { language } = useLanguage()
  const en = language === 'en'
  const L = (el, english) => (en ? english : el)
  const location = useLocation()
  const { tenant, role, actualRole, isRolePreview } = useTenant()
  const organizationId = tenant?.id || (isDemoDataEnvironment() ? DEMO_LIBRARY_ORG : null)
  const canManage = canManageHospitalLibrary(isRolePreview ? role : (actualRole === ROLES.PLATFORM_OWNER ? ROLES.PLATFORM_OWNER : role))
  const requested = new URLSearchParams(location.search).get('tab')
  const [tab, setTab] = useState(LIBRARY_TABS.includes(requested) ? requested : 'links')
  const [state, setState] = useState({ loading: true, items: [], news: [], sources: [] })
  const [editing, setEditing] = useState(null)

  const reload = useCallback(() => {
    Promise.all([loadLibrary(organizationId), loadNews(organizationId).catch(() => []), loadSources().catch(() => [])])
      .then(([items, news, sources]) => setState({ loading: false, items, news, sources }))
      .catch(() => setState({ loading: false, items: [], news: [], sources: [] }))
  }, [organizationId])
  useEffect(() => { reload() }, [reload])

  const counts = {
    links: state.items.filter(item => item.kind === 'link').length,
    guidelines: state.items.filter(item => item.kind === 'guideline').length,
    clinical: state.items.filter(item => item.kind === 'clinical_guide').length,
    news: state.news.length,
  }
  const tabs = [
    { value: 'links', icon: LinkIcon, label: L('Σύνδεσμοι', 'Links'), count: counts.links },
    { value: 'guidelines', icon: BookOpenCheck, label: L('Κατευθυντήριες οδηγίες', 'Guidelines'), count: counts.guidelines },
    { value: 'clinical', icon: Stethoscope, label: L('Κλινικοί οδηγοί', 'Clinical guides'), count: counts.clinical },
    { value: 'news', icon: Newspaper, label: L('Νέα', 'News'), count: counts.news },
  ]
  const addKind = tab === 'guidelines' ? 'guideline' : tab === 'clinical' ? 'clinical_guide' : tab === 'news' ? 'announcement' : 'link'
  const add = () => setEditing({ item: null, kind: addKind })
  const edit = item => setEditing({ item })
  const actions = canManage ? <Button variant="secondary" onClick={add}><Plus size={16} />{L('Προσθήκη του νοσοκομείου', 'Add for the hospital')}</Button> : null

  return <Page fill className="registry-fill-page" title={L('Βιβλιοθήκη', 'Library')} subtitle={L('Αξιόπιστες πηγές για πρόληψη λοιμώξεων, ποιότητα και νοσηλευτική: της πλατφόρμας για όλα τα νοσοκομεία, συν όσα προσθέτει το δικό σας.', 'Trusted sources for infection prevention, quality and nursing: the platform\'s for every hospital, plus whatever your own adds.')} actions={actions}>
    <CanonicalTabs items={tabs} value={tab} onChange={setTab} ariaLabel={L('Βιβλιοθήκη', 'Library')} />
    <section className="surface registry-workspace workspace-fill lib-workspace">
      {tab === 'links' && <LinksTab items={state.items} sources={state.sources} loading={state.loading} language={language} canManage={canManage} onEdit={edit} />}
      {tab === 'guidelines' && <GuidelinesTab items={state.items} loading={state.loading} language={language} canManage={canManage} onAdd={add} onEdit={edit} />}
      {tab === 'clinical' && <ClinicalTab items={state.items} loading={state.loading} language={language} canManage={canManage} onAdd={add} onEdit={edit} />}
      {tab === 'news' && <NewsTab news={state.news} sources={state.sources} loading={state.loading} language={language} canManage={canManage} onAdd={add} onEdit={news => setEditing({ item: { ...news, kind: 'announcement', name: news.title, abbreviation: news.sourceAbbreviation } })} />}
    </section>
    {editing && <LibraryItemDialog scope="hospital" organizationId={organizationId} item={editing.item} kind={editing.kind} language={language} onClose={() => setEditing(null)} onSaved={reload} />}
  </Page>
}

function Logo({ item }) {
  const text = initials(item)
  return <span className={`lib-logo tone-${logoTone(item)}${text.length > 4 ? ' is-long' : ''}`} aria-hidden="true">{text}</span>
}

function Chips({ options, value, onChange, label }) {
  return <div className="lib-chips" role="group" aria-label={label}>{options.map(option => <button key={option.value} type="button" className={`lib-chip${value === option.value ? ' is-active' : ''}`} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}<b>{option.count}</b></button>)}</div>
}

function LinksTab({ items, sources, loading, language, canManage, onEdit }) {
  const en = language === 'en'
  const L = (el, english) => (en ? english : el)
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('all')
  const { groups, counts, total } = useMemo(() => linkGroups(items, { query, group, language }), [items, query, group, language])
  const withNews = useMemo(() => new Set(sources.filter(source => source.active && source.itemId).map(source => source.itemId)), [sources])
  const options = [{ value: 'all', label: L('Όλοι', 'All'), count: total }, ...LINK_GROUPS.filter(entry => counts[entry.value]).map(entry => ({ value: entry.value, label: entry[en ? 'en' : 'el'], count: counts[entry.value] }))]
  return <>
    <FilterBar query={query} onQueryChange={setQuery} placeholder={L('Αναζήτηση φορέα, θέματος ή διεύθυνσης…', 'Search organisation, topic or address…')} onClear={() => { setQuery(''); setGroup('all') }} />
    <Chips options={options} value={group} onChange={setGroup} label={L('Ομάδα', 'Group')} />
    <div className="lib-scroll">
      {!loading && !groups.length && <RegistryEmptyState filtered={Boolean(query) || group !== 'all'} onClearFilters={() => { setQuery(''); setGroup('all') }} icon={LinkIcon} title={query || group !== 'all' ? undefined : L('Δεν υπάρχουν ακόμη σύνδεσμοι', 'No links yet')} text={query || group !== 'all' ? undefined : L('Οι σύνδεσμοι της πλατφόρμας εμφανίζονται εδώ.', 'The platform\'s links appear here.')} />}
      {groups.map(entry => <section key={entry.value} className="lib-group" aria-label={entry[en ? 'en' : 'el']}>
        <h3>{entry[en ? 'en' : 'el']} <b>{entry.items.length}</b></h3>
        <div className="lib-cards">{entry.items.map(item => <LinkCard key={item.id} item={item} language={language} news={withNews.has(item.id)} onEdit={canManage && item.organizationId ? () => onEdit(item) : null} />)}</div>
      </section>)}
    </div>
  </>
}

function LinkCard({ item, language, news, onEdit }) {
  const en = language === 'en'
  const L = (el, english) => (en ? english : el)
  const description = (en ? item.descriptionEn : item.descriptionEl) || item.descriptionEl || item.descriptionEn
  const note = (en ? item.noteEn : item.noteEl) || item.noteEl
  return <article className={`lib-card${item.proposed ? ' is-proposed' : ''}${item.group === 'archive' ? ' is-archived' : ''}`}>
    <Logo item={item} />
    <div>
      <a className="lib-card-title" href={item.url} {...external}>{item.name}</a>
      <span className="lib-domain">{domainOf(item.url)}</span>
      {description && <p>{description}</p>}
      {note && <p className="lib-note">{note}</p>}
      <div className="lib-tags">
        {(item.tags || []).map(tag => <span key={tag} className="lib-tag">{topicLabel(tag, language)}</span>)}
        {news && <span className="lib-tag is-rss"><Rss size={11} aria-hidden="true" />{L('Νέα', 'News')}</span>}
        {item.proposed && <span className="lib-tag is-proposed">{L('Προτεινόμενο', 'Suggested')}</span>}
        {item.organizationId && <span className="lib-tag is-hospital">{L('Του νοσοκομείου', "Hospital's own")}</span>}
        {item.group === 'archive' && <span className="lib-tag">{L('Αρχείο', 'Archive')}</span>}
      </div>
    </div>
    <div className="lib-card-actions">
      <a href={item.url} {...external} aria-label={L(`Άνοιγμα: ${item.name}`, `Open: ${item.name}`)} title={L('Άνοιγμα σε νέα καρτέλα', 'Open in a new tab')}><ExternalLink size={16} /></a>
      {onEdit && <IconButton size="sm" label={L('Επεξεργασία', 'Edit')} onClick={onEdit}><Pencil size={14} /></IconButton>}
    </div>
  </article>
}

function GuidelinesTab({ items, loading, language, canManage, onAdd, onEdit }) {
  const en = language === 'en'
  const L = (el, english) => (en ? english : el)
  const [filters, setFilters] = useState(NO_GUIDELINE_FILTERS)
  const [selectedId, setSelectedId] = useState('')
  const options = useMemo(() => guidelineOptions(items), [items])
  const rows = useMemo(() => filterGuidelines(items, filters, language), [items, filters, language])
  const selected = rows.find(item => item.id === selectedId) || null
  const set = (key, value) => setFilters(current => ({ ...current, [key]: value }))
  const filtered = filters !== NO_GUIDELINE_FILTERS && JSON.stringify(filters) !== JSON.stringify(NO_GUIDELINE_FILTERS)
  const all = L('Όλα', 'All')
  return <div className={`lib-guides${selected ? '' : ' no-drawer'}`}>
    <div className="lib-guides-main">
      <FilterBar query={filters.query} onQueryChange={value => set('query', value)} placeholder={L('Αναζήτηση τίτλου ή λέξης-κλειδιού…', 'Search title or keyword…')} onClear={filtered ? () => setFilters(NO_GUIDELINE_FILTERS) : undefined}
        end={<div className="lib-filter-selects">
          <FilterSelect label={L('Φορέας', 'Organisation')} value={filters.organisation} onChange={value => set('organisation', value)}><option value="all">{L('Όλοι', 'All')}</option>{options.organisations.map(value => <option key={value} value={value}>{value}</option>)}</FilterSelect>
          <FilterSelect label={L('Θέμα', 'Topic')} value={filters.topic} onChange={value => set('topic', value)}><option value="all">{all}</option>{options.topics.map(value => <option key={value} value={value}>{topicLabel(value, language)}</option>)}</FilterSelect>
          <FilterSelect label={L('Έτος', 'Year')} value={String(filters.year)} onChange={value => set('year', value)}><option value="all">{all}</option>{options.years.map(value => <option key={value} value={String(value)}>{value}</option>)}</FilterSelect>
        </div>} />
      {!loading && !rows.length ? <div className="lib-scroll"><RegistryEmptyState filtered={filtered} onClearFilters={() => setFilters(NO_GUIDELINE_FILTERS)} icon={BookOpenCheck} title={filtered ? undefined : L('Δεν υπάρχουν ακόμη κατευθυντήριες οδηγίες', 'No guidelines yet')} text={filtered ? undefined : L('Οι οδηγίες που προσθέτει η πλατφόρμα ή το νοσοκομείο εμφανίζονται εδώ, με σύνδεσμο στη σελίδα του φορέα.', 'Guidelines added by the platform or the hospital appear here, linked to the publisher\'s page.')} action={canManage ? { label: L('Προσθήκη οδηγίας', 'Add a guideline'), icon: Plus, onClick: onAdd } : null} /></div>
        : <div className="scroll-table"><table className="data-table sticky-table">
          <thead><tr><th>{L('Τίτλος', 'Title')}</th><th>{L('Φορέας', 'Organisation')}</th><th>{L('Θέμα', 'Topic')}</th><th>{L('Έτος', 'Year')}</th></tr></thead>
          <tbody>{rows.map(item => <tr key={item.id} tabIndex={0} className={`registry-row-clickable lib-guide-row${item.id === selectedId ? ' is-selected' : ''}`} aria-selected={item.id === selectedId} onClick={() => setSelectedId(item.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedId(item.id) } }}>
            <td><strong>{item.name}</strong><small>{item.language === 'el' ? L('Ελληνικά', 'Greek') : item.language === 'en' ? L('Αγγλικά', 'English') : L('Άλλη γλώσσα', 'Other language')} · {item.filePath ? L('αρχείο + σελίδα', 'file + page') : L('σελίδα φορέα', "publisher's page")}{item.organizationId ? ` · ${L('Του νοσοκομείου', "Hospital's own")}` : ''}</small></td>
            <td>{item.organisation || '—'}</td>
            <td>{(item.tags || []).slice(0, 1).map(tag => <span key={tag} className="lib-tag">{topicLabel(tag, language)}</span>)}</td>
            <td>{item.year || '—'}</td>
          </tr>)}</tbody>
        </table></div>}
    </div>
    {selected && <GuidelineDrawer item={selected} language={language} onClose={() => setSelectedId('')} onEdit={canManage && selected.organizationId ? () => onEdit(selected) : null} />}
  </div>
}

function GuidelineDrawer({ item, language, onClose, onEdit }) {
  const en = language === 'en'
  const L = (el, english) => (en ? english : el)
  const { notifyError } = useFeedback()
  const points = bulletLines((en ? item.summaryEn : item.summaryEl) || item.summaryEl)
  const link = (en ? item.limoxisEn : item.limoxisEl) || item.limoxisEl
  const description = (en ? item.descriptionEn : item.descriptionEl) || item.descriptionEl
  const [saved, setSaved] = useState(() => readSaved().has(item.id))
  useEffect(() => { setSaved(readSaved().has(item.id)) }, [item.id])
  const toggleSaved = () => { const set = readSaved(); if (set.has(item.id)) set.delete(item.id); else set.add(item.id); writeSaved(set); setSaved(set.has(item.id)) }
  const openFile = async () => { try { const url = await fileUrl(item); if (url) window.open(url, '_blank', 'noopener,noreferrer') } catch (error) { notifyError(error, 'load', { operation: 'library_file' }) } }
  return <aside className="lib-drawer" aria-label={item.name}>
    <div className="lib-drawer-head">
      <div><span className="lib-eyebrow">{[L('Κατευθυντήρια οδηγία', 'Guideline'), item.organisation, item.year].filter(Boolean).join(' · ')}</span><h2>{item.name}</h2></div>
      <IconButton label={L('Κλείσιμο', 'Close')} onClick={onClose}><X size={17} /></IconButton>
    </div>
    <div className="lib-row">{item.status === 'published' && <StatusBadge tone="success">{L('Ισχύει', 'Current')}</StatusBadge>}{(item.tags || []).map(tag => <span key={tag} className="lib-tag">{topicLabel(tag, language)}</span>)}{item.organizationId && <span className="lib-tag is-hospital">{L('Του νοσοκομείου', "Hospital's own")}</span>}</div>
    <dl>
      <dt>{L('Φορέας', 'Organisation')}</dt><dd>{item.organisation || '—'}</dd>
      {item.year && <><dt>{L('Έτος', 'Year')}</dt><dd>{item.year}</dd></>}
      <dt>{L('Γλώσσα', 'Language')}</dt><dd>{item.language === 'el' ? L('Ελληνικά', 'Greek') : item.language === 'en' ? L('Αγγλικά', 'English') : L('Άλλη', 'Other')}</dd>
      <dt>{L('Προστέθηκε', 'Added by')}</dt><dd>{item.organizationId ? L('Το νοσοκομείο', 'The hospital') : 'Platform Owner'}{item.updatedAt ? ` · ${formatDay(item.updatedAt, language)}` : ''}</dd>
    </dl>
    {description && <p className="leg-note">{description}</p>}
    {points.length > 0 && <div><span className="lib-eyebrow">{L('Τι λέει, σύντομα', 'In short')}</span><ul>{points.map(point => <li key={point}>{point}</li>)}</ul></div>}
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
function readSaved() { try { return new Set(JSON.parse(window.localStorage.getItem(SAVED_KEY) || '[]')) } catch { return new Set() } }
function writeSaved(set) { try { window.localStorage.setItem(SAVED_KEY, JSON.stringify([...set].slice(-300))) } catch { /* storage unavailable */ } }

function ClinicalTab({ items, loading, language, canManage, onAdd, onEdit }) {
  const en = language === 'en'
  const L = (el, english) => (en ? english : el)
  const { notifyError } = useFeedback()
  const [query, setQuery] = useState('')
  const rows = useMemo(() => clinicalGuides(items, query, language), [items, query, language])
  const open = async item => { try { const url = await fileUrl(item); if (url) window.open(url, '_blank', 'noopener,noreferrer') } catch (error) { notifyError(error, 'load', { operation: 'library_file' }) } }
  return <>
    <FilterBar query={query} onQueryChange={setQuery} placeholder={L('Αναζήτηση οδηγού…', 'Search guides…')} onClear={query ? () => setQuery('') : undefined} />
    <div className="lib-scroll">
      {!loading && !rows.length && <RegistryEmptyState filtered={Boolean(query)} onClearFilters={() => setQuery('')} icon={Stethoscope} title={query ? undefined : L('Δεν υπάρχουν ακόμη κλινικοί οδηγοί', 'No clinical guides yet')} text={query ? undefined : L('Οδηγοί μίας σελίδας (π.χ. infographic για τη σήψη) ως εικόνα, PDF ή σύνδεσμος, με την πηγή και την ημερομηνία τους.', 'One-page guides (e.g. a sepsis infographic) as an image, PDF or link, with their source and date.')} action={canManage ? { label: L('Προσθήκη οδηγού', 'Add a guide'), icon: Plus, onClick: onAdd } : null} />}
      {rows.length > 0 && <div className="lib-guide-cards">{rows.map(item => <article key={item.id} className="lib-guide-card">
        <span className="lib-logo" aria-hidden="true">{/^image\//.test(item.fileType || '') ? <ImageIcon size={18} /> : <FileText size={18} />}</span>
        <div>
          <button type="button" className="lib-card-title" onClick={() => open(item)}>{item.name}</button>
          <small>{[item.organisation, item.year, item.updatedAt ? formatDay(item.updatedAt, language) : ''].filter(Boolean).join(' · ')}</small>
          {((en ? item.descriptionEn : item.descriptionEl) || item.descriptionEl) && <p className="leg-note">{(en ? item.descriptionEn : item.descriptionEl) || item.descriptionEl}</p>}
          <div className="lib-tags">{(item.tags || []).map(tag => <span key={tag} className="lib-tag">{topicLabel(tag, language)}</span>)}{item.organizationId && <span className="lib-tag is-hospital">{L('Του νοσοκομείου', "Hospital's own")}</span>}</div>
        </div>
        <div className="lib-card-actions">
          <IconButton size="sm" label={L('Άνοιγμα', 'Open')} onClick={() => open(item)}><ExternalLink size={14} /></IconButton>
          {canManage && item.organizationId && <IconButton size="sm" label={L('Επεξεργασία', 'Edit')} onClick={() => onEdit(item)}><Pencil size={14} /></IconButton>}
        </div>
      </article>)}</div>}
    </div>
  </>
}

function NewsTab({ news, sources, loading, language, canManage, onAdd, onEdit }) {
  const en = language === 'en'
  const L = (el, english) => (en ? english : el)
  const [filter, setFilter] = useState('all')
  const [read, setRead] = useState(readSet)
  const counts = newsCounts(news, read)
  const rows = filterNews(news, filter, read)
  const labels = { all: L('Όλα', 'All'), greek: L('Ελληνικοί φορείς', 'Greek bodies'), international: 'WHO / ECDC / CDC', hospital: L('Του νοσοκομείου', "Hospital's own"), unread: L('Μη αναγνωσμένα', 'Unread') }
  const options = NEWS_FILTERS.filter(value => value === 'all' || counts[value]).map(value => ({ value, label: labels[value], count: counts[value] }))
  const markRead = item => setRead(current => { const next = new Set(current); next.add(item.id); rememberRead(next); return next })
  const activeSources = sources.filter(source => source.active)
  return <div className="lib-news">
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
              {canManage && item.organizationId && <IconButton size="sm" label={L('Επεξεργασία', 'Edit')} onClick={() => onEdit(item)}><Pencil size={14} /></IconButton>}
            </div>
          </article>
        })}</div>}
    </div>
    <aside className="lib-group">
      <div className="lib-panel">
        <div className="lib-row"><strong>{L('Αυτόματη ενημέρωση', 'Automatic updates')}</strong><span className="lib-tag is-rss"><Rss size={11} aria-hidden="true" />{L('RSS & σελίδες', 'RSS & pages')}</span></div>
        <p>{L('Οι πηγές ελέγχονται αυτόματα κάθε 2 ώρες (σελίδες χωρίς RSS: κάθε 6 ώρες ή μία φορά τη μέρα). Εμφανίζεται τίτλος, ημερομηνία και σύνδεσμος· το κείμενο μένει στην πηγή.', 'The sources are checked automatically every 2 hours (pages without RSS: every 6 hours or once a day). Title, date and link are shown; the text stays at the source.')}</p>
        {activeSources.length > 0 ? <div className="lib-feeds">{activeSources.map(source => { const state = sourceState(source); return <div key={source.id}><span><i className={`lib-dot is-${state}`} aria-hidden="true" />{source.name}</span><span>{sourceStateLabel(source, language)}</span></div> })}</div>
          : <p>{L('Δεν έχουν οριστεί πηγές.', 'No sources have been set.')}</p>}
      </div>
      <div className="lib-callout"><Info size={16} aria-hidden="true" /><div>{L('Τα νέα δεν αλλάζουν τίποτα στο Limoxis. Αν μια ανακοίνωση αφορά οδηγία, ο Platform Owner την προσθέτει στις «Κατευθυντήριες οδηγίες».', 'News changes nothing in Limoxis. If an announcement concerns a guideline, the Platform Owner adds it to «Guidelines».')}</div></div>
    </aside>
  </div>
}

