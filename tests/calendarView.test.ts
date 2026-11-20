import { describe, expect, it } from 'vitest'
import { buildCalendarEvents, type CalendarEvent } from '../src/features/calendar/calendarEvents'
import { calendarFilterCounts, calendarItemLine, dayCellGroups, dueInText, groupCalendarEvents, hasSingleDepartment, monthGlance, nextDaysGroups, overdueDurationText, pendingEvents, personInitials, searchCalendarGroups } from '../src/features/calendar/calendarView'

const today = '2026-11-20'
const ev = (fields: Partial<CalendarEvent>): CalendarEvent => ({ id: Math.random().toString(36), date: today, kind: 'controls', title: 'T', state: 'due', ...fields }) as CalendarEvent

describe('calendar screen: to-do rows', () => {
  it('groups the same certificate expiry of many people into one row, with its people and its oldest date', () => {
    const people = ['Νικόλαος Πετρόπουλος', 'Μαρία Παπαδοπούλου', 'Αικατερίνη Λάμπρου']
    const events = buildCalendarEvents({
      training: {
        programs: [],
        assignments: people.map((employeeName, index) => ({ id: `A${index}`, programId: 'P', status: 'completed', employeeName, department: 'ΜΕΘ' })),
        certificates: [
          { id: 'C0', assignmentId: 'A0', title: 'Πρόληψη CLABSI', validUntil: '2025-12-30' },
          { id: 'C1', assignmentId: 'A1', title: 'Πρόληψη CLABSI', validUntil: '2026-01-02' },
          { id: 'C2', assignmentId: 'A2', title: 'Πρόληψη CLABSI', validUntil: '2026-01-10' },
          { id: 'C3', assignmentId: 'A0', title: 'Υγιεινή χεριών', validUntil: '2026-03-20' },
        ],
      },
    }, { today })
    const overdue = pendingEvents(events, { today, scope: 'overdue' })
    expect(overdue).toHaveLength(4)
    const groups = groupCalendarEvents(overdue)
    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({ date: '2025-12-30', people })
    expect(groups[0].items.map(e => e.date)).toEqual(['2025-12-30', '2026-01-02', '2026-01-10'])
    expect(groups[0].first.action).toBe('Λήξη πιστοποιητικού')
    expect(groups[1].people).toEqual(['Νικόλαος Πετρόπουλος'])
    expect(searchCalendarGroups(groups, 'λαμπρου').map(g => g.first.title)).toEqual(['Πρόληψη CLABSI'])
    expect(personInitials('Νικόλαος Πετρόπουλος')).toBe('ΝΠ')
  })

  it('says how long an item is overdue and how soon it is due', () => {
    expect(overdueDurationText('2025-12-30', today)).toBe('11 μήνες')
    expect(overdueDurationText('2026-03-20', today)).toBe('8 μήνες')
    expect(overdueDurationText('2026-11-02', today)).toBe('18 ημέρες')
    expect(overdueDurationText('2026-11-19', today)).toBe('1 ημέρα')
    expect(overdueDurationText('2026-11-02', today, 'en')).toBe('18 days')
    expect(overdueDurationText('2024-01-10', today)).toBe('2 έτη')
    expect(dueInText(today, today)).toBe('σήμερα')
    expect(dueInText('2026-11-21', today)).toBe('αύριο')
    expect(dueInText('2026-11-25', today, 'en')).toBe('in 5 days')
  })

  it('splits the overdue items from those of the next 30 days', () => {
    const events = [ev({ date: '2026-11-01', state: 'overdue' }), ev({ date: '2026-11-25' }), ev({ date: '2026-12-25' }), ev({ date: '2026-11-22', state: 'done' })]
    expect(pendingEvents(events, { today, scope: 'overdue' })).toHaveLength(1)
    expect(pendingEvents(events, { today, scope: 'upcoming' }).map(e => e.date)).toEqual(['2026-11-25'])
  })
})

describe('calendar screen: month', () => {
  const events = [
    ev({ kind: 'controls', date: '2026-11-03', state: 'overdue' }),
    ev({ kind: 'controls', date: '2026-11-21' }),
    ev({ kind: 'training', id: 'trn-due:1', date: '2026-11-27', title: 'Υγιεινή χεριών' }),
    ev({ kind: 'training', id: 'cert:1', date: '2026-11-25', title: 'CLABSI' }),
    ev({ kind: 'kitchen', id: 'kit-exp:1', date: '2026-11-22', title: 'Διάλυμα χλωρίου' }),
    ev({ kind: 'committees', date: '2026-12-02' }),
  ]
  it('counts the month per chip, and the month at a glance', () => {
    const month = events.filter(e => e.date.startsWith('2026-11'))
    expect(calendarFilterCounts(month)).toEqual({ controls: 2, training: 1, expiries: 2 })
    expect(monthGlance(events, { monthKey: '2026-11', today })).toEqual({ overdue: 1, week: 2, training: 1, expiries: 2 })
  })

  it('lists the next 7 days from today and writes each item as kind and title', () => {
    expect(nextDaysGroups(events, today).map(g => g.date)).toEqual(['2026-11-21', '2026-11-22', '2026-11-25'])
    expect(calendarItemLine(events[2])).toBe('Εκπαίδευση: Υγιεινή χεριών')
    expect(calendarItemLine(events[4])).toBe('Λήξη υλικού: Διάλυμα χλωρίου')
    expect(calendarItemLine(ev({ id: 'cert:1', kind: 'training', title: 'ΚΑΡΠΑ' }))).toBe('Λήξη πιστοποιητικού: ΚΑΡΠΑ')
    expect(calendarItemLine(ev({ id: 'kit-exp:2', kind: 'kitchen', title: 'Λήξη παρτίδας: Γάλα' }))).toBe('Λήξη παρτίδας: Γάλα')
    expect(calendarItemLine(ev({ title: 'Έλεγχος ψυγείου φαρμάκων' }))).toBe('Έλεγχος ψυγείου φαρμάκων')
    expect(calendarItemLine(events[2], 'en')).toBe('Training: Υγιεινή χεριών')
  })

  it('puts a day’s overdue items first', () => {
    const day = [ev({ kind: 'training', title: 'A' }), ev({ kind: 'controls', title: 'B', state: 'overdue' })]
    expect(dayCellGroups(day, ['controls', 'training']).map(g => g.first.title)).toEqual(['B', 'A'])
  })
})

describe('calendar screen: department select', () => {
  it('is left out for a department role with one department, kept for hospital-wide roles and several departments', () => {
    expect(hasSingleDepartment('department_manager', { previewDepartment: 'ΜΕΘ' })).toBe(true)
    expect(hasSingleDepartment('department_manager', { departmentIds: ['d1'], departmentId: 'd1' })).toBe(true)
    expect(hasSingleDepartment('department_manager', { departmentIds: ['d1', 'd2'] })).toBe(false)
    expect(hasSingleDepartment('division_director', { previewDepartments: ['ΜΕΘ', 'ΤΕΠ'] })).toBe(false)
    expect(hasSingleDepartment('infection_control_lead', { departmentIds: [] })).toBe(false)
    expect(hasSingleDepartment('quality_manager', null)).toBe(false)
  })
})
