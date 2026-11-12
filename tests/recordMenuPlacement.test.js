import { describe, expect, it } from 'vitest'
import { readSource } from './helpers/readSource'

// The «…» menu of a record (edit, archive, delete, reject…) is the law of every record:
// the top right corner of the record card, never the header.
const shell = readSource('src/design-system/EntityRecordShell.jsx')

describe('record «…» menu placement', () => {
  it('renders the general record menu inside the record body, not the header', () => {
    const header = shell.slice(shell.indexOf('<header className="entity-record-header'), shell.indexOf('</header>'))
    expect(header).not.toContain('entity-record-general-actions')
    const body = shell.slice(shell.indexOf('<section className="entity-record-body'))
    expect(body).toContain('entity-record-general-actions')
  })

  it('anchors the menu to the top right corner of the card', () => {
    const css = readSource('src/styles/design-system.css')
    expect(css).toMatch(/\.entity-record-body>\.entity-record-general-actions\{position:absolute;top:\d+px;right:\d+px/)
  })
})
