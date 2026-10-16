// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SearchableSelect } from '../src/design-system/SearchableSelect'

const options = [
  { value: 'Θάλαμος', label: 'Θάλαμος' },
  { value: 'Σταθμός νοσηλευτών', label: 'Σταθμός νοσηλευτών' },
]

function setup(props = {}) {
  const onChange = vi.fn()
  render(<SearchableSelect label="Χώρος" options={options} onChange={onChange} customLabel={text => `Χρήση «${text}»`} {...props} />)
  return { onChange, input: screen.getByRole('combobox') }
}

afterEach(cleanup)

describe('SearchableSelect', () => {
  it('puts the recent values first under their own heading', () => {
    const { input } = setup({ value: '', recentValues: ['Σταθμός νοσηλευτών'], recentLabel: 'Πρόσφατα' })
    fireEvent.focus(input)
    const items = screen.getAllByRole('option').map(option => option.textContent)
    expect(items[0]).toBe('Σταθμός νοσηλευτών')
    expect(screen.getByText('Πρόσφατα')).toBeTruthy()
  })

  it('keeps the first library match on Enter and offers the typed text last', () => {
    const { input, onChange } = setup({ value: '', allowCustom: true })
    fireEvent.change(input, { target: { value: 'Θάλ' } })
    const items = screen.getAllByRole('option').map(option => option.textContent)
    expect(items).toEqual(['Θάλαμος', 'Χρήση «Θάλ»'])
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('Θάλαμος')
  })

  it('keeps a typed value on leaving the field and clears the value when its text is erased', () => {
    const typed = setup({ value: '', allowCustom: true })
    fireEvent.change(typed.input, { target: { value: 'Αποθήκη' } })
    fireEvent.blur(typed.input)
    expect(typed.onChange).toHaveBeenCalledWith('Αποθήκη')
    cleanup()
    const erased = setup({ value: 'Θάλαμος', allowCustom: true })
    fireEvent.change(erased.input, { target: { value: '' } })
    fireEvent.blur(erased.input)
    expect(erased.onChange).toHaveBeenCalledWith('')
  })

  it('leaves the value alone when the field is only visited', () => {
    const { input, onChange } = setup({ value: 'Θάλαμος', allowCustom: true })
    fireEvent.focus(input)
    fireEvent.blur(input)
    expect(onChange).not.toHaveBeenCalled()
  })
})
