import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The «…» menu of a record (edit, archive, delete, reject…) is the law of every record:
// the top right corner of the record card, never the header.
const shell = readFileSync('src/design-system/EntityRecordShell.jsx', 'utf8')

describe('record «…» menu placement', () => {
  it('renders the general record menu inside the record body, not the header', () => {
    const header = shell.slice(shell.indexOf('<header className="entity-record-header'), shell.indexOf('</header>'))
    expect(header).not.toContain('entity-record-general-actions')
    const body = shell.slice(shell.indexOf('<section className="entity-record-body'))
    expect(body).toContain('entity-record-general-actions')
  })

  it('anchors the menu to the top right corner of the card', () => {
    const css = readFileSync('src/styles/design-system.css', 'utf8')
    expect(css).toMatch(/\.entity-record-body>\.entity-record-general-actions\{position:absolute;top:\d+px;right:\d+px/)
  })
})
