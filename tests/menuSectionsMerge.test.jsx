// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CAPABILITIES, ROLES } from '../src/core/permissions/roles'
import { SECTION_TABS, resolveSectionTab, sectionCapabilities, sectionTabPath, sectionTabsFor } from '../src/core/navigation/sectionTabs'
import { navigationFor } from '../src/app/navigation'
import { SidebarNavigation } from '../src/app/SidebarNavigation'
import { SidebarIncidentReport } from '../src/app/SidebarIncidentReport'
import { calendarFilterOf, calendarFiltersFor, controlExecutionEvents, parseCalendarFilter } from '../src/features/calendar/calendarEvents'

const read = path => fs.readFileSync(path, 'utf8')
const ids = (section, role) => sectionTabsFor(section, { role }).map(tab => tab.id)

describe('merged sections: one menu entry, the tabs the role may open', () => {
  it('names the tabs of Surveillance, Documents & regulations and Meetings & decisions in order', () => {
    expect(SECTION_TABS.surveillance.tabs.map(tab => tab.id)).toEqual(['episodes', 'registry', 'outbreaks', 'employees', 'environmental'])
    expect(SECTION_TABS.documents.tabs.map(tab => tab.id)).toEqual(['documents', 'regulations', 'legislation'])
    expect(SECTION_TABS.meetings.tabs.map(tab => tab.id)).toEqual(['committees', 'departments', 'reviews'])
  })

  it('keeps each tab behind the gate its screen had', () => {
    expect(ids('documents', ROLES.HOSPITAL_ADMIN)).toEqual(['documents', 'regulations', 'legislation'])
    expect(ids('documents', ROLES.HOSPITAL_DIRECTOR)).toEqual(['documents', 'regulations'])
    expect(ids('meetings', ROLES.COMMITTEE_SECRETARIAT)).toEqual(['committees'])
    expect(ids('meetings', ROLES.QUALITY_MANAGER)).toEqual(['committees', 'departments', 'reviews'])
    expect(ids('meetings', ROLES.HOSPITAL_DIRECTOR)).toEqual([])
    expect(ids('surveillance', ROLES.INFECTION_CONTROL_MEMBER)).not.toContain('outbreaks')
    expect(ids('surveillance', ROLES.INFECTION_CONTROL_LEAD)).toContain('outbreaks')
    expect(ids('surveillance', ROLES.HR_OFFICE)).toEqual([])
    expect(sectionCapabilities('documents')).toEqual(expect.arrayContaining([CAPABILITIES.VIEW_DOCUMENTS, CAPABILITIES.VIEW_QUALITY]))
  })

  it('hides a section with no open tab from the menu', () => {
    expect(navigationFor({ role: ROLES.HOSPITAL_DIRECTOR }).map(item => item.key)).not.toContain('meetings')
    expect(navigationFor({ role: ROLES.HR_OFFICE }).map(item => item.key)).not.toContain('surveillance')
  })

  it('opens the requested tab when allowed, else the default, and writes ?tab= only off the default', () => {
    const allowed = sectionTabsFor('surveillance', { role: ROLES.HOSPITAL_ADMIN })
    expect(resolveSectionTab('surveillance', 'registry', allowed)).toBe('registry')
    expect(resolveSectionTab('surveillance', 'nope', allowed)).toBe('episodes')
    expect(resolveSectionTab('meetings', null, sectionTabsFor('meetings', { role: ROLES.QUALITY_MANAGER }))).toBe('committees')
    expect(sectionTabPath('surveillance', 'episodes')).toBe('/surveillance')
    expect(SECTION_TABS.surveillance.defaultTab).toBe('episodes')
    expect(resolveSectionTab('surveillance', null, allowed)).toBe('episodes')
    expect(sectionTabPath('surveillance', 'registry')).toBe('/surveillance?tab=registry')
    expect(sectionTabPath('documents', 'legislation', 'view=register')).toBe('/documents?view=register&tab=legislation')
  })

  it('redirects the old addresses to their tab and keeps the record pages', () => {
    const app = read('src/app/App.jsx')
    expect(app).toContain('<Route path="patients" element={<SectionRedirect sectionId="surveillance" tab="registry"/>}/>')
    expect(app).toContain('<Route path="committees" element={<SectionRedirect sectionId="meetings" tab="committees"/>}/>')
    expect(app).toContain('<Route path="regulations" element={<SectionRedirect sectionId="documents" tab="regulations"/>}/>')
    expect(app).toContain('<Route path="legislation" element={<SectionRedirect sectionId="documents" tab="legislation"/>}/>')
    for (const record of ['patients/:patientId', 'committees/:committeeId', 'regulations/:regulationId', 'legislation/:textId', 'meetings/:meetingId', 'documents/:documentId']) expect(app).toContain(`path="${record}"`)
  })

  it('takes the Meetings tab out of the Quality Center and links to the new section', () => {
    const quality = read('src/features/quality/QualityPage.jsx')
    expect(quality).not.toContain('MeetingsList')
    expect(quality).toContain("navigate('/meetings?tab=departments')")
  })
})

