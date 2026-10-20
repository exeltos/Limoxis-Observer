// @vitest-environment jsdom
import fs from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { navigationFor } from '../src/app/navigation'
import { ROLES, capabilitiesFor, CAPABILITIES } from '../src/core/permissions/roles'
import { INDICATOR_MORE_TABS, INDICATOR_TABS, indicatorTabOf } from '../src/features/analysis/analysisPageModel'
import { therapyAccess } from '../src/features/pharmacy/pharmacyAccess'
import { TopbarUserMenu } from '../src/app/TopbarUserMenu'

const read = path => fs.readFileSync(path, 'utf8')
const t = key => key

describe('integration: owner decisions', () => {
  afterEach(cleanup)
  it('keeps the incident report only at the foot of the sidebar', () => {
    const shell = read('src/app/AppShell.jsx')
    expect(shell).not.toContain('topbar-report')
    expect(shell).toContain('<SidebarIncidentReport t={t}')
    expect(read('src/app/SidebarIncidentReport.jsx')).toContain("go('/quality/my-reports')")
    expect(read('src/app/App.jsx')).toContain('path="quality/my-reports"')
  })

  it('cleans the top bar: where I am, the bell and one user menu', () => {
    const shell = read('src/app/AppShell.jsx')
    for (const gone of ['help-button', 'language-button', 'logout-button', '<Eye size={16}/><span>{isRolePreview']) expect(shell).not.toContain(gone)
    expect(shell).toContain('<TopbarUserMenu ')
    expect(shell).toContain('className="preview-banner"')
  })

  it('opens the user menu with the keyboard and closes it with Escape', () => {
    const onLogout = vi.fn(), onPreview = vi.fn()
    render(<TopbarUserMenu t={t} name="Μαρία" roleName="Διαχειριστής" language="el" onAccount={() => {}} onPreview={onPreview} onHelp={() => {}} onToggleLanguage={() => {}} onLogout={onLogout} />)
    const trigger = screen.getByRole('button', { name: /Μαρία/ })
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    const items = screen.getAllByRole('menuitem')
    expect(items.map(item => item.textContent)).toEqual(['userMenu.account', 'userMenu.preview', 'userMenu.help', 'userMenu.language: EnglishEN', 'userMenu.logout'])
    expect(document.activeElement).toBe(items[0])
    fireEvent.keyDown(items[0], { key: 'End' })
    expect(document.activeElement).toBe(items[4])
    fireEvent.keyDown(items[4], { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBe(null)
    expect(document.activeElement).toBe(trigger)
    fireEvent.click(trigger)
    fireEvent.click(screen.getByText('userMenu.logout'))
    expect(onLogout).toHaveBeenCalled()
  })

  it('hides the role preview item for roles that cannot preview', () => {
    render(<TopbarUserMenu t={t} name="Νίκος" roleName="Χρήστης" language="en" onAccount={() => {}} onPreview={null} onHelp={() => {}} onToggleLanguage={() => {}} onLogout={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Νίκος/ }))
    expect(screen.queryByText('userMenu.preview')).toBe(null)
    expect(screen.getByText('userMenu.language: Ελληνικά')).toBeTruthy()
  })

  it('gives «Δείκτες» one row of tabs, «Περισσότερα» last, and maps every old Analysis tab', () => {
    expect(INDICATOR_TABS.map(tab => tab[1])).toEqual(['Σύνοψη', 'Λοιμώξεις', 'Μικροβιολογία & AMR', 'Αντιμικροβιακά', 'Πρόληψη & έλεγχοι', 'Οργανισμός'])
    expect(INDICATOR_MORE_TABS.map(tab => tab[0])).toEqual(['pps', 'reporting', 'lira'])
    expect(['overview', 'surveillance', 'laboratory', 'antimicrobials', 'prevention', 'controls', 'quality', 'qualityfood', 'training', 'governance', 'occupational', 'pps', 'reporting', 'lira'].map(indicatorTabOf))
      .toEqual(['summary', 'infections', 'laboratory', 'antimicrobials', 'prevention', 'prevention', 'organisation', 'organisation', 'organisation', 'organisation', 'organisation', 'pps', 'reporting', 'lira'])
    const page = read('src/features/executive/ExecutiveDashboardPage.jsx')
    expect(page).toContain("const title=tx('Δείκτες','Indicators')")
    expect(page).not.toContain('CheckboxField')
    expect(read('src/features/analysis/AnalysisRoute.jsx')).toContain("pathname: '/executive'")
    expect(navigationFor({ role: ROLES.HOSPITAL_ADMIN }).map(item => item.key)).not.toContain('platformAnalyticsNav')
    expect(navigationFor({ role: ROLES.INFECTION_CONTROL_LEAD }).map(item => item.key)).toContain('platformAnalyticsNav')
  })

  it('mirrors the RLS of antimicrobial_therapies in the approvals tab', () => {
    expect(therapyAccess({ role: ROLES.HOSPITAL_ADMIN })).toEqual({ read: false, update: false })
    expect(therapyAccess({ role: ROLES.HOSPITAL_ADMIN, demoOrganization: true })).toEqual({ read: true, update: false })
    expect(therapyAccess({ role: ROLES.PHARMACY })).toEqual({ read: true, update: true })
    expect(therapyAccess({ role: ROLES.INFECTION_CONTROL_MEMBER })).toEqual({ read: true, update: false })
    expect(therapyAccess({ role: ROLES.PLATFORM_OWNER })).toEqual({ read: true, update: true })
    expect(therapyAccess({ role: ROLES.HOSPITAL_DIRECTOR })).toEqual({ read: false, update: false })
  })

  it('points the dashboard tiles at the merged sections', () => {
    const dashboard = read('src/features/dashboard/DashboardPage.jsx')
    expect(dashboard).toContain("inpatients:[BedDouble,'/surveillance?tab=registry']")
    expect(dashboard).toContain("upcomingMeetings:[CalendarDays,'/meetings']")
    expect(dashboard).toContain('const open=to&&canOpen(to);')
    expect(dashboard).not.toMatch(/'\/(patients|committees|indicators)'\]/)
  })

  it('merges the two indicator tabs of the Management Center into «Ορισμοί δεικτών»', () => {
    const management = read('src/features/management/ManagementPage.jsx')
    expect(management).not.toContain("id:'indicatorDefinitions'")
    expect(management).toContain("{id:'indicators',label:t('sidebarNav.indicatorDefinitions')")
  })

  it('gives the staff user its home, and documents only with view_documents', () => {
    expect(capabilitiesFor(ROLES.STAFF_USER)).toContain(CAPABILITIES.VIEW_DASHBOARD)
    expect(capabilitiesFor(ROLES.STAFF_USER)).not.toContain(CAPABILITIES.VIEW_DOCUMENTS)
    expect(navigationFor({ role: ROLES.STAFF_USER }).map(item => item.key)).toEqual(['dashboard'])
    expect(navigationFor({ role: ROLES.STAFF_USER, customCapabilities: [CAPABILITIES.VIEW_DOCUMENTS] }).map(item => item.key)).toEqual(expect.arrayContaining(['dashboard', 'documents']))
  })
})
