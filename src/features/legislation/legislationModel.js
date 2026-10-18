// Legislation (ISO 9001 §4.2, §6.1, §9.1.3; ISO 15189 §4.1): the platform's
// library of texts that apply to hospitals and each hospital's register of how
// it complies, requirement by requirement. A hospital reads only published
// versions; a new version puts the requirements that changed back to review,
// without touching what the hospital already declared for the others.

const pick = (list, value, language) => list.find(item => item.value === value)?.label[language === 'en' ? 1 : 0] || value || ''
const toneOf = (list, value) => list.find(item => item.value === value)?.tone || 'neutral'
export const todayIso = () => new Date().toISOString().slice(0, 10)

export const KINDS = [
  { value: 'law', label: ['Νόμος', 'Law'] },
  { value: 'presidential_decree', label: ['Προεδρικό Διάταγμα', 'Presidential decree'] },
  { value: 'ministerial_decision', label: ['Υπουργική / Κοινή Υπουργική Απόφαση', 'Ministerial decision'] },
  { value: 'circular', label: ['Εγκύκλιος', 'Circular'] },
  { value: 'eu_regulation', label: ['Κανονισμός ΕΕ', 'EU regulation'] },
  { value: 'eu_directive', label: ['Οδηγία ΕΕ', 'EU directive'] },
  { value: 'standard', label: ['Πρότυπο', 'Standard'] },
  { value: 'guideline', label: ['Οδηγία / κατευθυντήρια γραμμή', 'Guideline'] },
  { value: 'other', label: ['Άλλο', 'Other'] },
]
export const kindLabel = (value, language) => pick(KINDS, value, language)

export const TEXT_STATUSES = [
  { value: 'in_force', label: ['Σε ισχύ', 'In force'], tone: 'success' },
  { value: 'amended', label: ['Τροποποιήθηκε', 'Amended'], tone: 'warning' },
  { value: 'repealed', label: ['Καταργήθηκε', 'Repealed'], tone: 'neutral' },
]
export const textStatusLabel = (value, language) => pick(TEXT_STATUSES, value, language)
export const textStatusTone = value => toneOf(TEXT_STATUSES, value)

export const TOPICS = [
  { value: 'infection', label: ['Πρόληψη λοιμώξεων', 'Infection prevention'] },
  { value: 'waste', label: ['Απόβλητα', 'Waste'] },
  { value: 'water', label: ['Νερό & Λεγιονέλλα', 'Water & Legionella'] },
  { value: 'sterilization', label: ['Αποστείρωση', 'Sterilization'] },
  { value: 'food', label: ['Υγιεινή τροφίμων', 'Food hygiene'] },
  { value: 'antimicrobials', label: ['Αντιμικροβιακά', 'Antimicrobials'] },
  { value: 'patient_safety', label: ['Ασφάλεια ασθενών', 'Patient safety'] },
  { value: 'quality', label: ['Ποιότητα', 'Quality'] },
  { value: 'occupational', label: ['Υγεία & ασφάλεια εργαζομένων', 'Occupational health'] },
  { value: 'devices', label: ['Ιατροτεχνολογικά', 'Medical devices'] },
  { value: 'data', label: ['Προσωπικά δεδομένα', 'Personal data'] },
]
export const topicLabel = (value, language) => pick(TOPICS, value, language)

// How a hospital meets one requirement.
export const COMPLIANCE = [
  { value: 'compliant', label: ['Συμμορφώνεται', 'Compliant'], tone: 'success' },
  { value: 'partial', label: ['Μερικώς', 'Partly'], tone: 'warning' },
  { value: 'non_compliant', label: ['Δεν συμμορφώνεται', 'Not compliant'], tone: 'danger' },
  { value: 'not_applicable', label: ['Δεν εφαρμόζεται', 'Not applicable'], tone: 'neutral' },
]
export const complianceLabel = (value, language) => pick(COMPLIANCE, value, language) || (language === 'en' ? 'Not assessed' : 'Δεν αξιολογήθηκε')
export const complianceTone = value => (value ? toneOf(COMPLIANCE, value) : 'info')

