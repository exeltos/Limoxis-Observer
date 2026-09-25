import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

const read = file => fs.readFileSync(file, 'utf8')

describe('role dashboards', () => {
  it('awaits each dashboard count instead of Promise.all over [key, promise] pairs', () => {
    const service = read('src/features/dashboard/dashboardCloudService.js')
    expect(service).toContain('pending.map(async([key,count])=>[key,await count])')
  })

  it('uses real card headers (Card has no title prop) and drops the duplicate focus/notification cards', () => {
    const page = read('src/features/dashboard/DashboardPage.jsx')
    expect(page).toContain('<CardHeader')
    expect(page).not.toContain('<Card title=')
    expect(page).not.toContain('dashboard-notification-summary')
  })

  it('shows charts for analysis-oriented roles and role-specific demo KPIs', () => {
    const page = read('src/features/dashboard/DashboardPage.jsx')
    expect(page).toContain('<TrendChart')
    expect(page).toContain('<DonutChart')
    expect(page).toContain('function demoMetrics(')
    expect(page).toContain('case ROLES.PHARMACY:')
  })

  it('department home reuses the dashboard without organization-wide counts', () => {
    expect(read('src/features/workspaces/MyDepartmentPage.jsx')).toContain('<DashboardPage showKpis={false}')
  })

  it('role workspace titles are Greek', () => {
    const config = read('src/features/workspaces/workspaceConfig.js')
    expect(config).toContain("title: 'Κέντρο Ελέγχου Λοιμώξεων',")
    expect(config).not.toContain('Queue δειγμάτων')
  })
})
