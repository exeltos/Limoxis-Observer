import fs from 'node:fs'
import {describe,expect,it} from 'vitest'

const waste=fs.readFileSync('src/features/prevention/WasteEntryEditor.jsx','utf8')
const css=fs.readFileSync('src/styles/workspaces.css','utf8')

describe('prevention new-record defaults and visible refinements',()=>{
  it('does not preselect waste dates or department for a new record',()=>{
    expect(waste).toContain("const initialDepartment=initialRecord?.departmentEl||fixedDepartment||''")
    expect(waste).toContain("const initialPeriodStart=initialRecord?.periodStart||initialRecord?.date||''")
    expect(waste).toContain("const initialPeriodEnd=initialRecord?.periodEnd||initialRecord?.date||''")
    expect(waste).toContain("date:'',periodStart:'',periodEnd:'',departmentEl:initialDepartment")
  })

  it('does not later auto-fill an empty department when support data arrives',()=>{
    expect(waste).not.toContain("state.departmentEl||fixedDepartment||departments[0]?.el")
    expect(waste).toContain("<option value=\"\">{language==='en'?'Select department':'Επιλέξτε τμήμα'}</option>")
  })

  it('targets the actual ActionButton and editor classes for visible styling',()=>{
    expect(css).toContain('.who-page-editor .who-current-preview .lo-action-button:disabled')
    expect(css).toContain('.prevention-record-shell .waste-page-editor .waste-smart-measurement-grid')
    expect(css).toContain('grid-template-columns:repeat(24,minmax(0,1fr))')
    expect(css).toContain('grid-column:span 5!important')
    expect(css).toContain('grid-column:span 14!important')
  })
})
