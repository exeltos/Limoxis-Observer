import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

// User-reported: a small "⛶ expand field" button (injected sitewide by
// GlobalTextareaExpander next to every <textarea>) showed up floating in
// the wrong place, overlapping unrelated content on a Quality incident's
// read-only "Περιγραφή" field. Root cause: the component's MutationObserver
// only ever ADDED buttons for newly-found textareas — it never removed a
// button once its textarea left the DOM (which happens constantly, since
// many record pages swap <textarea> for a plain <p> when leaving edit
// mode). The orphaned button stayed stuck at its last computed position.
// A narrow CSS patch (modules.css, `.quality-readonly-text:not(:has(textarea))
// .textarea-expand-trigger{display:none!important}`) already band-aided
// this for ONE specific container class, proving the bug was known — but
// it only covered that one class, not the general case (e.g. the main
// "Περιγραφή" field, which has no .quality-readonly-text class, still
// showed a stray button). Fixed at the source instead of patching another
// container one at a time: every scan now also prunes any tracked button
// whose textarea is no longer in the document.
describe('GlobalTextareaExpander removes its injected button once the textarea it belongs to is gone', () => {
  it('prunes orphaned buttons on every scan, not just adds new ones', () => {
    const source = fs.readFileSync('src/design-system/GlobalTextareaExpander.jsx', 'utf8')
    expect(source).toContain('const prune=()=>{')
    expect(source).toContain('if(document.body.contains(textarea))return')
    expect(source).toContain('button.remove()')
    expect(source).toContain('listeners.delete(textarea)')
    expect(source).toContain('const scan=()=>{document.querySelectorAll(\'textarea\').forEach(enhance);prune()}')
  })
})
