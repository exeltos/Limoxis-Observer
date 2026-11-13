// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LanguageProvider } from '../src/core/i18n/LanguageContext'
import { InlineDialogContext, ObserverDialog } from '../src/design-system/ObserverDialog'
import { Button } from '../src/design-system/Button'

// The surveillance sheet (owner, 8/11/2026): a form shown in the page registers with its holder, which saves it
// when the user moves to the next step, and keeps the user there when a required field is missing.
function renderInline({ missing = false } = {}) {
  const onSave = vi.fn()
  let entry = null
  const holder = { register: value => (entry = value), unregister: () => {} }
  render(
    <LanguageProvider>
      <InlineDialogContext.Provider value={holder}>
        <ObserverDialog title="Αξιολόγηση" onClose={null} footer={<>{missing && <p className="form-missing-summary">Συμπληρώστε: Ημερομηνία</p>}<Button onClick={onSave}>Αποθήκευση</Button></>}>
          <textarea aria-label="Σύνοψη" />
          <div role="radiogroup"><button type="button" role="radio" aria-checked="false">Ναι</button></div>
        </ObserverDialog>
      </InlineDialogContext.Provider>
    </LanguageProvider>,
  )
  return { onSave, entry: () => entry }
}

describe('inline form on the surveillance sheet', () => {
  afterEach(cleanup)
  it('is in the page, without a window or a close button', () => {
    renderInline()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('region', { name: 'Αξιολόγηση' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Κλείσιμο' })).toBeNull()
  })

  it('saves on «next» only when something changed, once', () => {
    const { onSave, entry } = renderInline()
    expect(entry().dirty()).toBe(false)
    fireEvent.change(screen.getByLabelText('Σύνοψη'), { target: { value: 'κείμενο' } })
    expect(entry().dirty()).toBe(true)
    expect(entry().save()).toBe(true)
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(entry().dirty()).toBe(false)
  })

  it('counts a Yes/No pick as a change', () => {
    const { entry } = renderInline()
    fireEvent.click(screen.getByRole('radio', { name: 'Ναι' }))
    expect(entry().dirty()).toBe(true)
  })

  it('keeps the user on the step when a required field is missing', () => {
    const { entry } = renderInline({ missing: true })
    fireEvent.change(screen.getByLabelText('Σύνοψη'), { target: { value: 'κείμενο' } })
    expect(entry().save()).toBe(false)
    expect(entry().dirty()).toBe(true)
  })
})
