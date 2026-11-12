import { describe,it,expect } from 'vitest'
import { readSource } from './helpers/readSource'

const actions=readSource('src/styles/design-system.css')

describe('Platform Owner canonical action language',()=>{
 it('reserves solid destructive styling for confirmation buttons',()=>{
  expect(actions).toContain('.lo-action-button-danger{color:var(--lo-status-danger-fg);background:var(--lo-color-surface)')
  expect(actions).toContain('.button.button-destructive{color:#fff;background:var(--lo-status-danger-fg)')
 })
})
