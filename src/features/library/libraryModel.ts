import { LIBRARY_TOPICS, LINK_GROUPS } from './libraryCatalogue'
import { hospitalDay, hospitalToday } from '../../core/dates/hospitalDate'
import type { LibraryDraft, LibraryItem, LibraryNews, LibrarySource } from './libraryTypes'

// «Βιβλιοθήκη» (Library): the rules of the screen, kept apart from React so they are tested on their own.

export const LIBRARY_TABS = Object.freeze(['links', 'guidelines', 'clinical', 'news'])
export const KIND_FOR_TAB: Readonly<Record<string, string>> = Object.freeze({ links: 'link', guidelines: 'guideline', clinical: 'clinical_guide' })

// What a Hospital Admin or Quality Manager may add for the hospital, and what the Platform Owner may add for everyone.
export const HOSPITAL_KINDS = Object.freeze(['link', 'guideline', 'clinical_guide', 'announcement'])
export const PLATFORM_KINDS = Object.freeze(['link', 'guideline', 'clinical_guide', 'news_source'])
export const KIND_LABELS: Readonly<Record<string, [string, string]>> = Object.freeze({
  link: ['Σύνδεσμος', 'Link'],
  guideline: ['Κατευθυντήρια οδηγία', 'Guideline'],
  clinical_guide: ['Κλινικός οδηγός', 'Clinical guide'],
  news_source: ['Πηγή νέων', 'News source'],
  announcement: ['Ανακοίνωση', 'Announcement'],
})
export const kindLabel = (kind: string, language: string) => (KIND_LABELS[kind] || [kind, kind])[language === 'en' ? 1 : 0]

// Who keeps the hospital's own additions (RLS: 20261203200000_library.sql).
export const HOSPITAL_LIBRARY_ROLES: readonly string[] = Object.freeze(['hospital_admin', 'quality_manager', 'platform_owner', 'demo'])
export const canManageHospitalLibrary = (role: string | null | undefined) => HOSPITAL_LIBRARY_ROLES.includes(role || '')

export const INTERVALS = Object.freeze([2, 6, 24, 168])
export const intervalLabel = (hours: number, language: string) => {
  const en = language === 'en'
  if (hours === 24) return en ? 'Once a day' : 'Μία φορά τη μέρα'
  if (hours === 168) return en ? 'Once a week' : 'Μία φορά την εβδομάδα'
  return en ? `Every ${hours} hours` : `Κάθε ${hours} ώρες`
}

export const DESCRIPTION_LIMIT = 160
export const EXCERPT_LIMIT = 300

export const groupLabel = (value: string, language: string) => { const group = LINK_GROUPS.find(item => item.value === value); return group ? group[language === 'en' ? 'en' : 'el'] : value }
export const topicLabel = (value: string, language: string) => { const topic = LIBRARY_TOPICS.find(item => item.value === value); return topic ? topic[language === 'en' ? 'en' : 'el'] : value }

// The initials box of a card: the organisation's abbreviation, or the first letters of its name.
export function initials(item: Pick<LibraryItem, 'name' | 'abbreviation'> | null | undefined) {
  const given = String(item?.abbreviation || '').trim()
  if (given) return given.slice(0, 6)
  const words = String(item?.name || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(word => word.length > 2)
  return (words.slice(0, 3).map(word => word[0]).join('') || String(item?.name || '?').slice(0, 2)).toLocaleUpperCase('el')
}

// The colour family of the initials box, never the organisation's logo (trademarks).
const TONES: Record<string, string> = { WHO: 'who', AWaRe: 'who', CDC: 'cdc', NHSN: 'cdc', EID: 'cdc', ECDC: 'ecdc', ΕΟΔΥ: 'gov', ΕΟΦ: 'gov' }
export function logoTone(item: Pick<LibraryItem, 'abbreviation' | 'organizationId' | 'group'> | null | undefined) {
  if (item?.organizationId) return 'hospital'
  if (TONES[item?.abbreviation as string]) return TONES[item?.abbreviation as string]
  if (item?.group === 'nursing') return 'nursing'
  if (item?.group === 'archive') return 'reference'
  return 'society'
}

export const domainOf = (url: string) => { try { const parsed = new URL(url); return `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname.replace(/\/$/, '').replace(/\/index\.html$/, '')}` } catch { return '' } }
export const isHttpUrl = (value: unknown) => /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(String(value || '').trim())

const fold = (text: unknown) => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('el').replace(/ς/g, 'σ')
const haystack = (item: LibraryItem, language: string) => fold([item.name, item.titleEl, item.abbreviation, item.organisation, item.url, item.descriptionEl, item.descriptionEn, item.year, ...(item.tags || []).map((tag: string) => topicLabel(tag, language)), ...(item.tags || [])].join(' '))
// Every typed word must appear somewhere in the entry (the platform's search, with final sigma folded too).
export const matchesQuery = (item: LibraryItem, query: string, language: string) => { const words = fold(query).split(/\s+/).filter(Boolean); if (!words.length) return true; const text = haystack(item, language); return words.every(word => text.includes(word)) }

// The «Σύνδεσμοι» tab: the published links, grouped, with the hospital's own in their group.
export function linkGroups(items: LibraryItem[], { query = '', group = 'all', language = 'el' }: { query?: string, group?: string, language?: string } = {}) {
  const links = items.filter(item => item.kind === 'link' && item.status !== 'archived' && matchesQuery(item, query, language))
  const groupOf = (item: LibraryItem) => (item.organizationId ? 'hospital' : item.group)
  const counts = Object.fromEntries(LINK_GROUPS.map(entry => [entry.value, links.filter(item => groupOf(item) === entry.value).length]))
  const groups = LINK_GROUPS.map(entry => ({ ...entry, items: links.filter(item => groupOf(item) === entry.value && (group === 'all' || group === entry.value)).sort(bySortOrder) })).filter(entry => entry.items.length)
  return { groups, counts, total: links.length }
}
const bySortOrder = (a: LibraryItem, b: LibraryItem) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100) || String(a.name).localeCompare(String(b.name), 'el')

