import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Owner's rule: one frame per content block and one line per separator in the owner console.
// A record tab panel (or the list shell) is the frame; the list inside it has no card of its own,
// and a tab row and the panel under it share the tab underline as their only line.
const css = file => readFileSync(file, 'utf8')
const rule = (file, selector) => {
  const text = css(file)
  const at = text.indexOf(`${selector}{`)
  expect(at, `${selector} in ${file}`).toBeGreaterThan(-1)
  return text.slice(at, text.indexOf('}', at))
}

describe('owner console: one frame, one line', () => {
  it('a registry embedded in a record tab has no frame of its own', () => {
    const block = rule('src/styles/design-system.css', ':is(.entity-record-body>.workspace-column.workspace-fill>.registry-workspace,.platform-owner-record-shell .registry-workspace)')
    expect(block).toContain('border:0')
    expect(block).toContain('border-radius:0')
    expect(css('src/styles/design-system.css')).toContain('.platform-owner-record-shell .registry-workspace .scroll-table,')
  })

  it('the shell frames of the owner lists contain the table card without a second border', () => {
    const block = rule('src/styles/design-system.css', '.platform-registry-shell>:is(.platform-registry-card,.diagnostics-table-wrap)')
    expect(block).toContain('border:0')
    expect(block).toContain('border-radius:0')
    expect(rule('src/styles/design-system.css', '.platform-registry-shell')).toContain('gap:0;')
  })

  it('the record tab strip and its panel are one card with a single hairline between them', () => {
    const text = css('src/styles/design-system.css')
    const panel = text.slice(text.indexOf('.platform-owner-record-shell>.entity-record-body{border:'))
    expect(panel).toContain('border-top:0')
    expect(css('src/styles/features.css')).toContain('.entity-record-shell:not(:where(.platform-owner-record-shell)){gap:8px!important;')
  })

  it('a list frame under a tab row drops its top border and the gap', () => {
    const text = css('src/styles/design-system.css')
    expect(text).toContain(':is(.page,.page-fill)>.canonical-module-tabs+:is(.platform-registry-shell,.registry-workspace,.management-shell){border:1px solid var(--lo-color-border);border-top:0;')
    expect(text).toContain('.canonical-module-tabs:has(+:is(.platform-registry-shell,.registry-workspace,.management-shell)){margin-bottom:-12px}')
  })
})