// A text's state in a hospital's register, in the order the list shows them.
export const REGISTER_STATES = [
  { value: 'new', label: ['Νέο: χρειάζεται απόφαση', 'New: needs a decision'], tone: 'info' },
  { value: 'update', label: ['Ενημέρωση προς επανεξέταση', 'Update to review'], tone: 'warning' },
  { value: 'non_compliant', label: ['Μη συμμόρφωση', 'Not compliant'], tone: 'danger' },
  { value: 'pending', label: ['Αξιολόγηση σε εξέλιξη', 'Assessment in progress'], tone: 'info' },
  { value: 'partial', label: ['Μερική συμμόρφωση', 'Partly compliant'], tone: 'warning' },
  { value: 'compliant', label: ['Συμμορφώνεται', 'Compliant'], tone: 'success' },
  { value: 'not_applicable', label: ['Δεν αφορά', 'Does not apply'], tone: 'neutral' },
]
export const registerStateLabel = (value, language) => pick(REGISTER_STATES, value, language)
export const registerStateTone = value => toneOf(REGISTER_STATES, value)
const STATE_ORDER = Object.fromEntries(REGISTER_STATES.map((item, index) => [item.value, index]))

// The latest published version of each text, and every version by text.
export function latestVersions(versions = []) {
  const byText = new Map()
  for (const version of versions) {
    const list = byText.get(version.textId) || []
    list.push(version)
    byText.set(version.textId, list)
  }
  for (const list of byText.values()) list.sort((a, b) => a.version - b.version)
  return byText
}

// The requirements that changed after the version the hospital reviewed.
export function changedSince(history = [], acceptedVersion = 0) {
  const changed = new Set()
  for (const version of history) if (version.version > acceptedVersion) for (const id of version.changedRequirements || []) changed.add(id)
  return changed
}

export function complianceSummary(requirements = [], compliance = {}) {
  const counts = { compliant: 0, partial: 0, non_compliant: 0, not_applicable: 0, unassessed: 0 }
  for (const requirement of requirements) {
    const status = compliance?.[requirement.id]?.status
    if (status && counts[status] != null) counts[status] += 1
    else counts.unassessed += 1
  }
  const assessable = requirements.length - counts.not_applicable
  const percent = assessable > 0 ? Math.round(((counts.compliant + counts.partial * 0.5) / assessable) * 100) : null
  return { ...counts, total: requirements.length, assessable, percent }
}

// One text as the hospital's register shows it.
export function registerEntry(history, row, today = todayIso()) {
  const latest = history[history.length - 1]
  const text = { ...latest.snapshot, id: latest.textId, version: latest.version, publishedAt: latest.publishedAt }
  const requirements = text.requirements || []
  const accepted = row?.acceptedVersion || 0
  const changed = row ? changedSince(history, accepted) : new Set()
  const summary = complianceSummary(requirements, row?.compliance || {})
  const reviewLate = Boolean(row?.applicable !== false && row?.nextReviewOn && row.nextReviewOn < today)
  let state
  if (!row) state = 'new'
  else if (row.applicable === false) state = 'not_applicable'
  else if (accepted < latest.version) state = 'update'
  else if (summary.non_compliant) state = 'non_compliant'
  else if (summary.unassessed) state = 'pending'
  else if (summary.partial) state = 'partial'
  else state = 'compliant'
  return { text, row: row || null, history, state, summary, changed, reviewLate, latestChange: latest.changeNote || '', hasUpdate: Boolean(row && row.applicable !== false && accepted < latest.version) }
}

export function buildRegister(versions = [], rows = [], today = todayIso()) {
  const byText = latestVersions(versions)
  const rowsByText = new Map(rows.map(row => [row.textId, row]))
  return [...byText.values()].map(history => registerEntry(history, rowsByText.get(history[0].textId), today))
}

export function registerCounts(entries = []) {
  const applicable = entries.filter(entry => entry.state !== 'not_applicable' && entry.state !== 'new')
  const percents = applicable.map(entry => entry.summary.percent).filter(value => value != null)
  return {
    applicable: applicable.length,
    newTexts: entries.filter(entry => entry.state === 'new').length,
    updates: entries.filter(entry => entry.state === 'update').length,
    nonCompliant: entries.filter(entry => entry.summary.non_compliant > 0 && entry.state !== 'not_applicable').length,
    reviewLate: entries.filter(entry => entry.reviewLate).length,
    percent: percents.length ? Math.round(percents.reduce((sum, value) => sum + value, 0) / percents.length) : null,
  }
}

