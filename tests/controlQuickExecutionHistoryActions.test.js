import { describe,it,expect } from 'vitest'
import { readSource } from './helpers/readSource'

const registry=readSource(new URL('../src/features/controls/ControlsPage.jsx',import.meta.url))
const record=readSource(new URL('../src/features/controls/ControlRecordPage.jsx',import.meta.url))
const cancellation=readSource(new URL('../src/features/controls/ControlCancellationModal.jsx',import.meta.url))

describe('control quick execution and history actions',()=>{
 it('opens the control on a row click, with no execute button in the row (the execution is entered from the control)',()=>{
  expect(registry).toContain("function openControl(item,tab='')")
  expect(registry).toContain("registry.openRecord(navigate,`/controls/${item.id}${tab?`?tab=${tab}`:''}`")
  expect(registry).toContain('onClick={()=>openControl(item)}')
  expect(registry).not.toContain('function quickExecute')
  expect(registry).not.toContain('Τα στοιχεία του ελεγκτή θα συμπληρωθούν αυτόματα.')
  expect(registry).not.toContain('control-action-col')
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
