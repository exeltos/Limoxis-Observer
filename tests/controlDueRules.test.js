import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  dueState, executionMarks, firstDue, nextDeadlineAfter, nextDueAfterExecution, periodBounds, periodProgress, requiredPerPeriod, slotMargin, slotStarts, zonedInstant, zonedParts,
} from '../src/features/controls/controlDueRules'
import { assignmentProgress, assignmentStatus, isControlDue } from '../src/features/controls/controlScheduling'
import { filterControlRows, scopeControlRows } from '../src/features/controls/controlFilters'
import { programmeAdherence } from '../src/features/controls/controlAdherence'
import { programmeCalendar } from '../src/features/controls/controlCalendar'
import { progressCompleteMessage, progressText } from '../src/features/controls/controlProgress'
import { configureDataEnvironment } from '../src/core/data/dataEnvironment'

const iso = (value) => new Date(value).toISOString()
const daily1 = { kind: 'daily', timesPerDay: 1, times: ['09:00'] }
const daily2 = { kind: 'daily', timesPerDay: 2, times: ['08:00', '16:00'] }
const daily4 = { kind: 'daily', timesPerDay: 4, times: ['07:00', '11:00', '15:00', '19:00'] }

describe('time zone helpers (Europe/Athens)', () => {
  it('reads and builds wall-clock times on both sides of the October change', () => {
    expect(zonedParts('2026-10-24T21:00:00Z')).toMatchObject({ year: 2026, month: 10, day: 25, hour: 0 })
    expect(iso(zonedInstant(2026, 10, 25, 0))).toBe('2026-10-24T21:00:00.000Z') // EEST, UTC+3
    expect(iso(zonedInstant(2026, 10, 26, 0))).toBe('2026-10-25T22:00:00.000Z') // EET, UTC+2
    expect(iso(zonedInstant(2026, 3, 29, 0))).toBe('2026-03-28T22:00:00.000Z')
    expect(iso(zonedInstant(2026, 3, 30, 0))).toBe('2026-03-29T21:00:00.000Z')
  })
  it('gives the day of a 25-hour and a 23-hour day', () => {
    const autumn = periodBounds(daily1, new Date('2026-10-25T12:00:00Z'))
    expect((autumn.end - autumn.start) / 3600000).toBe(25)
    const spring = periodBounds(daily1, new Date('2026-03-29T12:00:00Z'))
    expect((spring.end - spring.start) / 3600000).toBe(23)
  })
})

