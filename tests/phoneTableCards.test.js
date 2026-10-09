// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { labelTableCells } from '../src/app/phoneTableCards.js'

describe('phone table cards', () => {
  it('gives every registry cell its column name, honouring colspan', () => {
    document.body.innerHTML = `<div class="content"><table class="data-table">
      <thead><tr><th>Κωδικός ▲</th><th>Τμήμα</th><th>Κατάσταση</th></tr></thead>
      <tbody><tr><td>PT-1</td><td>ΜΕΘ</td><td>Ενεργός</td></tr><tr><td colspan="2">x</td><td>y</td></tr></tbody>
    </table></div><table class="data-table"><thead><tr><th>Εκτός</th></tr></thead><tbody><tr><td>z</td></tr></tbody></table>`
    labelTableCells(document.body)
    const [first, second] = document.querySelectorAll('.content tbody tr')
    expect([...first.children].map(td => td.dataset.label)).toEqual(['Κωδικός', 'Τμήμα', 'Κατάσταση'])
    expect([...second.children].map(td => td.dataset.label)).toEqual(['Κωδικός', 'Κατάσταση'])
    expect(document.querySelector('body>table td').hasAttribute('data-label')).toBe(false)
  })
})
