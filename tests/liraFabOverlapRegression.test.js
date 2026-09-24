import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

// User-reported: after expanding the LIRA assistant panel, a round button
// appeared floating outside the panel's bottom-right corner. Root cause:
// the launcher FAB (.lira-assistant-fab, position:fixed;right:22px;
// bottom:20px) was never hidden while the panel was open — only toggled an
// "active" class. The expanded panel's own inset (72px 28px 28px 272px in
// modules.css) leaves the FAB's fixed position just outside its rounded
// corner (the FAB's box extends past the panel's right/bottom edges by a
// few pixels), so it visibly pokes out. Fix: don't render the FAB at all
// while the panel is open — there's no need for an "open LIRA" trigger
// while LIRA is already open.
describe('the LIRA launcher FAB is hidden while the assistant panel is open', () => {
  it('only renders the FAB button when the panel is closed', () => {
    const launcher = fs.readFileSync('src/features/lira/LiraAssistantLauncher.jsx', 'utf8')
    expect(launcher).toContain('{!open&&<button type="button" className="lira-assistant-fab"')
  })
})
