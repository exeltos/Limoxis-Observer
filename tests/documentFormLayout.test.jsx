// @vitest-environment jsdom
// The document details grid: owner as a normal read-only field on every type,
// licence fields as a number and one multi-select with tags (no checkbox pills).
import { afterEach, describe, expect, it } from 'vitest'
import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { LanguageProvider } from '../src/core/i18n/LanguageContext'
import { DocumentForm, createEmptyDocumentDraft } from '../src/features/documents/DocumentForm'

afterEach(cleanup)

function Harness({ type }) {
  const [value, setValue] = useState({ ...createEmptyDocumentDraft(), type, title: 'Demo' })
  return <LanguageProvider><DocumentForm value={value} onChange={setValue} ownerName="Demo User" /><output data-testid="required">{(value.requiredBy || []).join(',')}</output></LanguageProvider>
}

describe('document form grid', () => {
  it.each(['policy', 'protocol', 'licence'])('shows the owner of a %s as a read-only input with its hint in the note line', type => {
    const { container } = render(<Harness type={type} />)
    const owner = screen.getByDisplayValue('Demo User')
    expect(owner.tagName).toBe('INPUT')
    expect(owner).toHaveAttribute('readonly')
    expect(owner.closest('label').querySelector('small')).toBeNull()
    expect(container.querySelector('.document-form-grid > .field-hint').textContent).toMatch(/υπεύθυνος καταγράφεται/)
  })

  it('gives a licence a renewal number, issue/expiry dates and one required-by dropdown with tags', () => {
    const { container } = render(<Harness type="licence" />)
    expect(screen.getByText('Ανανέωση κάθε (μήνες)').closest('label').querySelector('input')).toHaveAttribute('type', 'number')
    expect(screen.getByText('Ημερομηνία έκδοσης')).toBeInTheDocument()
    expect(screen.getByText('Ημερομηνία λήξης')).toBeInTheDocument()
    expect(container.querySelector('input[type="checkbox"]')).toBeNull()
    expect(container.querySelector('[style]')).toBeNull()
    fireEvent.click(container.querySelector('.multi-select-button'))
    fireEvent.click(screen.getByRole('option', { name: 'ISO 15189' }))
    fireEvent.click(screen.getByRole('option', { name: 'Νομοθεσία' }))
    expect(screen.getByTestId('required').textContent).toBe('legislation,iso15189')
    expect([...container.querySelectorAll('.multi-select-tag')].map(tag => tag.textContent)).toEqual(['Νομοθεσία', 'ISO 15189'])
  })
})
