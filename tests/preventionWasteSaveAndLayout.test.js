import fs from 'node:fs'
import {describe,expect,it} from 'vitest'

const waste=fs.readFileSync('src/features/prevention/WasteEntryEditor.jsx','utf8')
const css=fs.readFileSync('src/styles/prevention-refinements.css','utf8')

describe('prevention waste editor refinements',()=>{
  it('hydrates department and waste type when support data arrives after first render',()=>{
    expect(waste).toContain('const department=state.departmentEl||fixedDepartment||departments[0]?.el')
    expect(waste).toContain('||wasteTypes[0]')
    expect(waste).toContain('wasteTypeId,wasteType,type:wasteType')
  })

  it('does not keep save disabled just because support arrays were empty on the first render',()=>{
    expect(waste).toContain("const valid=Boolean(validPeriod&&draft.departmentEl&&draft.wasteType&&weight>0&&Number(draft.containers)>=0)")
    expect(waste).not.toContain('&&departments.length&&wasteTypes.length')
  })

  it('gives the department more width than the two date fields',()=>{
    expect(css).toContain('minmax(150px,.72fr) minmax(150px,.72fr) minmax(300px,1.56fr)')
  })

  it('keeps disabled WHO add-opportunity text clearly readable',()=>{
    expect(css).toContain('color:#fff!important')
    expect(css).toContain('.who-current-preview .action-button:disabled span')
  })
})
