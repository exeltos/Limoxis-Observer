import { describe, expect, it } from 'vitest'
import {
  clinicalSourceTerms, draftPrompt, evaluateProtocol, extractProtocolReferences, fold, hasTextLayer, headingOf, legislationKeys,
  newFindings, parseDraft, splitProtocolSections, textCitesClinicalSource,
} from '../supabase/functions/_shared/protocolReview.ts'

const SAMPLE = `ΠΡΩΤΟΚΟΛΛΟ ΑΝΤΙΜΕΤΩΠΙΣΗΣ ΣΗΨΗΣ
1. Σκοπός
Η έγκαιρη αναγνώριση της σήψης στους ενήλικες ασθενείς.
2. Ορισμοί
Σήψη: δυσλειτουργία οργάνων λόγω απορρυθμισμένης απάντησης.
3. Διαδικασία
Υπολογισμός NEWS2 σε κάθε λήψη ζωτικών σημείων.
Χορήγηση κρυσταλλοειδών 30 ml/kg εντός 3 ωρών.
4. Βιβλιογραφία
Surviving Sepsis Campaign: international guidelines for adults, 2021.
ΕΟΔΥ, Οδηγίες για τις λοιμώξεις, 2019.
Ν. 3850/2010 (ΦΕΚ Α΄ 84/02.06.2010) Κύρωση του Κώδικα νόμων για την υγεία και την ασφάλεια των εργαζομένων.
Κανονισμός (ΕΕ) 2016/679 και WHO guidance 2022.`

describe('protocol text: sections', () => {
  it('folds Greek accents and final sigma', () => {
    expect(fold('Σκοπός  ΚΑΙ Πεδίο')).toBe('σκοποσ και πεδιο')
  })

  it('recognises numbered headings in Greek and English', () => {
    expect(headingOf('1. Σκοπός')).toBe('purpose')
    expect(headingOf('2.1 ΟΡΙΣΜΟΙ:')).toBe('definitions')
    expect(headingOf('Βιβλιογραφικές αναφορές')).toBe('references')
    expect(headingOf('Δοσολογία')).toBe('dosages')
    expect(headingOf('References')).toBe('references')
    expect(headingOf('Υπολογισμός NEWS2 σε κάθε λήψη ζωτικών σημείων.')).toBe(null)
  })

  it('splits the text into the five sections and collects dose lines', () => {
    const s = splitProtocolSections(SAMPLE)
    expect(s.purpose).toContain('έγκαιρη αναγνώριση')
    expect(s.definitions).toContain('Σήψη:')
    expect(s.instructions).toContain('NEWS2')
    expect(s.instructions).toContain('ΠΡΩΤΟΚΟΛΛΟ')
    expect(s.dosages).toContain('30 ml/kg')
    expect(s.references).toContain('Surviving Sepsis')
  })

  it('treats a PDF without letters as a scan', () => {
    expect(hasTextLayer('', 3)).toBe(false)
    expect(hasTextLayer('12 34 \n 5', 1)).toBe(false)
    expect(hasTextLayer(SAMPLE, 1)).toBe(true)
  })
})

