// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
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

  it('remembers the chosen language across reloads', async () => {
    const first = render(<LanguageProvider><Probe /></LanguageProvider>)
    act(() => { screen.getByRole('button').click() })
    // English is a lazily-loaded chunk; the switch happens once it has loaded.
    await waitFor(() => expect(document.documentElement.lang).toBe('en'))
    first.unmount()

    render(<LanguageProvider><Probe /></LanguageProvider>)
    expect(screen.getByRole('button').textContent).toBe('en')
  })

  it('loads English strings on demand and translates with them', async () => {
    const { loadLanguage, translate } = await import('../src/core/i18n/LanguageContext')
    await loadLanguage('en')
    expect(translate('librariesPanel.departmentTypeLabel', 'en')).toBe('Department type')
    expect(translate('librariesPanel.departmentTypeLabel', 'el')).toBe('Τύπος τμήματος')
  })
})
