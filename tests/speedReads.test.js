// @vitest-environment jsdom
// Screens slow to show data: fewer and narrower reads (20261128500000).
import fs from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'

const read = path => fs.readFileSync(path, 'utf8')
const migration = read('supabase/migrations/20261128500000_speed_reads.sql')
const flagsFix = read('supabase/migrations/20261128500100_patient_infection_flags_single_pass.sql')
const notifications = read('src/core/notifications/NotificationContext.jsx')
const surveillance = read('src/features/surveillance/SurveillanceCanonicalPage.jsx')
const auth = read('src/core/auth/AuthContext.jsx')

describe('database reads', () => {
  it('adds the two reads as SECURITY INVOKER functions for signed-in users only', () => {
    for (const name of ['control_recent_executions', 'patient_infection_flags']) {
      expect(migration).toContain(`create or replace function public.${name}(`)
      expect(migration).toContain(`revoke all on function public.${name}(`)
    }
    const sql = [migration, flagsFix].join('\n').split('\n').filter(line => !line.trim().startsWith('--')).join('\n')
    expect(sql).not.toContain('security definer')
    expect(flagsFix).toContain('distinct on (s.surveillance_case_id)')
  })

  it('evaluates auth.uid() once per statement in recycle_bin_insert', () => {
    expect(migration).toContain('alter policy recycle_bin_insert on public.recycle_bin')
    expect(migration).toContain('deleted_by = (select auth.uid())')
  })
})

describe('app shell reads', () => {
  it('runs the bell and the e-mail outbox after first paint, on the visible-page tick', () => {
    expect(notifications).toContain('export function whenIdle(task)')
    expect(notifications).toContain('return whenIdle(()=>void processNotificationOutboxAsync(tenant.id).catch(()=>{}))},[isDemo,tenant?.id,dataTick])')
    expect(notifications).not.toContain('[isDemo,tenant?.id,clock])')
    expect(notifications).toContain('loadExpiryProgramme(tenant.id)')
    expect(notifications).toContain('loadBirthdayEmployeesAsync')
    expect(notifications).not.toContain('useEmployeesData')
  })

  it('reads the demo access alongside the profile', () => {
    expect(auth.indexOf('const demoAccessRead=')).toBeLessThan(auth.indexOf(".from('profiles')"))
  })

  it('surveillance reads the laboratory once and with the patients', () => {
    expect(surveillance).toContain('useLaboratoryRegistry({ enabled: isDemo })')
    expect(surveillance.indexOf('const rest =')).toBeLessThan(surveillance.indexOf('const roster = await loadPatients'))
  })
})

describe('whenIdle', () => {
  afterEach(() => { vi.useRealTimers(); delete window.requestIdleCallback })

  it('waits for the idle callback, or a short timer without one, and can be cancelled', async () => {
    const { whenIdle } = await import('../src/core/notifications/NotificationContext')
    vi.useFakeTimers()
    const task = vi.fn()
    whenIdle(task)
    expect(task).not.toHaveBeenCalled()
    vi.advanceTimersByTime(250)
    expect(task).toHaveBeenCalledTimes(1)
    const cancelled = vi.fn()
    whenIdle(cancelled)()
    vi.advanceTimersByTime(250)
    expect(cancelled).not.toHaveBeenCalled()
    let idle
    window.requestIdleCallback = callback => { idle = callback; return 1 }
    const viaIdle = vi.fn()
    whenIdle(viaIdle)
    idle()
    expect(viaIdle).toHaveBeenCalledTimes(1)
  })
})

describe('employees cache', () => {
  it('shares one read per organization until it expires, is cleared or asked fresh', async () => {
    const { cachedEmployees, invalidateEmployeesCache, EMPLOYEES_CACHE_MS } = await import('../src/features/employees/employeesCache')
    invalidateEmployeesCache()
    const load = vi.fn(async () => [{ id: 'E1' }])
    await Promise.all([cachedEmployees('org-1', load), cachedEmployees('org-1', load)])
    expect(load).toHaveBeenCalledTimes(1)
    await cachedEmployees('org-2', load)
    expect(load).toHaveBeenCalledTimes(2)
    await cachedEmployees('org-1', load, { now: Date.now() + EMPLOYEES_CACHE_MS + 1 })
    expect(load).toHaveBeenCalledTimes(3)
    await cachedEmployees('org-1', load, { fresh: true })
    expect(load).toHaveBeenCalledTimes(4)
    invalidateEmployeesCache('org-1')
    await cachedEmployees('org-1', load)
    expect(load).toHaveBeenCalledTimes(5)
    const failing = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue([])
    await expect(cachedEmployees('org-3', failing)).rejects.toThrow('down')
    await cachedEmployees('org-3', failing)
    expect(failing).toHaveBeenCalledTimes(2)
  })

  it('is cleared by every employee save', () => {
    const service = read('src/features/employees/employeeService.js')
    expect(service.match(/invalidateEmployeesCache\(organizationId\)/g)).toHaveLength(4)
    expect(read('src/features/employees/employeePhotoService.js')).toContain('invalidateEmployeesCache(organizationId)')
  })
})

