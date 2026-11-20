// Who sees which calendar item (owner, 20/11/2026): a department role its departments' items by name (a hospital's
// membership carries the departments' names, the sample data the previewed department), never an item without a
// department; trainings by their audience; a plain user only their own certificates; the hospital committees only where
// the database loaded them. The roles of the whole hospital see everything, as before.
import { describe, expect, it } from 'vitest'
import { buildCalendarEvents, calendarFilterLabel, type CalendarEvent } from '../src/features/calendar/calendarEvents'
import { audienceIncludes, calendarScopeFor, calendarTypeLabel, eventInDepartment, eventWithinScope } from '../src/features/calendar/calendarView'
import { readSource } from './helpers/readSource'

const today = '2026-11-20'
const ev = (fields: Partial<CalendarEvent>): CalendarEvent => ({ id: 'ctrl:1', date: today, kind: 'controls', title: 'T', state: 'due', ...fields }) as CalendarEvent
const hospitalMember = { departmentIds: ['dep-surg'], departmentName: 'Χειρουργική', departmentNames: ['Χειρουργική'] }

describe('the calendar scope of a department role in a hospital', () => {
  const scope = calendarScopeFor({ role: 'department_manager', membership: hospitalMember, userId: 'u-1' })
  it('matches the department by its name, without minding accents or capitals', () => {
    expect(eventWithinScope(ev({ department: 'Χειρουργική' }), scope)).toBe(true)
    expect(eventWithinScope(ev({ department: 'ΧΕΙΡΟΥΡΓΙΚΗ' }), scope)).toBe(true)
    expect(eventWithinScope(ev({ department: 'ΜΕΘ' }), scope)).toBe(false)
  })
  it('never shows an item without a department (suppliers, audits, documents)', () => {
    expect(eventWithinScope(ev({ id: 'sup-eval:1', kind: 'suppliers', department: '' }), scope)).toBe(false)
    expect(eventWithinScope(ev({ id: 'audit:1', kind: 'audits', department: '' }), scope)).toBe(false)
  })
  it('fails closed without a department name', () => {
    const none = calendarScopeFor({ role: 'department_user', membership: { departmentIds: ['dep-1'] } })
    expect(eventWithinScope(ev({ department: 'ΜΕΘ' }), none)).toBe(false)
    // The names read for a previewed Division Director (useCalendarScope) count too.
    expect(eventWithinScope(ev({ department: 'ΜΕΘ' }), calendarScopeFor({ role: 'division_director', membership: { departmentIds: ['dep-1'] }, departmentNames: ['ΜΕΘ'] }))).toBe(true)
  })
  it('gives a Division Director the departments of the division, by name', () => {
    const director = calendarScopeFor({ role: 'division_director', membership: { departmentIds: ['a', 'b'], departmentNames: ['ΜΕΘ', 'Παθολογική'] } })
    expect(eventWithinScope(ev({ department: 'Παθολογική' }), director)).toBe(true)
    expect(eventWithinScope(ev({ department: 'Κουζίνα' }), director)).toBe(false)
    const sample = calendarScopeFor({ role: 'division_director', membership: { departmentIds: [], previewDepartments: ['ΜΕΘ', 'Χειρουργική'] } })
    expect(eventWithinScope(ev({ department: 'Χειρουργική' }), sample)).toBe(true)
    expect(eventWithinScope(ev({ department: 'Κουζίνα' }), sample)).toBe(false)
  })
  it('keeps the sample data\'s previewed department', () => {
    const preview = calendarScopeFor({ role: 'department_user', membership: { departmentIds: [], previewDepartment: 'ΜΕΘ' } })
    expect(eventWithinScope(ev({ department: 'ΜΕΘ' }), preview)).toBe(true)
    expect(eventWithinScope(ev({ department: 'Χειρουργική' }), preview)).toBe(false)
  })
})

