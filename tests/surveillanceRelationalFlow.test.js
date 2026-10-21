// The surveillance flow end to end (start → assessment → HAI classification →
// isolation → closing) against an in-memory table double that answers like
// PostgREST: inserts return their rows, «alias:table(columns)» embeds a child
// table's rows. Every value goes to a column or a child row of its own; no JSON
// column (payload, signs_symptoms, risk_factors, criteria_evidence, precautions,
// calculation_snapshot) is written, and the screens read back what they did.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const RETIRED = ['payload', 'signs_symptoms', 'risk_factors', 'criteria_evidence', 'precautions', 'calculation_snapshot', 'organisms']
const CHILD_KEYS = {
  clinical_assessment_findings: 'assessment_id',
  hai_classification_criteria: 'hai_classification_id',
  isolation_episode_precautions: 'isolation_episode_id',
  amr_classification_categories: 'amr_classification_id',
}

let tables
let writes
let seq
const newId = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`

function embedsOf(select = '*') {
  return [...String(select).matchAll(/(\w+):(\w+)\(([^)]*)\)/g)].map(([, alias, table, columns]) => ({ alias, table, columns: columns.split(',') }))
}
function withEmbeds(row, select) {
  const out = { ...row }
  for (const { alias, table, columns } of embedsOf(select)) {
    out[alias] = (tables[table] || []).filter(child => child[CHILD_KEYS[table]] === row.id).map(child => Object.fromEntries(columns.map(c => [c, child[c] ?? null])))
  }
  return out
}

function builder(table) {
  const state = { op: 'select', filters: [], select: '*', single: false, range: null }
  const rows = () => (tables[table] ||= [])
  const matches = row => state.filters.every(([kind, column, value]) => (kind === 'eq' ? row[column] === value : value.includes(row[column])))
  function run() {
    if (state.op === 'insert') {
      const list = (Array.isArray(state.payload) ? state.payload : [state.payload]).map(item => ({ id: newId(), created_at: new Date().toISOString(), ...item }))
      writes.push({ table, op: 'insert', rows: list })
      rows().push(...list)
      const data = list.map(row => withEmbeds(row, state.select))
      return { data: state.single ? data[0] : data, error: null }
    }
    if (state.op === 'update') {
      const hit = rows().filter(matches)
      writes.push({ table, op: 'update', rows: [state.payload] })
      for (const row of hit) Object.assign(row, state.payload)
      const data = hit.map(row => withEmbeds(row, state.select))
      return { data: state.single ? data[0] || null : data, error: null }
    }
    let data = rows().filter(matches).map(row => withEmbeds(row, state.select))
    if (state.range) data = data.slice(state.range[0], state.range[1] + 1)
    return { data: state.single ? data[0] || null : data, error: null }
  }
  const chain = {
    select(columns = '*') { state.select = columns; return chain },
    insert(payload) { state.op = 'insert'; state.payload = payload; return chain },
    update(payload) { state.op = 'update'; state.payload = payload; return chain },
    eq(column, value) { state.filters.push(['eq', column, value]); return chain },
    in(column, values) { state.filters.push(['in', column, values]); return chain },
    order() { return chain },
    range(from, to) { state.range = [from, to]; return chain },
    single() { state.single = true; return chain },
    maybeSingle() { state.single = true; return chain },
    then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject) },
  }
  return chain
}

vi.mock('../src/core/supabase/client', () => ({
  supabase: {
    from: table => builder(table),
    auth: { getUser: async () => ({ data: { user: { id: 'actor-1' } }, error: null }) },
    // create_surveillance_case writes what the database function does: the case and its start event.
    rpc: async (name, args) => {
      if (name !== 'create_surveillance_case') return { data: null, error: { message: `unknown rpc ${name}` } }
      const { data: created } = await builder('surveillance_cases').insert({ organization_id: args.p_organization_id, patient_id: args.p_patient_id, department_id: args.p_department_id, status: 'active', started_at: args.p_started_at, review_due_on: args.p_review_due, room: args.p_room, reason: args.p_reason, reason_en: args.p_reason_en, suspected_source: args.p_suspected_source, admission_id: args.p_admission_id, created_by: 'actor-1' }).select('*').single()
      await builder('surveillance_events').insert({ organization_id: args.p_organization_id, surveillance_case_id: created.id, event_type: 'surveillance_start', event_status: 'completed', occurred_at: args.p_started_at, detail: 'created', created_by: 'actor-1' }).select('*').single()
      return { data: [created], error: null }
    },
  },
}))

const service = await import('../src/features/surveillance/clinicalCloudService')
const { createClinicalRepository } = await import('../src/features/surveillance/clinicalRepository')

const ORG = 'org-1'
beforeEach(() => {
  seq = 0
  writes = []
  tables = {
    departments: [{ id: 'dep-1', organization_id: ORG, name: 'ΜΕΘ', is_active: true }],
    patients: [{ id: 'pat-1', organization_id: ORG, patient_code: 'P-1', first_name: 'Α.', last_name: 'Β.', admission_date: '2026-10-01', status: 'active' }],
  }
})

describe('surveillance flow through the relational tables', () => {
  it('starts, assesses, classifies, isolates and closes a case, and reads every step back', async () => {
    const repo = createClinicalRepository({ isDemo: false, organizationId: ORG, actor: { id: 'actor-1' } })
    const created = await repo.createCase({ recordId: 'pat-1' }, {
      departmentId: 'dep-1', startedAt: '2026-10-02T09:00:00Z', reviewDue: '2026-10-05', room: 'Κλίνη 4',
      reason: 'Πυρετός και θετική αιμοκαλλιέργεια', reasonEn: 'Fever and positive blood culture', suspectedSource: 'bloodstream',
    })
    expect(created).toMatchObject({ status: 'active', reviewDue: '2026-10-05', room: 'Κλίνη 4', reason: 'Πυρετός και θετική αιμοκαλλιέργεια', reasonEn: 'Fever and positive blood culture', suspectedSource: 'bloodstream', isolationDecision: null })

    const record = { ...created, recordId: created.recordId }
    const assessment = await repo.saveAssessment(record, { assessmentType: 'initial', classification: 'under_investigation', signsSymptoms: ['Πυρετός', 'Ρίγος', ''], riskFactors: ['Κεντρικός φλεβικός καθετήρας'], summary: 'Αρχική' })
    expect(assessment).toMatchObject({ signsSymptoms: ['Πυρετός', 'Ρίγος'], riskFactors: ['Κεντρικός φλεβικός καθετήρας'] })
    expect(tables.clinical_assessment_findings.map(row => [row.kind, row.position, row.label])).toEqual([['sign', 1, 'Πυρετός'], ['sign', 2, 'Ρίγος'], ['risk_factor', 1, 'Κεντρικός φλεβικός καθετήρας']])

    const hai = await repo.saveHai(record, { status: 'probable', type: 'CLABSI', definitionSet: 'ECDC', criteriaEvidence: ['clabsi-1', 'clabsi-3'], criteriaMet: true })
    expect(hai.criteriaEvidence).toEqual(['clabsi-1', 'clabsi-3'])

    const isolation = await repo.beginIsolation(record, { precautions: ['contact'], room: 'Θάλαμος 2', reason: 'KPC', reviewDue: '2026-10-06' })
    expect(isolation).toMatchObject({ precautions: ['contact'], status: 'active' })
    const ended = await repo.finishIsolation({ ...record, isolation }, { reason: 'Αρνητικές καλλιέργειες' })
    expect(ended).toMatchObject({ status: 'ended', precautions: ['contact'], endReason: 'Αρνητικές καλλιέργειες' })

    await repo.complete(record, { status: 'resolved', notes: 'Ίαση', date: '2026-10-12' })

    const loaded = await repo.loadCase(created.recordId)
    expect(loaded).toMatchObject({
      status: 'closed', reviewDue: '2026-10-05', room: 'Κλίνη 4', suspectedSource: 'bloodstream',
      assessment: { signsSymptoms: ['Πυρετός', 'Ρίγος'], riskFactors: ['Κεντρικός φλεβικός καθετήρας'] },
      haiClassification: { type: 'CLABSI', criteriaEvidence: ['clabsi-1', 'clabsi-3'] },
      isolation: { status: 'ended', precautions: ['contact'] },
      isolationDecision: { required: true },
      outcome: { status: 'resolved' },
    })
    expect(loaded.timeline.find(item => item.type === 'surveillance_start').detail).toBe('created')

    for (const write of writes) for (const row of write.rows) for (const column of RETIRED) expect(row, `${write.table}.${column}`).not.toHaveProperty(column)
  })

  it('records «isolation not required» on the case and its timeline', async () => {
    const repo = createClinicalRepository({ isDemo: false, organizationId: ORG, actor: { id: 'actor-1' } })
    const created = await repo.createCase({ recordId: 'pat-1' }, { departmentId: 'dep-1', reason: 'Αποικισμός' })
    await repo.setIsolationNotRequired(created)
    const [caseRow] = tables.surveillance_cases
    expect(caseRow).toMatchObject({ isolation_required: false, isolation_decided_by: 'actor-1' })
    expect(tables.surveillance_events.map(row => [row.event_type, row.detail])).toEqual([['surveillance_start', 'created'], ['isolation_not_required', 'no']])
    const loaded = await repo.loadCase(created.recordId)
    expect(loaded.isolationDecision).toEqual({ required: false, decidedAt: caseRow.isolation_decided_at, by: 'actor-1' })
    expect(loaded.timeline.map(item => item.detail)).toEqual(expect.arrayContaining(['created', 'no']))
  })

  it('keeps an edit of the start in the case columns and adds an «updated» start event', async () => {
    const repo = createClinicalRepository({ isDemo: false, organizationId: ORG, actor: { id: 'actor-1' } })
    const created = await repo.createCase({ recordId: 'pat-1' }, { departmentId: 'dep-1', reason: 'Πυρετός', room: 'Κλίνη 1' })
    const updated = await repo.updateCase(created, { room: 'Κλίνη 7', reviewDue: '2026-10-20', suspectedSource: '' })
    expect(updated).toMatchObject({ room: 'Κλίνη 7', reviewDue: '2026-10-20', reason: 'Πυρετός', reasonEn: 'Πυρετός', suspectedSource: '' })
    expect(tables.surveillance_events.map(row => row.detail)).toEqual(['created', 'updated'])
  })

  it('shows imported findings with their values and leaves out risk factors answered «no»', async () => {
    tables.surveillance_cases = [{ id: '00000000-0000-4000-8000-0000000000aa', organization_id: ORG, patient_id: 'pat-1', status: 'closed', started_at: '2025-01-01T00:00:00Z', case_kind: 'infection' }]
    tables.clinical_assessments = [{ id: 'as-1', organization_id: ORG, surveillance_case_id: '00000000-0000-4000-8000-0000000000aa', assessment_type: 'initial', assessed_at: '2025-01-01T00:00:00Z' }]
    tables.clinical_assessment_findings = [
      { assessment_id: 'as-1', kind: 'sign', position: 1, label: 'Πυρετός', value_numeric: 38.5 },
      { assessment_id: 'as-1', kind: 'lab_sign', position: 1, label: 'CRP αυξημένο' },
      { assessment_id: 'as-1', kind: 'risk_factor', position: 2, label: 'Σακχαρώδης διαβήτης', value_boolean: false },
      { assessment_id: 'as-1', kind: 'risk_factor', position: 1, label: 'Ουροκαθετήρας', value_boolean: true, value_text: '12/03/2025' },
    ]
    const [loaded] = await service.loadClinicalCases(ORG)
    expect(loaded.assessment.signsSymptoms).toEqual(['Πυρετός: 38.5', 'CRP αυξημένο'])
    expect(loaded.assessment.riskFactors).toEqual(['Ουροκαθετήρας: 12/03/2025'])
  })
})
