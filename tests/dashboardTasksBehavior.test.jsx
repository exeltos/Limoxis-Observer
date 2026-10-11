// @vitest-environment jsdom
// The home screen's priority work is counted from the same metrics as its
// tiles: in the Demo from the sample hospital's records, in a hospital from
// the database. Nothing pending shows no task; a department manager's tiles
// and tasks count only their department.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { configureDataEnvironment } from '../src/core/data/dataEnvironment'
import {
  DEPARTMENT_ROLES,
  PENDING_ACTION_KEYS,
  dashboardTasks,
  pendingActionsOf,
} from '../src/features/dashboard/dashboardTasks'

let queries
function builder(table) {
  const query = { table, filters: [] }
  queries.push(query)
  const chain = new Proxy(
    {},
    {
      get(_, name) {
        if (name === 'then') return resolve => resolve({ count: 1, error: null })
        return (...args) => {
          if (name !== 'select') query.filters.push([name, ...args])
          return chain
        }
      },
    },
  )
  return chain
}
vi.mock('../src/core/config/env', () => ({ hasSupabaseConfig: true }))
vi.mock('../src/core/supabase/client', () => ({ supabase: { from: table => builder(table) } }))
let tenant
vi.mock('../src/core/tenant/TenantContext', () => ({ useTenant: () => tenant }))
const dashboardProps = []
vi.mock('../src/features/dashboard/DashboardPage', () => ({
  DashboardPage: props => {
    dashboardProps.push(props)
    return null
  },
}))

const { loadDashboardMetrics } = await import('../src/features/dashboard/dashboardCloudService')
const { collectDemoDashboardMetrics } =
  await import('../src/features/dashboard/demoDashboardMetrics')
const { MyDepartmentPage } = await import('../src/features/workspaces/MyDepartmentPage')
const { LanguageProvider } = await import('../src/core/i18n/LanguageContext')

beforeEach(() => {
  queries = []
  dashboardProps.length = 0
})
afterEach(() => {
  cleanup()
  configureDataEnvironment({ mode: 'production' })
})

describe('priority work of a role', () => {
  it('lists only what is pending, with the count of its tile and the screen to open', () => {
    const tasks = dashboardTasks('pharmacy', { pendingApprovals: 3 })
    expect(tasks).toEqual([
      expect.objectContaining({
        title: 'Εγκρίσεις αντιβιοτικών σε αναμονή',
        count: 3,
        to: '/pharmacy',
      }),
    ])
    expect(dashboardTasks('pharmacy', { pendingApprovals: 0 })).toEqual([])
    expect(
      dashboardTasks('committee_secretariat', { pendingMinutes: 2, openDecisions: 4 }, 'en').map(
        task => [task.title, task.count],
      ),
    ).toEqual([
      ['Minutes awaiting finalization', 2],
      ['Open decisions', 4],
    ])
  })

  it('gives nothing without counts: no made-up work', () => {
    for (const role of [
      'hospital_admin',
      'infection_control_lead',
      'hr_office',
      'doctor_reviewer',
      'unknown',
    ])
      expect(dashboardTasks(role, {})).toEqual([])
  })

  it('makes the administrator\'s "Pending actions" the sum of the work listed under it', () => {
    const metrics = {
      overdueControls: 2,
      pendingSamples: 5,
      openIncidents: 1,
      overdueCapa: 0,
      criticalUncommunicated: 9,
    }
    const tasks = dashboardTasks('hospital_admin', metrics)
    expect(tasks.map(task => task.to)).toEqual(['/controls', '/laboratory', '/quality'])
    expect(pendingActionsOf(metrics)).toBe(tasks.reduce((sum, task) => sum + task.count, 0))
    expect(PENDING_ACTION_KEYS).toHaveLength(4)
  })
})

describe('the Demo hospital', () => {
  it('counts tiles and tasks from the same sample records', () => {
    configureDataEnvironment({ mode: 'demo' })
    const { metrics } = collectDemoDashboardMetrics()
    for (const role of [
      'infection_control_lead',
      'laboratory',
      'committee_secretariat',
      'hospital_admin',
    ]) {
      for (const task of dashboardTasks(role, metrics))
        expect(task.count).toBe(metrics[task.id.split('-').pop()])
    }
    expect(metrics.pendingActions).toBe(pendingActionsOf(metrics))
  })

  it("narrows the department counts to the manager's department", () => {
    configureDataEnvironment({ mode: 'demo' })
    const all = collectDemoDashboardMetrics().metrics
    const icu = collectDemoDashboardMetrics({ department: 'ΜΕΘ' }).metrics
    for (const key of ['inpatients', 'activeSurveillance', 'pendingSamples']) {
      expect(icu[key]).toBeGreaterThan(0)
      expect(icu[key]).toBeLessThan(all[key])
    }
    expect(collectDemoDashboardMetrics({ department: 'Καμία' }).metrics.inpatients).toBe(0)
  })
})

describe("a hospital's counts", () => {
  const departmentFilter = table =>
    queries
      .find(q => q.table === table)
      ?.filters.find(([name, column]) => name === 'in' && column === 'department_id')

  it('are organization-wide unless a department role asks for its departments', async () => {
    await loadDashboardMetrics('org-1')
    expect(departmentFilter('patients')).toBeUndefined()
    queries = []
    const metrics = await loadDashboardMetrics('org-1', { departmentIds: ['dep-1'] })
    for (const table of [
      'patients',
      'surveillance_cases',
      'isolation_episodes',
      'control_assignments',
      'laboratory_samples',
    ]) {
      expect(departmentFilter(table)).toEqual(['in', 'department_id', ['dep-1']])
    }
    expect(departmentFilter('quality_incidents')).toBeUndefined()
    expect(metrics).toMatchObject({ pendingApprovals: 1, employeesWithoutDepartment: 1 })
    const approvals = queries.find(
      q =>
        q.table === 'antimicrobial_therapies' &&
        q.filters.some(([, column]) => column === 'approval_status'),
    )
    expect(approvals.filters).toContainEqual(['eq', 'approval_status', 'pending'])
  })
})

describe('the department home', () => {
  const open = () =>
    render(
      <LanguageProvider>
        <MyDepartmentPage />
      </LanguageProvider>,
    )

  it('shows the manager the counts of their department', () => {
    expect(DEPARTMENT_ROLES.has('department_manager')).toBe(true)
    tenant = { role: 'department_manager', isDemo: true, membership: { previewDepartment: 'ΜΕΘ' } }
    open()
    expect(dashboardProps.at(-1)).toMatchObject({ title: 'ΜΕΘ', showKpis: true, department: 'ΜΕΘ' })
    tenant = {
      role: 'department_manager',
      isDemo: false,
      membership: { departmentIds: ['dep-1'], departmentName: 'Χειρουργική' },
    }
    open()
    expect(dashboardProps.at(-1)).toMatchObject({
      title: 'Χειρουργική',
      showKpis: true,
      department: null,
    })
  })

  it('shows no organization-wide counts without a department, nor to a department user', () => {
    tenant = { role: 'department_manager', isDemo: false, membership: { departmentIds: [] } }
    open()
    expect(dashboardProps.at(-1).showKpis).toBe(false)
    tenant = { role: 'department_user', isDemo: true, membership: { previewDepartment: 'ΜΕΘ' } }
    open()
    expect(dashboardProps.at(-1).showKpis).toBe(false)
  })
})
