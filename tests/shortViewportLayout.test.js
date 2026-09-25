import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

const main = fs.readFileSync('src/main.jsx', 'utf8')
const css = fs.readFileSync('src/styles/short-viewport.css', 'utf8')

describe('short screens (13" notebooks) scroll instead of clipping', () => {
  it('loads the short-viewport, rail and row-return rules last', () => {
    const imports = [...main.matchAll(/import '\.\/styles\/([^']+)'/g)].map(m => m[1])
    expect(imports.slice(-3)).toEqual(['short-viewport.css', 'tablet-rail.css', 'row-return-highlight.css'])
  })
  it('lets the workspace scroll and keeps registries at a usable height', () => {
    expect(css).toContain('.content,.content:has(>.page-fill){overflow-x:hidden!important;overflow-y:auto!important}')
    expect(css).toContain('.page-fill{min-height:760px!important}')
    expect(css).toContain('.laboratory-registry-page')
    expect(css).toContain('.sidebar nav{overflow-y:auto!important')
  })
})

describe('tablets and phones', () => {
  const rail = fs.readFileSync('src/styles/tablet-rail.css', 'utf8')
  const shell = fs.readFileSync('src/app/AppShell.jsx', 'utf8')
  it('drops the 1080px desktop minimum width below 1100px', () => {
    expect(rail).toContain('@media (max-width:1100px){body{min-width:0!important}}')
  })
  it('turns the sidebar into an icon rail with tooltips on tablets', () => {
    expect(rail).toContain('@media (min-width:781px) and (max-width:1100px)')
    expect(rail).toContain('.sidebar .nav-item>span')
    expect(shell).toContain('title={t(item.key)}')
  })
  it('lets phones scroll the whole page with a horizontal menu', () => {
    expect(rail).toContain('@media (max-width:780px)')
    expect(rail).toContain('flex-direction:row!important')
  })
  it('loads the rail rules after the short-viewport rules', () => {
    const imports = [...main.matchAll(/import '\.\/styles\/([^']+)'/g)].map(m => m[1])
    expect(imports.at(-2)).toBe('tablet-rail.css')
  })
})
