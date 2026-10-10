import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

// User-reported: the Laboratory record page's tabs looked visibly
// different from every other canonical record page (Committees, Training,
// Indicators, ...) — smaller text, wrapping onto multiple rows instead of
// the shared single-row scrolling tab bar. Root cause: a leftover
// "v0.14.5 — no-scroll lab tabs" override in core.css, scoped to
// .laboratory-record-shell .entity-record-tabs, predating the later
// canonical-tabs-final.css pass that every other module now relies on.
describe('the Laboratory record tabs use the shared canonical tab style, not a module-specific override', () => {
  it('core.css no longer overrides .laboratory-record-shell .entity-record-tabs', () => {
    const core = fs.readFileSync('src/styles/foundation.css', 'utf8')
    expect(core).not.toContain('.laboratory-record-shell .entity-record-tabs')
  })
})
