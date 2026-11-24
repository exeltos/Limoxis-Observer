// The administrator's home in one screen (owner, 21/11/2026): five figures by module, the departments with the most
// pending items, only the decisions the figures do not show, and the week as seven days with their chips.
import { describe, expect, it } from 'vitest'
import { readSource } from './helpers/readSource'
import { buildCalendarEvents } from '../src/features/calendar/calendarEvents'
import { calendarDayParam } from '../src/features/calendar/calendarView'
import { adminHomeTiles, departmentsNeedingAttention, expiredCertificateEvents, otherDecisionItems, overdueControlDepartments, weekSummary } from '../src/features/dashboard/adminHomeModel'

const today = '2026-11-21'
const metrics = { activeSurveillance: 5, overdueControls: 3, overdueCapa: 2, expiredCertificates: 4 }

describe('the five figures', () => {
  it('shows a figure only for an enabled module the user can open, with its small line', () => {
    const tiles = adminHomeTiles(metrics, { awaitingReview: 6, isolation: 2, overdueControlDepartments: 2, openCapa: 9 }, { moduleEnabled: module => module !== 'suppliers' })
    expect(tiles.map(tile => tile.key)).toEqual(['activeSurveillance', 'awaitingReview', 'overdueControls', 'overdueCapa'])
    expect(tiles.map(tile => tile.detail)).toEqual(['2 σε απομόνωση', 'θετικά χωρίς απόφαση', 'σε 2 τμήματα', 'από 9 ανοιχτές'])
    expect(adminHomeTiles(metrics, {}, { canOpen: to => to !== '/controls' }).map(tile => tile.key)).not.toContain('overdueControls')
  })
  it('leaves out a figure with no source once loaded, never a wrong 0', () => {
    expect(adminHomeTiles({ overdueControls: 1 }, { awaitingReview: null }).map(tile => tile.key)).toEqual(['overdueControls'])
    expect(adminHomeTiles({}, { loading: true, awaitingReview: null }).map(tile => tile.value)).toEqual([undefined, undefined, undefined, undefined])
    expect(adminHomeTiles(metrics, {}, { language: 'en' })[0]).toMatchObject({ label: 'Active surveillance', detail: 'patients under surveillance' })
  })
  it('says «κανείς σε απομόνωση» for none and names the suppliers on the certificates figure', () => {
    const tiles = adminHomeTiles(metrics, { isolation: 0 })
    expect(tiles[0].detail).toBe('κανείς σε απομόνωση')
    expect(tiles.find(tile => tile.key === 'expiredCertificates')?.detail).toBe('προμηθευτών, χωρίς ανανέωση')
    const english = adminHomeTiles(metrics, { isolation: 0 }, { language: 'en' })
    expect(english[0].detail).toBe('no one in isolation')
    expect(english.find(tile => tile.key === 'expiredCertificates')?.detail).toBe("suppliers', not renewed")
  })
})

const control = (id: string, title: string, departments: Record<string, string>) => ({ id, title, frequency: { kind: 'weekly' }, assignments: Object.fromEntries(Object.entries(departments).map(([department, nextDueAt]) => [department, { dbId: `${id}-${department}`, nextDueAt, status: 'scheduled' }])) })
const sources = {
  controls: [
    control('C1', 'Απινιδωτής', { 'ΜΕΘ': '2026-11-23T09:00:00', 'ΤΕΠ': '2026-11-23T09:00:00', 'Μαιευτική': '2026-11-24T09:00:00' }),
    control('C2', 'Ψυγείο φαρμάκων', { 'ΜΕΘ': '2026-11-10T09:00:00', 'ΤΕΠ': '2026-11-12T09:00:00' }),
  ],
  capas: [{ id: 'Q1', title: 'Διόρθωση', status: 'open', dueDate: '2026-11-01', department: 'ΜΕΘ' }, { id: 'Q2', title: 'Κλειστή', status: 'closed', dueDate: '2026-11-01', department: 'ΤΕΠ' }],
  training: {
    programs: [], assignments: [{ id: 'A1', programId: 'P', status: 'completed', department: 'ΜΕΘ', employeeName: 'Α', userId: 'u1' }, { id: 'A2', programId: 'P', status: 'completed', department: 'Παθολογική', employeeName: 'Β', userId: 'u2' }],
    certificates: [
      { id: 'X1', assignmentId: 'A1', title: 'ΚΑΡΠΑ', validUntil: '2026-10-01', userId: 'u1' },
      { id: 'X2', assignmentId: 'A1', title: 'ΚΑΡΠΑ', validUntil: '2028-10-01', userId: 'u1' },
      { id: 'X3', assignmentId: 'A2', title: 'ΚΑΡΠΑ', validUntil: '2026-09-01', userId: 'u2' },
    ],
  },
}
const events = buildCalendarEvents(sources as never, { from: today, to: '2026-11-27', today })

