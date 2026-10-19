// Έλεγχος επικαιρότητας πρωτοκόλλων: the pure part, shared by the protocol-review
// Edge Function and the tests. No imports and no I/O: text in, structure out.
//   splitProtocolSections   the text of a protocol in five sections;
//   extractProtocolReferences  the organisations, guidelines and legislation it cites;
//   legislationKeys / clinicalSourceTerms  how a library entry is recognised in a text;
//   evaluateProtocol        the findings for one protocol (review due, source changed, stale).

export const SECTION_KEYS = ['purpose', 'definitions', 'instructions', 'dosages', 'references'] as const
export type SectionKey = typeof SECTION_KEYS[number]
export type Sections = Record<SectionKey, string>

export const MAX_SECTION_CHARS = 20000
export const REVIEW_WINDOW_DAYS = 60
export const STALE_YEARS = 3

// \b of JavaScript knows only ASCII letters; this one knows Greek too.
const B = '(?:(?<![\\p{L}\\p{N}])(?=[\\p{L}\\p{N}])|(?<=[\\p{L}\\p{N}])(?![\\p{L}\\p{N}]))'
export const unicodeWords = (source: string, flags = '') => new RegExp(source.replace(/\\b/g, B), `${flags.replace('u', '')}u`)

// Lower case, no accents, final sigma folded, spaces collapsed: «Σκοπός» → «σκοπος».
export function fold(value: unknown): string {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/ς/g, 'σ').replace(/\s+/g, ' ').trim()
}

export function normalizeExtractedText(value: unknown): string {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00ad/g, '')
    .replace(/[\t\f\v\u00a0]+/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n[ ]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// A PDF whose pages carry (almost) no letters is a scan: «χωρίς κείμενο».
export function hasTextLayer(text: string, pages = 1): boolean {
  const letters = (String(text || '').match(/\p{L}/gu) || []).length
  return letters >= Math.max(80, 20 * Math.max(1, pages))
}

const HEADINGS: Array<[SectionKey, RegExp]> = [
  ['purpose', /^(σκοποσ|αντικειμενο|εισαγωγη|πεδιο εφαρμογησ|σκοποσ και πεδιο|στοχοσ|στοχοι|purpose|scope|introduction|aim|objective)/],
  ['definitions', /^(ορισμοι|ορισμοσ|συντομογραφιεσ|ορολογια|ακρωνυμια|definitions|abbreviations|glossary)/],
  ['dosages', /^(δοσολογια|δοσολογιεσ|δοσεισ|φαρμακευτικη αγωγη|φαρμακοθεραπεια|χορηγηση φαρμακ|dosage|dosing|doses|drug therapy)/],
  ['references', /^(βιβλιογραφια|βιβλιογραφικεσ αναφορεσ|αναφορεσ|πηγεσ|σχετικα εγγραφα|σχετικη νομοθεσια|νομοθετικο πλαισιο|references|bibliography|sources)/],
  ['instructions', /^(διαδικασια|περιγραφη διαδικασιασ|οδηγιεσ|ενεργειεσ|αντιμετωπιση|θεραπεια|διαχειριση|εφαρμογη|αλγοριθμοσ|procedure|instructions|management|treatment|actions)/],
]
// «1.», «2.3», «Α.», «IV.» and bullets in front of a heading.
const NUMBERING = /^\s*(?:(?:\d{1,2}(?:\.\d{1,2})*\.?\)?|[ivx]{1,4}[.)]|[α-ωa-z][.)])\s*|[-•·▪●*]\s*)?/
const DOSE = unicodeWords('\\b\\d+(?:[.,]\\d+)?\\s*(?:mg|mcg|μg|ng|g|gr|ml|iu|ie|meq|mmol|μοναδεσ|units?)(?:\\s*\\/\\s*(?:kg|h|ωρα|24h|ημερα|day))?\\b')

