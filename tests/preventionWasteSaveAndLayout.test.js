// The editors and services are exercised by behavior in preventionAntisepticWasteBehavior
// and preventionVaccinationBundleBehavior; the layout (CSS) rules stay here.
import fs from 'node:fs'
import {describe,expect,it} from 'vitest'
const css=fs.readFileSync('src/styles/workspaces.css','utf8')
const occupational=fs.readFileSync('src/features/occupational-health/OccupationalHealthPage.jsx','utf8')

describe('prevention waste editor refinements',()=>{
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

  it('keeps Occupational Health focused on physician visits',()=>{
    expect(occupational).not.toContain('StaffVaccinationsPage')
    expect(occupational).not.toContain("searchParams.get('tab')==='vaccinations'")
  })
})
