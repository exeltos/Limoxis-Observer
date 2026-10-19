// Behavior of the clinical (surveillance) cloud service against a recording
// Supabase double: what each operation writes, to which table, scoped how, and
// by whom. Replaces source-text assertions that pinned the service's formatting.
import { beforeEach, describe, expect, it, vi } from 'vitest'

let queries
let respond
function builder(table) {
  const query = { table, op: 'select', payload: null, filters: [] }
  queries.push(query)
  const chain = {
    select() { return chain },
    insert(payload) { query.op = 'insert'; query.payload = payload; return chain },
    update(payload) { query.op = 'update'; query.payload = payload; return chain },
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
vi.mock('../src/core/supabase/client', () => ({
  supabase: { from: table => builder(table), auth: { getUser: async () => ({ data: { user: { id: 'actor-1' } }, error: null }) } },
}))

const service = await import('../src/features/surveillance/clinicalCloudService')

const writes = (table, op) => queries.filter(q => q.table === table && q.op === op)
const filter = (query, column) => query.filters.find(([, name]) => name === column)?.[2]
const record = { recordId: 'case-1', patientRecordId: 'pat-1', departmentId: 'dep-1' }

beforeEach(() => {
  queries = []
  respond = query => {
    if (query.op === 'insert') return { data: { id: `${query.table}-new`, ...query.payload }, error: null }
    if (query.table === 'departments' && query.single) return { data: { id: 'dep-1' }, error: null }
    return { data: query.single ? null : [], error: null }
  }
})

describe('creating a surveillance case', () => {
  it('opens an active case with what the start records, and its surveillance-start event, both by the signed-in user', async () => {
    await service.createClinicalCase('org-1', 'pat-1', { departmentId: 'dep-1', startedAt: '2026-10-01', reason: 'Πυρετός', reviewDue: '2026-10-04', suspectedSource: 'urinary' })
    const [caseInsert] = writes('surveillance_cases', 'insert')
    expect(caseInsert.payload).toMatchObject({ organization_id: 'org-1', patient_id: 'pat-1', department_id: 'dep-1', status: 'active', created_by: 'actor-1',
      reason: 'Πυρετός', reason_en: 'Πυρετός', review_due_on: '2026-10-04', suspected_source: 'urinary', room: null })
    const [event] = writes('surveillance_events', 'insert')
    expect(event.payload).toMatchObject({ surveillance_case_id: 'surveillance_cases-new', event_type: 'surveillance_start', detail: 'created', created_by: 'actor-1' })
    expect(event.payload).not.toHaveProperty('payload')
  })

  it('accepts only an active department of the same organization', async () => {
    respond = query => (query.table === 'departments' ? { data: null, error: null } : { data: [], error: null })
    await expect(service.createClinicalCase('org-1', 'pat-1', { departmentId: 'dep-x' })).rejects.toThrow('Selected department is not available for this organization.')
    const [check] = queries.filter(q => q.table === 'departments')
    expect(check.filters).toEqual(expect.arrayContaining([['eq', 'organization_id', 'org-1'], ['eq', 'id', 'dep-x'], ['eq', 'is_active', true]]))
    expect(writes('surveillance_cases', 'insert')).toHaveLength(0)
  })
})

describe('laboratory request', () => {
  it('is a request, not a collected specimen', async () => {
    await service.requestLaboratorySample('org-1', record, { type: 'bloodCulture', source: 'peripheral' })
    const [sample] = writes('laboratory_samples', 'insert')
    expect(sample.payload).toMatchObject({ status: 'requested', collected_at: null, received_at: null, requested_by: 'actor-1', surveillance_case_id: 'case-1', patient_id: 'pat-1' })
  })
})

describe('reassessment and completion', () => {
  it('records a reassessment by the signed-in user', async () => {
    await service.addClinicalReassessment('org-1', 'case-1', 'pat-1', { status: 'stable', notes: 'Σταθερός' })
    expect(writes('surveillance_reassessments', 'insert')[0].payload).toMatchObject({ surveillance_case_id: 'case-1', notes: 'Σταθερός', created_by: 'actor-1' })
  })

  it('stores the outcome and closes the case of that organization', async () => {
    await service.completeClinicalCase('org-1', 'case-1', 'pat-1', { status: 'resolved', notes: 'Ίαση' })
    expect(writes('surveillance_outcomes', 'insert')[0].payload).toMatchObject({ outcome: 'resolved', created_by: 'actor-1' })
    const [close] = writes('surveillance_cases', 'update')
    expect(close.payload).toMatchObject({ status: 'closed', closed_by: 'actor-1', close_reason: 'Ίαση' })
    expect([filter(close, 'organization_id'), filter(close, 'id')]).toEqual(['org-1', 'case-1'])
  })
})

describe('cancelling and reopening', () => {
  it('keeps the reason with the status change, scoped to the organization', async () => {
    await service.voidClinicalCase('org-1', 'case-1', 'Λάθος καταχώριση')
    await service.reopenClinicalCase('org-1', 'case-1', 'Νέα στοιχεία')
    const [cancel, reopen] = writes('surveillance_cases', 'update')
    expect(cancel.payload).toEqual({ status: 'cancelled', void_reason: 'Λάθος καταχώριση' })
    expect(reopen.payload).toEqual({ status: 'active', reopen_reason: 'Νέα στοιχεία' })
    for (const update of [cancel, reopen]) expect([filter(update, 'organization_id'), filter(update, 'id')]).toEqual(['org-1', 'case-1'])
  })
})

describe('antimicrobial therapy', () => {
  it('needs stewardship approval for an advanced antibiotic, and records the chosen approval otherwise', async () => {
    await service.addAntimicrobialTherapy('org-1', record, { antimicrobial: 'Meropenem', isAdvancedAntibiotic: true, approvalStatus: 'approved' })
    await service.addAntimicrobialTherapy('org-1', record, { antimicrobial: 'Cefazolin', approvalStatus: 'approved' })
    await service.addAntimicrobialTherapy('org-1', record, { antimicrobial: 'Amoxicillin' })
    expect(writes('antimicrobial_therapies', 'insert').map(q => q.payload.approval_status)).toEqual(['pending', 'approved', 'not_required'])
  })

  it('hydrates each therapy with only its own administrations', async () => {
    respond = query => {
      const rows = {
        surveillance_cases: [{ id: 'case-1', patient_id: 'pat-1', status: 'active', started_at: '2026-10-01T00:00:00Z' }],
        antimicrobial_therapies: [{ id: 'th-1', surveillance_case_id: 'case-1', antimicrobial: 'Meropenem' }, { id: 'th-2', surveillance_case_id: 'case-1', antimicrobial: 'Vancomycin' }],
        antimicrobial_therapy_administrations: [{ id: 'ad-1', therapy_id: 'th-1', status: 'administered' }, { id: 'ad-2', therapy_id: 'th-2', status: 'withheld' }, { id: 'ad-3', therapy_id: 'th-1', status: 'administered' }],
      }[query.table] || []
      return { data: rows, error: null }
    }
    const [loaded] = await service.loadClinicalCases('org-1')
    const administrationsOf = id => loaded.therapy.find(therapy => therapy.id === id).administrations.map(item => item.id)
    expect(administrationsOf('th-1')).toEqual(['ad-1', 'ad-3'])
    expect(administrationsOf('th-2')).toEqual(['ad-2'])
    const administrations = queries.find(q => q.table === 'antimicrobial_therapy_administrations')
    expect(filter(administrations, 'therapy_id')).toEqual(['th-1', 'th-2'])
  })

  it('shows the active isolation, and an isolation with an end date as ended', async () => {
    respond = query => {
      const rows = {
        surveillance_cases: [{ id: 'case-1', patient_id: 'pat-1', status: 'active', started_at: '2026-10-01T00:00:00Z' }, { id: 'case-2', patient_id: 'pat-2', status: 'active', started_at: '2026-10-02T00:00:00Z' }],
        isolation_episodes: [
          { id: 'iso-0', surveillance_case_id: 'case-1', status: 'ended', started_at: '2026-09-01T00:00:00Z', ended_at: '2026-09-05T00:00:00Z' },
          { id: 'iso-1', surveillance_case_id: 'case-1', status: 'active', started_at: '2026-10-01T00:00:00Z', ended_at: null, precaution_rows: [{ position: 1, precaution: 'contactPrecautions' }] },
          { id: 'iso-2', surveillance_case_id: 'case-2', status: 'active', started_at: '2026-10-02T00:00:00Z', ended_at: '2026-10-03T00:00:00Z' },
        ],
      }[query.table] || []
      return { data: rows, error: null }
    }
    const loaded = await service.loadClinicalCases('org-1')
    const byId = Object.fromEntries(loaded.map(row => [row.id, row]))
    expect(byId['case-1'].isolation).toMatchObject({ id: 'iso-1', status: 'active', precautions: ['contactPrecautions'] })
    expect(byId['case-2'].isolation).toMatchObject({ id: 'iso-2', status: 'ended' })
  })
})
