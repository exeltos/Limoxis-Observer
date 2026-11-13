// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FilterBar, FilterSelect } from '../src/design-system/FilterBar'
import { LanguageProvider } from '../src/core/i18n/LanguageContext'

// The filter window closes with its own «OK», and «Clear filters» sits beside it while a filter is set (owner, 11/11/2026):
// nobody has to click somewhere else on the screen to make it go away.
afterEach(() => cleanup())

const bar = props => render(
  <LanguageProvider>
    <FilterBar query="" onQueryChange={() => {}} onClear={props.onClear} activeAdvancedCount={props.active}>
      <FilterSelect label="Τμήμα" value="all" onChange={() => {}}><option value="all">Όλα</option></FilterSelect>
    </FilterBar>
  </LanguageProvider>,
)
const open = () => fireEvent.click(screen.getByRole('button', { name: /Φίλτρα|Filters/ }))

describe('FilterBar window', () => {
  it('has an OK that closes the window, with no clear button while no filter is set', () => {
    bar({ onClear: vi.fn(), active: 0 })
    open()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(document.querySelector('.filter-popover-footer .filter-popover-clear')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Εντάξει|OK/ }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows «Clear filters» beside the OK while a filter is set, and clearing closes the window', () => {
    const onClear = vi.fn()
    bar({ onClear, active: 2 })
    open()
    const footer = document.querySelector('.filter-popover-footer')
    expect(footer.querySelectorAll('button')).toHaveLength(2)
    fireEvent.click(footer.querySelector('.filter-popover-clear'))
    expect(onClear).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
