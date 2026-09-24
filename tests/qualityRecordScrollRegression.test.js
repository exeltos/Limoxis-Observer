import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

// User-reported: on a fully-populated Quality incident (root cause,
// contributing factors, the "create linked CAPA" action), that content
// was unreachable at ordinary desktop sizes — no scrollbar, wheel scroll
// did nothing. Root cause: a "Quality records — no-scroll desktop fit"
// media query forced .entity-record-body (and its .record-section) to
// overflow:hidden at min-width:981px and min-height:760px — virtually
// any real desktop window — assuming a record's content always fit one
// screen. It doesn't for a fully-populated incident, so the excess was
// silently clipped with no way to reach it.
//
// The outer .content container can't be the fallback scroll region
// either: modern.css forces .content:has(>.page-fill){overflow:hidden
// !important} app-wide, by design, for every workspace-fill page. So the
// fix is to remove the no-scroll-desktop-fit override and let
// .entity-record-body fall back to its normal, unconditional
// overflow:auto (core.css) — the same internal-scroll pattern every
// other record page in the app already relies on.
describe('the Quality incident/finding/CAPA/audit record body scrolls internally at ordinary desktop sizes', () => {
  it('no longer forces .entity-record-body/.record-section to overflow:hidden at desktop widths and heights', () => {
    const css = fs.readFileSync('src/styles/modules.css', 'utf8')
    expect(css).not.toMatch(/@media\s*\(min-width:981px\)\s*and\s*\(min-height:760px\)\{\s*\.quality-record-shell\.workspace-fill>\.entity-record-body\{\s*overflow:hidden/)
  })

  it('does not force .entity-record-body back to overflow:visible/hidden for the quality record shell', () => {
    const css = fs.readFileSync('src/styles/modules.css', 'utf8')
    expect(css).not.toContain('.quality-record-shell.workspace-fill>.entity-record-body{\n  overflow:visible!important;\n}')
  })
})
