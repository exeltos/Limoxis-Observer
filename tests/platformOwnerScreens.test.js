import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { globSync } from 'node:fs'

const read = file => fs.readFileSync(file, 'utf8')
const files = [...globSync('src/features/platform/*.jsx'), 'src/features/workspaces/PlatformCenterPage.jsx']

describe('platform owner screens', () => {
  it('Greek strings avoid Hospital Admin / Platform Owner / audit trail / production / synthetic', () => {
    for (const file of files) {
      const greek = [...read(file).matchAll(/tx\('([^']*)',/g)].map(m => m[1])
      for (const text of greek) expect(text, `${file}: ${text}`).not.toMatch(/Hospital Admin|Platform Owner|audit trail|production|synthetic|registry/)
    }
  })

  it('the platform overview adds status and region charts', () => {
    const view = read('src/features/platform/PlatformDashboardView.jsx')
    expect(view).toContain('<DonutChart')
    expect(view).toContain('<BarList')
  })

  it('organization type is translated in the registry', () => {
    expect(read('src/features/platform/PlatformOrganizationsRegistry.jsx')).not.toContain("{org.type || 'hospital'}")
  })
})