export function headingOf(line: string): SectionKey | null {
  const raw = String(line || '').trim()
  if (!raw || raw.length > 90) return null
  const text = fold(raw).replace(NUMBERING, '').replace(/[:.\-–—]+$/, '').trim()
  if (!text) return null
  for (const [key, pattern] of HEADINGS) if (pattern.test(text)) return key
  return null
}

// Text under each heading until the next heading. Text before the first
// heading, or under an unknown heading, belongs to the instructions. Dose lines
// found elsewhere are also collected under dosages when there is no such heading.
export function splitProtocolSections(input: string): Sections {
  const text = normalizeExtractedText(input)
  const out: Record<SectionKey, string[]> = { purpose: [], definitions: [], instructions: [], dosages: [], references: [] }
  let current: SectionKey = 'instructions'
  let sawDosageHeading = false
  const doseLines: string[] = []
  for (const line of text.split('\n')) {
    const heading = headingOf(line)
    if (heading) { current = heading; if (heading === 'dosages') sawDosageHeading = true; continue }
    if (!line.trim()) { out[current].push(''); continue }
    out[current].push(line)
    if (current !== 'dosages' && DOSE.test(fold(line))) doseLines.push(line.trim())
  }
  if (!sawDosageHeading) out.dosages.push(...doseLines)
  const sections = {} as Sections
  for (const key of SECTION_KEYS) sections[key] = out[key].join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_SECTION_CHARS)
  return sections
}

export const presentSections = (sections: Partial<Sections> | null | undefined): SectionKey[] =>
  SECTION_KEYS.filter(key => String(sections?.[key] || '').trim())

// ---------------------------------------------------------------- references

export type ProtocolReference = {
  kind: 'organisation' | 'legislation'
  key: string            // stable match key: org:eody, law:3850/2010, fek:b:1537/2012, eu:852/2004, iso:9001
  label: string          // what the protocol calls it
  organisation: string | null
  year: number | null
  section: SectionKey | null
  context: string        // the cited line, at most 200 characters
}


// Organisations and guideline bodies a Greek hospital protocol cites. folded is
// tested on the folded line; upper on the line as written, for acronyms that are
// also common English words (WHO, NICE, ESC…).
const ORG = (code: string, label: string, folded: string, upper?: string) => ({ code, label, folded: folded ? unicodeWords(folded) : null, upper: upper ? unicodeWords(upper) : null })
const ORGANISATIONS = [
  ORG('eody', 'ΕΟΔΥ', '\\bεοδυ\\b|εθνικοσ οργανισμοσ δημοσιασ υγειασ|\\bnpho\\b'),
  ORG('keelpno', 'ΚΕΕΛΠΝΟ', '\\bκεελπνο\\b'),
  ORG('moh', 'Υπουργείο Υγείας', 'υπουργει\\S* υγει'),
  ORG('kesy', 'ΚΕΣΥ', '\\bκεσυ\\b|κεντρικο συμβουλιο υγειασ'),
  ORG('who', 'WHO', 'world health organi[sz]ation|παγκοσμιοσ οργανισμοσ υγειασ', '\\bWHO\\b|\\bΠ\\.?Ο\\.?Υ\\b'),
  ORG('ecdc', 'ECDC', '\\becdc\\b|european centre for disease'),
  ORG('cdc', 'CDC', '\\bcdc\\b|centers for disease control'),
  ORG('eucast', 'EUCAST', '\\beucast\\b'),
  ORG('clsi', 'CLSI', '\\bclsi\\b'),
  ORG('nice', 'NICE', 'national institute for health and care excellence', '\\bNICE\\b'),
  ORG('idsa', 'IDSA', '\\bidsa\\b|infectious diseases society of america'),
  ORG('escmid', 'ESCMID', '\\bescmid\\b'),
  ORG('shea', 'SHEA', '', '\\bSHEA\\b'),
  ORG('erc', 'ERC', 'european resuscitation council', '\\bERC\\b'),
  ORG('aha', 'AHA', 'american heart association', '\\bAHA\\b'),
  ORG('esc', 'ESC', 'european society of cardiology', '\\bESC\\b'),
  ORG('esicm', 'ESICM', '\\besicm\\b'),
  ORG('sccm', 'SCCM', '\\bsccm\\b|surviving sepsis'),
  ORG('rcog', 'RCOG', '\\brcog\\b|royal college of obstetricians'),
  ORG('acog', 'ACOG', '\\bacog\\b|american college of obstetricians'),
  ORG('figo', 'FIGO', '\\bfigo\\b'),
  ORG('rcp', 'Royal College of Physicians', 'royal college of physicians'),
  ORG('rcpch', 'RCPCH', '\\brcpch\\b|royal college of paediatrics'),
  ORG('ema', 'EMA', 'european medicines agency', '\\bEMA\\b'),
  ORG('eof', 'ΕΟΦ', '\\bεοφ\\b|εθνικοσ οργανισμοσ φαρμακων'),
  ORG('iso', 'ISO', '', '\\bISO\\b'),
]