describe('due rules per frequency', () => {
  it('once a day: due 2 hours after its time; an entry just before 09:00 makes it due tomorrow at 11:00', () => {
    const at = new Date('2026-10-19T05:55:00Z') // 08:55 Athens
    expect(slotMargin(daily1)).toBe(120)
    expect(nextDueAfterExecution(daily1, at, 1)).toBe('2026-10-20T08:00:00.000Z') // tomorrow 11:00
    // Nothing yet today: due by 11:00 today.
    expect(nextDueAfterExecution(daily1, at, 0)).toBe('2026-10-19T08:00:00.000Z')
  })
  it('N times a day: each time 1 hour after it', () => {
    const morning = new Date('2026-10-19T04:30:00Z') // 07:30 Athens
    expect(slotStarts(daily2)).toEqual([480, 960])
    expect(requiredPerPeriod(daily2)).toBe(2)
    expect(slotMargin(daily2)).toBe(60)
    expect(nextDueAfterExecution(daily2, morning, 0)).toBe('2026-10-19T06:00:00.000Z') // 09:00
    expect(nextDueAfterExecution(daily2, morning, 1)).toBe('2026-10-19T14:00:00.000Z') // 17:00
    expect(nextDueAfterExecution(daily2, morning, 2)).toBe('2026-10-20T06:00:00.000Z') // tomorrow 09:00
    // 23:00 + 1 hour stops at the end of the day.
    expect(nextDueAfterExecution({ kind: 'daily', times: ['08:00', '14:00', '23:00'] }, morning, 2)).toBe('2026-10-19T20:59:59.000Z')
  })
  it('the day split evenly without times keeps the old rule: by the next slot', () => {
    const even = { kind: 'daily', timesPerDay: 2, times: [] }
    expect(slotMargin(even)).toBe(0)
    expect(nextDueAfterExecution(even, new Date('2026-10-19T04:30:00Z'), 0)).toBe('2026-10-19T09:00:00.000Z') // 12:00
  })
  it('a control\'s own margin replaces the default', () => {
    const f = { kind: 'daily', times: ['07:00', '15:00', '23:00'], toleranceMinutes: 90 }
    const at = new Date('2026-10-19T05:00:00Z')
    expect(nextDueAfterExecution(f, at, 0)).toBe('2026-10-19T05:30:00.000Z') // 08:30
    expect(nextDueAfterExecution(f, at, 2)).toBe('2026-10-19T20:59:59.000Z') // 23:00 + 90' capped at the day's end
  })
  it('times per day without times split the day evenly', () => {
    expect(slotStarts({ kind: 'daily', timesPerDay: 4, times: [] })).toEqual([0, 360, 720, 1080])
  })
  it('an entry after midnight UTC but before midnight Athens belongs to the Athens day', () => {
    const lateEvening = new Date('2026-10-19T20:30:00Z') // 23:30 Athens, 19 October
    const afterMidnight = new Date('2026-10-19T21:30:00Z') // 00:30 Athens, 20 October
    expect(periodBounds(daily1, lateEvening).start.toISOString()).toBe('2026-10-18T21:00:00.000Z')
    expect(periodBounds(daily1, afterMidnight).start.toISOString()).toBe('2026-10-19T21:00:00.000Z')
  })
  it('across the October change: due by 23:59:59 local in winter time', () => {
    expect(nextDueAfterExecution(daily1, new Date('2026-10-25T00:30:00Z'), 1)).toBe('2026-10-26T09:00:00.000Z') // 11:00 EET
    expect(nextDueAfterExecution(daily4, new Date('2026-10-25T00:30:00Z'), 0)).toBe('2026-10-25T06:00:00.000Z') // 08:00 EET
  })
  it('weekly: by Sunday of the next week; every two weeks, the week after', () => {
    const saturday = new Date('2026-10-24T08:00:00Z')
    expect(nextDueAfterExecution({ kind: 'weekly', interval: 1 }, saturday)).toBe('2026-11-01T21:59:59.000Z')
    expect(nextDueAfterExecution({ kind: 'weekly', interval: 2 }, saturday)).toBe('2026-11-08T21:59:59.000Z')
    expect(periodBounds({ kind: 'weekly' }, saturday).start.toISOString()).toBe('2026-10-18T21:00:00.000Z') // Monday 19th
  })
  it('monthly and yearly: by the end of the N-th month or year (31 January included)', () => {
    expect(nextDueAfterExecution({ kind: 'monthly', interval: 1 }, new Date('2026-01-31T10:00:00Z'))).toBe('2026-02-28T21:59:59.000Z')
    expect(nextDueAfterExecution({ kind: 'monthly', interval: 6 }, new Date('2026-03-28T22:10:00Z'))).toBe('2026-09-30T20:59:59.000Z')
    expect(nextDueAfterExecution({ kind: 'yearly', interval: 1 }, new Date('2026-12-31T22:30:00Z'))).toBe('2028-12-31T21:59:59.000Z') // 1 Jan 2027 Athens
  })
  it('every N days: by the end of the N-th day', () => {
    expect(nextDueAfterExecution({ kind: 'custom', interval: 15 }, new Date('2026-10-19T05:55:00Z'))).toBe('2026-11-03T21:59:59.000Z')
  })
  it('steps a schedule from deadline to deadline and starts a new one in the current period', () => {
    expect(nextDeadlineAfter(daily2, new Date('2026-10-19T13:00:00Z'))).toBe('2026-10-19T14:00:00.000Z') // 17:00
    expect(nextDeadlineAfter({ kind: 'monthly', interval: 1 }, new Date('2026-10-31T21:59:59Z'))).toBe('2026-11-30T21:59:59.000Z')
    expect(firstDue({ kind: 'monthly', interval: 1 }, new Date('2026-10-19T10:00:00Z'))).toBe('2026-10-31T21:59:59.000Z')
  })
  it('overdue once the deadline has passed, due soon within two hours for daily controls', () => {
    const now = new Date('2026-10-19T19:30:00Z')
    expect(dueState('2026-10-19T20:59:59Z', daily1, now)).toBe('dueSoon')
    expect(dueState('2026-10-19T19:00:00Z', daily1, now)).toBe('overdue')
    expect(dueState('2026-10-20T20:59:59Z', daily1, now)).toBe('scheduled')
  })
})