export const NO_FILTERS = { query: '', topic: 'all', kind: 'all', state: 'all', quick: null }
export function filterRegister(entries = [], filters = NO_FILTERS) {
  const q = String(filters.query || '').trim().toLocaleLowerCase('el')
  return entries
    .filter(entry => !q || [entry.text.code, entry.text.title, entry.text.reference, entry.text.issuer, entry.text.summary].some(value => String(value || '').toLocaleLowerCase('el').includes(q)))
    .filter(entry => filters.topic === 'all' || (entry.text.topics || []).includes(filters.topic))
    .filter(entry => filters.kind === 'all' || entry.text.kind === filters.kind)
    .filter(entry => filters.state === 'all' || entry.state === filters.state)
    .filter(entry => !filters.quick || (filters.quick === 'new' ? entry.state === 'new' : filters.quick === 'updates' ? entry.state === 'update' : filters.quick === 'nonCompliant' ? entry.summary.non_compliant > 0 && entry.state !== 'not_applicable' : filters.quick === 'reviewLate' ? entry.reviewLate : filters.quick === 'applicable' ? !['new', 'not_applicable'].includes(entry.state) : true))
    .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || String(a.text.code).localeCompare(String(b.text.code)))
}

// --- The Platform Owner's library ---------------------------------------------------------

