// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { LanguageProvider } from '../src/core/i18n/LanguageContext'
import { ManualDateField } from '../src/design-system/ManualDateField'

afterEach(cleanup)

function Field({ onChange }) {
  return <LanguageProvider><ManualDateField label="Date" value="2026-01-15" onChange={onChange} /></LanguageProvider>
}

describe('ManualDateField', () => {
  it('commits a valid typed date', () => {
    let saved = ''
    render(<Field onChange={value => { saved = value }} />)
    const input = screen.getByPlaceholderText('ηη/μμ/εεεε')
    fireEvent.change(input, { target: { value: '20/02/2026' } })
    fireEvent.blur(input)
    expect(saved).toBe('2026-02-20')
    expect(input.value).toBe('20/02/2026')
  })

  it('reverts the displayed text to the last valid value instead of silently keeping garbage on screen', () => {
    let saved = null
    render(<Field onChange={value => { saved = value }} />)
    const input = screen.getByPlaceholderText('ηη/μμ/εεεε')
    fireEvent.change(input, { target: { value: 'not a date' } })
    fireEvent.blur(input)
    expect(saved).toBeNull()
    expect(input.value).toBe('15/01/2026')
  })
})
