import { describe, expect, it } from 'vitest'
import { CALENDAR_KINDS, buildCalendarEvents, calendarFilterOf, calendarKindLabel, controlExecutionEvents } from '../src/features/calendar/calendarEvents'
import { readSource } from './helpers/readSource'

const control = (category, extra = {}) => ({ id: 'c1', title: 'Καλλιέργειες επιφανειών ΜΕΘ', titleEn: 'Surface cultures ICU', category, frequency: { kind: 'monthly', interval: 1 }, responseConfig: {}, assignments: { ΜΕΘ: { dbId: 'a1', nextDueAt: '2026-11-10T08:00:00Z', frequency: { kind: 'monthly', interval: 1 } } }, ...extra })
const range = { from: '2026-11-01', to: '2026-12-31', today: '2026-11-05' }

describe('culture sampling in the calendar', () => {
  it('is its own kind, naming who takes the samples: Έλεγχος Λοιμώξεων', () => {
    expect(CALENDAR_KINDS).toContain('cultures')
    const events = buildCalendarEvents({ controls: [control('Περιβαλλοντικός μικροβιολογικός έλεγχος')] }, { ...range, language: 'el' })
    expect(events.length).toBeGreaterThan(0)
    expect(events.every(event => event.kind === 'cultures')).toBe(true)
    expect(events[0]).toMatchObject({ department: 'ΜΕΘ', detail: 'Έλεγχος Λοιμώξεων' })
    expect(calendarFilterOf(events[0])).toBe('cultures')
    expect(calendarKindLabel('cultures', 'en')).toBe('Cultures')
  })
  it('leaves the routine controls as controls', () => {
    const events = buildCalendarEvents({ controls: [control('Θερμοκρασίες')] }, { ...range, language: 'el' })
    expect(events.every(event => event.kind === 'controls')).toBe(true)
  })
  it('names the sampling done or missed, not a control done or missed', () => {
    const line = (months) => [{ item: control('Περιβαλλοντικός μικροβιολογικός έλεγχος'), department: 'ΜΕΘ', months }]
    const months = Array.from({ length: 12 }, (_, month) => ({ month, inactive: false, frequent: false, marks: month === 9 ? [{ day: 15, late: false }] : [], missed: month === 8 ? [10] : [], planned: [] }))
    const events = controlExecutionEvents(line(months), { year: 2026, month: 9, today: '2026-11-05', language: 'en' })
    expect(events[0]).toMatchObject({ kind: 'cultures', detail: 'Samples taken', state: 'done' })
    const missed = controlExecutionEvents(line(months), { year: 2026, month: 8, today: '2026-11-05', language: 'en' })
    expect(missed[0]).toMatchObject({ kind: 'cultures', detail: 'Samples not taken', state: 'missed' })
  })
})

describe('the department calendar', () => {
  it('has a menu entry and a page of its own for the department roles, the culture sampling first', () => {
    const read = path => readSource(new URL(`../${path}`, import.meta.url))
    expect(read('src/app/navigation.js')).toContain("key:'departmentCalendar'")
    expect(read('src/app/App.jsx')).toContain('path="my-department/calendar"')
    expect(read('src/features/workspaces/DepartmentCalendarPage.jsx')).toContain('<CalendarPage departmentOnly />')
    const calendar = read('src/features/calendar/CalendarPage.jsx')
    expect(calendar).toContain("['cultures',...CALENDAR_KINDS.filter(kind=>kind!=='cultures')]")
    // No summary cards (the page fits without scrolling): the overdue count sits on the «To do» tab.
    expect(calendar).not.toContain('module-summary-strip')
    // Only the calendar entry is marked on its page, not «My department» as well.
    expect(read('src/app/SidebarNavigation.jsx')).toContain("to==='/my-department'&&['/my-department/calendar'")
  })
})