export interface GuidelineFilters { query: string, organisation: string, topic: string, year: string }
export const NO_GUIDELINE_FILTERS: Readonly<GuidelineFilters> = Object.freeze({ query: '', organisation: 'all', topic: 'all', year: 'all' })
export function guidelineOptions(items: LibraryItem[]): { organisations: string[], topics: string[], years: number[] } {
  const guidelines = items.filter(item => item.kind === 'guideline' && item.status !== 'archived')
  const organisations = [...new Set(guidelines.map(item => item.organisation).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'el'))
  const topics = [...new Set(guidelines.flatMap(item => item.tags || []))]
  const years = [...new Set(guidelines.map(item => item.year).filter(Boolean))].sort((a, b) => b - a)
  return { organisations, topics, years }
}
export function filterGuidelines(items: LibraryItem[], filters: Readonly<GuidelineFilters> = NO_GUIDELINE_FILTERS, language = 'el') {
  return items.filter(item => item.kind === 'guideline' && item.status !== 'archived'
    && matchesQuery(item, filters.query, language)
    && (filters.organisation === 'all' || item.organisation === filters.organisation)
    && (filters.topic === 'all' || (item.tags || []).includes(filters.topic))
    && (filters.year === 'all' || String(item.year) === String(filters.year)))
    .sort((a, b) => (b.year || 0) - (a.year || 0) || bySortOrder(a, b))
}
// The topic chips above the guidelines: the guidelines the other filters leave, counted per topic.
export function guidelineTopicCounts(items: LibraryItem[], filters: Readonly<GuidelineFilters> = NO_GUIDELINE_FILTERS, language = 'el') {
  const rows = filterGuidelines(items, { ...filters, topic: 'all' }, language)
  const counts: Record<string, number> = {}
  for (const item of rows) for (const tag of new Set(item.tags || [])) counts[tag] = (counts[tag] || 0) + 1
  return { total: rows.length, topics: Object.entries(counts).sort((a, b) => b[1] - a[1] || topicLabel(a[0], language).localeCompare(topicLabel(b[0], language), 'el')).map(([value, count]) => ({ value, count })) }
}
// A guideline's title: in Greek the Greek title, with the original under it; in English the original only.
export function guidelineTitle(item: Pick<LibraryItem, 'name' | 'titleEl'>, language: string) {
  const greek = String(item.titleEl || '').trim()
  if (language === 'en' || !greek || greek === item.name) return { main: item.name, original: '' }
  return { main: greek, original: item.name }
}
export const clinicalGuides = (items: LibraryItem[], query = '', language = 'el') => items.filter(item => item.kind === 'clinical_guide' && item.status !== 'archived' && matchesQuery(item, query, language)).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')) || bySortOrder(a, b))

