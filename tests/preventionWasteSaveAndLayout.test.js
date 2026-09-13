import fs from 'node:fs'
import {describe,expect,it} from 'vitest'

const waste=fs.readFileSync('src/features/prevention/WasteEntryEditor.jsx','utf8')
const css=fs.readFileSync('src/styles/prevention-refinements.css','utf8')

describe('prevention waste editor refinements',()=>{
  it('hydrates the waste type when support data arrives but leaves department for explicit user selection',()=>{
    expect(waste).toContain('||wasteTypes[0]')
    expect(waste).toContain('wasteTypeId,wasteType,type:wasteType')
    expect(waste).not.toContain('state.departmentEl||fixedDepartment||departments[0]?.el')
    expect(waste).toContain("<option value=\"\">{language==='en'?'Select department':'Επιλέξτε τμήμα'}</option>")
  })

  it('does not keep save disabled just because support arrays were empty on the first render',()=>{
    expect(waste).toContain("const valid=Boolean(validPeriod&&draft.departmentEl&&draft.wasteType&&weight>0&&Number(draft.containers)>=0)")
    expect(waste).not.toContain('&&departments.length&&wasteTypes.length')
  })

  it('gives the department more width than the two date fields',()=>{
    expect(css).toContain('grid-template-columns:180px 180px minmax(360px,1fr)')
    expect(css).toContain('.waste-page-editor .waste-smart-measurement-grid')
  })

  it('keeps disabled WHO add-opportunity text clearly readable',()=>{
    expect(css).toContain('color:#fff!important')
    expect(css).toContain('.who-page-editor .who-current-preview .lo-action-button:disabled span')
  })
})
