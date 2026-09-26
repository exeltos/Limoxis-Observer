import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
// Only the declarations matter here, not whether they carry !important.
const withoutImportant = css => css.replaceAll('!important', '')


const main = fs.readFileSync('src/main.jsx', 'utf8')
const css = fs.readFileSync('src/styles/responsive.css', 'utf8')

describe('short screens (13" notebooks) scroll instead of clipping', () => {
  it('loads the short-viewport, rail and row-return rules last', () => {
    const imports = [...main.matchAll(/import '\.\/styles\/([^']+)'/g)].map(m => m[1])
    expect(imports.at(-1)).toBe('responsive.css')
    const order = ['short-viewport', 'tablet-rail', 'row-return-highlight'].map(name => css.indexOf(`/* ==== ${name} ==== */`))
    expect(order.every(index => index > 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(css.slice(order[2] + 1)).not.toContain('/* ==== ')
  })
  it('lets the workspace scroll and keeps registries at a usable height', () => {
    expect(withoutImportant(css)).toContain('.content,.content:has(>.page-fill){overflow-x:hidden;overflow-y:auto}')
    expect(withoutImportant(css)).toContain('.page-fill{min-height:760px}')
    expect(css).toContain('.laboratory-registry-page')
    expect(withoutImportant(css)).toContain('.sidebar nav{overflow-y:auto')
  })
})

describe('tablets and phones', () => {
  const rail = fs.readFileSync('src/styles/responsive.css', 'utf8')
  const shell = fs.readFileSync('src/app/AppShell.jsx', 'utf8')
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
  const css = fs.readFileSync('src/styles/responsive.css', 'utf8')
  const read = p => fs.readFileSync(p, 'utf8')
  it('colours the cells, not only the row, so the highlight is visible', () => {
    expect(css).toContain('tr.registry-row-returned>td{background:#e3f0fa!important')
  })
  it('keeps the returned class when a registry adds its own row class', () => {
    const surveillance = read('src/features/surveillance/SurveillanceCanonicalPage.jsx')
    expect(surveillance).not.toContain("className:'clickable-row'}")
    expect(surveillance).toContain('className:`${rp.className} clickable-row`')
  })
  it('remembers the opened row in occupational health, environment, organizations and demos', () => {
    expect(read('src/features/occupational-health/OccupationalHealthPage.jsx')).toContain("useRegistryMemory('occupational-health')")
    expect(read('src/features/surveillance/EnvironmentalSurveillanceFlow.jsx')).toContain("' registry-row-returned'")
    expect(read('src/features/platform/PlatformOrganizationsRegistry.jsx')).toContain('limoxis.registry.platform-organizations.selected')
    expect(read('src/features/platform/PlatformDemosRegistry.jsx')).toContain('limoxis.registry.platform-demos.selected')
  })
})
