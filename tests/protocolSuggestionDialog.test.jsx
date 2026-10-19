// @vitest-environment jsdom
// The suggestion dialog opens in the decision chosen on the panel: no mode
// switch, a matching title and primary button, a house checkbox for the wording.
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { LanguageProvider } from '../src/core/i18n/LanguageContext'
import { ProtocolSuggestionDialog } from '../src/features/documents/protocolReview/ProtocolSuggestionDialog'

afterEach(cleanup)
const suggestion = { id: 's1', reason: 'guideline_updated', whatChanged: 'Demo change', draftText: 'Demo wording', affectedSections: [] }
const show = decision => render(<LanguageProvider><ProtocolSuggestionDialog suggestion={suggestion} initialDecision={decision} canRevise /></LanguageProvider>)

describe('protocol suggestion dialog', () => {
  it('accepts with a checkbox for the proposed wording and no decision switch', () => {
    const { container } = show('accepted')
    expect(screen.getByRole('dialog', { name: 'Αποδοχή πρότασης ανανέωσης' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /προτεινόμενη διατύπωση/ })).toBeChecked()
    expect(screen.getByRole('button', { name: /Αποδοχή και νέα αναθεώρηση/ })).toBeInTheDocument()
    expect(container.querySelector('.mode-switch, [role=radiogroup]')).toBeNull()
    expect(screen.queryByText('Λόγος απόρριψης *')).toBeNull()
  })
  it('rejects with a reason only', () => {
    show('rejected')
    expect(screen.getByRole('dialog', { name: 'Απόρριψη πρότασης ανανέωσης' })).toBeInTheDocument()
    expect(screen.getByText('Λόγος απόρριψης *')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.getByRole('button', { name: /Απόρριψη πρότασης/ })).toBeDisabled()
  })
})
