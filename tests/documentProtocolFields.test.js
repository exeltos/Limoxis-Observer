// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { PROTOCOL_KINDS, protocolFieldsFromRow, protocolFieldsToRow, protocolSummary } from '../src/features/documents/protocolFields'
import { createEmptyDocumentDraft } from '../src/features/documents/DocumentForm'
import { loadDocuments } from '../src/features/documents/documentStore'

describe('protocol fields of controlled documents', () => {
  it('reads both columns into the record', () => {
    expect(protocolFieldsFromRow({ protocol_kind: 'medical', clinical_area: 'Μαιευτική' })).toEqual({ protocolKind: 'medical', clinicalArea: 'Μαιευτική' })
    expect(protocolFieldsFromRow({})).toEqual({ protocolKind: '', clinicalArea: '' })
  })

  it('writes them only for protocols, trimmed, with a known kind', () => {
    expect(protocolFieldsToRow({ type: 'protocol', protocolKind: 'medical', clinicalArea: '  Επείγοντα   - ΚΑΡΠΑ ' })).toEqual({ protocol_kind: 'medical', clinical_area: 'Επείγοντα - ΚΑΡΠΑ' })
    expect(protocolFieldsToRow({ type: 'protocol', protocolKind: 'unknown', clinicalArea: '' })).toEqual({ protocol_kind: null, clinical_area: null })
    expect(protocolFieldsToRow({ type: 'policy', protocolKind: 'medical', clinicalArea: 'Μαιευτική' })).toEqual({ protocol_kind: null, clinical_area: null })
    expect(protocolFieldsToRow({ type: 'protocol', clinicalArea: 'x'.repeat(200) }).clinical_area).toHaveLength(120)
  })

  it('summarises kind and area in both languages', () => {
    const doc = { type: 'protocol', protocolKind: 'medical', clinicalArea: 'Μαιευτική' }
    expect(protocolSummary(doc, 'el')).toBe('Ιατρικό πρωτόκολλο · Μαιευτική')
    expect(protocolSummary(doc, 'en')).toBe('Medical protocol · Μαιευτική')
    expect(protocolSummary({ type: 'protocol', clinicalArea: 'Λοιμώξεις' })).toBe('Λοιμώξεις')
    expect(protocolSummary({ type: 'policy', protocolKind: 'medical' })).toBe('')
    expect(Object.keys(PROTOCOL_KINDS.en)).toEqual(Object.keys(PROTOCOL_KINDS.el))
  })

  it('starts empty drafts without protocol fields and seeds demo protocols with them', () => {
    expect(createEmptyDocumentDraft()).toMatchObject({ protocolKind: '', clinicalArea: '' })
    const protocols = loadDocuments().filter(row => row.type === 'protocol')
    expect(protocols.length).toBeGreaterThanOrEqual(2)
    expect(protocols.every(row => row.protocolKind === 'medical' && row.clinicalArea)).toBe(true)
  })
})

describe('protocol fields in the schema and the service', () => {
  it('adds both columns through an idempotent migration and reads/writes them in the service', async () => {
    const fs = await import('node:fs')
    const migration = fs.readFileSync(new URL('../supabase/migrations/20261121110000_controlled_document_protocol_fields.sql', import.meta.url), 'utf8')
    const service = fs.readFileSync(new URL('../src/features/documents/documentService.js', import.meta.url), 'utf8')
    expect(migration).toMatch(/add column if not exists protocol_kind text/)
    expect(migration).toMatch(/add column if not exists clinical_area text/)
    expect(migration).toMatch(/'medical','nursing','administrative','manual'/)
    expect(service).toMatch(/document_type,protocol_kind,clinical_area,/)
    expect(service.match(/protocolFieldsToRow\(/g)).toHaveLength(3)
  })
})
