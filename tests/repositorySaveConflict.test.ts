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
  const calls = { upsert: [], delete: [] }
  function from(table) {
    let mode = null
    let currentDelete = null
    const builder = {
      select() { mode = 'select'; return builder },
      order() { return builder },
      eq(field, value) {
        if (mode === 'delete') currentDelete.eqs.push([field, value])
        return builder
      },
      upsert(records, opts) { calls.upsert.push({ table, records, opts }); return Promise.resolve({ error: null }) },
      delete() {
        mode = 'delete'
        currentDelete = { table, eqs: [] }
        calls.delete.push(currentDelete)
        return builder
      },
      then(resolve) {
        if (mode === 'select') {
          const queue = selectResponses[table] || []
          resolve(queue.length ? queue.shift() : { data: [], error: null })
        } else {
          resolve({ error: null })
        }
      },
    }
    return builder
  }
  return { supabase: { from }, calls }
}

vi.stubEnv('VITE_DATA_BACKEND', 'supabase')
vi.mock('../src/core/config/env', () => ({ hasSupabaseConfig: true }))

async function setup(selectResponses) {
  const { supabase, calls } = makeSupabaseMock(selectResponses)
  vi.doMock('../src/core/supabase/client', () => ({ supabase }))
  const { configureDataEnvironment } = await import('../src/core/data/dataEnvironment')
  configureDataEnvironment({ mode: 'production', organizationId: 'org-1' })
  const repository = await import('../src/core/data/repository')
  return { ...repository, calls }
}

describe('repository.save() detects concurrent conflicts instead of silently overwriting', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', storage())
    vi.resetModules()
  })
  afterEach(() => vi.doUnmock('../src/core/supabase/client'))

  it('rejects the save and performs no writes when the server changed since the last load', async () => {
    const { load, save, calls, DataAccessError } = await setup({
      environmental_standards: [
        { data: [{ record_key: 'a', payload: { id: 'a', value: 1 } }], error: null },
        { data: [{ record_key: 'a', payload: { id: 'a', value: 999 } }], error: null },
      ],
    })

    await load('environmental_standards', { fallback: [], organizationId: 'org-1' })

    let caught = null
    try {
      await save('environmental_standards', [{ id: 'a', value: 2 }], { organizationId: 'org-1' })
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(DataAccessError)
    expect(caught.code).toBe('CONFLICT')
    expect(calls.upsert).toEqual([])
  })

  it('saves normally when the server still matches what was last loaded', async () => {
    const unchanged = { data: [{ record_key: 'a', payload: { id: 'a', value: 1 } }], error: null }
    const { load, save, calls } = await setup({
      environmental_standards: [unchanged, structuredClone(unchanged)],
    })

    await load('environmental_standards', { fallback: [], organizationId: 'org-1' })
    const saved = await save('environmental_standards', [{ id: 'a', value: 2 }], { organizationId: 'org-1' })

    expect(saved).toEqual([{ id: 'a', value: 2 }])
    expect(calls.upsert).toHaveLength(1)
  })

  it('allows the first save of a session through with no prior load to compare against', async () => {
    const { save, calls } = await setup({
      environmental_standards: [{ data: [], error: null }],
    })

    const saved = await save('environmental_standards', [{ id: 'a', value: 1 }], { organizationId: 'org-1' })

    expect(saved).toEqual([{ id: 'a', value: 1 }])
    expect(calls.upsert).toHaveLength(1)
  })
})
