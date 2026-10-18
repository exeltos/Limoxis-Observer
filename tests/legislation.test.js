import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildRegister, changedSince, complianceSummary, filterRegister, hasUnpublished, legislationCapaSource, nextLegislationCode, registerCounts, registerExport, sourceHealth, textFromCandidate, textProblems, unpublishedChanges, NO_FILTERS } from '../src/features/legislation/legislationModel'
import { demoLegislation } from '../src/features/legislation/legislationDemoData'
import { matchedKeywords, newCandidates, normalize, parseFeed, parsePage } from '../supabase/functions/_shared/legislationWatch.ts'
import { legislationDigestEmail, legislationUpdateEmail } from '../supabase/functions/_shared/legislationEmail.ts'

const TODAY = '2026-10-18'
const requirement = (id, text) => ({ id, text })
const version = (textId, n, requirements, changed, extra = {}) => ({ textId, version: n, snapshot: { code: 'LEG-001', title: 'Απόβλητα', kind: 'ministerial_decision', reference: 'ΦΕΚ Β΄ 1537/2012', requirements }, changeNote: extra.note || '', changedRequirements: changed, publishedAt: `2026-0${n}-01T09:00:00Z` })
const V1 = [requirement('a', 'Σχέδιο διαχείρισης'), requirement('b', 'Διαλογή στην πηγή'), requirement('c', 'Μητρώο αποβλήτων')]
const V2 = [V1[0], V1[1], requirement('c', 'Μητρώο αποβλήτων και ΗΜΑ'), requirement('d', 'Εκπαίδευση προσωπικού')]
const history = [version('t1', 1, V1, ['a', 'b', 'c']), version('t1', 2, V2, ['c', 'd'], { note: 'ΗΜΑ' })]

describe('Legislation: the hospital register', () => {
  it('a text the hospital has not decided on is new; one updated after its review asks for a review of what changed', () => {
    expect(buildRegister(history, [], TODAY)[0].state).toBe('new')
    const reviewed = { textId: 't1', applicable: true, acceptedVersion: 1, compliance: { a: { status: 'compliant' }, b: { status: 'compliant' }, c: { status: 'compliant' } } }
    const [entry] = buildRegister(history, [reviewed], TODAY)
    expect(entry.state).toBe('update')
    expect([...entry.changed]).toEqual(['c', 'd'])
    expect(entry.text.version).toBe(2)
    expect(changedSince(history, 2).size).toBe(0)
    // Once reviewed, the requirements decide: «d» was never assessed.
    expect(buildRegister(history, [{ ...reviewed, acceptedVersion: 2 }], TODAY)[0].state).toBe('pending')
    expect(buildRegister(history, [{ ...reviewed, acceptedVersion: 2, compliance: { ...reviewed.compliance, d: { status: 'non_compliant' } } }], TODAY)[0].state).toBe('non_compliant')
    expect(buildRegister(history, [{ ...reviewed, applicable: false }], TODAY)[0].state).toBe('not_applicable')
  })

  it('scores compliance on the requirements that apply, half for partly', () => {
    expect(complianceSummary(V2, { a: { status: 'compliant' }, b: { status: 'partial' }, c: { status: 'not_applicable' } })).toMatchObject({ compliant: 1, partial: 1, not_applicable: 1, unassessed: 1, assessable: 3, percent: 50 })
    expect(complianceSummary([], {}).percent).toBeNull()
  })

  it('counts, filters and exports the register; a late review is flagged', () => {
    const state = demoLegislation()
    const entries = buildRegister(state.versions, state.rows)
    const counts = registerCounts(entries)
    expect(counts).toMatchObject({ newTexts: 1, updates: 1, nonCompliant: 1, reviewLate: 1, applicable: 4 })
    expect(filterRegister(entries, NO_FILTERS)[0].state).toBe('new')
    expect(filterRegister(entries, { ...NO_FILTERS, quick: 'updates' }).map(entry => entry.text.code)).toEqual(['LEG-001'])
    expect(filterRegister(entries, { ...NO_FILTERS, topic: 'food' }).map(entry => entry.text.code)).toEqual(['LEG-003'])
    expect(registerExport(entries, 'el').rows).toHaveLength(5)
  })

  it('a requirement not met opens a corrective action that names the text', () => {
    const source = legislationCapaSource({ code: 'LEG-004', title: 'ISO 9001', reference: 'ΕΛΟΤ EN ISO 9001:2015' }, requirement('q4', 'Αξιολόγηση εξωτερικών παρόχων'), { note: 'Δεν έγινε' })
    expect(source).toMatchObject({ sourceId: 'LEG:LEG-004' })
    expect(source.description).toContain('Δεν έγινε')
    expect(fs.readFileSync('src/features/quality/QualityLists.jsx', 'utf8')).toContain("if(id.startsWith('LEG:'))return 'legislation'")
  })
})