export const bulletLines = (text: unknown) => String(text || '').split(/\n+/).map(line => line.replace(/^[-•·]\s*/, '').trim()).filter(Boolean)
// The sources of a clinical guide, from its note («Πηγές: A (2020)· B (2009)»), one per line.
export const sourceLines = (note: unknown) => String(note || '').replace(/^\s*(Πηγές|Πηγή|Sources?)\s*:\s*/i, '').split(/\s*·\s+|\n+/).map(line => line.trim()).filter(Boolean)

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c])
// «Εκτύπωση» of a clinical guide: one clean A4 page (title, what we do, sources, date), opened in a print window.
export function clinicalGuidePrintHtml(item: LibraryItem, language: string, { today = hospitalToday(), band = '' }: { today?: string, band?: string } = {}) {
  const en = language === 'en'
  const L = (el: string, english: string) => (en ? english : el)
  const points = bulletLines((en ? item.summaryEn : item.summaryEl) || item.summaryEl)
  const sources = sourceLines((en ? item.noteEn : item.noteEl) || item.noteEl)
  const description = (en ? item.descriptionEn : item.descriptionEl) || item.descriptionEl
  const meta = [item.organisation, item.year].filter(Boolean).join(' · ')
  const [y, m, d] = String(today).split('-')
  const printed = y && m && d ? `${Number(d)}/${Number(m)}/${y}` : today
  return `<!doctype html><html lang="${en ? 'en' : 'el'}"><head><meta charset="utf-8"><title>${escapeHtml(item.name)}</title><style>
@page{size:A4;margin:16mm 16mm 14mm}*{box-sizing:border-box}
body{margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#17233a;font-size:12.5px;line-height:1.45}
.eyebrow{font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#5d6f80}
h1{margin:2px 0 4px;font-size:21px;line-height:1.25}.lead{margin:0 0 14px;color:#3d4f61}
h2{margin:16px 0 6px;padding-bottom:4px;border-bottom:1px solid #cfd9e2;font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#1d3a52}
ul{margin:0;padding-left:20px}li{margin:0 0 5px}.sources li{margin:0 0 3px;font-size:11px;color:#3d4f61}
.footer{margin-top:18px;padding-top:8px;border-top:1px solid #cfd9e2;font-size:10px;color:#5d6f80;display:flex;justify-content:space-between;gap:12px;overflow-wrap:anywhere}
@media print{body{padding:0}}
</style></head><body>${band}
<div class="eyebrow">${escapeHtml([L('Κλινικός οδηγός', 'Clinical guide'), meta].filter(Boolean).join(' · '))}</div>
<h1>${escapeHtml(item.name)}</h1>${description ? `<p class="lead">${escapeHtml(description)}</p>` : ''}
${points.length ? `<h2>${L('Τι κάνουμε', 'What we do')}</h2><ul>${points.map(point => `<li>${escapeHtml(point)}</li>`).join('')}</ul>` : ''}
${sources.length ? `<h2>${L('Πηγές', 'Sources')}</h2><ul class="sources">${sources.map(source => `<li>${escapeHtml(source)}</li>`).join('')}</ul>` : ''}
<div class="footer"><span>${escapeHtml(item.url || '')}</span><span>${L('Εκτύπωση', 'Printed')} ${escapeHtml(printed)} · Limoxis Observer</span></div>
</body></html>`
}

// --- News ----------------------------------------------------------------------------------

const DAY = 86400000
export const newsDate = (item: LibraryNews) => item.publishedAt || item.detectedAt || ''
// The headings of the «Νέα» list, by the listed date in hospital time: this (calendar) week from
// Monday, the rest of this month, older.
export const NEWS_PERIODS = Object.freeze(['week', 'month', 'older'])
export function newsPeriod(item: LibraryNews, today = hospitalToday()) {
  const day = hospitalDay(newsDate(item))
  if (!day) return 'older'
  const monday = new Date(`${today}T12:00:00Z`)
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7))
  if (day >= monday.toISOString().slice(0, 10)) return 'week'
  return day.slice(0, 7) === today.slice(0, 7) ? 'month' : 'older'
}
export const newsByPeriod = (items: LibraryNews[], today = hospitalToday()) => NEWS_PERIODS.map(period => ({ period, items: items.filter(item => newsPeriod(item, today) === period) })).filter(group => group.items.length)
export const isRecentNews = (item: LibraryNews, now = Date.now()) => { const time = Date.parse(newsDate(item)); return Number.isFinite(time) && now - time < 3 * DAY }
// Greek bodies and the hospital's own on one side, the international agencies on the other.
const GREEK_SOURCES = new Set(['ΕΟΔΥ', 'ΕΕΕΛ', 'ΕΝΕ', 'ΕΟΦ', 'ΕΕΛ'])
export const newsBucket = (item: LibraryNews) => (item.organizationId ? 'hospital' : GREEK_SOURCES.has(item.sourceAbbreviation as string) ? 'greek' : 'international')
export const NEWS_FILTERS = Object.freeze(['all', 'greek', 'international', 'hospital', 'unread'])
export function filterNews(items: LibraryNews[], filter = 'all', read: Set<string> = new Set()) {
  const sorted = [...items].sort((a, b) => String(newsDate(b)).localeCompare(String(newsDate(a))))
  if (filter === 'all') return sorted
  if (filter === 'unread') return sorted.filter(item => !read.has(item.id))
  return sorted.filter(item => newsBucket(item) === filter)
}
export const newsCounts = (items: LibraryNews[], read: Set<string> = new Set()): Record<string, number> => ({ all: items.length, greek: items.filter(item => newsBucket(item) === 'greek').length, international: items.filter(item => newsBucket(item) === 'international').length, hospital: items.filter(item => newsBucket(item) === 'hospital').length, unread: items.filter(item => !read.has(item.id)).length })

