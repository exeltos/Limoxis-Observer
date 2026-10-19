import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { REQUIRED_BY, licenceFieldsFromRow, licenceFieldsToRow, licenceSummary, renewalLabel, toggleRequiredBy, documentTypeSummary } from '../src/features/documents/licenceFields'
import { createEmptyDocumentDraft, DOCUMENT_TYPES } from '../src/features/documents/DocumentForm'
import { buildCalendarEvents } from '../src/features/calendar/calendarEvents'

describe('licence fields of controlled documents', () => {
  it('reads renewal and required-by into the record, known keys only, in a fixed order', () => {
    expect(licenceFieldsFromRow({ renewal_months: 12, required_by: ['iso9001', 'legislation'] })).toEqual({ renewalMonths: 12, requiredBy: ['legislation', 'iso9001'] })
    expect(licenceFieldsFromRow({ required_by: ['legislation', 'bogus', 'legislation'] })).toEqual({ renewalMonths: '', requiredBy: ['legislation'] })
    expect(licenceFieldsFromRow({})).toEqual({ renewalMonths: '', requiredBy: [] })
  })

  it('writes them only for licences, dropping values the database would refuse', () => {
    expect(licenceFieldsToRow({ type: 'licence', renewalMonths: '12', requiredBy: ['iso9001', 'legislation'] })).toEqual({ renewal_months: 12, required_by: ['legislation', 'iso9001'] })
    expect(licenceFieldsToRow({ type: 'licence', renewalMonths: '0', requiredBy: [] })).toEqual({ renewal_months: null, required_by: null })
    expect(licenceFieldsToRow({ type: 'licence', renewalMonths: '1.5' }).renewal_months).toBeNull()
    expect(licenceFieldsToRow({ type: 'licence', renewalMonths: '241' }).renewal_months).toBeNull()
    expect(licenceFieldsToRow({ type: 'form', renewalMonths: 12, requiredBy: ['legislation'] })).toEqual({ renewal_months: null, required_by: null })
  })

  it('toggles a required-by key', () => {
    expect(toggleRequiredBy([], 'iso9001')).toEqual(['iso9001'])
    expect(toggleRequiredBy(['iso9001'], 'legislation')).toEqual(['legislation', 'iso9001'])
    expect(toggleRequiredBy(['legislation', 'iso9001'], 'legislation')).toEqual(['iso9001'])
  })

  it('summarises renewal and requirement in both languages', () => {
    expect(renewalLabel(12)).toBe('Ανανέωση κάθε χρόνο')
    expect(renewalLabel(60, 'en')).toBe('Renewal every 5 years')
    expect(renewalLabel(6)).toBe('Ανανέωση κάθε 6 μήνες')
    expect(renewalLabel('')).toBe('')
    const doc = { type: 'licence', renewalMonths: 12, requiredBy: ['legislation', 'iso9001'] }
    expect(licenceSummary(doc)).toBe('Ανανέωση κάθε χρόνο · Νομοθεσία, ISO 9001')
    expect(licenceSummary(doc, 'en')).toBe('Renewal every year · Legislation, ISO 9001')
    expect(licenceSummary({ type: 'policy', renewalMonths: 12 })).toBe('')
    expect(documentTypeSummary(doc)).toBe('Ανανέωση κάθε χρόνο · Νομοθεσία, ISO 9001')
    expect(documentTypeSummary({ type: 'protocol', protocolKind: 'medical', clinicalArea: 'Μαιευτική' })).toBe('Ιατρικό πρωτόκολλο · Μαιευτική')
    expect(Object.keys(REQUIRED_BY.en)).toEqual(Object.keys(REQUIRED_BY.el))
  })

  it('offers the type in the form and starts empty drafts without licence values', () => {
    expect(DOCUMENT_TYPES.el.licence).toBe('Άδεια / Πιστοποιητικό')
    expect(DOCUMENT_TYPES.en.licence).toBe('Licence / certificate')
    expect(DOCUMENT_TYPES.el.form).toBe('Έντυπο')
    expect(createEmptyDocumentDraft()).toMatchObject({ renewalMonths: '', requiredBy: [] })
  })

  it('shows a licence expiry in the calendar as an expiry, overdue once past', () => {
    const events = buildCalendarEvents({
      documentFamilies: [
        { root: { id: 'DOC-11' }, activePublished: { id: 'DOC-11', title: 'Άδεια λειτουργίας', type: 'licence', version: '1.0', reviewDate: '2026-10-01' } },
        { root: { id: 'DOC-1' }, activePublished: { id: 'DOC-1', title: 'Πολιτική', type: 'policy', version: '1.0', reviewDate: '2026-11-01' } },
      ],
    }, { today: '2026-10-19' })
    const licence = events.find(event => event.id === 'doc:DOC-11'), policy = events.find(event => event.id === 'doc:DOC-1')
    expect(licence.detail).toMatch(/^Λήξη · DOC-11/)
    expect(licence.state).toBe('overdue')
    expect(policy.detail).toMatch(/^Αναθεώρηση · DOC-1/)
  })
})

describe('licence fields in the schema, the service and the demo', () => {
  it('adds both columns through an idempotent migration and reads/writes them in the service', () => {
    const migration = fs.readFileSync(new URL('../supabase/migrations/20261121130000_controlled_document_licence_fields.sql', import.meta.url), 'utf8')
    const service = fs.readFileSync(new URL('../src/features/documents/documentService.js', import.meta.url), 'utf8')
    expect(migration).toMatch(/add column if not exists renewal_months integer/)
    expect(migration).toMatch(/add column if not exists required_by text\[\]/)
    expect(migration).toMatch(/'legislation','iso9001','iso15189','accreditation','contract','other'/)
    expect(Object.keys(REQUIRED_BY.el).every(key => migration.includes(`'${key}'`))).toBe(true)
    expect(service).toMatch(/renewal_months,required_by,/)
    expect(service.match(/licenceFieldsToRow\(/g)).toHaveLength(3)
  })

  it('seeds demo forms and licences, every licence with an issue date, an expiry and a renewal', () => {
    const store = fs.readFileSync(new URL('../src/features/documents/documentStore.js', import.meta.url), 'utf8')
    expect((store.match(/type:'form',/g) || []).length).toBeGreaterThanOrEqual(2)
    const licences = store.split(/\n {2}\{\n/).filter(block => block.includes("type:'licence'"))
    expect(licences.length).toBeGreaterThanOrEqual(2)
    expect(licences.every(block => /renewalMonths:\d+/.test(block) && /effectiveDate:'\d{4}-\d{2}-\d{2}'/.test(block) && /reviewDate:'\d{4}-\d{2}-\d{2}'/.test(block))).toBe(true)
  })
})