describe('Legislation: the platform library', () => {
  it('knows what is not yet published, and what a publication needs', () => {
    const last = history[1].snapshot
    expect(hasUnpublished(unpublishedChanges({ ...last, topics: [] }, { ...last, topics: [] }))).toBe(false)
    const changed = unpublishedChanges({ ...last, title: 'Νέος', requirements: [...last.requirements.slice(0, 3), requirement('e', 'Νέα')] }, last)
    expect(changed).toMatchObject({ fields: ['title'], requirements: ['e'], removed: ['d'] })
    expect(unpublishedChanges({ requirements: V1 }, null).isNew).toBe(true)
    expect(textProblems({ title: 'Απόβλητα', reference: '', requirements: [requirement('a', '')] })).toEqual(['στοιχεία δημοσίευσης (π.χ. ΦΕΚ)', 'διατύπωση σε κάθε απαίτηση'])
    expect(nextLegislationCode(['LEG-009', 'LEG-010'])).toBe('LEG-011')
  })

  it('starts a text from what the check found, and tells how a source is doing', () => {
    expect(textFromCandidate({ title: 'Κοινή Υπουργική Απόφαση 87338/2026 - ΦΕΚ Β 6275/16-10-2026', url: 'https://x' })).toMatchObject({ reference: 'ΦΕΚ Β 6275/16-10-2026', url: 'https://x' })
    expect([sourceHealth({ active: true, lastCheckedAt: 'x', consecutiveFailures: 0 }), sourceHealth({ active: true, lastCheckedAt: 'x', consecutiveFailures: 2 }), sourceHealth({ active: true, lastCheckedAt: '' }), sourceHealth({ active: false })]).toEqual(['ok', 'failing', 'waiting', 'inactive'])
  })
})

describe('Legislation: the automatic check', () => {
  const feed = `<?xml version="1.0"?><rss><channel><title>Feed</title>
    <item><title><![CDATA[Κοινή Υπουργική Απόφαση για τα Απόβλητα Υγειονομικών Μονάδων]]></title><description><![CDATA[<b>Μέτρα</b> &amp; όροι]]></description><link>https://e.gr/a.html</link><guid>https://e.gr/a.html</guid><pubDate>Sat, 17 Oct 2026</pubDate></item>
    <item><title>Επιδότηση πετρελαίου</title><link>https://e.gr/b.html</link></item></channel></rss>`

  it('reads RSS items and the links of a page on the same site', () => {
    const items = parseFeed(feed)
    expect(items.map(item => item.key)).toEqual(['https://e.gr/a.html', 'https://e.gr/b.html'])
    expect(items[0].excerpt).toBe('Μέτρα & όροι')
    const page = parsePage('<a href="/articles/news/1">Εγκύκλιος για την πρόληψη των λοιμώξεων</a><a href="https://other.gr/x">Εγκύκλιος για την πρόληψη αλλού γραμμένη</a><a href="/menu">Αρχική</a>', 'https://www.moh.gov.gr/articles/news')
    expect(page.map(item => item.url)).toEqual(['https://www.moh.gov.gr/articles/news/1'])
  })

  it('matches keywords without accents or case, and reports only new items after the first check', () => {
    expect(normalize('ΛΟΙΜΏΞΕΙΣ')).toBe('λοιμωξεισ')
    const [item] = parseFeed(feed)
    expect(matchedKeywords(item, ['αποβλητ', 'λεγιονελλ'])).toEqual(['αποβλητ'])
    expect(newCandidates(parseFeed(feed), [], ['αποβλητ'], true).candidates).toEqual([])
    const second = newCandidates(parseFeed(feed), ['https://e.gr/b.html'], ['αποβλητ'], false)
    expect(second.candidates.map(entry => entry.key)).toEqual(['https://e.gr/a.html'])
    expect(second.keys).toEqual(['https://e.gr/a.html', 'https://e.gr/b.html'])
    expect(newCandidates(parseFeed(feed), ['https://e.gr/a.html', 'https://e.gr/b.html'], ['αποβλητ']).candidates).toEqual([])
  })

  it('writes the e-mails: to the hospitals on publication, to the Platform Owner in the morning', () => {
    const update = legislationUpdateEmail({ kind: 'update', title: 'Απόβλητα', code: 'LEG-001', version: 2, changed: 1, changeNote: 'ΗΜΑ <b>', recipientName: 'Μαρία' }, 'https://app/legislation/x')
    expect(update.subject).toBe('Ενημέρωση νομοθεσίας: Απόβλητα')
    expect(update.html).toContain('ΗΜΑ &lt;b&gt;')
    expect(update.text).toContain('https://app/legislation/x')
    const digest = legislationDigestEmail({ items: [{ title: 'ΚΥΑ', url: 'https://e.gr/a', source: 'e-nomothesia', matched: ['αποβλητ'] }], failing: [{ name: 'ΕΟΔΥ', error: 'HTTP 403' }] }, 'https://app/legislation?tab=review')
    expect(digest.subject).toBe('Νομοθεσία: 1 νέο κείμενο προς έλεγχο')
    expect(digest.text).toContain('ΕΟΔΥ (HTTP 403)')
  })

  it('the database keeps the working copies to the Platform Owner and publishes only through legislation_publish', () => {
    const sql = fs.readFileSync('supabase/migrations/20261112100000_legislation.sql', 'utf8')
    expect(sql).toMatch(/create policy legislation_texts_owner[^;]*current_user_is_platform_owner/)
    expect(sql).toContain('grant select on public.legislation_text_versions to authenticated')
    expect(sql).not.toMatch(/grant [^;]*insert[^;]*legislation_text_versions/)
    expect(sql).toMatch(/legislation_publish[\s\S]*current_user_is_platform_owner[\s\S]*notification_outbox/)
    expect(sql).toContain("cron.schedule('limoxis-legislation-digest'")
    const manifest = JSON.parse(fs.readFileSync('supabase/security-definer-manifest.json', 'utf8'))
    expect(JSON.stringify(manifest)).toContain('legislation_publish')
  })
})
