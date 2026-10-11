import { describe,it,expect } from 'vitest'
import fs from 'node:fs'

const actions=fs.readFileSync('src/styles/design-system.css','utf8')

describe('Platform Owner canonical action language',()=>{
 it('reserves solid destructive styling for confirmation buttons',()=>{
  expect(actions).toContain('.lo-action-button-danger{color:var(--lo-status-danger-fg);background:var(--lo-color-surface)')
  expect(actions).toContain('.button.button-destructive{color:#fff;background:var(--lo-status-danger-fg)')
 })
})