describe('the departments that need attention and the coming week', () => {
  it('ranks the departments by overdue controls, corrective actions and expired certificates not renewed', () => {
    expect(expiredCertificateEvents(events, sources.training).map(event => event.id)).toEqual(['cert:X3'])
    expect(overdueControlDepartments(events)).toBe(2)
    expect(departmentsNeedingAttention(events, sources.training)).toEqual([
      { department: 'ΜΕΘ', controls: 1, capa: 1, certificates: 0, total: 2 },
      { department: 'ΤΕΠ', controls: 1, capa: 0, certificates: 0, total: 1 },
      { department: 'Παθολογική', controls: 0, capa: 0, certificates: 1, total: 1 },
    ])
  })
  it('ranks up to eight departments by default', () => {
    const many = Array.from({ length: 10 }, (_, index) => ({ id: `capa:${index}`, kind: 'capa', date: '2026-11-01', state: 'overdue', title: 'Δ', department: `Τμήμα ${index}` }))
    expect(departmentsNeedingAttention(many)).toHaveLength(8)
  })
})

describe('«Χρειάζονται και αυτά απόφαση»', () => {
  it('leaves out what the figures already show and adds objectives, minutes, expiring supplier certificates and training requests', () => {
    const all = { expiredCertificates: 4, overdueControls: 3, overdueCapa: 2, awaitingReview: 7, criticalUncommunicated: 1, pendingApprovals: 2, missedObjectives: 1, pendingMinutes: 2, expiringCertificates: 5, trainingRequests: 3, kitchenUnverifiedDays: 0 }
    const items = otherDecisionItems(all)
    // The expired supplier certificates left the figures for this list (owner, 24/11/2026): urgent, first.
    expect(items.map(item => item.key)).toEqual(['expiredCertificates', 'criticalUncommunicated', 'pendingApprovals', 'missedObjectives', 'pendingMinutes', 'expiringCertificates', 'trainingRequests'])
    expect(items[1]).toMatchObject({ title: 'Κρίσιμα χωρίς ενημέρωση', count: 1, urgent: true })
    expect(otherDecisionItems(all, { moduleEnabled: module => module !== 'training', canOpen: to => to !== '/meetings', language: 'en' }).map(item => item.title)).toEqual(['Expired supplier certificates', 'Critical results not communicated', 'Antimicrobials to approve', 'Objectives not met', 'Suppliers: expiring in 30 days'])
    expect(otherDecisionItems({ overdueCapa: 4, overdueControls: 3 })).toEqual([])
  })
})

describe('«Η εβδομάδα»', () => {
  const day = (id: string, kind: string, date: string, extra: Record<string, unknown> = {}) => ({ id, kind, date, state: 'planned', title: 'Τ', ...extra })
  const week = [
    ...Array.from({ length: 5 }, (_, index) => day(`ctrl:${index}`, 'controls', today, { state: 'due', department: index < 3 ? 'ΜΕΘ' : 'ΤΕΠ' })),
    day('ctrl:x', 'controls', today, { state: 'done', department: 'ΜΕΘ' }),
    day('ctrl:late', 'controls', '2026-11-10', { state: 'overdue', department: 'ΜΕΘ' }),
    day('ctrl:9', 'controls', '2026-11-22', { department: 'ΜΕΘ' }), day('ctrl:10', 'controls', '2026-11-22', { department: 'ΤΕΠ' }),
    day('cert:1', 'training', '2026-11-22'), day('cert:2', 'training', '2026-11-22'),
    day('mtg:c1:m1', 'committees', '2026-11-23', { title: '3η συνεδρίαση', detail: 'Επιτροπή Λοιμώξεων' }),
    day('trn-start:p1', 'training', '2026-11-23', { title: 'Υγιεινή χεριών' }),
    day('mtg:c2:a', 'committees', '2026-11-24', { detail: 'Α' }), day('mtg:c3:b', 'committees', '2026-11-24', { detail: 'Β' }), day('dm:1', 'committees', '2026-11-24', { title: 'Γ' }),
    day('doc:1', 'documents', '2026-11-25'),
    day('ctrl:out', 'controls', '2026-11-28'),
  ]
  it('has exactly seven days from today, each opening the calendar on that day', () => {
    const days = weekSummary(week, today)
    expect(days.map(item => item.date)).toEqual(['2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27'])
    expect(days.map(item => item.label)).toEqual(['Σήμερα', 'Κυρ 22', 'Δευ 23', 'Τρί 24', 'Τετ 25', 'Πέμ 26', 'Παρ 27'])
    expect(days[3].path).toBe('/calendar?day=2026-11-24')
    expect(days[5].chips).toEqual([])
  })
  it('counts controls (with departments today), expiries and documents, and names one or two trainings or meetings', () => {
    const texts = weekSummary(week, today).map(item => item.chips.map(chip => `${chip.kind}:${chip.text}`))
    expect(texts[0]).toEqual(['controls:5 έλεγχοι · 2 τμήματα'])
    expect(texts[1]).toEqual(['controls:2 έλεγχοι', 'expiries:2 λήξεις'])
    expect(texts[2]).toEqual(['meetings:Επιτροπή Λοιμώξεων', 'training:Υγιεινή χεριών (έναρξη)'])
    expect(weekSummary(week, today)[2].chips.every(chip => chip.named)).toBe(true)
    expect(texts[3]).toEqual(['meetings:3 συνεδριάσεις'])
    expect(texts[4]).toEqual(['documents:1 έγγραφο'])
    expect(weekSummary(week, today, 'en').map(item => item.chips.map(chip => chip.text))[0]).toEqual(['5 controls · 2 departments'])
    expect(weekSummary(week, today, 'en')[2].chips[1].text).toBe('Υγιεινή χεριών (start)')
  })
  it('opens the calendar on the chosen day (?day=YYYY-MM-DD) and ignores anything else', () => {
    expect(calendarDayParam('2026-11-24')).toBe('2026-11-24')
    expect(calendarDayParam('2026-02-30')).toBeNull()
    expect(calendarDayParam('24/11/2026')).toBeNull()
    expect(calendarDayParam(null)).toBeNull()
    expect(readSource('src/features/calendar/CalendarPage.tsx')).toContain("const startDay=calendarDayParam(searchParams.get('day'))||today")
  })
  it('is the home of the administrator and of the Platform Owner inside a hospital', () => {
    const page = readSource('src/features/dashboard/DashboardPage.tsx')
    expect(page).toContain('(actualRole===ROLES.PLATFORM_OWNER&&tenant)?ROLES.HOSPITAL_ADMIN')
    expect(page).toContain("<AdminHome ")
    expect(page).toContain("state:{trainingView:'requests'}")
  })
})

