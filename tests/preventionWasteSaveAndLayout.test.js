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

  it('removes the related-workflows strip and exposes staff vaccinations as a Prevention tab',()=>{
    expect(prevention).not.toContain('prevention-related-strip')
    expect(prevention).not.toContain('preventionAntimicrobialStewardshipLabel')
    expect(prevention).toContain('prevention-vaccinations-tab')
    expect(prevention).toContain("/occupational-health?tab=vaccinations")
  })

  it('renders the vaccination deep-link as a standalone Prevention workspace',()=>{
    expect(occupational).toContain("const vaccinationWorkspace=searchParams.get('tab')==='vaccinations'")
    expect(occupational).toContain("<BackButton onClick={()=>navigate('/prevention?tab=vaccinations')}")
    expect(occupational).toContain("vaccinationWorkspace?[UI_ACTIONS.CREATE,UI_ACTIONS.EXPORT]")
    expect(occupational).toContain("!vaccinationWorkspace&&<nav className=\"tabs occupational-tabs canonical-module-tabs\"")
    expect(occupational).toContain("setSearchParams({tab:next},{replace:true})")
  })
})