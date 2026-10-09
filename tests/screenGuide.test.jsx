// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'
import { LanguageProvider } from '../src/core/i18n/LanguageContext'

const seen = new Set()
const marked = []
vi.mock('../src/features/demo/screenGuideService', () => ({
  loadSeenScreenGuides: vi.fn(async () => new Set(seen)),
  markScreenGuidesSeen: vi.fn(async (_user, keys) => { marked.push(...keys) }),
  resetScreenGuides: vi.fn(async () => {}),
}))
const { ScreenGuide, screenGuideKey, ALL_SCREEN_GUIDES } = await import('../src/features/demo/ScreenGuide')

const at = (path, props = {}) => render(<LanguageProvider><MemoryRouter initialEntries={[path]}><ScreenGuide enabled userId="u1" language="el" {...props}/></MemoryRouter></LanguageProvider>)

afterEach(() => { cleanup(); seen.clear(); marked.length = 0 })

describe('Screen guide', () => {
  it('maps a path to its Help Center manual section', () => {
    expect(screenGuideKey('/')).toBe('/')
    expect(screenGuideKey('/patients/123')).toBe('/patients')
    expect(screenGuideKey('/occupational-health')).toBe('/occupational-health')
    expect(screenGuideKey('/no-such-screen')).toBe(null)
  })
  it('shows the Help Center excerpt the first time a screen opens and remembers it', async () => {
    at('/surveillance')
    expect(await screen.findByText('Δοκιμάστε τώρα')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Κατάλαβα, ξεκινάω'))
    await waitFor(() => expect(marked).toEqual(['/surveillance']))
    expect(screen.queryByText('Δοκιμάστε τώρα')).not.toBeInTheDocument()
  })
  it('does not show a guide already seen, while something else is open, or after "do not show"', async () => {
    seen.add('/surveillance')
    at('/surveillance')
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(screen.queryByText('Δοκιμάστε τώρα')).not.toBeInTheDocument()
    cleanup()
    at('/patients', { hold: true })
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(screen.queryByText('Δοκιμάστε τώρα')).not.toBeInTheDocument()
    cleanup()
    at('/patients')
    fireEvent.click(await screen.findByRole('checkbox'))
    fireEvent.click(screen.getByText('Κατάλαβα, ξεκινάω'))
    await waitFor(() => expect(marked).toEqual(['/patients', ALL_SCREEN_GUIDES]))
  })
  it('is stored per user with row-level security, shown in Demo organizations', () => {
    const migration = fs.readFileSync('supabase/migrations/20261017120000_screen_guides.sql', 'utf8')
    expect(migration).toContain('using (user_id = (select auth.uid()))')
    const shell = fs.readFileSync('src/app/AppShell.jsx', 'utf8')
    expect(shell).toContain('<ScreenGuide enabled={realDemoTenant&&!platformMode&&!helpPreviewMode}')
    expect(shell).toContain('hold={briefingOpen||birthdayOpen||helpOpen||demoEvaluation.busy}')
  })
})
