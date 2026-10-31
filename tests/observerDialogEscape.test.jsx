// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { LanguageProvider } from '../src/core/i18n/LanguageContext'
import { ObserverDialog } from '../src/design-system/ObserverDialog'

describe('dialog window', () => {
  it('closes with Escape like ×, and takes the focus when it opens', () => {
    const onClose = vi.fn()
    render(<LanguageProvider><ObserverDialog title="Δοκιμή" onClose={onClose}><p>Περιεχόμενο</p></ObserverDialog></LanguageProvider>)
    const dialog = screen.getByRole('dialog')
    expect(document.activeElement).toBe(dialog)
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('leaves Escape to a list open inside it', () => {
    const onClose = vi.fn()
    render(<LanguageProvider><ObserverDialog title="Δοκιμή" onClose={onClose}><input aria-label="πεδίο" onKeyDown={event => { if (event.key === 'Escape') event.preventDefault() }} /></ObserverDialog></LanguageProvider>)
    fireEvent.keyDown(screen.getByLabelText('πεδίο'), { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })
})