const LEGISLATION: Array<{ pattern: RegExp, key: (m: RegExpMatchArray) => string, label: (m: RegExpMatchArray) => string, year: (m: RegExpMatchArray) => string }> = [
  // ν. 3850/2010, Ν.4624/2019, νόμος 3850/2010
  { pattern: /(?:^|[^\p{L}])(?:ν\.?|νομο[σσυ]?)\s?(\d{3,4})\s?\/\s?((?:19|20)\d{2})/gu, key: m => `law:${m[1]}/${m[2]}`, label: m => `Ν. ${m[1]}/${m[2]}`, year: m => m[2] },
  // ΦΕΚ Β΄ 1537/2012, ΦΕΚ Α' 84/02.06.2010, ΦΕΚ 388/Β/2014
  { pattern: /φεκ\s*([αβγδab])\s*['΄’`]?\s*(\d{1,5})\s*\/\s*(?:\d{1,2}[.\-/]\d{1,2}[.\-/])?((?:19|20)\d{2})/gu, key: m => `fek:${fekIssue(m[1])}:${m[2]}/${m[3]}`, label: m => `ΦΕΚ ${fekIssue(m[1]).toUpperCase()}΄ ${m[2]}/${m[3]}`, year: m => m[3] },
  { pattern: /φεκ\s*(\d{1,5})\s*\/\s*([αβγδab])\s*['΄’`]?\s*\/\s*((?:19|20)\d{2})/gu, key: m => `fek:${fekIssue(m[2])}:${m[1]}/${m[3]}`, label: m => `ΦΕΚ ${fekIssue(m[2]).toUpperCase()}΄ ${m[1]}/${m[3]}`, year: m => m[3] },
  // π.δ. 87/1986
  { pattern: /(?:^|[^\p{L}])π\.?\s?δ\.?\s?(\d{1,3})\s?\/\s?((?:19|20)\d{2})/gu, key: m => `pd:${m[1]}/${m[2]}`, label: m => `Π.Δ. ${m[1]}/${m[2]}`, year: m => m[2] },
  // Κανονισμός (ΕΚ) αριθ. 852/2004, Regulation (EU) 2017/745, Οδηγία 2010/32/ΕΕ
  { pattern: /(?:κανονισμ\S*|regulation|οδηγι\S*|directive)\s*\((?:εκ|εε|εοκ|ec|eu|eec)\)\s*(?:αριθ\.?|αρ\.?|no\.?)?\s*((?:19|20)?\d{2,4})\s?\/\s?((?:19|20)?\d{2,4})/gu, key: m => `eu:${euKey(m[1], m[2])}`, label: m => `ΕΕ ${m[1]}/${m[2]}`, year: m => euYear(m[1], m[2]) },
  { pattern: /(?:οδηγι\S*|directive)\s*((?:19|20)\d{2})\s?\/\s?(\d{1,4})\s?\/\s?(?:εε|εκ|εοκ|eu|ec|eec)/gu, key: m => `eu:${m[1]}/${m[2]}`, label: m => `Οδηγία ${m[1]}/${m[2]}`, year: m => m[1] },
  // ISO 9001:2015, ΕΛΟΤ EN ISO 15189
  { pattern: /\biso\s?(\d{4,5})(?:\s?[:/]\s?((?:19|20)\d{2}))?/gu, key: m => `iso:${m[1]}`, label: m => `ISO ${m[1]}${m[2] ? `:${m[2]}` : ''}`, year: m => m[2] || '' },
]

// ΦΕΚ issue letters typed in Latin (B) are the Greek ones (Β).
function fekIssue(letter: string) { return ({ a: 'α', b: 'β' } as Record<string, string>)[letter] || letter }
// EU acts are numbered number/year before 2015 and year/number since.
function euKey(a: string, b: string) { return `${a}/${b}` }
function euYear(a: string, b: string) { const x = Number(a), y = Number(b); return String(x >= 1950 && x <= 2100 ? x : y >= 1950 && y <= 2100 ? y : '') }

const YEAR = /\b((?:19[89]|20[0-4])\d)\b/g

function yearNear(line: string, max: number): number | null {
  const years = [...line.matchAll(YEAR)].map(m => Number(m[1])).filter(y => y <= max)
  return years.length ? Math.max(...years) : null
}

function sectionOfLines(text: string): Array<{ line: string, section: SectionKey | null }> {
  let current: SectionKey | null = null
  return normalizeExtractedText(text).split('\n').map(line => {
    const heading = headingOf(line)
    if (heading) current = heading
    return { line, section: heading ? null : current }
  })
}

// Every organisation and legislative act the text names, once per key, with the
// latest year written next to it.
export function extractProtocolReferences(text: string, { now = new Date() }: { now?: Date } = {}): ProtocolReference[] {
  const maxYear = now.getUTCFullYear() + 1
  const found = new Map<string, ProtocolReference>()
  const add = (ref: ProtocolReference) => {
    const prev = found.get(ref.key)
    if (!prev) { found.set(ref.key, ref); return }
    if (ref.year && (!prev.year || ref.year > prev.year)) prev.year = ref.year
    if (prev.section !== 'references' && ref.section === 'references') prev.section = 'references'
  }
  for (const { line, section } of sectionOfLines(text)) {
    if (!line.trim()) continue
    const folded = fold(line)
    const context = line.trim().slice(0, 200)
    for (const org of ORGANISATIONS) {
      if (!(org.folded?.test(folded) || org.upper?.test(line))) continue
      add({ kind: 'organisation', key: `org:${org.code}`, label: org.label, organisation: org.label, year: yearNear(folded, maxYear), section, context })
    }
    for (const rule of LEGISLATION) {
      for (const m of folded.matchAll(rule.pattern)) {
        const y = Number(rule.year(m)) || null
        add({ kind: 'legislation', key: rule.key(m), label: rule.label(m), organisation: null, year: y && y <= maxYear ? y : null, section, context })
      }
    }
  }
  return [...found.values()]
}

// The match keys of a legislation library entry, from its code, reference and title.
export function legislationKeys(text: { code?: string | null, reference?: string | null, title?: string | null }): string[] {
  const joined = [text.reference, text.title, text.code].filter(Boolean).join('\n')
  const keys = new Set(extractProtocolReferences(joined).filter(r => r.kind === 'legislation').map(r => r.key))
  // «Κανονισμός (ΕΕ) 2016/679» written without the «(ΕΕ)» in a protocol: also «ΓΚΠΔ / GDPR».
  if ([...keys].includes('eu:2016/679')) keys.add('alias:gdpr')
  return [...keys]
}

const ALIAS_KEYS: Array<[RegExp, string]> = [[unicodeWords('\\bγκπδ\\b|\\bgdpr\\b'), 'alias:gdpr']]
export function textAliasKeys(text: string): string[] {
  const folded = fold(text)
  return ALIAS_KEYS.filter(([pattern]) => pattern.test(folded)).map(([, key]) => key)
}

// The terms that show a protocol relies on a clinical content source:
// its name (without the « — Adult» qualifier), a short code such as NEWS2, and
// the qualifier, which must also appear when the name has one.
export function clinicalSourceTerms(source: { source_key?: string | null, name?: string | null }) {
  const name = fold(source.name || '')
  const [core, qualifier] = name.split(/\s+[—–-]\s+/)
  const terms = new Set<string>()
  if (core && core.length >= 4) terms.add(core)
  const key = fold(source.source_key || '')
  if (/^[a-z0-9]{3,8}$/.test(key)) terms.add(key)
  if (key === 'news2') terms.add('news 2')
  const words = (core || '').split(' ').filter(w => w.length > 2)
  if (words.length >= 3) terms.add(words.map(w => w[0]).join('')) // «Paediatric Early Warning Systems» → pews
  const QUALIFIERS: Record<string, string[]> = { adult: ['adult', 'ενηλ'], pediatric: ['pediatr', 'paediatr', 'παιδ'], paediatric: ['pediatr', 'paediatr', 'παιδ'], neonatal: ['neonat', 'νεογν'] }
  const q = qualifier ? (QUALIFIERS[qualifier.split(' ')[0]] || [qualifier.split(' ')[0]]) : []
  return { terms: [...terms].filter(t => t.length >= 3), qualifiers: q }
}

const wordHit = (haystack: string, term: string) => {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?:$|[^\\p{L}\\p{N}])`, 'u').test(haystack)
}

export function textCitesClinicalSource(foldedText: string, source: { source_key?: string | null, name?: string | null }): string | null {
  const { terms, qualifiers } = clinicalSourceTerms(source)
  const hit = terms.find(term => wordHit(foldedText, term))
  if (!hit) return null
  if (qualifiers.length && !qualifiers.some(q => foldedText.includes(q))) return null
  return hit
}

// Sections whose text contains the term (folded); references always, when present.
export function sectionsMentioning(sections: Partial<Sections>, terms: string[]): SectionKey[] {
  const hits = SECTION_KEYS.filter(key => { const body = fold(sections[key] || ''); return body && terms.some(t => t && body.includes(fold(t))) })
  if (String(sections.references || '').trim() && !hits.includes('references')) hits.push('references')
  return hits
}

// ---------------------------------------------------------------- comparison

export type ProtocolDoc = { id: string, organization_id: string, code?: string | null, title?: string | null, status: string, version?: string | null, effective_date?: string | null, review_date?: string | null, published_at?: string | null, created_at?: string | null }
export type ClinicalSourceChange = { source: { id: string, source_key?: string | null, name?: string | null, authority?: string | null, source_url?: string | null }, historyId: string, checkedAt: string, note?: string | null }
export type LegislationChange = { text: { id: string, code?: string | null, title?: string | null, reference?: string | null, url?: string | null, status?: string | null }, keys: string[], triggerKey: string, changedAt: string, summary: string, excerpt: string }
export type Finding = {
  reason: 'review_due' | 'source_changed' | 'stale'
  source_kind: 'clinical_source' | 'legislation' | null
  source_ref: string
  source_label: string | null
  source_url: string | null
  trigger_key: string
  what_changed: string
  affected_sections: SectionKey[]
  details: Record<string, unknown>
  source_excerpt: string | null
}

const DAY = 86400000
export const dayOf = (value?: string | null) => (value ? String(value).slice(0, 10) : '')
const greekDay = (day: string) => day ? `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}` : ''
const addDays = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10)
const addYears = (day: string, years: number) => { const d = new Date(`${day}T00:00:00Z`); d.setUTCFullYear(d.getUTCFullYear() + years); return d.toISOString().slice(0, 10) }

export const REVIEWED_STATUSES = ['published', 'approved']

// The date from which a later change in a source makes the protocol out of date: the newest of
// effective_date and published_at. A revision inherits its predecessor's effective_date, so its
// own published_at must win, or an accepted change would recur on the new version.
export const protocolBaseline = (doc: ProtocolDoc) => [dayOf(doc.effective_date), dayOf(doc.published_at)].filter(Boolean).sort().pop() || dayOf(doc.created_at)

export function evaluateProtocol({ doc, sections, references = [], text = '', clinicalChanges = [], legislationChanges = [], today, reviewWindowDays = REVIEW_WINDOW_DAYS, staleYears = STALE_YEARS }: {
  doc: ProtocolDoc, sections?: Partial<Sections> | null, references?: Array<Pick<ProtocolReference, 'key' | 'kind' | 'label'>>, text?: string,
  clinicalChanges?: ClinicalSourceChange[], legislationChanges?: LegislationChange[], today: string, reviewWindowDays?: number, staleYears?: number
}): Finding[] {
  if (!REVIEWED_STATUSES.includes(doc.status)) return []
  const findings: Finding[] = []
  const all = presentSections(sections)
  const review = dayOf(doc.review_date), effective = dayOf(doc.effective_date)
  if (review && review <= addDays(today, reviewWindowDays)) {
    const days = Math.round((Date.parse(`${review}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY)
    findings.push({
      reason: 'review_due', source_kind: null, source_ref: '', source_label: null, source_url: null, trigger_key: `review:${review}`,
      what_changed: days < 0 ? `Η ημερομηνία αναθεώρησης (${greekDay(review)}) έχει παρέλθει.` : days === 0 ? `Η αναθεώρηση οφείλεται σήμερα (${greekDay(review)}).` : `Η αναθεώρηση οφείλεται σε ${days} ημέρες (${greekDay(review)}).`,
      affected_sections: all, details: { reviewDate: review, days }, source_excerpt: null,
    })
  }
  if (!review && effective && addYears(effective, staleYears) < today) {
    findings.push({
      reason: 'stale', source_kind: null, source_ref: '', source_label: null, source_url: null, trigger_key: `stale:${effective}`,
      what_changed: `Σε ισχύ από ${greekDay(effective)} (πάνω από ${staleYears} έτη) χωρίς ημερομηνία αναθεώρησης.`,
      affected_sections: all, details: { effectiveDate: effective, years: staleYears }, source_excerpt: null,
    })
  }
  const baseline = protocolBaseline(doc)
  const folded = fold(text)
  if (folded) {
    // Latest change of each matched clinical source after the baseline.
    const latest = new Map<string, ClinicalSourceChange>()
    for (const change of clinicalChanges) {
      if (baseline && dayOf(change.checkedAt) <= baseline) continue
      const prev = latest.get(change.source.id)
      if (!prev || change.checkedAt > prev.checkedAt) latest.set(change.source.id, change)
    }
    for (const change of latest.values()) {
      const term = textCitesClinicalSource(folded, change.source)
      if (!term) continue
      const label = [change.source.name, change.source.authority].filter(Boolean).join(' · ')
      findings.push({
        reason: 'source_changed', source_kind: 'clinical_source', source_ref: `clinical:${change.source.id}`, source_label: label, source_url: change.source.source_url || null,
        trigger_key: `clinical:${change.historyId}`,
        what_changed: `Η πηγή «${change.source.name}» άλλαξε στις ${greekDay(dayOf(change.checkedAt))}${change.note ? `: ${change.note}` : '.'}`,
        affected_sections: sectionsMentioning(sections || {}, [term]), details: { sourceId: change.source.id, changedAt: change.checkedAt, matched: term }, source_excerpt: change.note || null,
      })
    }
  }
  const refKeys = new Set([...references.map(r => r.key), ...textAliasKeys(text)])
  for (const change of legislationChanges) {
    const matched = change.keys.find(key => refKeys.has(key))
    if (!matched) continue
    if (baseline && dayOf(change.changedAt) <= baseline) continue
    const ref = references.find(r => r.key === matched)
    const label = [change.text.code, change.text.reference || change.text.title].filter(Boolean).join(' · ')
    findings.push({
      reason: 'source_changed', source_kind: 'legislation', source_ref: `legislation:${change.text.id}`, source_label: label, source_url: change.text.url || null,
      trigger_key: change.triggerKey, what_changed: change.summary,
      affected_sections: sectionsMentioning(sections || {}, [ref?.label || '', matched.split(':').pop() || '']), details: { textId: change.text.id, changedAt: change.changedAt, matched }, source_excerpt: change.excerpt || null,
    })
  }
  return findings
}

