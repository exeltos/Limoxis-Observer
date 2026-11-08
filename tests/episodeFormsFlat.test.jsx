// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LanguageProvider } from '../src/core/i18n/LanguageContext'
import { FormsTabContext, FormSection } from '../src/features/surveillance/forms/FormSection'
import { FormRow, FormRows } from '../src/features/surveillance/forms/FormRow'

// The «Φόρμες» tab (owner, 8/11/2026): every section open, no button on a row (its action is in its «⋯» and a
// click on the row does it), the section's actions in a «⋯».
const flat = { isOpen: () => false, toggle: () => {}, offer: () => {}, flat: true }

describe('forms tab sections', () => {
  afterEach(cleanup)
  it('opens every section and keeps the actions in «⋯»', () => {
    const open = vi.fn()
    const add = vi.fn()
    render(
      <LanguageProvider>
        <FormsTabContext.Provider value={flat}>
          <FormSection id="scales" title="Κλίμακες" actions={[{ id: 'new', label: 'Νέα αξιολόγηση', onClick: add }]}>
            <FormRows label="Κλίμακες">
              <FormRow title="Braden" action={{ label: 'Νέα βαθμολόγηση', onClick: open }} />
            </FormRows>
          </FormSection>
        </FormsTabContext.Provider>
      </LanguageProvider>,
    )
    expect(screen.queryByRole('button', { name: 'Νέα βαθμολόγηση' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Νέα αξιολόγηση' })).toBeNull()
    expect(document.querySelector('[data-section="scales"] .episode-form-section-body').hidden).toBe(false)
    fireEvent.click(screen.getByText('Braden'))
    expect(open).toHaveBeenCalledTimes(1)
    fireEvent.click(document.querySelector('[data-section="scales"] .episode-form-section-actions button'))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Νέα αξιολόγηση' }))
    expect(add).toHaveBeenCalledTimes(1)
  })
})
