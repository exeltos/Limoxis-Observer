import { describe, expect, it } from 'vitest'
import { readSource } from './helpers/readSource'
// Only the declarations matter here, not whether they carry !important.
const withoutImportant = css => css.replaceAll('!important', '')


const main = readSource('src/main.jsx')
const css = readSource('src/styles/responsive.css')

describe('short screens (13" notebooks) scroll instead of clipping', () => {
  it('loads the short-viewport, rail and row-return rules last', () => {
    const imports = [...main.matchAll(/import '\.\/styles\/([^']+)'/g)].map(m => m[1])
    expect(imports.at(-1)).toBe('responsive.css')
    const order = ['short-viewport', 'tablet-rail', 'row-return-highlight'].map(name => css.indexOf(`/* ==== ${name} ==== */`))
    expect(order.every(index => index > 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(css.slice(order[2] + 1)).not.toContain('/* ==== ')
  })
  it('fits full-height pages to the window, scrolling the workspace only below a small floor', () => {
    expect(withoutImportant(css)).toContain('.content,.content:has(>.page-fill){overflow-x:hidden;overflow-y:auto}')
    expect(withoutImportant(css)).toContain('.page-fill{min-height:440px}')
    expect(css).not.toContain('min-height:760px')
    expect(css).toContain('@media (max-height:800px)')
    expect(css).toContain('.laboratory-registry-page')
    expect(withoutImportant(css)).toContain('.sidebar nav{overflow-y:auto')
  })
})

describe('tablets and phones', () => {
  const rail = readSource('src/styles/responsive.css')
  const shell = readSource('src/app/AppShell.jsx')
  it('drops the 1080px desktop minimum width below 1100px', () => {
    expect(withoutImportant(rail)).toContain('@media (max-width:1100px){body{min-width:0}}')
  })
  it('turns the sidebar into an icon rail with tooltips on tablets', () => {
    expect(rail).toContain('@media (min-width:781px) and (max-width:1100px)')
    expect(rail).toContain('.sidebar .nav-item>span')
    expect(shell).toContain('title={t(item.key)}')
  })
  it('lets phones scroll the whole page with a horizontal menu', () => {
    expect(rail).toContain('@media (max-width:780px)')
    expect(withoutImportant(rail)).toContain('flex-direction:row')
  })
  it('loads the rail rules after the short-viewport rules', () => {
    expect(rail.indexOf('/* ==== tablet-rail ==== */')).toBeGreaterThan(rail.indexOf('/* ==== short-viewport ==== */'))
  })
})

describe('returned-row highlight', () => {
  const css = readSource('src/styles/responsive.css')
  const read = p => readSource(p)
  it('colours the cells, not only the row, so the highlight is visible', () => {
    expect(css).toContain('tr.registry-row-returned>td{background:#e3f0fa!important')
  })
  it('remembers the opened row in occupational health, environment, organizations and demos', () => {
    expect(read('src/features/occupational-health/OccupationalHealthPage.jsx')).toContain("useRegistryMemory('occupational-health')")
    expect(read('src/features/platform/PlatformOrganizationsRegistry.jsx')).toContain('limoxis.registry.platform-organizations.selected')
    expect(read('src/features/platform/PlatformDemosRegistry.jsx')).toContain('limoxis.registry.platform-demos.selected')
  })
})
