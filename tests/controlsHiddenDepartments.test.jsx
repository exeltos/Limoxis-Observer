// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ControlDepartmentCards } from '../src/features/controls/ControlDepartmentCards'
import { readSource } from './helpers/readSource'

const card = (department) => ({ department, controls: 2, overdue: 0, todayDone: 0, todayRequired: 0, rate: 90, lastAt: null })

describe('Controls: departments I see', () => {
  it('ticks every shown department while choosing and toggles a card on a click', () => {
    const onToggle = vi.fn()
    render(<ControlDepartmentCards picking cards={[card('ΜΕΘ'), card('ΤΕΠ')]} hidden={new Set(['ΤΕΠ'])} onToggle={onToggle} language="el" />)
    expect(screen.getByRole('button', { name: /ΜΕΘ/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: /ΤΕΠ/ }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.queryByText('Όλοι οι έλεγχοι')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /ΤΕΠ/ }))
    expect(onToggle).toHaveBeenCalledWith('ΤΕΠ')
  })

  it('names the hidden departments under the cards, with a way back', () => {
    const onShowAll = vi.fn()
    render(<ControlDepartmentCards cards={[card('ΜΕΘ')]} hiddenCount={2} onShowAll={onShowAll} language="el" />)
    expect(screen.getByText(/2 κρυμμένα τμήματα/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Εμφάνιση' }))
    expect(onShowAll).toHaveBeenCalled()
  })

  it('keeps the choice on the user account and applies it to every tab', () => {
    const page = readSource('src/features/controls/ControlsPage.jsx')
    expect(page).toContain("useViewPreference(tenant?.id,user?.id,'controls.hiddenDepartments',NO_HIDDEN)")
    expect(page).toContain('const scopedControls=useMemo(()=>hidden.size||closedToday.size?accessibleControls.map(')
    const sql = readSource('supabase/migrations/20261231242000_user_view_preferences.sql')
    expect(sql).toContain('user_id = (select auth.uid()) and public.is_org_member(organization_id)')
  })
})

describe('Controls: Today on a weekend', () => {
  it('leaves out the departments whose daily controls all run Monday–Friday, only on Saturday and Sunday', async () => {
    const { weekendClosedDepartments } = await import('../src/features/controls/controlDepartmentCards')
    const weekdays = { kind: 'daily', times: ['09:00'], weekdaysOnly: true }
    const everyDay = { kind: 'daily', times: ['09:00'] }
    const rows = [
      { item: { frequency: everyDay, assignments: { 'Απεικονίσεις': { frequency: weekdays }, 'ΜΕΘ': { frequency: everyDay } } }, departments: ['Απεικονίσεις', 'ΜΕΘ'] },
      { item: { frequency: { kind: 'weekly' }, assignments: {} }, departments: ['Απεικονίσεις'] },
    ]
    expect([...weekendClosedDepartments(rows, new Date('2026-11-07T10:00:00Z'))]).toEqual(['Απεικονίσεις'])
    expect(weekendClosedDepartments(rows, new Date('2026-11-09T10:00:00Z')).size).toBe(0)
  })
})