export const nextLegislationCode = (codes = []) => {
  const used = codes.map(code => String(code || '').match(/^LEG-(\d+)$/)?.[1]).filter(Boolean).map(Number)
  return `LEG-${String((used.length ? Math.max(...used) : 0) + 1).padStart(3, '0')}`
}
export const requirementId = () => `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

export function newText() {
  return { id: '', code: '', title: '', titleEn: '', kind: 'ministerial_decision', reference: '', issuer: '', issuedOn: '', topics: [], summary: '', url: '', status: 'in_force', requirements: [], version: 0, publishedAt: '' }
}

export function textProblems(text, language = 'el') {
  const en = language === 'en'
  const problems = []
  if (String(text.title || '').trim().length < 3) problems.push(en ? 'a title' : 'τίτλο')
  if (!String(text.reference || '').trim()) problems.push(en ? 'the reference (e.g. Government Gazette)' : 'στοιχεία δημοσίευσης (π.χ. ΦΕΚ)')
  if (!(text.requirements || []).length) problems.push(en ? 'at least one requirement' : 'τουλάχιστον μία απαίτηση')
  if ((text.requirements || []).some(item => !String(item.text || '').trim())) problems.push(en ? 'the wording of every requirement' : 'διατύπωση σε κάθε απαίτηση')
  return problems
}

// What the working copy changed against the last published version.
export function unpublishedChanges(text, lastSnapshot) {
  if (!lastSnapshot) return { isNew: true, fields: [], requirements: (text.requirements || []).map(item => item.id) }
  const fields = ['title', 'titleEn', 'kind', 'reference', 'issuer', 'issuedOn', 'summary', 'url', 'status'].filter(key => String(text[key] || '') !== String(lastSnapshot[key] || ''))
  if ([...(text.topics || [])].sort().join('|') !== [...(lastSnapshot.topics || [])].sort().join('|')) fields.push('topics')
  const previous = new Map((lastSnapshot.requirements || []).map(item => [item.id, item.text]))
  const requirements = (text.requirements || []).filter(item => previous.get(item.id) !== item.text).map(item => item.id)
  const removed = [...previous.keys()].filter(id => !(text.requirements || []).some(item => item.id === id))
  return { isNew: false, fields, requirements, removed }
}
export const hasUnpublished = changes => changes.isNew || changes.fields.length > 0 || changes.requirements.length > 0 || (changes.removed || []).length > 0

export const CANDIDATE_STATUSES = [
  { value: 'pending', label: ['Προς έλεγχο', 'To review'], tone: 'info' },
  { value: 'linked', label: ['Καταχωρίστηκε', 'Added'], tone: 'success' },
  { value: 'dismissed', label: ['Απορρίφθηκε', 'Dismissed'], tone: 'neutral' },
]
export const candidateStatusLabel = (value, language) => pick(CANDIDATE_STATUSES, value, language)
export const candidateStatusTone = value => toneOf(CANDIDATE_STATUSES, value)

// A source's health, as the Sources view shows it.
export function sourceHealth(source) {
  if (!source.active) return 'inactive'
  if (!source.lastCheckedAt) return 'waiting'
  if (source.consecutiveFailures >= 2) return 'failing'
  if (source.consecutiveFailures === 1) return 'warning'
  return 'ok'
}
export const SOURCE_HEALTH = [
  { value: 'ok', label: ['Λειτουργεί', 'Working'], tone: 'success' },
  { value: 'warning', label: ['Απέτυχε μία φορά', 'Failed once'], tone: 'warning' },
  { value: 'failing', label: ['Δεν απαντά', 'Not answering'], tone: 'danger' },
  { value: 'waiting', label: ['Αναμένει πρώτο έλεγχο', 'Awaiting first check'], tone: 'info' },
  { value: 'inactive', label: ['Ανενεργή', 'Inactive'], tone: 'neutral' },
]
export const sourceHealthLabel = (value, language) => pick(SOURCE_HEALTH, value, language)
export const sourceHealthTone = value => toneOf(SOURCE_HEALTH, value)

// The prefill of a library text started from a candidate.
export function textFromCandidate(candidate) {
  const title = String(candidate.title || '').trim()
  const reference = title.match(/ΦΕΚ\s+[ΑΒΓΔ΄']*\s*[\d/.-]+/i)?.[0] || ''
  return { ...newText(), title, reference, url: candidate.url || '', summary: candidate.excerpt || '' }
}

// The prefill of a corrective action opened from a requirement the hospital does not meet.
export function legislationCapaSource(text, requirement, record, language = 'el') {
  const en = language === 'en'
  return {
    source: 'other', sourceId: `LEG:${text.code}`,
    title: en ? `Compliance: ${requirement.text.slice(0, 90)}` : `Συμμόρφωση: ${requirement.text.slice(0, 90)}`,
    description: [`${text.code} · ${text.title}${text.reference ? ` (${text.reference})` : ''}`, `${en ? 'Requirement' : 'Απαίτηση'}: ${requirement.text}`, record?.note ? `${en ? 'Finding' : 'Διαπίστωση'}: ${record.note}` : ''].filter(Boolean).join('\n'),
  }
}

export function registerExport(entries = [], language = 'el') {
  const en = language === 'en'
  return {
    name: en ? 'legislation-register' : 'mitroo-nomothesias',
    headers: en ? ['Code', 'Text', 'Kind', 'Reference', 'Status of text', 'Version', 'Applies', 'Requirements', 'Compliant', 'Partly', 'Not compliant', 'Not assessed', 'Compliance %', 'Next review', 'Register state'] : ['Κωδικός', 'Κείμενο', 'Είδος', 'Δημοσίευση', 'Κατάσταση κειμένου', 'Έκδοση', 'Αφορά', 'Απαιτήσεις', 'Συμμορφώνεται', 'Μερικώς', 'Δεν συμμορφώνεται', 'Δεν αξιολογήθηκε', 'Συμμόρφωση %', 'Επόμενη επανεξέταση', 'Κατάσταση στο μητρώο'],
    rows: entries.map(entry => [entry.text.code, entry.text.title, kindLabel(entry.text.kind, language), entry.text.reference || '', textStatusLabel(entry.text.status, language), entry.text.version, entry.row ? (entry.row.applicable === false ? (en ? 'No' : 'Όχι') : (en ? 'Yes' : 'Ναι')) : '', entry.summary.total, entry.summary.compliant, entry.summary.partial, entry.summary.non_compliant, entry.summary.unassessed, entry.summary.percent ?? '', entry.row?.nextReviewOn || '', registerStateLabel(entry.state, language)]),
  }
}
