import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const actionButton=fs.readFileSync(new URL('../src/design-system/ActionButton.jsx',import.meta.url),'utf8')
const recordActions=fs.readFileSync(new URL('../src/design-system/RecordActions.jsx',import.meta.url),'utf8')
const saveButton=fs.readFileSync(new URL('../src/design-system/SaveButton.jsx',import.meta.url),'utf8')
const observerDialog=fs.readFileSync(new URL('../src/design-system/ObserverDialog.jsx',import.meta.url),'utf8')
const analysis=fs.readFileSync(new URL('../src/features/analysis/AnalysisPage.jsx',import.meta.url),'utf8')
const css=fs.readFileSync(new URL('../src/styles/design-system-actions.css',import.meta.url),'utf8')

describe('shared semantic action design',()=>{
  it('provides one semantic wrapper for labelled and icon-only actions',()=>{
    expect(actionButton).toContain("import { Button } from './Button'")
    expect(actionButton).toContain("import { IconButton } from './IconButton'")
    expect(actionButton).toContain('iconOnly')
    expect(actionButton).toContain('lo-action-button-${tone}')
  })

  it('maps edit, delete, completion, print and export to canonical semantics',()=>{
    expect(recordActions).toContain("edit:{icon:Pencil,key:'edit',tone:'edit'}")
    expect(recordActions).toContain("delete:{icon:Trash2,key:'delete',tone:'danger'}")
    expect(recordActions).toContain("complete:{icon:CheckCircle2,key:'complete',tone:'success'}")
    expect(recordActions).toContain('action===UI_ACTIONS.PRINT||action===UI_ACTIONS.EXPORT')
    expect(recordActions).toContain('<ActionButton')
  })

  it('always gives save actions the disk icon',()=>{
    expect(saveButton).toContain("import { Save } from 'lucide-react'")
    expect(saveButton).toContain('<Save size={15} />')
  })

  it('does not automatically duplicate the dialog close action with Cancel',()=>{
    expect(observerDialog).toContain('showCancel=false')
    expect(observerDialog).toContain('showCancel&&onCancel')
  })

  it('uses the shared icon control for analytics print and export',()=>{
    expect(analysis).toContain("import { IconButton } from '../../design-system/IconButton'")
    expect(analysis).toContain('<IconButton label={tx(')
    expect(analysis).toContain("tx('Εκτύπωση','Print')")
    expect(analysis).toContain("tx('Εξαγωγή CSV','Export CSV')")
  })

  it('centralizes edit, destructive and success tones in one stylesheet',()=>{
    expect(css).toContain('.lo-action-button-edit')
    expect(css).toContain('.lo-action-button-danger')
    expect(css).toContain('.lo-action-button-success')
    expect(css).toContain('.record-actions')
  })
})
