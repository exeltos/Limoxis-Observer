import { describe,it,expect } from 'vitest'
import fs from 'node:fs'

const actions=fs.readFileSync('src/styles/design-system-actions.css','utf8')
const org=fs.readFileSync('src/features/platform/PlatformOrganizationRecord.jsx','utf8')
const demo=fs.readFileSync('src/features/platform/PlatformDemoRecord.jsx','utf8')

describe('Platform Owner canonical action language',()=>{
 it('uses shared ActionButton for full-record edit and delete actions',()=>{
  expect(org).toContain('<ActionButton tone="edit"')
  expect(org).toContain('<ActionButton tone="danger"')
  expect(org).not.toContain('<Button variant="danger"')
 })
 it('keeps platform shell actions icon-based and tone-consistent',()=>{
  expect(demo).toContain('tone="danger"')
 })
 it('reserves solid destructive styling for confirmation buttons',()=>{
  expect(actions).toContain('.lo-action-button-danger{color:var(--lo-status-danger-fg);background:var(--lo-color-surface)')
  expect(actions).toContain('.button.button-destructive{color:#fff;background:var(--lo-status-danger-fg)')
 })
})
