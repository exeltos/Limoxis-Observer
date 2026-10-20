// Screens slow to show data, second round: analysis per tab, the kitchen by date
// window, lean training rows, one employee per record, control counts kept by a
// trigger, and lists read page by page.
import fs from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'

const read = path => fs.readFileSync(path, 'utf8')

function client(calls, rows = {}) {
  const builder = table => {
    const call = { table, filters: [] }
    calls.push(call)
    const chain = {}
    for (const method of ['select', 'eq', 'neq', 'in', 'not', 'is', 'or', 'gte', 'lt', 'order', 'range', 'limit']) chain[method] = (...args) => { call.filters.push([method, ...args]); return chain }
    chain.maybeSingle = () => Promise.resolve({ data: null, error: null })
    chain.then = (resolve, reject) => Promise.resolve({ data: rows[table] || [], error: null }).then(resolve, reject)
    return chain
  }
  return {
    supabase: {
      from: builder,
      rpc: (name, args) => {
        calls.push({ table: `rpc:${name}`, args })
        const result = Promise.resolve({ data: rows[`rpc:${name}`] ?? {}, error: null })
        const chain = { order: () => chain, range: () => chain, then: (resolve, reject) => result.then(resolve, reject) }
        return chain
      },
    },
  }
}

describe('analysis per tab', () => {
  afterEach(() => { vi.resetModules(); vi.doUnmock('../src/core/supabase/client'); vi.doUnmock('../src/core/config/env') })

  it('reads the overview parts first and only what a tab adds when it opens', async () => {
    const calls = []
    vi.doMock('../src/core/supabase/client', () => client(calls, { 'rpc:analysis_microbiology_findings': [], 'rpc:analysis_amr_susceptibility': [] }))
    vi.doMock('../src/core/config/env', () => ({ hasSupabaseConfig: true }))
    const { analysisPartsForTab, clearAnalysisSnapshotCache, loadAnalysisSnapshot } = await import('../src/features/platform/platformService')
    clearAnalysisSnapshotCache()
    const rpcs = () => calls.filter(c => c.table.startsWith('rpc:')).map(c => c.table.slice(4))
    const args = { organizationId: 'org-1', from: '2026-01-01', to: '2026-12-31' }
    expect(analysisPartsForTab('overview')).toEqual(['summary', 'domains', 'microbiology'])
    await loadAnalysisSnapshot({ ...args, parts: analysisPartsForTab('overview') })
    expect(rpcs().sort()).toEqual(['analysis_domain_metrics', 'analysis_microbiology_findings', 'platform_report_summary'])
    calls.length = 0
    await loadAnalysisSnapshot({ ...args, parts: analysisPartsForTab('surveillance') })
    expect(rpcs()).toEqual(['analysis_crosstab_metrics'])
    calls.length = 0
    await loadAnalysisSnapshot({ ...args, parts: analysisPartsForTab('training') })
    expect(rpcs()).toEqual(['analysis_people_metrics'])
    // Without parts (the dashboard), every part; those read already are reused.
    calls.length = 0
    const whole = await loadAnalysisSnapshot(args)
    expect(rpcs().sort()).toEqual(['analysis_amr_susceptibility', 'analysis_quality_food_metrics', 'get_organism_clusters'])
    expect(rpcs()).not.toContain('analysis_domain_metrics')
    expect(whole.domains).not.toBeNull()
  })

  it('the page asks for the parts of its tab, compare-year and owner comparison included', () => {
    const page = read('src/features/analysis/AnalysisPage.jsx')
    expect(page).toContain("const tabParts=analysisPartsForTab(tab).join(',')")
    expect(page).toContain('const args={...mainScope,...range,departmentId:effectiveDepartment,parts}')
    expect(page).toContain("const ownerArgs=ownerCompareScope?{...ownerCompareScope,...range,departmentId:'',parts}:null")
  })
})

