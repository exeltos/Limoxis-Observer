import { describe, expect, it } from 'vitest'
import { readSource } from './helpers/readSource'

const read = file => readSource(file)

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

  it('keeps the home to one list of work, the announcements and the week (no figures, no charts)', () => {
    const page = read('src/features/dashboard/DashboardPage.jsx')
    expect(page).not.toContain('<TrendChart')
    expect(page).not.toContain('<KpiStrip')
    expect(page).toContain("tr('Για μένα σήμερα','For me today')")
    expect(page).toContain("tr('Επόμενες 7 ημέρες','Next 7 days')")
    // The role's counts still feed the list.
    expect(page).toContain('case ROLES.PHARMACY:')
  })
})