// A source's state in the «Αυτόματη ενημέρωση» panel: answering, not answering (3 failures in a row), not checked yet, off.
export function sourceState(source: Partial<LibrarySource>) {
  if (!source.active) return 'off'
  if ((source.consecutiveFailures || 0) >= 3) return 'failing'
  if (!source.lastOkAt) return 'unchecked'
  return 'ok'
}
export function sinceLabel(value: string | null | undefined, language: string, now = Date.now()) {
  const en = language === 'en'
  const time = Date.parse(value || '')
  if (!Number.isFinite(time)) return ''
  const hours = Math.max(0, Math.round((now - time) / 3600000))
  if (hours < 1) return en ? 'just now' : 'μόλις τώρα'
  if (hours < 24) return en ? `${hours} h ago` : `πριν ${hours} ${hours === 1 ? 'ώρα' : 'ώρες'}`
  const days = Math.round(hours / 24)
  if (days === 1) return en ? 'yesterday' : 'χθες'
  return en ? `${days} days ago` : `πριν ${days} ημέρες`
}
export function sourceStateLabel(source: Partial<LibrarySource>, language: string, now = Date.now()) {
  const en = language === 'en'
  const state = sourceState(source)
  if (state === 'off') return en ? 'off' : 'ανενεργή'
  if (state === 'unchecked') return en ? 'not checked yet' : 'δεν ελέγχθηκε ακόμη'
  if (state === 'failing') { const days = Math.max(1, Math.round((now - Date.parse(String(source.lastOkAt || source.createdAt || now))) / DAY)); return source.lastOkAt ? (en ? `not answering for ${days} days` : `δεν απαντά ${days} ημέρες`) : (en ? 'not answering' : 'δεν απαντά') }
  return sinceLabel(source.lastOkAt, language, now)
}

// --- The form --------------------------------------------------------------------------------

export function blankDraft(kind = 'link', scope = 'platform'): LibraryDraft {
  return { id: '', kind, scope, group: scope === 'hospital' ? 'hospital' : 'international', name: '', titleEl: '', abbreviation: '', organisation: '', url: '', descriptionEl: '', descriptionEn: '', summaryEl: '', summaryEn: '', noteEl: '', noteEn: '', tags: [], year: '', language: 'el', proposed: false, status: 'published', file: null, filePath: '', fileName: '', excerpt: '', publishedAt: '', news: { enabled: false, id: '', url: '', kind: 'rss', intervalHours: 2, keywords: '' } }
}

export function validateDraft(draft: LibraryDraft): Record<string, string> {
  const errors: Record<string, string> = {}
  const name = String(draft.name || '').trim()
  if (name.length < 2) errors.name = 'required'
  const needsUrl = draft.kind === 'link' || draft.kind === 'guideline' || (draft.kind === 'clinical_guide' && !draft.file && !draft.filePath)
  if (needsUrl && !isHttpUrl(draft.url)) errors.url = 'url'
  if (!needsUrl && draft.url && !isHttpUrl(draft.url)) errors.url = 'url'
  if (draft.kind === 'link' && !String(draft.descriptionEl || '').trim()) errors.descriptionEl = 'required'
  if (String(draft.descriptionEl || '').length > DESCRIPTION_LIMIT || String(draft.descriptionEn || '').length > DESCRIPTION_LIMIT) errors.descriptionEl = 'long'
  if (draft.kind === 'announcement' && String(draft.excerpt || '').length > EXCERPT_LIMIT) errors.excerpt = 'long'
  if (draft.year && !/^\d{4}$/.test(String(draft.year))) errors.year = 'year'
  if (String(draft.abbreviation || '').length > 8) errors.abbreviation = 'long'
  const newsUrl = draft.kind === 'news_source' ? draft.url : draft.news?.enabled ? draft.news.url : ''
  if ((draft.kind === 'news_source' || draft.news?.enabled) && !isHttpUrl(newsUrl)) errors.newsUrl = 'url'
  return errors
}
export const errorText = (code: string, language: string) => {
  const en = language === 'en'
  return ({ required: en ? 'Required.' : 'Υποχρεωτικό.', url: en ? 'An address starting with https:// (or http://).' : 'Διεύθυνση που αρχίζει με https:// (ή http://).', long: en ? 'Too long.' : 'Πολύ μεγάλο.', year: en ? 'A year, e.g. 2021.' : 'Έτος, π.χ. 2021.' } as Record<string, string>)[code] || ''
}
export const keywordList = (text: unknown) => String(text || '').split(',').map(word => word.trim()).filter(Boolean)