describe('cloud loaders (mocked client)', () => {
  afterEach(() => { vi.resetModules(); vi.doUnmock('../src/core/supabase/client'); vi.doUnmock('../src/core/data/dataEnvironment') })

  function client(calls, rows = {}) {
    const builder = table => {
      const call = { table, filters: [] }
      calls.push(call)
      const chain = {}
      for (const method of ['select', 'eq', 'neq', 'in', 'not', 'order', 'range']) chain[method] = (...args) => { call.filters.push([method, ...args]); return chain }
      chain.then = (resolve, reject) => Promise.resolve({ data: rows[table] || [], error: null }).then(resolve, reject)
      return chain
    }
    return {
      supabase: {
        from: builder,
        rpc: (name, args) => { calls.push({ table: `rpc:${name}`, args }); return Promise.resolve({ data: rows[`rpc:${name}`] || [], error: null }) },
      },
    }
  }

  it('patient flags come from patient_infection_flags in one request', async () => {
    const calls = []
    vi.doMock('../src/core/supabase/client', () => client(calls, { 'rpc:patient_infection_flags': [{ patient_id: 'p1', classification: 'MDR', organism: 'K. pneumoniae', since: '2026-08-01T00:00:00+00:00' }] }))
    const { loadPatientInfectionFlags } = await import('../src/features/patients/patientInfectionFlagsService')
    expect(await loadPatientInfectionFlags('org-1')).toEqual({ p1: { resistance: { classification: 'MDR', organism: 'K. pneumoniae', since: '2026-08-01T00:00:00+00:00' }, isolation: null } })
    expect(calls).toEqual([{ table: 'rpc:patient_infection_flags', args: { p_organization_id: 'org-1' } }])
  })

  it('birthdays read only active employees with a birth date, in a few columns', async () => {
    const calls = []
    vi.doMock('../src/core/supabase/client', () => client(calls, { employees: [{ id: 'db-1', employee_code: 'E1', first_name: 'Άννα', last_name: 'Ιωάννου', employment_status: 'active', birth_date: '1990-10-19' }] }))
    vi.doMock('../src/core/data/dataEnvironment', () => ({ isDemoDataEnvironment: () => false }))
    vi.doMock('../src/core/config/env', () => ({ hasSupabaseConfig: true }))
    const { loadBirthdayEmployeesAsync } = await import('../src/features/employees/employeeService')
    const rows = await loadBirthdayEmployeesAsync('org-1')
    expect(rows).toEqual([expect.objectContaining({ id: 'E1', firstName: 'Άννα', lastName: 'Ιωάννου', birthDate: '1990-10-19', employmentStatus: 'active' })])
    expect(calls[0].filters).toEqual([
      ['select', 'id,employee_code,first_name,first_name_en,last_name,last_name_en,employment_status,birth_date'],
      ['eq', 'organization_id', 'org-1'],
      ['eq', 'employment_status', 'active'],
      ['not', 'birth_date', 'is', null],
    ])
    vi.doUnmock('../src/core/config/env')
  })

  it('an employee record reads only the samples of its own surveillance records', async () => {
    const calls = []
    vi.doMock('../src/core/supabase/client', () => client(calls))
    const { loadEmployeeSurveillanceSamples } = await import('../src/features/laboratory/laboratoryCloudService')
    expect(await loadEmployeeSurveillanceSamples('org-1', [])).toEqual([])
    expect(calls).toHaveLength(0)
    await loadEmployeeSurveillanceSamples('org-1', ['sv-1', 'sv-2'])
    expect(calls[0].table).toBe('laboratory_samples')
    expect(calls[0].filters).toEqual(expect.arrayContaining([['eq', 'organization_id', 'org-1'], ['in', 'employee_surveillance_id', ['sv-1', 'sv-2']]]))
  })

  it('reuses an analysis snapshot read in the last minute', async () => {
    const calls = []
    vi.doMock('../src/core/supabase/client', () => client(calls))
    vi.doMock('../src/core/config/env', () => ({ hasSupabaseConfig: true }))
    const { clearAnalysisSnapshotCache, loadAnalysisSnapshot } = await import('../src/features/platform/platformService')
    clearAnalysisSnapshotCache()
    const args = { organizationId: 'org-1', from: '2026-01-01', to: '2026-12-31' }
    const first = await loadAnalysisSnapshot(args)
    const count = calls.length
    expect(await loadAnalysisSnapshot({ ...args })).toBe(first)
    expect(calls).toHaveLength(count)
    // One hospital reads only its own name.
    expect(calls.find(c => c.table === 'organizations').filters).toEqual(expect.arrayContaining([['eq', 'id', 'org-1']]))
    await loadAnalysisSnapshot({ ...args, departmentId: 'd1' })
    expect(calls.length).toBeGreaterThan(count)
    vi.doUnmock('../src/core/config/env')
  })
})
