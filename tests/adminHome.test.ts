// The administrator's home in one screen (owner, 21/11/2026): five figures by module, the departments with the most
// overdue items, the coming week one line per item (the same control of many departments once) and the training line.
import { describe, expect, it } from 'vitest'
import { readSource } from './helpers/readSource'
import { buildCalendarEvents } from '../src/features/calendar/calendarEvents'
import { nextDaysGroups } from '../src/features/calendar/calendarView'
import { adminHomeTiles, adminWeekLine, departmentsNeedingAttention, expiredCertificateEvents, moduleStatusRows, overdueControlDepartments } from '../src/features/dashboard/adminHomeModel'

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
  it('shows the same control of many departments as one line', () => {
    const lines = nextDaysGroups(events, today).map(group => adminWeekLine(group, 'el'))
    expect(lines.filter(line => line.what.startsWith('Απινιδωτής'))).toEqual([{ what: 'Απινιδωτής · Έλεγχος', where: '3 τμήματα', text: 'Απινιδωτής · Έλεγχος · 3 τμήματα' }])
  })
})

describe('the modules at a glance', () => {
  it('adds the training line only when its figures were counted', () => {
    expect(moduleStatusRows(metrics).map(row => row.module)).not.toContain('training')
    const rows = moduleStatusRows({ ...metrics, trainingRequests: 2, trainingCertificatesExpired: 0 })
    expect(rows.map(row => row.module).slice(3, 5)).toEqual(['quality', 'training'])
    expect(rows.find(row => row.module === 'training')?.status).toBe('warning')
  })
  it('is the home of the administrator and of the Platform Owner inside a hospital', () => {
    const page = readSource('src/features/dashboard/DashboardPage.tsx')
    expect(page).toContain('(actualRole===ROLES.PLATFORM_OWNER&&tenant)?ROLES.HOSPITAL_ADMIN')
    expect(page).toContain("<AdminHome ")
    expect(page).toContain("state:{trainingView:'requests'}")
  })
})