describe('period progress and marks', () => {
  const now = new Date('2026-10-19T13:00:00Z') // 16:00 Athens
  const history = [
    { at: '2026-10-19T04:10:00Z' }, { at: '2026-10-19T08:00:00Z' }, { at: '2026-10-19T12:00:00Z' },
    { at: '2026-10-19T12:30:00Z', isExtra: true },
    { at: '2026-10-19T12:40:00Z', status: 'cancelled' },
    { at: '2026-10-18T20:30:00Z' }, // 23:30 yesterday
  ]
  it('counts the regular entries of the current period, extra and voided ones apart', () => {
    expect(periodProgress(daily4, history, now)).toMatchObject({ unit: 'day', required: 4, done: 3, extra: 1, complete: false })
    expect(progressText(periodProgress(daily4, history, now))).toBe('3/4 σήμερα')
    expect(periodProgress(daily4, [...history, { at: '2026-10-19T12:50:00Z' }], now).complete).toBe(true)
  })
  it('words the complete message', () => {
    expect(progressCompleteMessage({ unit: 'day', done: 4, required: 4 })).toBe('Οι απαιτούμενες καταχωρήσεις για σήμερα (4/4) έχουν ολοκληρωθεί.')
    expect(progressCompleteMessage({ unit: 'week', done: 1, required: 1 }, 'en')).toBe('The required entries for this week (1/1) are complete.')
  })
  it('marks only the first N entries of a day as counted', () => {
    const marks = executionMarks([{ at: '2026-10-19T05:00:00Z' }, { at: '2026-10-19T06:00:00Z' }, { at: '2026-10-19T07:00:00Z' }], daily2)
    expect(marks.map((m) => m.counted)).toEqual([true, true, false])
  })
  it('is on time from 1 hour before to the margin after; later the same day it is late', () => {
    const at = (time) => ({ at: new Date(zonedInstant(2026, 10, 19, Number(time.slice(0, 2)) * 60 + Number(time.slice(3)))).toISOString() })
    const onTime = (rows, f) => executionMarks(rows, f).map((m) => m.onTime)
    // Once a day at 08:00: 07:00–10:00.
    const once = { kind: 'daily', times: ['08:00'] }
    expect(onTime([at('06:59')], once)).toEqual([false])
    expect(onTime([at('07:00')], once)).toEqual([true])
    expect(onTime([at('10:00')], once)).toEqual([true])
    expect(onTime([at('10:01')], once)).toEqual([false])
    // Three times (08:00, 14:00, 23:00): ±1 hour each.
    const three = { kind: 'daily', times: ['08:00', '14:00', '23:00'] }
    expect(onTime([at('08:30'), at('13:10'), at('23:45')], three)).toEqual([true, true, true])
    expect(onTime([at('08:30'), at('16:00'), at('21:00')], three)).toEqual([true, false, false])
  })
  it('uses the database count for the current period and the history once the period moved on', () => {
    const record = { frequency: daily4, assignments: { ΜΕΘ: { nextDueAt: '2026-10-19T16:00:00Z', progress: { start: '2026-10-18T21:00:00.000Z', required: 4, done: 4, extra: 0 }, history: [] } } }
    expect(assignmentProgress(record, 'ΜΕΘ', now)).toMatchObject({ done: 4, complete: true, unit: 'day' })
    expect(isControlDue(record, 'ΜΕΘ', now)).toBe(false)
    expect(assignmentProgress(record, 'ΜΕΘ', new Date('2026-10-20T06:00:00Z'))).toMatchObject({ done: 0, complete: false })
  })
  it('is due when the period still needs an entry, not when the next deadline is in a later period', () => {
    const record = (nextDueAt) => ({ frequency: { kind: 'monthly', interval: 1 }, assignments: { ΜΕΘ: { nextDueAt, history: [] } } })
    expect(isControlDue(record('2026-10-31T21:59:59Z'), 'ΜΕΘ', now)).toBe(true)
    expect(isControlDue(record('2026-11-30T21:59:59Z'), 'ΜΕΘ', now)).toBe(false)
    expect(assignmentStatus({ ...record('2026-10-01T00:00:00Z'), status: 'inactive' }, 'ΜΕΘ', now)).toBe('paused')
  })
})

