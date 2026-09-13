import fs from 'node:fs'
import {describe,expect,it} from 'vitest'

const waste=fs.readFileSync('src/features/prevention/WasteEntryEditor.jsx','utf8')
const css=fs.readFileSync('src/styles/prevention-refinements.css','utf8')
const prevention=fs.readFileSync('src/features/prevention/PreventionPage.jsx','utf8')
const occupational=fs.readFileSync('src/features/occupational-health/OccupationalHealthPage.jsx','utf8')

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

  it('keeps waste dates compact but wide enough for the full date and leaves Department largest',()=>{
    expect(css).toContain('grid-template-columns:repeat(24,minmax(0,1fr))')
    expect(css).toContain('>.waste-date-field')
    expect(css).toContain('grid-column:span 5!important')
    expect(css).toContain('>.waste-department-field')
    expect(css).toContain('grid-column:span 14!important')
    expect(css).toContain('grid-column:span 8!important')
  })

  it('keeps disabled WHO add-opportunity text clearly readable',()=>{
    expect(css).toContain('color:#fff!important')
    expect(css).toContain('.who-page-editor .who-current-preview .lo-action-button:disabled span')
  })

  it('renders staff vaccinations as a native Prevention tab',()=>{
    expect(prevention).not.toContain('prevention-related-strip')
    expect(prevention).not.toContain('preventionAntimicrobialStewardshipLabel')
    expect(prevention).toContain("['vaccinations','vaccinations']")
    expect(prevention).toContain("tab==='vaccinations'&&!loading&&<VaccinationTable")
    expect(prevention).toContain("setSearchParams({tab:id},{replace:true})")
    expect(prevention).not.toContain("/occupational-health?tab=vaccinations")
  })

  it('keeps Occupational Health focused on physician visits',()=>{
    expect(occupational).not.toContain('StaffVaccinationsPage')
    expect(occupational).not.toContain("searchParams.get('tab')==='vaccinations'")
  })
})
