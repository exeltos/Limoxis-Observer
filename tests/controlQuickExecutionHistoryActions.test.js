import { describe,it,expect } from 'vitest'
import { readFileSync } from 'node:fs'

const registry=readFileSync(new URL('../src/features/controls/ControlsPage.jsx',import.meta.url),'utf8')
const record=readFileSync(new URL('../src/features/controls/ControlRecordPage.jsx',import.meta.url),'utf8')
const cancellation=readFileSync(new URL('../src/features/controls/ControlCancellationModal.jsx',import.meta.url),'utf8')

describe('control quick execution and history actions',()=>{
 it('keeps row click for specification and adds a dedicated quick execution action',()=>{
  expect(registry).toContain('registry.openRecord(navigate,`/controls/${row.item.id}`')
  expect(registry).toContain('async function quickExecute(item,deps,e)')
  expect(registry).toContain('Τα στοιχεία του ελεγκτή θα συμπληρωθούν αυτόματα.')
  expect(registry).toContain('IconButton')
  expect(registry).toContain('?department=${encodeURIComponent(dep)}&execute=1')
 })

 it('uses the standard execution registry with a three-dot action menu per history row',()=>{
  expect(record).toContain('wrapperClassName="scroll-table"')
  expect(record).toContain('<OverflowMenu items={historyActions(h)}')
  expect(record).toContain("id:'edit'")
  expect(record).toContain("id:'delete'")
  expect(record).toContain("id:'void'")
 })

 it('keeps deletion auditable instead of hard deleting execution history',()=>{
  expect(record).toContain('`[DELETE] ${payload.reason.trim()}`')
  expect(record).toContain('mode="delete"')
  expect(cancellation).toContain("mode='void'")
  expect(cancellation).toContain('audit trail')
 })
})
