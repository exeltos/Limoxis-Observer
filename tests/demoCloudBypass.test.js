import { beforeEach, describe, expect, it, vi } from 'vitest'

const queries = []

function query(table) {
  queries.push(table)
  // A real Supabase call here would be exactly the live bug: 'demo-hospital' is
  // not a valid uuid, so Postgres itself throws 22P02 "invalid input syntax for
  // type uuid" for any cloud-enabled table. Throwing here makes this test fail
  // loudly if demo mode ever regresses to actually reaching this mock.
  throw new Error(`Unexpected Supabase call for table "${table}" during a demo session`)
}

vi.mock('../src/core/config/env', () => ({ hasSupabaseConfig: true }))
vi.mock('../src/core/supabase/client', () => ({ supabase: { from: query } }))

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

const { configureDataEnvironment } = await import('../src/core/data/dataEnvironment')
const { load, save } = await import('../src/core/data/repository')
const { loadEmployeesAsync, createEmployeeAsync } = await import('../src/features/employees/employeeService')

describe('demo sessions never reach cloud-enabled tables', () => {
  beforeEach(() => {
    queries.splice(0)
    vi.stubGlobal('localStorage', storage())
    configureDataEnvironment({ mode: 'demo', organizationId: 'demo-hospital' })
  })

  it('repository.load() stays local for a cloud-enabled table in demo mode', async () => {
    const seed = [{ id: 'demo-training' }]
    const result = await load('training_records', { fallback: seed, organizationId: 'demo-hospital' })
    expect(result).toEqual(seed)
    expect(queries).toEqual([])
  })

  it('repository.save() stays local for a cloud-enabled table in demo mode', async () => {
    const result = await save('environmental_standards', [{ id: 'demo-standard' }], { organizationId: 'demo-hospital' })
    expect(result).toEqual([{ id: 'demo-standard' }])
    expect(queries).toEqual([])
  })

  it('employeeService.loadEmployeesAsync() stays local in demo mode', async () => {
    const result = await loadEmployeesAsync('demo-hospital')
    expect(Array.isArray(result)).toBe(true)
    expect(queries).toEqual([])
  })

  it('employeeService.createEmployeeAsync() stays local in demo mode', async () => {
    const result = await createEmployeeAsync('demo-hospital', { id: 'EMP-DEMO', firstName: 'Demo', lastName: 'User', employmentStatus: 'active' })
    expect(result.id).toBe('EMP-DEMO')
    expect(queries).toEqual([])
  })
})
