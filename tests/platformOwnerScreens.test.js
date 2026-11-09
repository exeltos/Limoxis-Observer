import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { globSync } from 'node:fs'
import { activityDays, hospitalHealthOf } from '../src/features/platform/platformHealthService'

const read = file => fs.readFileSync(file, 'utf8')
const files = [...globSync('src/features/platform/*.jsx'), 'src/features/workspaces/PlatformCenterPage.jsx']

describe('platform owner screens', () => {
  it('Greek strings avoid Hospital Admin / Platform Owner / audit trail / production / synthetic', () => {
    for (const file of files) {
      const greek = [...read(file).matchAll(/tx\('([^']*)',/g)].map(m => m[1])
      for (const text of greek) expect(text, `${file}: ${text}`).not.toMatch(/Hospital Admin|Platform Owner|audit trail|production|synthetic|registry/)
    }
  })

  it('the platform overview has one strip of totals, the hospitals, what needs action and the quick actions: no number cards, no charts', () => {
    const view = read('src/features/platform/PlatformDashboardView.jsx')
    expect(view).toContain('platform-overview-totals')
    expect(view).toContain('<ActionList')
    expect(view).toContain('<HospitalsTable')
    expect(view).toContain('<QuickActions')
    expect(view).toContain('{liveSessions}')
    expect(view).not.toContain('<MetricCard')
    expect(view).not.toContain('<DonutChart')
    expect(view).not.toContain('<BarList')
  })

  it('counts each hospital\'s recorded changes per day of the last 14 (Athens time) for the Overview sparkline', () => {
    const now = Date.parse('2026-11-09T12:00:00Z')
    const days = activityDays(now)
    expect(days).toHaveLength(14)
    expect(days[13]).toBe('2026-11-09')
    // 23:30 UTC on 8/11 is already 9/11 in Athens.
    const health = hospitalHealthOf({ now, recent: [{ organization_id: 'a', created_at: '2026-11-08T23:30:00Z' }, { organization_id: 'a', created_at: '2026-11-07T10:00:00Z' }, { organization_id: 'a', created_at: '2026-10-01T10:00:00Z' }] })
    expect(health.a.activity.slice(-3)).toEqual([1, 0, 1])
    expect(health.a.activity.reduce((sum, value) => sum + value, 0)).toBe(2)
    // Without the recent rows the sparkline is left out, not drawn flat.
    expect(hospitalHealthOf({ now, events: [{ organization_id: 'a', severity: 'error', occurred_at: '2026-11-09T11:00:00.000Z' }], recent: null }).a).toMatchObject({ errors24h: 1, activity: null })
  })

  it('the owner menu marks exactly one entry and groups Monitoring and Settings under headings', () => {
    const shell = read('src/app/AppShell.jsx')
    expect(shell).toContain("hash:'demo',icon:FlaskConical")
    expect(shell).toContain("hash:'users',icon:Users")
    expect(shell).toContain("platformNavGroups=[['',null],['monitoring','platformNav.groupMonitoring'],['settings','platformNav.groupSettings']]")
    expect(shell).not.toContain("['organizations','demo','users'].includes(platformHashKey)")
  })

  it('organization type is translated in the registry', () => {
    expect(read('src/features/platform/PlatformOrganizationsRegistry.jsx')).not.toContain("{org.type || 'hospital'}")
  })
})
