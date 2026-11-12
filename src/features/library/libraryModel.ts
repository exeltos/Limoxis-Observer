import { LIBRARY_TOPICS, LINK_GROUPS } from './libraryCatalogue'

// «Βιβλιοθήκη» (Library): the rules of the screen, kept apart from React so they are tested on their own.

export const LIBRARY_TABS = Object.freeze(['links', 'guidelines', 'clinical', 'news'])
export const KIND_FOR_TAB = Object.freeze({ links: 'link', guidelines: 'guideline', clinical: 'clinical_guide' })

// What a Hospital Admin or Quality Manager may add for the hospital, and what the Platform Owner may add for everyone.
export const HOSPITAL_KINDS = Object.freeze(['link', 'guideline', 'clinical_guide', 'announcement'])
export const PLATFORM_KINDS = Object.freeze(['link', 'guideline', 'clinical_guide', 'news_source'])
export const KIND_LABELS = Object.freeze({
  link: ['Σύνδεσμος', 'Link'],
  guideline: ['Κατευθυντήρια οδηγία', 'Guideline'],
  clinical_guide: ['Κλινικός οδηγός', 'Clinical guide'],
  news_source: ['Πηγή νέων', 'News source'],
  announcement: ['Ανακοίνωση', 'Announcement'],
})
export const kindLabel = (kind, language) => (KIND_LABELS[kind] || [kind, kind])[language === 'en' ? 1 : 0]

// Who keeps the hospital's own additions (RLS: 20261203200000_library.sql).
export const HOSPITAL_LIBRARY_ROLES = Object.freeze(['hospital_admin', 'quality_manager', 'platform_owner', 'demo'])
export const canManageHospitalLibrary = role => HOSPITAL_LIBRARY_ROLES.includes(role)

export const INTERVALS = Object.freeze([2, 6, 24, 168])
export const intervalLabel = (hours, language) => {
  const en = language === 'en'
  if (hours === 24) return en ? 'Once a day' : 'Μία φορά τη μέρα'
  if (hours === 168) return en ? 'Once a week' : 'Μία φορά την εβδομάδα'
  return en ? `Every ${hours} hours` : `Κάθε ${hours} ώρες`
}

export const DESCRIPTION_LIMIT = 160
export const EXCERPT_LIMIT = 300

export const groupLabel = (value, language) => { const group = LINK_GROUPS.find(item => item.value === value); return group ? group[language === 'en' ? 'en' : 'el'] : value }
export const topicLabel = (value, language) => { const topic = LIBRARY_TOPICS.find(item => item.value === value); return topic ? topic[language === 'en' ? 'en' : 'el'] : value }

