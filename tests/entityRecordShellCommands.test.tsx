// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { LanguageProvider } from '../src/core/i18n/LanguageContext'
import { EntityRecordShell } from '../src/design-system/EntityRecordShell'
import { ExportMenu } from '../src/design-system/ExportMenu'
import { IconButton } from '../src/design-system/IconButton'

describe('EntityRecordShell header actions', () => {
  afterEach(cleanup)

  it('keeps a record command visible beside the export control instead of dropping it', () => {
    render(<MemoryRouter><LanguageProvider><EntityRecordShell title="Monitor" headerActions={<div className="row-actions">
      <ExportMenu onPrint={vi.fn()} />
      <button type="button" onClick={vi.fn()}>Καταγραφή ελέγχου</button>
      <IconButton tone="danger" label="Διαγραφή εξοπλισμού" onClick={vi.fn()}>×</IconButton>
    </div>}><p>body</p></EntityRecordShell></LanguageProvider></MemoryRouter>)

    const utilities = document.querySelector('.entity-record-utilities')
    const command = screen.getByRole('button', { name: 'Καταγραφή ελέγχου' })
    expect(utilities).toContainElement(command)
    // The export control stays last (top right); delete goes to the «…» menu.
    expect(utilities.lastElementChild).not.toContainElement(command)
    expect(screen.queryByRole('button', { name: 'Διαγραφή εξοπλισμού' })).toBeNull()
  })
})
