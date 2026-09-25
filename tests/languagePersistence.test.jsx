// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { LanguageProvider, useLanguage } from '../src/core/i18n/LanguageContext'

function Probe() {
  const { language, setLanguage } = useLanguage()
  return <button type="button" onClick={() => setLanguage(language === 'el' ? 'en' : 'el')}>{language}</button>
}

describe('language preference', () => {
  afterEach(() => {
    cleanup()
    localStorage.clear()
    document.documentElement.lang = 'el'
  })

  it('defaults to Greek and keeps <html lang> in sync', () => {
    render(<LanguageProvider><Probe /></LanguageProvider>)
    expect(screen.getByRole('button').textContent).toBe('el')
    expect(document.documentElement.lang).toBe('el')
  })

  it('remembers the chosen language across reloads', () => {
    const first = render(<LanguageProvider><Probe /></LanguageProvider>)
    act(() => { screen.getByRole('button').click() })
    expect(document.documentElement.lang).toBe('en')
    first.unmount()

    render(<LanguageProvider><Probe /></LanguageProvider>)
    expect(screen.getByRole('button').textContent).toBe('en')
  })
})
