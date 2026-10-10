import { describe, expect, it } from 'vitest'
import { navigationFor } from '../src/app/navigation'
import { ROLES } from '../src/core/permissions/roles'

// The sidebar order is part of each role's workspace: daily work first, the
// calendar closing the main list, then "More" and the Management Center.
const order = role => navigationFor({ role }).map(item => item.group === 'more' ? `more:${item.key}` : item.key)

describe('sidebar order per role', () => {
  it('opens the Platform Owner workspace with clinical work and keeps the calendar last in the main list', () => {
    expect(order(ROLES.PLATFORM_OWNER)).toEqual([
      'dashboard', 'surveillance', 'patients', 'laboratory', 'prevention', 'controls', 'quality', 'employees', 'calendar',
      'more:platformAnalyticsNav', 'more:indicators', 'more:training', 'more:committees', 'more:documents', 'management',
    ])
  })

  it('puts the calendar after the daily work of every role', () => {
    for (const role of Object.values(ROLES)) {
      const keys = navigationFor({ role }).filter(item => !item.group && item.key !== 'management').map(item => item.key)
      if (!keys.includes('calendar')) continue
      expect(keys.at(-1), role).toBe('calendar')
    }
  })

  it('leads each specialised role with its own module', () => {
    expect(order(ROLES.LABORATORY).slice(0, 2)).toEqual(['dashboard', 'laboratory'])
    expect(order(ROLES.OCCUPATIONAL_PHYSICIAN).slice(0, 2)).toEqual(['dashboard', 'occupationalHealth'])
    expect(order(ROLES.LINK_NURSE)[0]).toBe('myDepartment')
  })
})
