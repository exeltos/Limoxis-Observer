import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

// User-reported: a Quality record still had a lot of unused vertical
// whitespace between fields even after the scroll fix, because the
// compact spacing for .record-section/.detail-item/.quality-description/
// etc only applied at min-width:1400px and min-height:800px — a narrower
// or shorter (but still ordinary) desktop window got the roomier
// pre-compaction spacing instead. Made unconditional so records are
// compact, and more likely to need no scrolling at all, on any normal
// desktop size.
describe('the Quality record body uses its compact spacing unconditionally, not only on very large windows', () => {
  it('no longer gates the compact record spacing behind a min-width:1400px/min-height:800px media query', () => {
    const css = fs.readFileSync('src/styles/modules.css', 'utf8')
    expect(css).not.toContain('@media (min-width:1400px) and (min-height:800px){')
    expect(css).toContain('.quality-record-shell .record-section{padding:8px 10px}')
    expect(css).toContain('.quality-record-shell .detail-item{min-height:58px;padding:9px 12px}')
  })
})
