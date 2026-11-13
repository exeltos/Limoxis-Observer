// @vitest-environment jsdom
// Tabs stay on one line: seldom used ones (and, on a desktop, those that do not
// fit) sit under «Περισσότερα», which names the active tab while it is one of them.
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { LanguageProvider } from '../src/core/i18n/LanguageContext'
import { CanonicalTabs } from '../src/design-system/CanonicalTabs'

afterEach(cleanup)
const items = [{ value: 'a', label: 'Σύνοψη' }, { value: 'b', label: 'Λοιμώξεις' }]
const more = [{ value: 'c', label: 'Επιπολασμός', count: 2 }, { value: 'd', label: 'LIRA' }]

describe('CanonicalTabs', () => {
  it('folds the seldom used tabs under «Περισσότερα» and opens them from its menu', () => {
    let chosen = ''
    render(<LanguageProvider><CanonicalTabs items={items} moreItems={more} value="a" onChange={value => { chosen = value }} ariaLabel="Ενότητες" /></LanguageProvider>)
    // Two tabs and the «More» trigger, itself a tab of the tablist (WCAG: a tablist owns tabs only).
    expect(screen.getAllByRole('tab')).toHaveLength(3)
    const trigger = screen.getByRole('tab', { name: /Περισσότερα/ })
    expect(trigger).toHaveAttribute('aria-selected', 'false')
    expect(trigger).toHaveTextContent('2')
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('menuitem', { name: /LIRA/ }))
    expect(chosen).toBe('d')
  })

  it('names the active tab on the trigger while it is folded', () => {
    render(<LanguageProvider><CanonicalTabs items={items} moreItems={more} value="c" onChange={() => {}} ariaLabel="Ενότητες" /></LanguageProvider>)
    const trigger = screen.getByRole('tab', { name: /Επιπολασμός/ })
    expect(trigger.className).toContain('active')
    expect(trigger).toHaveAttribute('aria-selected', 'true')
  })
})
