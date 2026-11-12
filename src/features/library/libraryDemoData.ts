import { emptyInPreview } from '../../core/preview/emptyPreview'
import { NEWS_SOURCES, PLATFORM_GUIDELINES, PLATFORM_LINKS } from './libraryCatalogue'

// The Library in the preview and the Demo: the platform's real starting content
// (libraryCatalogue.js), plus sample hospital additions and sample news, dated
// relative to today. The empty-hospital preview (?helpEmpty=1) keeps the
// platform content (it is reference material, like the product's libraries)
// and starts without the hospital's own items and without news.

const DEMO_ORG = 'demo-hospital'
const ago = (days, hours = 0) => new Date(Date.now() - days * 86400000 - hours * 3600000).toISOString()

// The hospital's own additions (sample data).
const hospitalItems = [
  { id: 'lib-hosp-01', organizationId: DEMO_ORG, kind: 'link', group: 'hospital', abbreviation: 'ΠΡΩ', name: 'Πρωτόκολλα ΜΕΘ του νοσοκομείου', organisation: '', url: 'https://intranet.example.org/icu-protocols', descriptionEl: 'Τα εσωτερικά πρωτόκολλα της ΜΕΘ: καθετήρες, απομόνωση, εμπειρική αγωγή.', descriptionEn: 'The ICU\'s internal protocols: catheters, isolation, empirical treatment.', tags: ['internal'], year: null, language: 'el', proposed: false, noteEl: '', noteEn: '', summaryEl: '', summaryEn: '', limoxisEl: '', limoxisEn: '', status: 'published', sortOrder: 10, updatedAt: ago(9) },
  { id: 'lib-hosp-02', organizationId: DEMO_ORG, kind: 'clinical_guide', group: 'hospital', abbreviation: 'WHO', name: 'Οι 5 στιγμές της υγιεινής των χεριών', organisation: 'WHO', url: 'https://www.who.int/campaigns/world-hand-hygiene-day', descriptionEl: 'Η αφίσα του WHO «My 5 Moments for Hand Hygiene» για τους θαλάμους.', descriptionEn: 'The WHO poster «My 5 Moments for Hand Hygiene» for the wards.', tags: ['hand_hygiene'], year: null, language: 'en', proposed: false, noteEl: '', noteEn: '', summaryEl: '', summaryEn: '', limoxisEl: '', limoxisEn: '', status: 'published', sortOrder: 10, updatedAt: ago(4) },
]

// Sample news: titles of the kind each source publishes, linked to the source's home page.
const hospitalNews = [
  { id: 'news-demo-07', sourceId: '', sourceName: '', sourceAbbreviation: 'ΓΘΠ', organizationId: DEMO_ORG, title: 'Επικαιροποίηση πρωτοκόλλου απομόνωσης CPE στη ΜΕΘ', url: '', excerpt: 'Ανακοίνωση της Ομάδας Ελέγχου Λοιμώξεων του νοσοκομείου.', publishedAt: ago(8), detectedAt: ago(8) },
]
const sourceNews = [
  ['ECDC · Communicable disease threats report', 'Communicable disease threats report, εβδομαδιαία σύνοψη', 'Εβδομαδιαία σύνοψη των απειλών μεταδοτικών νοσημάτων στην Ευρώπη.', 'https://www.ecdc.europa.eu', ago(1)],
  ['ΕΟΔΥ · ανακοινώσεις', 'Εβδομαδιαία έκθεση επιδημιολογικής επιτήρησης της γρίπης', 'Έναρξη της περιόδου επιτήρησης· δείκτες γριπώδους συνδρομής.', 'https://eody.gov.gr', ago(3)],
  ['WHO · news', 'Disease Outbreak News: νέα ανακοίνωση', 'Ο WHO δημοσίευσε ενημέρωση για συρροή κρουσμάτων· ανοίξτε την πηγή για λεπτομέρειες.', 'https://www.who.int', ago(4)],
  ['CDC · MMWR', 'MMWR Weekly · τεύχος εβδομάδας', 'Νέα άρθρα του Morbidity and Mortality Weekly Report.', 'https://www.cdc.gov/mmwr/index.html', ago(4, 6)],
  ['ΕΕΕΛ · οδηγίες', 'Νέα κατευθυντήρια οδηγία στη σελίδα της ΕΕΕΛ', 'Εντοπίστηκε νέος σύνδεσμος στη λίστα «Κατευθυντήριες οδηγίες».', 'https://www.eeel.gr/1/katefthyntiries-odigies-c4.html', ago(6)],
  ['CDC · EID ahead of print', 'Emerging Infectious Diseases · ahead of print', 'Άρθρα πριν την έντυπη έκδοση του περιοδικού του CDC.', 'https://wwwnc.cdc.gov/eid', ago(7)],
].map(([sourceName, title, excerpt, url, publishedAt], index) => {
  const source = NEWS_SOURCES.find(item => item.name === sourceName)
  return { id: `news-demo-0${index + 1}`, sourceId: `src-${NEWS_SOURCES.indexOf(source) + 1}`, sourceName, sourceAbbreviation: source?.abbreviation || '', organizationId: null, title, url, excerpt, publishedAt, detectedAt: publishedAt }
})

// The sources, as the automatic check last left them (sample states).
const FAILING = new Set(['ΕΝΕ · ανακοινώσεις'])
export const demoSources = () => NEWS_SOURCES.map((source, index) => {
  const failing = FAILING.has(source.name)
  return { id: `src-${index + 1}`, itemId: PLATFORM_LINKS.find(link => link.abbreviation === source.abbreviation)?.id || '', name: source.name, abbreviation: source.abbreviation, url: source.url, kind: source.kind, intervalHours: source.intervalHours, keywords: [...source.keywords], active: true, verified: !failing, lastCheckedAt: ago(0, 1), lastOkAt: failing ? ago(3, 2) : ago(0, Math.min(source.intervalHours, 20)), lastError: failing ? 'HTTP 503' : '', consecutiveFailures: failing ? 9 : 0, createdAt: ago(30) }
})

emptyInPreview(hospitalItems)
emptyInPreview(hospitalNews)
emptyInPreview(sourceNews)

export const demoLibraryItems = () => [...PLATFORM_LINKS, ...PLATFORM_GUIDELINES, ...hospitalItems].map(item => ({ ...item, tags: [...item.tags], updatedAt: item.updatedAt || ago(12) }))
export const demoLibraryNews = () => [...sourceNews, ...hospitalNews].map(item => ({ ...item }))
export const DEMO_LIBRARY_ORG = DEMO_ORG
