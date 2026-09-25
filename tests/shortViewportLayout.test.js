import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

const main = fs.readFileSync('src/main.jsx', 'utf8')
const css = fs.readFileSync('src/styles/short-viewport.css', 'utf8')

describe('short screens (13" notebooks) scroll instead of clipping', () => {
  it('loads the short-viewport rules after every other stylesheet', () => {
    const imports = [...main.matchAll(/import '\.\/styles\/([^']+)'/g)].map(m => m[1])
    expect(imports.at(-1)).toBe('short-viewport.css')
  })
  it('lets the workspace scroll and keeps registries at a usable height', () => {
    expect(css).toContain('.content,.content:has(>.page-fill){overflow-x:hidden!important;overflow-y:auto!important}')
    expect(css).toContain('.page-fill{min-height:760px!important}')
    expect(css).toContain('.laboratory-registry-page')
    expect(css).toContain('.sidebar nav{overflow-y:auto!important')
  })
})
