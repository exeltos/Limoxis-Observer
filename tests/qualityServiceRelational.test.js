// What the Quality services write to the detail tables of 20261116100000,
// against a recording Supabase double.
import { beforeEach, describe, expect, it, vi } from 'vitest'

let queries
let respond
function builder(table) {
  const query = { table, op: 'select', payload: null, filters: [], options: null }
  queries.push(query)
  const chain = {
    select(columns) { query.columns = columns; return chain },
    insert(payload) { query.op = 'insert'; query.payload = payload; return chain },
    update(payload) { query.op = 'update'; query.payload = payload; return chain },
    upsert(payload, options) { query.op = 'upsert'; query.payload = payload; query.options = options || null; return chain },
    delete() { query.op = 'delete'; return chain },
    eq(column, value) { query.filters.push(['eq', column, value]); return chain },
    in(column, values) { query.filters.push(['in', column, values]); return chain },
    order() { return chain },
    range() { return chain },
    maybeSingle() { query.single = true; return chain },
    single() { query.single = true; return chain },
    then(resolve, reject) { return Promise.resolve(respond(query)).then(resolve, reject) },
  }
  return chain
}
vi.mock('../src/core/supabase/client', () => ({ supabase: { from: table => builder(table) } }))
vi.mock('../src/core/data/dataEnvironment', () => ({ isDemoDataEnvironment: () => false }))
vi.mock('../src/core/preview/ownerPreview', () => ({ isOwnerPreview: () => false }))

const { createQualityRecord, saveQualityRecord, addCapaProgress } = await import('../src/features/quality/qualityService')
const { saveSupplier } = await import('../src/features/quality/resources/resourceService')

const ORG = 'org-1'
const CAPA = '44444444-4444-4444-8444-444444444444'
const STEP = '55555555-5555-4555-8555-555555555555'
const writes = (table, op) => queries.filter(q => q.table === table && q.op === op)
const filter = (query, column) => query.filters.find(([, name]) => name === column)?.[2]
let stored

beforeEach(() => {
  queries = []
  stored = {}
  respond = query => {
    if (query.op === 'update' && query.single) return { data: { id: CAPA }, error: null }
    if (query.op === 'select' && stored[query.table]) return { data: stored[query.table], error: null }
    if (query.op === 'select' && query.single) return { data: query.table === 'quality_capa_root_cause_analyses' ? null : { id: CAPA, code: 'CAPA-1', organization_id: ORG }, error: null }
    return { data: query.single ? { id: 'new' } : [], error: null }
  }
})

describe('saving a CAPA', () => {
  const record = { id: 'CAPA-1', dbId: CAPA, title: 'Ενέργεια', status: 'open', updatedAt: '2026-10-01T10:00:00+00:00', history: [], rootCauseAnalysis: null }

  it('updates the CAPA without jsonb, then writes only the changed steps and removes the missing ones', async () => {
    stored.quality_capa_sub_actions = [{ id: STEP, position: 1, title: 'Παλιό', owner_label: null, due_date: null, done: false, done_at: null, done_by_label: null }, { id: 'gone', position: 2, title: 'Χ', owner_label: null, due_date: null, done: false, done_at: null, done_by_label: null }]
    await saveQualityRecord('capas', ORG, { ...record, subActions: [{ id: STEP, title: 'Παλιό', owner: '', dueDate: '', done: false }, { id: 'sa-new', title: 'Νέο', owner: 'Α', dueDate: '2026-11-01', done: false }] })
    const [update] = writes('quality_capa_actions', 'update')
    expect(update.payload).not.toHaveProperty('sub_actions')
    expect(update.payload).not.toHaveProperty('root_cause_analysis')
    expect(filter(update, 'updated_at')).toBe(record.updatedAt)
    const [remove] = writes('quality_capa_sub_actions', 'delete')
    expect(filter(remove, 'id')).toEqual(['gone'])
    const [upsert] = writes('quality_capa_sub_actions', 'upsert')
    expect(upsert.payload).toHaveLength(1)
    expect(upsert.payload[0]).toMatchObject({ capa_id: CAPA, organization_id: ORG, position: 2, title: 'Νέο', owner_label: 'Α', due_date: '2026-11-01' })
    // An unchanged analysis (none before, none now) is not written.
    expect(writes('quality_capa_root_cause_analyses', 'upsert')).toHaveLength(0)
  })

  it('writes a changed analysis: its row, then its whys and causes', async () => {
    await saveQualityRecord('capas', ORG, { ...record, subActions: [], rootCauseAnalysis: { problem: 'Π', whys: ['α', '', 'γ'], causes: { people: ['p'] }, rootCause: 'ρ', updatedBy: 'Ε' } })
    const [analysis] = writes('quality_capa_root_cause_analyses', 'upsert')
    expect(analysis.payload).toMatchObject({ capa_id: CAPA, organization_id: ORG, problem_statement: 'Π', root_cause: 'ρ', updated_by_label: 'Ε' })
    expect(analysis.options).toEqual({ onConflict: 'capa_id' })
    expect(writes('quality_capa_root_cause_whys', 'insert')[0].payload.map(row => row.position)).toEqual([1, 3])
    expect(writes('quality_capa_root_cause_factors', 'insert')[0].payload).toEqual([{ category: 'people', position: 1, description: 'p', capa_id: CAPA, organization_id: ORG }])
  })

  it('adds a progress note as a row of its own', async () => {
    await addCapaProgress(ORG, record, { date: '2026-10-05', note: 'Έγινε', author: 'Α' })
    const [insert] = writes('quality_capa_progress', 'insert')
    expect(insert.payload).toMatchObject({ capa_id: CAPA, organization_id: ORG, entry_date: '2026-10-05', note: 'Έγινε', author_label: 'Α' })
  })
})