// The initials box of a card: the organisation's abbreviation, or the first letters of its name.
export function initials(item) {
  const given = String(item?.abbreviation || '').trim()
  if (given) return given.slice(0, 6)
  const words = String(item?.name || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(word => word.length > 2)
  return (words.slice(0, 3).map(word => word[0]).join('') || String(item?.name || '?').slice(0, 2)).toLocaleUpperCase('el')
}

// The colour family of the initials box, never the organisation's logo (trademarks).
const TONES = { WHO: 'who', AWaRe: 'who', CDC: 'cdc', NHSN: 'cdc', EID: 'cdc', ECDC: 'ecdc', ΕΟΔΥ: 'gov', ΕΟΦ: 'gov' }
export function logoTone(item) {
  if (item?.organizationId) return 'hospital'
  if (TONES[item?.abbreviation]) return TONES[item.abbreviation]
  if (item?.group === 'nursing') return 'nursing'
  if (item?.group === 'archive') return 'reference'
  return 'society'
}

export const domainOf = url => { try { const parsed = new URL(url); return `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname.replace(/\/$/, '').replace(/\/index\.html$/, '')}` } catch { return '' } }
export const isHttpUrl = value => /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(String(value || '').trim())

const fold = text => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('el').replace(/ς/g, 'σ')
const haystack = (item, language) => fold([item.name, item.abbreviation, item.organisation, item.url, item.descriptionEl, item.descriptionEn, ...(item.tags || []).map(tag => topicLabel(tag, language)), ...(item.tags || [])].join(' '))
export const matchesQuery = (item, query, language) => !String(query || '').trim() || haystack(item, language).includes(fold(query.trim()))

// The «Σύνδεσμοι» tab: the published links, grouped, with the hospital's own in their group.
export function linkGroups(items, { query = '', group = 'all', language = 'el' } = {}) {
  const links = items.filter(item => item.kind === 'link' && item.status !== 'archived' && matchesQuery(item, query, language))
  const groupOf = item => (item.organizationId ? 'hospital' : item.group)
  const counts = Object.fromEntries(LINK_GROUPS.map(entry => [entry.value, links.filter(item => groupOf(item) === entry.value).length]))
  const groups = LINK_GROUPS.map(entry => ({ ...entry, items: links.filter(item => groupOf(item) === entry.value && (group === 'all' || group === entry.value)).sort(bySortOrder) })).filter(entry => entry.items.length)
  return { groups, counts, total: links.length }
}
const bySortOrder = (a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100) || String(a.name).localeCompare(String(b.name), 'el')

export const NO_GUIDELINE_FILTERS = Object.freeze({ query: '', organisation: 'all', topic: 'all', year: 'all' })
export function guidelineOptions(items) {
  const guidelines = items.filter(item => item.kind === 'guideline' && item.status !== 'archived')
  const organisations = [...new Set(guidelines.map(item => item.organisation).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'el'))
  const topics = [...new Set(guidelines.flatMap(item => item.tags || []))]
  const years = [...new Set(guidelines.map(item => item.year).filter(Boolean))].sort((a, b) => b - a)
  return { organisations, topics, years }
}
export function filterGuidelines(items, filters = NO_GUIDELINE_FILTERS, language = 'el') {
  return items.filter(item => item.kind === 'guideline' && item.status !== 'archived'
    && matchesQuery(item, filters.query, language)
    && (filters.organisation === 'all' || item.organisation === filters.organisation)
    && (filters.topic === 'all' || (item.tags || []).includes(filters.topic))
    && (filters.year === 'all' || String(item.year) === String(filters.year)))
    .sort((a, b) => (b.year || 0) - (a.year || 0) || bySortOrder(a, b))
}
export const clinicalGuides = (items, query = '', language = 'el') => items.filter(item => item.kind === 'clinical_guide' && item.status !== 'archived' && matchesQuery(item, query, language)).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')) || bySortOrder(a, b))

export const bulletLines = text => String(text || '').split(/\n+/).map(line => line.replace(/^[-•·]\s*/, '').trim()).filter(Boolean)

// --- News ----------------------------------------------------------------------------------

const DAY = 86400000
export const newsDate = item => item.publishedAt || item.detectedAt || ''
export const isRecentNews = (item, now = Date.now()) => { const time = Date.parse(newsDate(item)); return Number.isFinite(time) && now - time < 3 * DAY }
// Greek bodies and the hospital's own on one side, the international agencies on the other.
const GREEK_SOURCES = new Set(['ΕΟΔΥ', 'ΕΕΕΛ', 'ΕΝΕ', 'ΕΟΦ', 'ΕΕΛ'])
export const newsBucket = item => (item.organizationId ? 'hospital' : GREEK_SOURCES.has(item.sourceAbbreviation) ? 'greek' : 'international')
export const NEWS_FILTERS = Object.freeze(['all', 'greek', 'international', 'hospital', 'unread'])
export function filterNews(items, filter = 'all', read = new Set()) {
  const sorted = [...items].sort((a, b) => String(newsDate(b)).localeCompare(String(newsDate(a))))
  if (filter === 'all') return sorted
  if (filter === 'unread') return sorted.filter(item => !read.has(item.id))
  return sorted.filter(item => newsBucket(item) === filter)
}
export const newsCounts = (items, read = new Set()) => ({ all: items.length, greek: items.filter(item => newsBucket(item) === 'greek').length, international: items.filter(item => newsBucket(item) === 'international').length, hospital: items.filter(item => newsBucket(item) === 'hospital').length, unread: items.filter(item => !read.has(item.id)).length })

// A source's state in the «Αυτόματη ενημέρωση» panel: answering, not answering (3 failures in a row), not checked yet, off.
export function sourceState(source) {
  if (!source.active) return 'off'
  if ((source.consecutiveFailures || 0) >= 3) return 'failing'
  if (!source.lastOkAt) return 'unchecked'
  return 'ok'
}
export function sinceLabel(value, language, now = Date.now()) {
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
export function sourceStateLabel(source, language, now = Date.now()) {
  const en = language === 'en'
  const state = sourceState(source)
  if (state === 'off') return en ? 'off' : 'ανενεργή'
  if (state === 'unchecked') return en ? 'not checked yet' : 'δεν ελέγχθηκε ακόμη'
  if (state === 'failing') { const days = Math.max(1, Math.round((now - Date.parse(source.lastOkAt || source.createdAt || now)) / DAY)); return source.lastOkAt ? (en ? `not answering for ${days} days` : `δεν απαντά ${days} ημέρες`) : (en ? 'not answering' : 'δεν απαντά') }
  return sinceLabel(source.lastOkAt, language, now)
}

// --- The form --------------------------------------------------------------------------------

export function blankDraft(kind = 'link', scope = 'platform') {
  return { id: '', kind, scope, group: scope === 'hospital' ? 'hospital' : 'international', name: '', abbreviation: '', organisation: '', url: '', descriptionEl: '', descriptionEn: '', summaryEl: '', summaryEn: '', noteEl: '', noteEn: '', tags: [], year: '', language: 'el', proposed: false, status: 'published', file: null, filePath: '', fileName: '', excerpt: '', publishedAt: '', news: { enabled: false, id: '', url: '', kind: 'rss', intervalHours: 2, keywords: '' } }
}

export function validateDraft(draft) {
  const errors = {}
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
export const errorText = (code, language) => {
  const en = language === 'en'
  return { required: en ? 'Required.' : 'Υποχρεωτικό.', url: en ? 'An address starting with https:// (or http://).' : 'Διεύθυνση που αρχίζει με https:// (ή http://).', long: en ? 'Too long.' : 'Πολύ μεγάλο.', year: en ? 'A year, e.g. 2021.' : 'Έτος, π.χ. 2021.' }[code] || ''
}
export const keywordList = text => String(text || '').split(',').map(word => word.trim()).filter(Boolean)