describe('protocol text: references', () => {
  const refs = extractProtocolReferences(SAMPLE, { now: new Date('2026-10-19T00:00:00Z') })
  const keys = refs.map(r => r.key)

  it('finds the organisations it cites, with the year', () => {
    expect(keys).toEqual(expect.arrayContaining(['org:eody', 'org:who', 'org:sccm']))
    expect(refs.find(r => r.key === 'org:eody')).toMatchObject({ label: 'ΕΟΔΥ', year: 2019, section: 'references' })
    expect(refs.find(r => r.key === 'org:who').year).toBe(2022)
  })

  it('finds laws, ΦΕΚ and EU acts', () => {
    expect(keys).toEqual(expect.arrayContaining(['law:3850/2010', 'fek:α:84/2010', 'eu:2016/679']))
    expect(refs.find(r => r.key === 'law:3850/2010')).toMatchObject({ kind: 'legislation', label: 'Ν. 3850/2010', year: 2010 })
  })

  it('does not take the English word «who» or a Greek word ending in ν for a citation', () => {
    const plain = extractProtocolReferences('Patients who need care.\nΤον ασθενή τον 2010/2011 μήνα.')
    expect(plain.map(r => r.key)).toEqual([])
  })

  it('reads a ΦΕΚ written with a Latin B and in the 388/Β/2014 order', () => {
    expect(extractProtocolReferences('ΦΕΚ B 388/18.02.2014').map(r => r.key)).toEqual(['fek:β:388/2014'])
    expect(extractProtocolReferences('ΦΕΚ 388/Β/2014').map(r => r.key)).toEqual(['fek:β:388/2014'])
  })

  it('derives the same keys from a legislation library entry', () => {
    expect(legislationKeys({ code: 'LEG-005', reference: 'Ν. 3850/2010 · ΦΕΚ Α΄ 84/02.06.2010' })).toEqual(expect.arrayContaining(['law:3850/2010', 'fek:α:84/2010']))
    expect(legislationKeys({ reference: 'Κανονισμός (ΕΕ) 2016/679 · Ν. 4624/2019 (ΦΕΚ Α΄ 137/2019)' })).toEqual(expect.arrayContaining(['eu:2016/679', 'law:4624/2019', 'alias:gdpr']))
    expect(legislationKeys({ reference: 'ΕΛΟΤ EN ISO 9001:2015' })).toEqual(['iso:9001'])
    expect(evaluateProtocol({ doc: { id: 'd', status: 'published', effective_date: '2025-01-01' }, text: 'Σύμφωνα με τον ΓΚΠΔ.', today: '2026-10-19', legislationChanges: [{ text: { id: 'g' }, keys: ['alias:gdpr'], triggerKey: 'g:v2', changedAt: '2026-02-01', summary: 'x', excerpt: '' }] })).toHaveLength(1)
  })
})

describe('protocol text: clinical sources', () => {
  it('matches a source by name or short code, respecting the adult / paediatric qualifier', () => {
    const text = fold(SAMPLE)
    expect(textCitesClinicalSource(text, { source_key: 'news2', name: 'NEWS2' })).toBe('news2')
    expect(textCitesClinicalSource(text, { source_key: 'ssc-adult', name: 'Surviving Sepsis Campaign — Adult' })).toBe('surviving sepsis campaign')
    expect(textCitesClinicalSource(text, { source_key: 'ssc-pediatric', name: 'Surviving Sepsis Campaign — Pediatric' })).toBe(null)
    expect(textCitesClinicalSource(text, { source_key: 'gcs', name: 'Glasgow Coma Scale' })).toBe(null)
    expect(clinicalSourceTerms({ source_key: 'pews', name: 'UK Paediatric Early Warning Systems' }).terms).toContain('pews')
  })
})