describe('reporting an incident', () => {
  it('inserts an anonymous report and its event details without reading them back', async () => {
    const created = await createQualityRecord('incidents', ORG, { title: 'Πτώση', anonymous: true, eventType: 'injury_fall_exposure', fall: { fallType: 'slip', injurySubcategory: 'sharp_object' }, sharp: { tool: 'needle' }, blueCode: { outcome: 'successful' } }, 'user-1')
    expect(created.anonymous).toBe(true)
    const [incident] = writes('quality_incidents', 'insert')
    expect(incident.payload).toMatchObject({ event_type: 'injury_fall_exposure', is_anonymous: true, reported_by: null })
    const [fall] = writes('quality_incident_falls', 'insert')
    expect(fall.payload).toMatchObject({ incident_id: incident.payload.id, organization_id: ORG, fall_type: 'slip' })
    expect(writes('quality_incident_sharps', 'insert')[0].payload).toMatchObject({ incident_id: incident.payload.id, tool: 'needle' })
    expect(writes('quality_incident_blue_codes', 'insert')).toHaveLength(0)
    expect(queries.filter(q => q.op === 'select')).toHaveLength(0)
  })

  it('on save, writes the blocks of the event type and removes the others', async () => {
    await saveQualityRecord('incidents', ORG, { id: 'INC-1', title: 'Μ', status: 'reported', eventType: 'obstetric', obstetric: { subcategory: 'preeclampsia' }, fall: { fallType: 'slip' }, history: [] })
    expect(writes('quality_incidents', 'update')[0].payload.event_type).toBe('obstetric')
    expect(writes('quality_incident_obstetric', 'upsert')[0].payload).toMatchObject({ subcategory: 'preeclampsia', incident_id: CAPA })
    expect(writes('quality_incident_falls', 'delete')).toHaveLength(1)
    expect(writes('quality_incident_falls', 'upsert')).toHaveLength(0)
  })
})

describe('saving an audit checklist', () => {
  it('links a «No» to its finding by id', async () => {
    stored.quality_findings = [{ id: 'finding-uuid', code: 'FND-1' }]
    await saveQualityRecord('audits', ORG, { id: 'AUD-1', title: 'Α', status: 'inProgress', history: [], checklist: [{ id: 'item-1', item: 'ΜΑΠ', itemEn: 'PPE', required: true, answer: 'no', note: '', findingId: 'FND-1' }] })
    const [upsert] = writes('quality_audit_checklist_items', 'upsert')
    expect(upsert.payload[0]).toMatchObject({ audit_id: CAPA, position: 1, item: 'ΜΑΠ', item_en: 'PPE', answer: 'no', finding_id: 'finding-uuid' })
    expect(writes('quality_audits', 'update')[0].payload).not.toHaveProperty('checklist')
  })
})

describe('saving a supplier', () => {
  it('writes its lists to their tables and each evaluation score as a row', async () => {
    const SUPPLIER = '66666666-6666-4666-8666-666666666666'
    respond = query => {
      if (query.op === 'select' && query.table === 'quality_suppliers' && query.single) return { data: { id: SUPPLIER, code: 'SUP-001', name: 'Π', certifications: [], evaluations: [], nonconformities: [] }, error: null }
      return { data: query.single ? { id: SUPPLIER } : [], error: null }
    }
    await saveSupplier(ORG, { id: SUPPLIER, name: 'Προμηθευτής', certifications: [{ id: 'cert-1', type: 'ISO 9001', number: '', issuer: '', expiresOn: '' }], evaluations: [{ id: 'ev-1', evaluatedOn: '2026-01-10', evaluator: '', scores: { quality: 5, delivery: 4, specs: '', documents: '', support: '', price: '' }, notes: '' }], nonconformities: [] })
    expect(writes('quality_suppliers', 'update')[0].payload).not.toHaveProperty('certifications')
    expect(writes('quality_supplier_certifications', 'upsert')[0].payload[0]).toMatchObject({ supplier_id: SUPPLIER, certificate_type: 'ISO 9001' })
    const [evaluation] = writes('quality_supplier_evaluations', 'upsert')
    const [scores] = writes('quality_supplier_evaluation_scores', 'upsert')
    expect(scores.payload.map(row => [row.criterion, row.score, row.weight])).toEqual([['quality', 5, 1], ['delivery', 4, 1]])
    expect(new Set(scores.payload.map(row => row.evaluation_id))).toEqual(new Set([evaluation.payload[0].id]))
  })
})