describe('grouped sidebar', () => {
  beforeEach(() => { try { window.localStorage.clear() } catch { /* no storage */ } })
  afterEach(cleanup)
  const t = key => key
  const renderMenu = (role = ROLES.HOSPITAL_ADMIN, path = '/') => render(<MemoryRouter initialEntries={[path]}><nav><SidebarNavigation role={role} items={navigationFor({ role })} t={t} userKey="u1" /></nav></MemoryRouter>)

  it('opens one group at a time and keeps the group of the open screen marked', () => {
    renderMenu(ROLES.HOSPITAL_ADMIN, '/laboratory')
    const clinical = screen.getByRole('button', { name: 'sidebarNav.groupClinical' })
    const staff = screen.getByRole('button', { name: 'sidebarNav.groupStaff' })
    expect(clinical.getAttribute('aria-expanded')).toBe('true')
    expect(staff.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(staff)
    expect(staff.getAttribute('aria-expanded')).toBe('true')
    expect(clinical.getAttribute('aria-expanded')).toBe('false')
    expect(clinical.closest('.sidebar-nav-section').className).toContain('has-active')
    expect(staff.closest('.sidebar-nav-section').className).not.toContain('has-active')
    fireEvent.click(staff)
    expect(staff.getAttribute('aria-expanded')).toBe('false')
  })

  it('opens the group of a record page of a merged section (a patient is under Surveillance)', () => {
    renderMenu(ROLES.HOSPITAL_ADMIN, '/patients/FMP-01459')
    expect(screen.getByRole('button', { name: 'sidebarNav.groupClinical' }).getAttribute('aria-expanded')).toBe('true')
  })

  it('labels a merged entry with the section name', () => {
    renderMenu()
    expect(screen.getByRole('link', { name: 'sidebarNav.surveillanceSection' }).getAttribute('href')).toBe('/surveillance')
    expect(screen.getByRole('link', { name: 'sidebarNav.documentsRegulations' }).getAttribute('href')).toBe('/documents')
  })
})

describe('one calendar', () => {
  it('reads the filter chips from the address', () => {
    expect(parseCalendarFilter('controls')).toEqual(new Set(['controls']))
    expect(parseCalendarFilter('controls,training,bogus')).toEqual(new Set(['controls', 'training']))
    expect(parseCalendarFilter('')).toBe(null)
    expect(parseCalendarFilter('none')).toEqual(new Set())
    expect(calendarFiltersFor(['controls', 'training', 'committees'])).toEqual(['controls', 'training', 'meetings', 'expiries'])
  })

  it('files every event under one chip', () => {
    expect(calendarFilterOf({ kind: 'controls', id: 'ctrl:1' })).toBe('controls')
    expect(calendarFilterOf({ kind: 'training', id: 'trn-due:1' })).toBe('training')
    expect(calendarFilterOf({ kind: 'training', id: 'cert:1' })).toBe('expiries')
    expect(calendarFilterOf({ kind: 'documents', id: 'doc:1', expiry: true })).toBe('expiries')
    expect(calendarFilterOf({ kind: 'committees', id: 'mtg:1' })).toBe('meetings')
    expect(calendarFilterOf({ kind: 'capa', id: 'capa:1' })).toBe('other')
  })

  it('shows what the controls calendar showed: done, late and missed executions by day', () => {
    const lines = [{ item: { id: 'CTRL-1', title: 'Ψυγείο' }, department: 'ΜΕΘ', months: Array.from({ length: 12 }, (_, month) => month === 9 ? { frequent: false, marks: [{ day: 2, late: false }, { day: 9, late: true }], missed: [20], planned: [] } : { frequent: false, marks: [], missed: [], planned: [] }) }]
    const events = controlExecutionEvents(lines, { year: 2026, month: 9, today: '2026-10-25', language: 'el' })
    expect(events.map(event => [event.date, event.state])).toEqual([['2026-10-02', 'done'], ['2026-10-09', 'late'], ['2026-10-20', 'missed']])
    expect(events.every(event => event.kind === 'controls' && event.path === '/controls/CTRL-1')).toBe(true)
  })

  it('opens the calendar from Controls with the controls filter, old calendar links included', () => {
    const controls = read('src/features/controls/ControlsPage.jsx')
    expect(controls).not.toContain("{value:'calendar'")
    expect(controls).toContain("navigate('/calendar?filter=controls')")
    expect(controls).toContain("get('tab')==='calendar'")
  })
})

describe('incident report button and indicators', () => {
  afterEach(cleanup)
  it('pins «+ Incident report» at the foot of the sidebar for whoever may report, with a new report and my reports', () => {
    const shell = read('src/app/AppShell.jsx')
    expect(shell).toContain('const canReportIncident=!platformMode&&can(role,CAPABILITIES.REPORT_INCIDENT,')
    expect(shell.indexOf('<SidebarIncidentReport')).toBeLessThan(shell.indexOf('<div className="sidebar-footer">'))
    render(<MemoryRouter><SidebarIncidentReport t={key => key} /></MemoryRouter>)
    const trigger = screen.getByRole('button', { name: 'sidebarNav.reportIncident' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(trigger)
    expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual(['sidebarNav.newIncidentReport', 'sidebarNav.myIncidentReports'])
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBe(null)
  })

  it('sends old /indicators links of the leadership to the Management tab (or the dashboard) and keeps the list for the others', () => {
    const route = read('src/features/indicators/IndicatorsRoute.jsx')
    expect(route).toContain("'/management?tab=indicators' : '/executive'")
    const management = read('src/features/management/ManagementPage.jsx')
    expect(management).toContain("{id:'indicators',label:t('sidebarNav.indicatorDefinitions')")
    expect(management).toContain('<PageEmbedProvider><IndicatorsPage/></PageEmbedProvider>')
    expect(read('src/app/App.jsx')).toContain('<Route path="indicators" element={gateAny([CAPABILITIES.VIEW_INDICATORS,CAPABILITIES.VIEW_EXECUTIVE_DASHBOARD],<IndicatorsRoute/>)}/>')
  })
})

describe('menu entries start a section clean', () => {
  afterEach(cleanup)
  it('forgets the kept search of a registry when its section is opened from the menu', () => {
    window.sessionStorage.setItem('limoxis.registry.patients.view', JSON.stringify({ query: 'FMP-00539' }))
    window.sessionStorage.setItem('limoxis.registry.patients.selected', 'FMP-00539')
    render(<MemoryRouter initialEntries={['/']}><nav><SidebarNavigation role={ROLES.HOSPITAL_ADMIN} items={navigationFor({ role: ROLES.HOSPITAL_ADMIN })} t={key => key} userKey="u1" /></nav></MemoryRouter>)
    fireEvent.click(screen.getByRole('link', { name: 'sidebarNav.surveillanceSection' }))
    expect(window.sessionStorage.getItem('limoxis.registry.patients.view')).toBeNull()
    expect(window.sessionStorage.getItem('limoxis.registry.patients.selected')).toBe('FMP-00539')
  })
})
