// @vitest-environment jsdom
import fs from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls = []
const visitRows = [
  { id: 'v-1', employee_id: 'emp-db-1', visit_date: '2026-10-09', visit_type: 'periodic', status: 'scheduled', follow_up_date: null, fitness_status: 'pending', clinical_notes: null, created_at: null, updated_at: null },
  { id: 'v-2', employee_id: 'emp-db-2', visit_date: '2026-09-01', visit_type: 'followUp', status: 'completed', follow_up_date: '2026-12-01', fitness_status: 'fit', clinical_notes: 'Κατάλληλος/η.', created_at: null, updated_at: null },
]

vi.mock('../src/core/config/env', () => ({
  appConfig: { supabaseUrl: 'https://example.invalid', supabaseAnonKey: 'anon', appEnv: 'test', allowDemo: true },
  hasSupabaseConfig: true,
}))

vi.mock('../src/core/supabase/client', () => ({
  supabase: {
    from: table => {
      const query = { table, filters: {} }
      calls.push(query)
      const builder = {
        select: columns => { query.columns = columns; return builder },
        eq: (column, value) => { query.filters[column] = value; return builder },
        order: (column, options) => { query.order = [column, options]; return builder },
        then: resolve => resolve({ data: visitRows, error: null }),
      }
      return builder
    },
  },
}))

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
const { loadAllOccupationalVisitsAsync } = await import('../src/features/employees/employeeSubRecordsService')
const { loadOccupationalVisits } = await import('../src/features/employees/employeeRecordsService')

describe('Occupational Health registry visits', () => {
  beforeEach(() => {
    calls.length = 0
    vi.stubGlobal('localStorage', storage())
  })

  it('reads every visit of the organization from Supabase in production', async () => {
    configureDataEnvironment({ mode: 'production', organizationId: 'org-1' })
    const rows = await loadAllOccupationalVisitsAsync('org-1')
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ table: 'occupational_health_visits', filters: { organization_id: 'org-1' }, order: ['visit_date', { ascending: false }] })
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ id: 'v-1', employeeId: 'emp-db-1', date: '2026-10-09', type: 'periodic', status: 'scheduled', fitStatus: 'pending' })
    expect(rows.filter(x => x.status === 'scheduled')).toHaveLength(1)
  })

  it('waits for the organization instead of showing browser rows in production', async () => {
    configureDataEnvironment({ mode: 'production' })
    expect(await loadAllOccupationalVisitsAsync(null)).toEqual([])
    expect(calls).toHaveLength(0)
  })

  it('keeps the browser sample visits for the sample demo', async () => {
    configureDataEnvironment({ mode: 'demo', organizationId: 'demo-hospital', demoAccountId: 'demo-user-1' })
    const rows = await loadAllOccupationalVisitsAsync('demo-hospital')
    expect(calls).toHaveLength(0)
    expect(rows).toEqual(loadOccupationalVisits())
  })

  it('the page loads its visits through the cloud-aware loader', () => {
    const page = fs.readFileSync('src/features/occupational-health/OccupationalHealthPage.jsx', 'utf8')
    expect(page).toContain('loadAllOccupationalVisitsAsync(tenant?.id)')
    expect(page).not.toContain('useMemo(loadOccupationalVisits')
  })
})