describe('filters keep only the selected department everywhere', () => {
  const now = new Date('2026-10-08T12:00:00Z')
  const item = (id, extra = {}) => ({
    id, title: id, category: 'Θερμοκρασίες', frequency: { kind: 'weekly', interval: 1 }, responseConfig: { criticality: 'high' }, ...extra,
    assignments: {
      ΜΕΘ: { dbId: `${id}-icu`, nextDueAt: '2026-10-01T00:00:00Z', history: [{ at: '2026-10-05T10:00:00Z' }] },
      ΤΕΠ: { dbId: `${id}-ed`, nextDueAt: '2026-10-30T00:00:00Z', history: [{ at: '2026-10-06T10:00:00Z' }, { at: '2026-09-29T10:00:00Z' }] },
    },
  })
  const rows = [{ item: item('A'), departments: ['ΜΕΘ', 'ΤΕΠ'] }, { item: item('B', { responseConfig: { criticality: 'low' } }), departments: ['ΤΕΠ'] }]

  it('narrows each row to the department, and the status to its departments', () => {
    expect(scopeControlRows(rows, { department: 'ΜΕΘ' }).map((r) => [r.item.id, r.departments])).toEqual([['A', ['ΜΕΘ']]])
    expect(filterControlRows(rows, { status: 'overdue', now }).map((r) => [r.item.id, r.departments])).toEqual([['A', ['ΜΕΘ']]])
    expect(filterControlRows(rows, { criticality: 'low' }).map((r) => r.item.id)).toEqual(['B'])
    expect(filterControlRows(rows, { frequency: 'daily' })).toEqual([])
  })
  it('the adherence and the calendar count the selected department only', () => {
    const icu = scopeControlRows(rows, { department: 'ΜΕΘ' })
    const { lines, totals } = programmeAdherence(icu, { from: new Date('2026-09-10T12:00:00Z'), to: now, now })
    expect(lines.map((l) => l.department)).toEqual(['ΜΕΘ'])
    expect(totals.performed).toBe(1)
    expect(programmeCalendar(icu, 2026, now).map((l) => l.department)).toEqual(['ΜΕΘ'])
  })
})

describe('over-entry guard', () => {
  beforeEach(() => { configureDataEnvironment({ mode: 'demo', demoAccountId: 'guard-test' }); globalThis.localStorage?.clear?.() })
  afterEach(() => configureDataEnvironment({ mode: 'production' }))

  it('refuses a fifth entry of a four-a-day control and keeps an extra one with its reason', async () => {
    const { loadControlByCode, completeControlExecution } = await import('../src/features/controls/controlCloudService')
    const record = await loadControlByCode('demo-hospital', 'CTRL-DEMO-0005')
    const progress = assignmentProgress(record, 'ΜΕΘ')
    expect(progress).toMatchObject({ required: 4, done: 4, complete: true })
    await expect(completeControlExecution('demo-hospital', record, 'ΜΕΘ', { value: 'Συμμορφώνεται' })).rejects.toMatchObject({ code: 'control_period_complete' })
    await expect(completeControlExecution('demo-hospital', record, 'ΜΕΘ', { value: 'Συμμορφώνεται', extra: { reason: '  ' } })).rejects.toThrow('control_extra_reason_required')
    const saved = await completeControlExecution('demo-hospital', record, 'ΜΕΘ', { value: 'Συμμορφώνεται', extra: { reason: 'Επαναληπτικός έλεγχος μετά από απόκλιση' } })
    expect(saved).toMatchObject({ isExtra: true, extraReason: 'Επαναληπτικός έλεγχος μετά από απόκλιση' })
    const after = await loadControlByCode('demo-hospital', 'CTRL-DEMO-0005')
    expect(assignmentProgress(after, 'ΜΕΘ')).toMatchObject({ done: 4, extra: 1 })
    // The internal ward has three of four: the fourth is a regular entry.
    expect(assignmentProgress(after, 'Παθολογική')).toMatchObject({ done: 3, complete: false })
    await completeControlExecution('demo-hospital', after, 'Παθολογική', { value: 'Συμμορφώνεται' })
    const done = await loadControlByCode('demo-hospital', 'CTRL-DEMO-0005')
    expect(assignmentProgress(done, 'Παθολογική')).toMatchObject({ done: 4, complete: true })
    // Next due: tomorrow's first slot, 07:00 + 1 hour (by 08:00 Athens).
    expect(zonedParts(done.assignments.Παθολογική.nextDueAt)).toMatchObject({ hour: 8, minute: 0 })
  })

  it('is enforced by the database too, for new entries of the current period only', () => {
    const sql = readFileSync(new URL('../supabase/migrations/20261121140000_control_due_rules.sql', import.meta.url), 'utf8')
    expect(sql).toContain('create or replace trigger control_executions_period_guard before insert on public.control_executions')
    expect(sql).toContain("raise exception 'control_period_complete'")
    expect(sql).toContain("raise exception 'control_extra_reason_required'")
    expect(sql).toContain('now() >= v_start and now() < v_end')
    expect(sql).not.toMatch(/create temp(orary)? table/i)
  })
})

