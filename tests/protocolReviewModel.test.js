import { beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import {
  addDaysKey, decisionProblem, documentsWithOpenSuggestions, effectiveStatus, familyHasOpenSuggestion, revisionNoteFor, suggestionCalendarItems,
  suggestionFromRow, suggestionReasonLabel, suggestionSectionLabel, suggestionsForDocument, MAX_REVISION_NOTE,
} from '../src/features/documents/protocolReview/protocolReviewModel'
import { decideProtocolSuggestionAsync, loadProtocolSuggestionsAsync } from '../src/features/documents/protocolReview/protocolReviewService'
import { DEMO_PROTOCOL_SUGGESTIONS } from '../src/features/documents/protocolReview/protocolReviewDemoData'
import { configureDataEnvironment } from '../src/core/data/dataEnvironment'
import { buildCalendarEvents } from '../src/features/calendar/calendarEvents'

const row = (over = {}) => ({ id: 's1', organization_id: 'o1', document_id: 'd1', reason: 'source_changed', source_ref: 'clinical:x', source_label: 'NEWS2 · RCP', what_changed: 'Η πηγή άλλαξε.', affected_sections: ['instructions', 'references', 'bogus'], draft_text: 'Νέα διατύπωση.', draft_citation: 'NEWS2 · RCP', status: 'open', created_at: '2026-10-18T03:13:00Z', ...over })

describe('protocol update suggestions: model', () => {
  it('reads a row and keeps only known sections', () => {
    const s = suggestionFromRow(row())
    expect(s).toMatchObject({ id: 's1', documentId: 'd1', reason: 'source_changed', sourceLabel: 'NEWS2 · RCP', affectedSections: ['instructions', 'references'], status: 'open' })
    expect(suggestionFromRow(null)).toBe(null)
  })

  it('labels reasons and sections in both languages', () => {
    expect(suggestionReasonLabel('review_due', 'el')).toBe('Λήγει η αναθεώρηση')
    expect(suggestionReasonLabel('stale', 'en')).toBe('Old, no review date')
    expect(suggestionSectionLabel('dosages', 'el')).toBe('Δοσολογίες')
  })

  it('treats a postponed suggestion as open from its date', () => {
    expect(effectiveStatus({ status: 'snoozed', snoozedUntil: '2026-11-01' }, '2026-10-19')).toBe('snoozed')
    expect(effectiveStatus({ status: 'snoozed', snoozedUntil: '2026-10-19' }, '2026-10-19')).toBe('open')
    expect(effectiveStatus({ status: 'rejected' }, '2026-10-19')).toBe('rejected')
  })

  it('groups the suggestions of one document version and of a family', () => {
    const list = [suggestionFromRow(row()), suggestionFromRow(row({ id: 's2', status: 'snoozed', snoozed_until: '2026-12-01' })), suggestionFromRow(row({ id: 's3', document_id: 'd2' }))]
    const mine = suggestionsForDocument(list, { dbId: 'd1', id: 'DOC-1' }, '2026-10-19')
    expect(mine.open.map(s => s.id)).toEqual(['s1'])
    expect(mine.snoozed.map(s => s.id)).toEqual(['s2'])
    const keys = documentsWithOpenSuggestions(list, '2026-10-19')
    expect([...keys].sort()).toEqual(['d1', 'd2'])
    expect(familyHasOpenSuggestion({ versions: [{ id: 'DOC-9', dbId: 'd9' }, { id: 'DOC-1', dbId: 'd1' }] }, keys)).toBe(true)
    expect(familyHasOpenSuggestion({ versions: [{ id: 'DOC-9', dbId: 'd9' }] }, keys)).toBe(false)
    expect(familyHasOpenSuggestion({ versions: [{ id: 'DOC-008' }] }, new Set(['DOC-008']))).toBe(true)
  })

  it('prefills the revision notes with the reason, the change and the draft with its citation', () => {
    const s = suggestionFromRow(row())
    const notes = revisionNoteFor(s)
    expect(notes).toContain('Πρόταση ανανέωσης: Άλλαξε πηγή που αναφέρει.')
    expect(notes).toContain('Ενότητες που επηρεάζονται: Οδηγίες, Βιβλιογραφία')
    expect(notes).toContain('Προτεινόμενη διατύπωση: Νέα διατύπωση.')
    expect(notes).toContain('[NEWS2 · RCP]')
    expect(revisionNoteFor(s, { includeDraft: false })).not.toContain('Νέα διατύπωση')
    expect(revisionNoteFor({ ...s, draftText: 'x'.repeat(5000) }).length).toBe(MAX_REVISION_NOTE)
  })

  it('validates each decision', () => {
    const today = '2026-10-19'
    expect(decisionProblem({ decision: 'rejected', reason: ' ', today })).toBe('reason_required')
    expect(decisionProblem({ decision: 'rejected', reason: 'Ισχύει ήδη', today })).toBe(null)
    expect(decisionProblem({ decision: 'snoozed', snoozeUntil: '', today })).toBe('date_required')
    expect(decisionProblem({ decision: 'snoozed', snoozeUntil: today, today })).toBe('date_in_past')
    expect(decisionProblem({ decision: 'snoozed', snoozeUntil: addDaysKey(today, 30), today })).toBe(null)
    expect(decisionProblem({ decision: 'accepted', notes: 'Σημειώσεις', canRevise: false, today })).toBe('revision_unavailable')
    expect(decisionProblem({ decision: 'accepted', notes: '', today })).toBe('notes_required')
    expect(decisionProblem({ decision: 'accepted', notes: 'Σημειώσεις', today })).toBe(null)
    expect(addDaysKey('2026-12-20', 30)).toBe('2027-01-19')
  })

  it('puts open suggestions of the user\'s own protocols in the calendar', () => {
    const documents = [{ id: 'DOC-1', dbId: 'd1', title: 'Π1', ownerId: 'u1', department: 'ΜΕΘ' }, { id: 'DOC-2', dbId: 'd2', title: 'Π2', ownerId: 'u2' }]
    const list = [suggestionFromRow(row()), suggestionFromRow(row({ id: 's3', document_id: 'd2' })), suggestionFromRow(row({ id: 's4', status: 'snoozed', snoozed_until: '2026-11-02' }))]
    const items = suggestionCalendarItems(list, documents, { today: '2026-10-19', ownerId: 'u1' })
    expect(items.map(i => [i.id, i.date, i.state])).toEqual([['psug:s1', '2026-10-19', 'due'], ['psug:s4', '2026-11-02', 'planned']])
    expect(items[0]).toMatchObject({ kind: 'documents', path: '/documents/DOC-1', detail: 'Προτείνεται ανανέωση · Άλλαξε πηγή που αναφέρει' })
    expect(suggestionCalendarItems(list, documents, { today: '2026-10-19' })).toHaveLength(3)
    const events = buildCalendarEvents({ documentFamilies: [{ versions: documents, activePublished: null }], protocolSuggestions: list }, { from: '2026-10-01', to: '2026-11-30', today: '2026-10-19', ownerId: 'u2' })
    expect(events.map(e => e.id)).toEqual(['psug:s3'])
  })
})

describe('protocol update suggestions: demo service', () => {
  beforeEach(() => configureDataEnvironment({ mode: 'demo', demoAccountId: `t-${Math.random()}` }))

  it('ships two demo suggestions on demo protocols', async () => {
    const store = fs.readFileSync(new URL('../src/features/documents/documentStore.js', import.meta.url), 'utf8')
    for (const s of DEMO_PROTOCOL_SUGGESTIONS) {
      expect(store).toMatch(new RegExp(`id:'${s.document_id}',[^\\n]*type:'protocol'`))
    }
    const list = await loadProtocolSuggestionsAsync(null)
    expect(list).toHaveLength(2)
    expect(list.filter(s => s.draftText)).toHaveLength(1)
  })

  it('rejects with a reason and postpones to a date, then hides decided ones', async () => {
    const [first, second] = await loadProtocolSuggestionsAsync(null)
    await expect(decideProtocolSuggestionAsync(null, first, { decision: 'rejected', reason: '' })).rejects.toThrow('PROTOCOL_SUGGESTION_REASON_REQUIRED')
    const rejected = await decideProtocolSuggestionAsync(null, first, { decision: 'rejected', reason: 'Ήδη εφαρμόζεται' }, { id: 'u1' })
    expect(rejected).toMatchObject({ status: 'rejected', rejectionReason: 'Ήδη εφαρμόζεται' })
    const snoozed = await decideProtocolSuggestionAsync(null, second, { decision: 'snoozed', snoozeUntil: '2099-01-01' })
    expect(snoozed).toMatchObject({ status: 'snoozed', snoozedUntil: '2099-01-01' })
    const left = await loadProtocolSuggestionsAsync(null)
    expect(left.map(s => s.status)).toEqual(['snoozed'])
  })

  it('accepts with the revision that was started for it', async () => {
    const [first] = await loadProtocolSuggestionsAsync(null)
    const accepted = await decideProtocolSuggestionAsync(null, first, { decision: 'accepted', revisionDocumentId: 'DOC-009' })
    expect(accepted).toMatchObject({ status: 'accepted', revisionDocumentId: 'DOC-009' })
  })
})

describe('protocol currency review: database and wiring', () => {
  const sql = fs.readFileSync(new URL('../supabase/migrations/20261121120000_protocol_currency_review.sql', import.meta.url), 'utf8')

  it('keeps one open suggestion per protocol, reason and source, and never touches the outbox', () => {
    expect(sql).toMatch(/create unique index if not exists protocol_update_suggestions_one_open[\s\S]*\(document_id, reason, source_ref\) where status in \('open','snoozed'\)/)
    expect(sql).toMatch(/check \(status in \('open','accepted','rejected','snoozed'\)\)/)
    expect(sql).not.toMatch(/insert into public\.notification_outbox/i)
    expect(sql).not.toMatch(/create temp(orary)? table/i)
  })

  it('lets people only read, and decide through the guarded RPC', () => {
    expect(sql).toMatch(/revoke insert, update, delete, truncate on public\.protocol_text_versions, public\.protocol_references, public\.protocol_update_suggestions from authenticated/)
    expect(sql).toMatch(/current_user_has_governance_capability\(v_row\.organization_id, 'manage_documents'\)/)
    expect(sql).toMatch(/PROTOCOL_SUGGESTION_REASON_REQUIRED/)
    expect(sql).toMatch(/cron\.schedule\('limoxis-protocol-review'/)
  })

  it('sends the model only protocol text and the source excerpt', () => {
    const fn = fs.readFileSync(new URL('../supabase/functions/protocol-review/index.ts', import.meta.url), 'utf8')
    expect(fn).not.toMatch(/from\('(patients|patient_[a-z_]+|admissions|surveillance_[a-z_]+)'\)/)
    expect(fn).not.toMatch(/from\('notification_outbox'\)/)
    expect(fn).toMatch(/draftPrompt\(\{ sections: text\.sections/)
  })
})
