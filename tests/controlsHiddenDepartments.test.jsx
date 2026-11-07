// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fireEvent, render, screen } from '@testing-library/react'
import { ControlDepartmentCards } from '../src/features/controls/ControlDepartmentCards'

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
    const page = readFileSync('src/features/controls/ControlsPage.jsx', 'utf8')
    expect(page).toContain("useViewPreference(tenant?.id,user?.id,'controls.hiddenDepartments',NO_HIDDEN)")
    expect(page).toContain('const scopedControls=useMemo(()=>hidden.size?accessibleControls.map(')
    const sql = readFileSync('supabase/migrations/20261231242000_user_view_preferences.sql', 'utf8')
    expect(sql).toContain('user_id = (select auth.uid()) and public.is_org_member(organization_id)')
  })
})
