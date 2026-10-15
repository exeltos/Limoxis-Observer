// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MultiSelect } from '../src/design-system/MultiSelect'

const options = [
  { value: 'ICU', label: 'ΜΕΘ' },
  { value: 'SURG', label: 'Χειρουργική' },
  { value: 'MED', label: 'Παθολογική' },
]

function setup(selected = []) {
  const onChange = vi.fn()
  render(
    <MultiSelect
      label="Τμήματα"
      options={options}
      selected={selected}
      onChange={onChange}
      placeholder="Επιλέξτε"
      searchPlaceholder="Αναζήτηση"
      selectAllLabel="Επιλογή όλων"
      clearAllLabel="Αποεπιλογή όλων"
      countLabel={n => `${n} τμήματα`}
    />,
  )
  return onChange
}

afterEach(cleanup)

describe('MultiSelect', () => {
  it('summarises the chosen values in the closed field', () => {
    setup(['ICU', 'SURG', 'MED'])
    expect(screen.getByRole('button', { name: /Τμήματα/ }).textContent).toBe('3 τμήματα')
  })

  it('toggles a row and keeps the list open', () => {
    const onChange = setup(['ICU'])
    fireEvent.click(screen.getByRole('button', { name: /Τμήματα/ }))
    fireEvent.click(screen.getByRole('option', { name: 'Χειρουργική' }))
    expect(onChange).toHaveBeenLastCalledWith(['ICU', 'SURG'])
    fireEvent.click(screen.getByRole('option', { name: 'ΜΕΘ' }))
    expect(onChange).toHaveBeenLastCalledWith([])
    expect(screen.getByRole('listbox')).toBeTruthy()
  })

  it('selects all of the options the search shows', () => {
    const onChange = setup([])
    fireEvent.click(screen.getByRole('button', { name: /Τμήματα/ }))
    fireEvent.change(screen.getByPlaceholderText('Αναζήτηση'), { target: { value: 'χειρ' } })
    expect(screen.getAllByRole('option')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Επιλογή όλων' }))
    expect(onChange).toHaveBeenLastCalledWith(['SURG'])
  })
})