// One open suggestion per protocol, reason and source; a change already
// decided (accepted, rejected) is not suggested again.
export const findingIdentity = (documentId: string, f: Pick<Finding, 'reason' | 'source_ref'>) => `${documentId}|${f.reason}|${f.source_ref || ''}`
export function newFindings(documentId: string, findings: Finding[], existing: Array<{ document_id: string, reason: string, source_ref: string | null, trigger_key: string, status: string }>) {
  const open = new Set(existing.filter(s => s.status === 'open' || s.status === 'snoozed').map(s => findingIdentity(s.document_id, { reason: s.reason as Finding['reason'], source_ref: s.source_ref || '' })))
  const seen = new Set(existing.map(s => `${findingIdentity(s.document_id, { reason: s.reason as Finding['reason'], source_ref: s.source_ref || '' })}|${s.trigger_key}`))
  const out: Finding[] = []
  for (const f of findings) {
    const id = findingIdentity(documentId, f)
    if (open.has(id) || seen.has(`${id}|${f.trigger_key}`)) continue
    open.add(id)
    out.push(f)
  }
  return out
}

// ---------------------------------------------------------------- drafting

// What the model receives: the affected sections of the protocol (capped) and
// the source excerpt. Nothing else (no patient data, no names of people).
export function draftPrompt({ sections, affected, sourceLabel, sourceExcerpt, whatChanged, maxChars = 6000 }: { sections: Partial<Sections>, affected: SectionKey[], sourceLabel: string, sourceExcerpt: string, whatChanged: string, maxChars?: number }) {
  const keys = affected.length ? affected : presentSections(sections)
  let budget = Math.max(500, maxChars)
  const parts: string[] = []
  for (const key of keys) {
    const body = String(sections[key] || '').trim()
    if (!body || budget <= 0) continue
    const slice = body.slice(0, budget)
    budget -= slice.length
    parts.push(`[${key}]\n${slice}`)
  }
  return {
    system: 'Είσαι βοηθός διαχείρισης ποιότητας νοσοκομείου. Συγκρίνεις ένα εσωτερικό πρωτόκολλο με την αλλαγή μιας πηγής. Απαντάς στα ελληνικά, σύντομα, μόνο σε JSON με πεδία what_changed, affected_sections (από: purpose, definitions, instructions, dosages, references) και proposed_text (μία παράγραφος αντικατάστασης με αναφορά στην πηγή σε αγκύλες). Δεν επινοείς στοιχεία· αν το απόσπασμα δεν αρκεί, το λες.',
    user: JSON.stringify({ source: sourceLabel, source_change: whatChanged, source_excerpt: String(sourceExcerpt || '').slice(0, 2000), protocol_sections: parts.join('\n\n') }),
  }
}

export function parseDraft(raw: string): { what_changed: string, affected_sections: SectionKey[], proposed_text: string } | null {
  const match = String(raw || '').match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const value = JSON.parse(match[0])
    const proposed = String(value.proposed_text || '').trim().slice(0, 4000)
    if (!proposed) return null
    return {
      what_changed: String(value.what_changed || '').trim().slice(0, 2000),
      affected_sections: (Array.isArray(value.affected_sections) ? value.affected_sections : []).filter((k: string) => (SECTION_KEYS as readonly string[]).includes(k)),
      proposed_text: proposed,
    }
  } catch { return null }
}
