// The editors and services are exercised by behavior in preventionAntisepticWasteBehavior
// and preventionVaccinationBundleBehavior; the layout (CSS) rules stay here.
import fs from 'node:fs'
import {describe,expect,it} from 'vitest'
const css=fs.readFileSync('src/styles/workspaces.css','utf8')

describe('prevention new-record defaults and visible refinements',()=>{
  it('targets the actual ActionButton and editor classes for visible styling',()=>{
    expect(css).toContain('.who-page-editor .who-section-title .lo-action-button:disabled')
    expect(css).toContain('.prevention-record-shell .waste-page-editor .waste-smart-measurement-grid')
    expect(css).toContain('grid-template-columns:repeat(24,minmax(0,1fr))')
    expect(css).toContain('grid-column:span 5!important')
    expect(css).toContain('grid-column:span 14!important')
  })
})
