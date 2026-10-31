import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { deadlineText } from '../src/features/controls/controlProgress'
import { filterControlRows } from '../src/features/controls/controlFilters'
import { dashboardTasks } from '../src/features/dashboard/dashboardTasks'

const now = new Date('2026-10-27T08:00:00Z') // 10:00 in Athens

describe('a department records its controls of the day', () => {
  it('says a deadline in plain words', () => {
    expect(deadlineText('2026-10-27T19:59:00Z', 'el', now)).toBe('σήμερα έως 21:59')
    expect(deadlineText('2026-10-28T07:00:00Z', 'el', now)).toBe('αύριο έως 09:00')
    expect(deadlineText('2026-11-30T19:59:00Z', 'el', now)).toBe('έως 30/11/2026, 21:59')
    expect(deadlineText('2026-10-26T19:59:00Z', 'el', now)).toBe('έληξε 26/10/2026, 21:59')
  })

  it('keeps the controls a department still owes today', () => {
    const daily = { id: 'A', title: 'A', category: '', frequency: { kind: 'daily', timesPerDay: 1, times: ['09:00'] }, assignments: { ΜΕΘ: { nextDueAt: '2026-10-27T19:59:00Z', history: [] } } }
    const monthly = { id: 'B', title: 'B', category: '', frequency: { kind: 'monthly', interval: 1 }, assignments: { ΜΕΘ: { nextDueAt: '2026-11-30T21:59:00Z', history: [] } } }
    const rows = [{ item: daily, departments: ['ΜΕΘ'] }, { item: monthly, departments: ['ΜΕΘ'] }]
    expect(filterControlRows(rows, { status: 'today', now }).map((row) => row.item.id)).toEqual(['A'])
  })

  it('shows «Controls due today» first on a department\'s home, opening the list of today', () => {
    const tasks = dashboardTasks('department_user', { controlsDueToday: 3, overdueControls: 1 })
    expect(tasks[0]).toMatchObject({ title: 'Έλεγχοι για σήμερα', count: 3, to: '/controls?due=today' })
  })

  it('records from the list and returns there after saving', () => {
    const page = fs.readFileSync('src/features/controls/ControlsPage.jsx', 'utf8')
    const record = fs.readFileSync('src/features/controls/ControlRecordPage.jsx', 'utf8')
    expect(page).toContain("{state:{returnTo:'/controls'}}")
    expect(record).toContain('navigate(returnTo||recordUrl,{replace:true})')
  })
})
