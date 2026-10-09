// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'

vi.mock('../src/core/feedback/FeedbackContext', () => ({ useOptionalFeedback: () => null }))
const { HelpManualsView, manualUrl } = await import('../src/core/help/HelpManualsView.jsx')

describe('Help Center › Manuals', () => {
  afterEach(cleanup)

  it('links point at the public domain unless the app already runs there', () => {
    expect(manualUrl('a.pdf', { hostname: 'localhost', origin: 'http://localhost:5173' })).toBe('https://www.limoxis.com/manual/a.pdf')
    expect(manualUrl('a.pdf', { hostname: 'limoxis-observer.netlify.app', origin: 'https://limoxis-observer.netlify.app' })).toBe('https://limoxis-observer.netlify.app/manual/a.pdf')
  })

  it('offers download, open, copy and e-mail for both manuals, and the files exist', () => {
    render(<HelpManualsView language="el"/>)
    const downloads = screen.getAllByRole('link', { name: /Λήψη/ })
    expect(downloads.map(a => a.getAttribute('download'))).toEqual(['Limoxis-Observer-Odigos-EL.pdf', 'Limoxis-Observer-Guide-EN.pdf'])
    for (const file of ['Limoxis-Observer-Odigos-EL.pdf', 'Limoxis-Observer-Guide-EN.pdf']) expect(fs.existsSync(`public/manual/${file}`)).toBe(true)
    const mail = screen.getAllByRole('link', { name: /email/ })[0].getAttribute('href')
    expect(mail).toMatch(/^mailto:\?subject=/)
    expect(decodeURIComponent(mail)).toContain('https://www.limoxis.com/manual/Limoxis-Observer-Odigos-EL.pdf')
    expect(screen.getAllByRole('button', { name: /Αντιγραφή συνδέσμου/ })).toHaveLength(2)
  })

  it('is shown in the Help Center to the Platform Owner only', () => {
    const center = fs.readFileSync('src/core/help/HelpCenter.jsx', 'utf8')
    expect(center).toContain("const isOwner=actualRole==='platform_owner'")
    expect(center).toContain("{isOwner&&<button className={mode==='manuals'")
    expect(center).toContain("{mode==='manuals'&&isOwner&&<HelpManualsView")
  })
})