describe('comparison', () => {
  const sections = splitProtocolSections(SAMPLE)
  const references = extractProtocolReferences(SAMPLE)
  const doc = { id: 'd1', organization_id: 'o1', status: 'published', effective_date: '2022-01-10', review_date: null }
  const today = '2026-10-19'

  it('flags an old protocol without a review date as stale', () => {
    const findings = evaluateProtocol({ doc: { ...doc, effective_date: '2020-05-01' }, sections, references, text: SAMPLE, today })
    expect(findings.map(f => f.reason)).toEqual(['stale'])
    expect(findings[0]).toMatchObject({ trigger_key: 'stale:2020-05-01', source_ref: '' })
    expect(findings[0].affected_sections).toEqual(['purpose', 'definitions', 'instructions', 'dosages', 'references'])
    expect(evaluateProtocol({ doc: { ...doc, effective_date: '2024-05-01' }, sections, today })).toEqual([])
  })

  it('flags a review date that has passed or falls within 60 days', () => {
    expect(evaluateProtocol({ doc: { ...doc, review_date: '2026-12-01' }, today })[0]).toMatchObject({ reason: 'review_due', details: { days: 43 } })
    expect(evaluateProtocol({ doc: { ...doc, review_date: '2026-09-01' }, today })[0].what_changed).toContain('έχει παρέλθει')
    expect(evaluateProtocol({ doc: { ...doc, review_date: '2027-06-01' }, today })).toEqual([])
  })

  it('skips drafts, superseded and archived versions', () => {
    for (const status of ['draft', 'review', 'superseded', 'archived']) expect(evaluateProtocol({ doc: { ...doc, status, review_date: '2026-01-01' }, today })).toEqual([])
  })

  it('flags a cited clinical source that changed after the protocol took effect', () => {
    const source = { id: 's1', source_key: 'news2', name: 'NEWS2', authority: 'Royal College of Physicians', source_url: 'https://example.org/news2' }
    const findings = evaluateProtocol({ doc, sections, references, text: SAMPLE, today, clinicalChanges: [
      { source, historyId: 'h-old', checkedAt: '2021-01-01T00:00:00Z' },
      { source, historyId: 'h1', checkedAt: '2026-03-02T08:00:00Z', note: 'Νέα έκδοση' },
      { source, historyId: 'h2', checkedAt: '2026-05-02T08:00:00Z' },
    ] })
    const f = findings.find(x => x.reason === 'source_changed')
    expect(f).toMatchObject({ source_kind: 'clinical_source', source_ref: 'clinical:s1', trigger_key: 'clinical:h2', source_url: 'https://example.org/news2' })
    expect(f.affected_sections).toEqual(['instructions', 'references'])
  })

  it('flags cited legislation that was updated, by law number', () => {
    const change = { text: { id: 't1', code: 'LEG-005', reference: 'Ν. 3850/2010' }, keys: ['law:3850/2010'], triggerKey: 'legislation:t1:v2', changedAt: '2026-06-01T00:00:00Z', summary: 'Η νομοθεσία ενημερώθηκε.', excerpt: 'Νέα απαίτηση' }
    const findings = evaluateProtocol({ doc, sections, references, text: SAMPLE, today, legislationChanges: [change, { ...change, text: { id: 't2' }, keys: ['law:1/1999'], triggerKey: 'x:t2' }] }).filter(f => f.reason === 'source_changed')
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ reason: 'source_changed', source_kind: 'legislation', source_ref: 'legislation:t1', source_excerpt: 'Νέα απαίτηση' })
    expect(findings[0].affected_sections).toContain('references')
    // A change before the protocol took effect is already in it.
    expect(evaluateProtocol({ doc, sections, references, text: SAMPLE, today, legislationChanges: [{ ...change, changedAt: '2021-01-01' }] }).filter(f => f.reason === 'source_changed')).toEqual([])
  })

  it('keeps one open suggestion per protocol, reason and source and never repeats a decided change', () => {
    const findings = [
      { reason: 'stale', source_ref: '', trigger_key: 'stale:2020-05-01' },
      { reason: 'source_changed', source_ref: 'clinical:s1', trigger_key: 'clinical:h2' },
      { reason: 'source_changed', source_ref: 'clinical:s2', trigger_key: 'clinical:h9' },
      { reason: 'source_changed', source_ref: 'clinical:s2', trigger_key: 'clinical:h10' },
    ]
    const existing = [
      { document_id: 'd1', reason: 'stale', source_ref: '', trigger_key: 'stale:2020-05-01', status: 'rejected' },
      { document_id: 'd1', reason: 'source_changed', source_ref: 'clinical:s1', trigger_key: 'clinical:h1', status: 'snoozed' },
    ]
    expect(newFindings('d1', findings, existing).map(f => f.trigger_key)).toEqual(['clinical:h9'])
    expect(newFindings('d2', findings, existing)).toHaveLength(3)
  })
})

describe('drafting', () => {
  it('sends only the affected sections, capped, and the source excerpt', () => {
    const sections = { purpose: 'α'.repeat(5000), instructions: 'β'.repeat(5000), references: 'γ' }
    const prompt = draftPrompt({ sections, affected: ['instructions', 'references'], sourceLabel: 'NEWS2', sourceExcerpt: 'x'.repeat(3000), whatChanged: 'Άλλαξε', maxChars: 1200 })
    const user = JSON.parse(prompt.user)
    expect(user.protocol_sections).not.toContain('α')
    expect(user.protocol_sections.length).toBeLessThan(1300)
    expect(user.source_excerpt).toHaveLength(2000)
    expect(Object.keys(user)).toEqual(['source', 'source_change', 'source_excerpt', 'protocol_sections'])
  })

  it('reads the JSON answer and drops unknown sections', () => {
    expect(parseDraft('```json\n{"what_changed":"Νέο όριο","affected_sections":["dosages","other"],"proposed_text":"Χορηγούνται 30 ml/kg [NEWS2]"}\n```')).toEqual({ what_changed: 'Νέο όριο', affected_sections: ['dosages'], proposed_text: 'Χορηγούνται 30 ml/kg [NEWS2]' })
    expect(parseDraft('no json')).toBe(null)
    expect(parseDraft('{"proposed_text":""}')).toBe(null)
  })
})
