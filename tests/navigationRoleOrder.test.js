import { describe, expect, it } from 'vitest'
import { navigationFor, sidebarLayout } from '../src/app/navigation'
import { ROLES } from '../src/core/permissions/roles'

// The sidebar order is part of each role's workspace: daily work first, the
// calendar closing the main list, then "More" and the Management Center.
// Hospital leadership (Administrator, Platform Owner in a hospital) has headed
// groups instead; an entry in a group reads `group:key`.
const order = role => navigationFor({ role }).map(item => item.group ? `${item.group}:${item.key}` : item.key)

describe('sidebar order per role', () => {
  it('groups the Hospital Administrator menu under headed groups, the Management Center last', () => {
    expect(order(ROLES.HOSPITAL_ADMIN)).toEqual([
      'overview:dashboard', 'overview:executiveDashboard', 'overview:calendar',
      'clinical:surveillance', 'clinical:laboratory', 'clinical:prevention', 'clinical:pharmacy',
      'operations:controls', 'operations:kitchen',
      'quality:quality', 'quality:meetings', 'quality:documents',
      'staff:employees', 'staff:training', 'staff:interviews',
      'management:management',
    ])
    expect(sidebarLayout(ROLES.HOSPITAL_ADMIN, navigationFor({ role: ROLES.HOSPITAL_ADMIN })).map(block => [block.kind, block.id])).toEqual([
      ['group', 'overview'], ['group', 'clinical'], ['group', 'operations'], ['group', 'quality'], ['group', 'staff'], ['group', 'management'],
    ])
  })

  it('gives the Platform Owner in a hospital the same groups, with Pharmacy and Occupational Health', () => {
    const owner = order(ROLES.PLATFORM_OWNER)
    expect(owner.filter(key => !key.startsWith('staff:occupationalHealth'))).toEqual(order(ROLES.HOSPITAL_ADMIN))
    expect(owner).toContain('clinical:pharmacy')
    expect(owner).toContain('staff:occupationalHealth')
  })

  it('keeps the Director on «Indicators» (the executive dashboard), documents and the calendar, without Home', () => {
    expect(order(ROLES.HOSPITAL_DIRECTOR)).toEqual(['executiveDashboard', 'documents', 'calendar'])
  })

  it('calls the dashboard «Home» and the executive dashboard «Indicators»; the indicators list stays only for roles without it', () => {
    const labels = role => navigationFor({ role }).map(item => item.label || item.key)
    expect(labels(ROLES.HOSPITAL_ADMIN).slice(0, 2)).toEqual(['sidebarNav.home', 'sidebarNav.indicators'])
    for (const role of [ROLES.HOSPITAL_ADMIN, ROLES.PLATFORM_OWNER, ROLES.HOSPITAL_DIRECTOR]) expect(order(role).join(' '), role).not.toMatch(/(^|[: ])indicators( |$)/)
    for (const role of [ROLES.INFECTION_CONTROL_LEAD, ROLES.QUALITY_MANAGER, ROLES.PHARMACY]) expect(navigationFor({ role }).map(item => item.key), role).toContain('indicators')
  })

  it('puts the staff screens of every role that sees two or more of them under one «Staff» group', () => {
    for (const role of Object.values(ROLES)) {
      const items = navigationFor({ role })
      const staff = items.filter(item => ['employees', 'training', 'interviews', 'occupationalHealth'].includes(item.key))
      if (staff.length < 2) continue
      expect(staff.every(item => item.group === 'staff'), role).toBe(true)
      expect(sidebarLayout(role, items).filter(block => block.kind === 'group' && block.id === 'staff'), role).toHaveLength(1)
    }
    expect(order(ROLES.HR_OFFICE)).toEqual(['dashboard', 'staff:employees', 'staff:interviews', 'staff:training', 'calendar', 'more:documents'])
  })

  it('shows «More» once at most', () => {
    for (const role of Object.values(ROLES)) expect(sidebarLayout(role, navigationFor({ role })).filter(block => block.kind === 'more').length, role).toBeLessThanOrEqual(1)
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
    expect(order(ROLES.OCCUPATIONAL_PHYSICIAN).slice(0, 2)).toEqual(['dashboard', 'staff:occupationalHealth'])
    expect(order(ROLES.LINK_NURSE)[0]).toBe('myDepartment')
  })

  it('merges patients and surveillance, documents and regulations, committees and meetings for every role', () => {
    for (const role of Object.values(ROLES)) {
      const keys = navigationFor({ role }).map(item => item.key)
      for (const gone of ['patients', 'regulations', 'committees', 'reportIncident']) expect(keys, role).not.toContain(gone)
    }
  })
})