describe('certificates, trainings and committees', () => {
  const events = buildCalendarEvents({
    training: {
      programs: [
        { id: 'P1', title: 'ΜΑΠ', status: 'active', dueDate: '2026-11-25', audience: 'ΜΕΘ · Παθολογική · ΤΕΠ' },
        { id: 'P2', title: 'Αιχμηρά', status: 'active', dueDate: '2026-11-26', audience: 'Όλο το προσωπικό' },
        { id: 'P3', title: 'CLABSI', status: 'active', dueDate: '2026-11-27', audience: 'Χειρουργική' },
      ],
      assignments: [
        { id: 'A1', programId: 'P1', status: 'completed', employeeName: 'Μαρία Π.', department: 'ΜΕΘ', userId: 'u-me', employeeId: 'EMP-1' },
        { id: 'A2', programId: 'P1', status: 'completed', employeeName: 'Νίκος Δ.', department: 'ΜΕΘ', userId: 'u-other', employeeId: 'EMP-2' },
      ],
      certificates: [
        { id: 'C1', assignmentId: 'A1', title: 'ΜΑΠ', validUntil: '2026-12-01' },
        { id: 'C2', assignmentId: 'A2', title: 'ΜΑΠ', validUntil: '2026-12-02' },
      ],
    },
    committees: [{ id: 'COM-1', name: 'Επιτροπή Λοιμώξεων', meetings: [{ id: 'M1', title: 'Συνεδρίαση', status: 'scheduled', date: '2026-11-23' }] }],
  }, { today })
  const byId = (prefix: string) => events.filter(e => e.id.startsWith(prefix))
  const icuUser = calendarScopeFor({ role: 'department_user', membership: { departmentIds: ['d'], departmentNames: ['ΜΕΘ'] }, userId: 'u-me' })
  const icuManager = calendarScopeFor({ role: 'department_manager', membership: { departmentIds: ['d'], departmentNames: ['ΜΕΘ'] }, userId: 'u-boss' })

  it('carries the certificate\'s person as an account and an employee, and a programme\'s audience apart from the department', () => {
    expect(byId('cert:C1')[0]).toMatchObject({ personUserId: 'u-me', personEmployeeId: 'EMP-1', department: 'ΜΕΘ' })
    expect(byId('trn-due:P1')[0]).toMatchObject({ department: '', audience: 'ΜΕΘ · Παθολογική · ΤΕΠ' })
  })
  it('shows a plain user only their own certificate, never a colleague\'s name', () => {
    const shown = events.filter(e => e.id.startsWith('cert:') && eventWithinScope(e, icuUser))
    expect(shown.map(e => e.person)).toEqual(['Μαρία Π.'])
    // The sample data's own employee counts as the user.
    const sample = calendarScopeFor({ role: 'link_nurse', membership: { departmentIds: [], previewDepartment: 'ΜΕΘ' }, employeeId: 'EMP-2' })
    expect(events.filter(e => e.id.startsWith('cert:') && eventWithinScope(e, sample)).map(e => e.person)).toEqual(['Νίκος Δ.'])
  })
  it('shows the manager the department\'s certificates', () => {
    expect(events.filter(e => e.id.startsWith('cert:') && eventWithinScope(e, icuManager))).toHaveLength(2)
  })
  it('shows a programme to the departments its audience names, or to all when it is for the whole staff', () => {
    expect(['trn-due:P1', 'trn-due:P2', 'trn-due:P3'].map(id => eventWithinScope(byId(id)[0], icuUser))).toEqual([true, true, false])
    expect(audienceIncludes('Κλινικό προσωπικό', ['ΜΕΘ'])).toBe(true)
    expect(audienceIncludes('All staff', [])).toBe(true)
    expect(audienceIncludes('ΜΕΘ · παθολογικη', ['Παθολογική'])).toBe(true)
    // A whole word only: «ΤΕΠ» is not in «Στεπ».
    expect(audienceIncludes('Στεπ', ['ΤΕΠ'])).toBe(false)
    expect(audienceIncludes('', ['ΜΕΘ'])).toBe(false)
    expect(eventInDepartment(byId('trn-due:P1')[0], 'Παθολογική')).toBe(true)
    expect(eventInDepartment(byId('trn-due:P3')[0], 'ΜΕΘ')).toBe(false)
  })
  it('shows department roles their own meetings, never the hospital committees\' sessions', () => {
    expect(eventWithinScope(byId('mtg:')[0], icuUser)).toBe(false)
    expect(calendarTypeLabel(ev({ id: 'dmg:G1', kind: 'committees', title: 'Συνάντηση ΜΕΘ' }))).toBe('Συνάντηση')
    expect(calendarFilterLabel('meetings', 'el', true)).toBe('Συναντήσεις')
    expect(calendarFilterLabel('meetings')).toBe('Συνεδριάσεις')
  })
  it('leaves the roles of the whole hospital unchanged', () => {
    const admin = calendarScopeFor({ role: 'hospital_admin', membership: hospitalMember })
    expect(events.every(e => eventWithinScope(e, admin))).toBe(true)
    expect(eventWithinScope(ev({ department: '' }), calendarScopeFor({ role: 'quality_manager', membership: {} }))).toBe(true)
  })
})

describe('the screens use the scope', () => {
  it('filters the calendar and the homes with eventWithinScope, not with the record check by id', () => {
    for (const file of ['src/features/calendar/CalendarPage.tsx', 'src/features/dashboard/DashboardPage.tsx']) {
      const source = readSource(file)
      expect(source).toContain('eventWithinScope(')
      expect(source).not.toContain('canAccessRecord({department:')
    }
    expect(readSource('src/core/tenant/tenantService.ts')).toContain('departmentNames:')
  })
})