describe('the hospital\'s period on the administrator home (owner, 24/11/2026)', () => {
  it('reads the period figures for the whole hospital and shows the period controls', () => {
    const page = readSource('src/features/dashboard/DashboardPage.tsx')
    expect(page).toContain('const periodDepartments=adminHome?null:membership?.departmentIds')
    expect(page).toContain('loadDepartmentHomeOverview(tenant?.id,periodDepartments,periodWindow)')
    expect(page).toContain("collectDemoDepartmentHome({department:adminHome?null:department,window:periodWindow})")
    expect(page).toContain('<AdminHome language={language} overview={overview} window={periodWindow} status={overviewStatus}')
    expect(page.match(/actions=\{<DepartmentPeriodControls /g)?.length).toBe(2)
  })
  it('counts the samples to review in the period figures, with no list read', () => {
    const page = readSource('src/features/dashboard/DashboardPage.tsx')
    expect(page).toContain('useSamplesAwaitingReview({enabled:reviewCard&&!adminHome')
    expect(page).not.toContain('useSamplesAwaitingReviewCount')
    expect(adminHomeTiles({}, { awaitingReview: null }).map(tile => tile.key)).not.toContain('awaitingReview')
  })
  it('shows the four period figures, the overdue corrective actions, the chart, the hospital organisms and the busy days', () => {
    const home = readSource('src/features/dashboard/AdminHome.tsx')
    expect(home).toContain('...periodTiles(overview, { language, moduleEnabled })')
    expect(home).toContain("<PositivesChart rows={overview?.positivesSeries || []}")
    expect(home).toContain("title={tr('Μικρόβια του νοσοκομείου', 'Hospital organisms')}")
    expect(home).toContain('const busyDays = (week || []).filter(day => day.today || day.chips.length > 0)')
  })
})

describe('the Codex findings on the administrator home', () => {
  it('counts a control as overdue from its due time on the same day', () => {
    const control = { id: 'ctrl:1:2026-11-21', kind: 'controls', date: '2026-11-21', time: '09:00', state: 'due', title: 'Απινιδωτής', department: 'ΜΕΘ' }
    expect(overdueControlDepartments([control], { date: '2026-11-21', time: '12:00' })).toBe(1)
    expect(overdueControlDepartments([control], { date: '2026-11-21', time: '08:30' })).toBe(0)
    expect(departmentsNeedingAttention([control], null, 8, { date: '2026-11-21', time: '12:00' })[0]).toMatchObject({ department: 'ΜΕΘ', controls: 1 })
  })
  it('counts the departments on Greek events and the announcements open read ones too', () => {
    const page = readSource('src/features/dashboard/DashboardPage.tsx')
    expect(page).toContain("language:'el'}).filter(event=>allowedKinds.includes(event.kind))")
    expect(page).toContain('items:nctx.visibleAnnouncements.slice(0,6)')
    expect(readSource('src/features/dashboard/AdminHome.tsx')).toContain('setAnnouncementsOpen(true)')
  })
})

describe('the hospital hand hygiene target on the administrator home (Codex, PR #704)', () => {
  it('puts the hospital objective first for the whole hospital and the department\'s first for a department', () => {
    const sql = readSource('supabase/migrations/20261231637000_department_home_hospital_hand_hygiene_target.sql')
    expect(sql).toContain('create or replace function public.department_home_period_overview')
    expect(sql).toContain('order by case when coalesce(cardinality(p_department_ids), 0) = 0 then (o.department_id is not null) else (o.department_id is null) end, o.updated_at desc')
    expect(sql).not.toMatch(/^\s*(drop|revoke)\b/im)
  })
})