describe('kitchen by date window', () => {
  it('takes each batch\'s whole-life uses from the balances when the state has them', async () => {
    const { stockRows } = await import('../src/features/kitchen/kitchenModel')
    const state = { receipts: [{ id: 'r1', code: 'PAR-1', receivedOn: '2026-01-01', items: [{ id: 'i1', productName: 'Κιμάς', quantity: 10, unit: 'kg' }] }], usage: [{ id: 'u1', receiptItemId: 'i1', quantity: 1 }], writeoffs: [] }
    expect(stockRows(state, '2026-01-02')[0]).toMatchObject({ used: 1, remaining: 9, uses: 1 })
    expect(stockRows({ ...state, balances: { i1: { used: 6, uses: 4, writtenOff: 1 } } }, '2026-01-02')[0]).toMatchObject({ used: 6, writtenOff: 1, remaining: 3, uses: 4 })
  })

  it('reads the configuration once, the day records from the window and the stock balances', async () => {
    const calls = []
    vi.doMock('../src/core/supabase/client', () => client(calls, { 'rpc:kitchen_batch_balances': [] }))
    vi.doMock('../src/core/data/dataEnvironment', () => ({ isDemoDataEnvironment: () => false }))
    const { loadKitchen } = await import('../src/features/kitchen/kitchenService')
    await loadKitchen('org-1', { since: '2026-07-01' })
    const usage = calls.find(c => c.table === 'kitchen_material_usage')
    expect(usage.filters).toEqual(expect.arrayContaining([['gte', 'used_on', '2026-07-01']]))
    expect(calls.find(c => c.table === 'rpc:kitchen_batch_balances').args).toEqual({ p_organization_id: 'org-1', p_since: '2026-07-01' })
    const configReads = calls.filter(c => c.table === 'kitchen_limits').length
    await loadKitchen('org-1', { since: '2026-07-01' })
    expect(calls.filter(c => c.table === 'kitchen_limits').length).toBe(configReads)
    vi.resetModules(); vi.doUnmock('../src/core/supabase/client'); vi.doUnmock('../src/core/data/dataEnvironment')
  })

  it('keeps the balances in the database, through row level security', () => {
    const sql = read('supabase/migrations/20261201100100_kitchen_batch_balances.sql')
    expect(sql).toContain('language sql stable security invoker')
    expect(sql).toContain('revoke all on function public.kitchen_batch_balances(uuid, date) from public, anon;')
    const service = read('src/features/kitchen/kitchenService.js')
    expect(service).toContain('export async function loadKitchenReceipt(organizationId, receiptId)')
    expect(service).toContain('export async function loadKitchenDay(organizationId, productionId)')
    expect(service).toContain('export async function loadKitchenTrace(organizationId,')
    expect(read('src/features/calendar/CalendarPage.jsx')).toContain("loadKitchen(organizationId,{since:addDays(todayKey(),-30)})")
  })
})

describe('controls counts kept by a trigger', () => {
  it('maintains control_assignment_stats on insert, update and delete, and the summary reads it', () => {
    const sql = read('supabase/migrations/20261201100000_control_assignment_stats.sql')
    expect(sql).toContain('after insert or update or delete on public.control_executions')
    expect(sql).toContain('create policy control_assignment_stats_read on public.control_assignment_stats for select to authenticated')
    expect(sql).toContain('from public.control_assignment_stats s')
    expect(sql).toContain("e.performed_at >= coalesce(p_today_from, date_trunc('day', now()))")
    expect(sql).toContain("language plpgsql stable security invoker set search_path = '' set plan_cache_mode = force_custom_plan")
  })
})

describe('employee record and lists past 1,000 rows', () => {
  afterEach(() => { vi.resetModules(); vi.doUnmock('../src/core/supabase/client'); vi.doUnmock('../src/core/data/dataEnvironment'); vi.doUnmock('../src/core/config/env') })

  it('reads the open employee by code, not the register', async () => {
    const calls = []
    vi.doMock('../src/core/supabase/client', () => client(calls, { employees: [{ id: 'db-1', employee_code: 'EMP-1', first_name: 'Α', last_name: 'Β' }] }))
    vi.doMock('../src/core/data/dataEnvironment', () => ({ isDemoDataEnvironment: () => false }))
    vi.doMock('../src/core/config/env', () => ({ hasSupabaseConfig: true }))
    const { loadEmployeeRecordAsync } = await import('../src/features/employees/employeeService')
    const rows = await loadEmployeeRecordAsync('org-1', { code: 'EMP-1' })
    expect(rows.map(row => row.id)).toEqual(['EMP-1'])
    expect(calls[0].filters).toEqual(expect.arrayContaining([['eq', 'organization_id', 'org-1'], ['eq', 'employee_code', 'EMP-1'], ['limit', 1]]))
    expect(read('src/features/employees/EmployeeRecordPage.jsx')).toContain('useEmployeeRecordData({')
  })

  it('pages the lists that stopped at the API cap', () => {
    for (const path of ['src/features/controls/controlCloudService.js', 'src/features/quality/qualityService.js', 'src/features/occupational-health/vaccinationService.js', 'src/features/occupational-health/exposureIncidentService.js', 'src/features/employees/employeeSubRecordsService.js', 'src/features/employees/employeeService.js']) {
      expect(read(path)).toContain("from '../../core/data/inChunks'")
    }
  })
})
