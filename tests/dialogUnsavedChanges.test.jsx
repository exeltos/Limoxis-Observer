// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const confirm = vi.fn()
vi.mock('../src/core/feedback/FeedbackContext', () => ({ useOptionalFeedback: () => ({ confirm }) }))
vi.mock('../src/core/i18n/LanguageContext', () => ({ useLanguage: () => ({ language: 'el' }) }))
const { ObserverDialog } = await import('../src/design-system/ObserverDialog.jsx')

function renderDialog(onClose) {
  return render(<ObserverDialog title="Νέα εγγραφή" onClose={onClose}>
    <input aria-label="Σημειώσεις"/>
    <input aria-label="Αναζήτηση" type="search"/>
  </ObserverDialog>)
}

describe('ObserverDialog unsaved changes', () => {
  afterEach(() => { cleanup(); confirm.mockReset() })

  it('closes at once when nothing was typed', async () => {
    const onClose = vi.fn()
    renderDialog(onClose)
    fireEvent.change(screen.getByLabelText('Αναζήτηση'), { target: { value: 'abc' } })
    fireEvent.click(screen.getByRole('button', { name: 'Κλείσιμο' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(confirm).not.toHaveBeenCalled()
  })

  it('asks before discarding typed changes and stays open on "no"', async () => {
    const onClose = vi.fn()
    confirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    renderDialog(onClose)
    fireEvent.change(screen.getByLabelText('Σημειώσεις'), { target: { value: 'κείμενο' } })
    fireEvent.click(screen.getByRole('button', { name: 'Κλείσιμο' }))
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Κλείσιμο' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })
})
