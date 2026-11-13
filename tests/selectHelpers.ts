import { fireEvent, within } from '@testing-library/react'

// The house select (SearchableSelect): open the field named `label` inside
// `container` and return its options, or pick the one named `option`.
export function selectOptions(container, label) {
  const input = within(container).getByRole('combobox', { name: label })
  fireEvent.focus(input)
  const list = document.getElementById(input.getAttribute('aria-controls'))
  return within(list).getAllByRole('option')
}
export function chooseOption(container, label, option) {
  const target = selectOptions(container, label).find(item => (option instanceof RegExp ? option.test(item.textContent) : item.textContent === option))
  if (!target) throw new Error(`No option ${option} in ${label}`)
  fireEvent.click(target)
}
export const selectInput = (container, label) => within(container).getByRole('combobox', { name: label })