describe('working days only (Monday–Friday)', () => {
  const f = { kind: 'daily', times: ['08:00'], weekdaysOnly: true }
  it('skips the weekend: after Friday or at the weekend, due on Monday', () => {
    expect(nextDueAfterExecution(f, new Date('2026-10-16T05:00:00Z'), 1)).toBe('2026-10-19T07:00:00.000Z') // Fri → Mon 10:00
    expect(nextDueAfterExecution(f, new Date('2026-10-17T05:00:00Z'), 1)).toBe('2026-10-19T07:00:00.000Z') // Sat → Mon 10:00
    expect(nextDueAfterExecution({ ...f, weekdaysOnly: undefined }, new Date('2026-10-16T05:00:00Z'), 1)).toBe('2026-10-17T07:00:00.000Z')
    expect(nextDeadlineAfter(f, new Date('2026-10-16T08:00:00Z'))).toBe('2026-10-19T07:00:00.000Z')
  })
  it('expects no entry at the weekend', () => {
    // Monday 12 to Monday 19 October: five working days.
    expect(programmeAdherence([{ item: { id: 'W', frequency: f, assignments: { Ενδοσκοπικό: { history: [] } } }, departments: ['Ενδοσκοπικό'] }], { from: new Date('2026-10-11T21:00:00Z'), to: new Date('2026-10-18T21:00:00Z'), now: new Date('2026-10-18T21:00:00Z') }).totals.expected).toBe(5)
  })
  it('is mirrored by the database', () => {
    const sql = readFileSync(new URL('../supabase/migrations/20261211120000_control_weekdays_only.sql', import.meta.url), 'utf8')
    expect(sql).toContain("p_frequency ->> 'weekdaysOnly'")
    expect(sql).toContain('private.control_working_day(p_frequency, v_local::date + 1)')
  })
})

describe('a department records inside the window of the control time', () => {
  it('opens 1 hour before a set time and closes at its margin; outside, the entry is not offered', async () => {
    const { recordWindow } = await import('../src/features/controls/controlScheduling')
    const item = (history, times = ['09:00', '17:00']) => ({ id: 'A', frequency: { kind: 'daily', times }, assignments: { ΜΕΘ: { nextDueAt: '2026-10-27T08:00:00Z', history } } })
    const at = (iso) => new Date(iso)
    // 09:00 and 17:00 Athens (UTC+2 on 27/10): 09:00 opens 08:00 and closes 10:00 (1 hour margin with two times).
    expect(recordWindow(item([]), 'ΜΕΘ', at('2026-10-27T04:30:00Z'))).toMatchObject({ gated: true, state: 'before', opens: at('2026-10-27T06:00:00Z') })
    expect(recordWindow(item([]), 'ΜΕΘ', at('2026-10-27T06:30:00Z'))).toMatchObject({ gated: true, state: 'open' })
    // 09:00 done; at 12:30 the next is 17:00 (opens 16:00 Athens).
    expect(recordWindow(item([{ at: '2026-10-27T06:10:00Z' }]), 'ΜΕΘ', at('2026-10-27T09:30:00Z'))).toMatchObject({ gated: true, state: 'before', opens: at('2026-10-27T14:00:00Z') })
    // Nothing done and 17:00 passed too: closed.
    expect(recordWindow(item([]), 'ΜΕΘ', at('2026-10-27T18:00:00Z'))).toMatchObject({ gated: true, state: 'closed' })
    // Weekly controls and controls without set times are not held to a window.
    expect(recordWindow({ frequency: { kind: 'weekly', interval: 1 }, assignments: { ΜΕΘ: {} } }, 'ΜΕΘ')).toEqual({ gated: false })
    expect(recordWindow(item([], []), 'ΜΕΘ', at('2026-10-27T04:30:00Z'))).toEqual({ gated: false })
  })
})

describe('who records outside the window', () => {
  it('only the hospital administrator and the platform owner', async () => {
    const { canRecordAnytime } = await import('../src/features/controls/controlScheduling')
    const { ROLES } = await import('../src/core/permissions/roles')
    expect(canRecordAnytime(ROLES.HOSPITAL_ADMIN)).toBe(true)
    expect(canRecordAnytime(ROLES.PLATFORM_OWNER)).toBe(true)
    expect(canRecordAnytime(ROLES.INFECTION_CONTROL_LEAD)).toBe(false)
    expect(canRecordAnytime(ROLES.DEPARTMENT_MANAGER)).toBe(false)
  })
  it('the database holds the same rule for a signed-in department user', async () => {
    const { readFileSync } = await import('node:fs')
    const sql = readFileSync('supabase/migrations/20261211200000_control_entry_window_guard.sql', 'utf8')
    expect(sql).toContain("array['hospital_admin']::public.app_role[]")
    expect(sql).toContain('public.current_user_is_platform_owner()')
    expect(sql).toContain("raise exception 'control_outside_window'")
    expect(sql).toContain('if auth.uid() is null then return new; end if;')
  })
})
