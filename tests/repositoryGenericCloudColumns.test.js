import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function storage() {
  const values = new Map()
  return {
    get length() { return values.size },
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    key: index => [...values.keys()][index] ?? null,
  }
}

function makeSupabaseMock(selectResponses) {
  const selectColumns = {}
  function from(table) {
    const builder = {
      select(columns) { selectColumns[table] = columns; return builder },
      order() { return builder },
      eq() { return builder },
      then(resolve) { resolve(selectResponses[table] || { data: [], error: null }) },
    }
    return builder
  }
  return { supabase: { from }, selectColumns }
}

vi.stubEnv('VITE_DATA_BACKEND', 'supabase')
vi.mock('../src/core/config/env', () => ({ hasSupabaseConfig: true }))

async function setup(selectResponses) {
  const { supabase, selectColumns } = makeSupabaseMock(selectResponses)
  vi.doMock('../src/core/supabase/client', () => ({ supabase }))
  const { configureDataEnvironment } = await import('../src/core/data/dataEnvironment')
  configureDataEnvironment({ mode: 'production', organizationId: 'org-1' })
  const repository = await import('../src/core/data/repository')
  return { ...repository, selectColumns }
}

// Regression test for a real production outage: environmental_standards is
// the one 'rows'-kind cloud table in TABLES, but its Supabase table only
// ever had `record_key`/`payload` (plus organization_id/id/audit columns) —
// no record_type/department_id/employee_user_id. The generic load()
// unconditionally selected those three extra columns for every non-training
// table, so every load (and thus every page view of Environmental
// Standards) failed with "column ... does not exist". Nothing in the
// existing repositorySaveConflict tests caught this because that mock
// ignores whatever string is passed to select() and returns canned data
// regardless — so this test asserts the actual columns requested.
describe('repository.load() only requests generic multi-purpose columns for the training kind', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', storage())
    vi.resetModules()
  })
  afterEach(() => vi.doUnmock('../src/core/supabase/client'))

  it('requests only record_key,payload for a plain rows-kind table like environmental_standards', async () => {
    const { load, selectColumns } = await setup({ environmental_standards: { data: [], error: null } })
    await load('environmental_standards', { fallback: [], organizationId: 'org-1' })
    expect(selectColumns.environmental_standards).toBe('record_key,payload')
  })

  it('still requests the full generic column set for the training kind', async () => {
    const { load, selectColumns } = await setup({ training_records: { data: [], error: null } })
    await load('training_records', { fallback: { programs: [], assignments: [], certificates: [], emailOutbox: [], history: [] }, organizationId: 'org-1' })
    expect(selectColumns.training_records).toBe('record_key,record_type,department_id,employee_user_id,payload')
  })
})
