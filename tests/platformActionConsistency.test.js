import { describe,it,expect } from 'vitest'
import fs from 'node:fs'

const actions=fs.readFileSync('src/styles/design-system.css','utf8')
const demo=fs.readFileSync('src/features/platform/PlatformDemoRecord.jsx','utf8')

describe('Platform Owner canonical action language',()=>{
 it('keeps platform shell actions icon-based and tone-consistent',()=>{
  expect(demo).toContain('tone="danger"')
 })
 it('reserves solid destructive styling for confirmation buttons',()=>{
  expect(actions).toContain('.lo-action-button-danger{color:var(--lo-status-danger-fg);background:var(--lo-color-surface)')
  expect(actions).toContain('.button.button-destructive{color:#fff;background:var(--lo-status-danger-fg)')
 })
})
