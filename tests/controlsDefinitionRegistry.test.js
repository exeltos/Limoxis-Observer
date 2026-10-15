import fs from 'node:fs'
import {describe,expect,it} from 'vitest'

const registry=fs.readFileSync('src/features/controls/ControlsPage.jsx','utf8')
const record=fs.readFileSync('src/features/controls/ControlRecordPage.jsx','utf8')
const editor=fs.readFileSync('src/features/controls/ControlEditor.jsx','utf8')

describe('controls definition-centric workflow',()=>{
 it('shows one registry row per control definition using the canonical registry layout',()=>{
  expect(registry).toContain('<RegistryTable wrapperRef={registry.scrollRef}')
  expect(registry).toContain('renderRow={({item,departments:deps})=>')
  expect(registry).toContain('<tr key={item.id}')
  expect(registry).toContain('registry.openRecord(navigate,`/controls/${item.id}`')
  expect(registry).toContain('{rows.length>0&&<RegistryPagination language={language}')
  expect(registry).not.toContain('rowKey={row=>`${row.item.id}:${row.department}`}')
 })

 it('keeps department assignments and executions inside the control record',()=>{
  expect(record).toContain('const assignments=visibleDepartments.map')
  expect(record).toContain('const historyRows=assignments.flatMap')
  expect(record).toContain("label:en?'Executions':'Εκτελέσεις'")
  expect(record).toContain("key:'department',label:en?'Department':'Τμήμα'")
 })

 it('supports select all and clear all for department assignment',()=>{
  expect(editor).toContain('<MultiSelect className="control-departments-select"')
  expect(editor).toContain("en?'Select all':'Επιλογή όλων'")
  expect(editor).toContain("en?'Clear all':'Αποεπιλογή όλων'")
 })
})
