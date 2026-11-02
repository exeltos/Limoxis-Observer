// @vitest-environment jsdom
// The one key-figure card: value with unit, status against the target, change
// against the previous period; a failed read never looks like «no value».
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { LanguageProvider } from '../src/core/i18n/LanguageContext'
import { KpiCard, KpiStrip } from '../src/design-system/KpiCard'

afterEach(cleanup)
const show = node => render(<LanguageProvider>{node}</LanguageProvider>)

describe('KpiCard', () => {
  it('shows the value, its unit, the status against the target and the change', () => {
    show(<KpiCard label="Υγιεινή χεριών" period="Οκτ 2026" value="80,3" unit="%" status="good" target="στόχος ≥ 80%" delta={{ text: '+2,1 μον. βελτίωση', trend: 'up', good: true }} />)
    expect(screen.getByText('80,3')).toBeInTheDocument()
    expect(screen.getByText('%')).toBeInTheDocument()
    expect(screen.getByText('Εντός στόχου')).toBeInTheDocument()
    expect(screen.getByText('στόχος ≥ 80%')).toBeInTheDocument()
    expect(screen.getByText('+2,1 μον. βελτίωση').className).toContain('is-better')
    expect(document.querySelector('.lo-kpi').className).toContain('tone-good')
  })

  it('tells a failed read apart from an empty value', () => {
    show(<><KpiCard label="Α" value={null} /><KpiCard label="Β" value={5} error /></>)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('Δεν φορτώθηκε')).toBeInTheDocument()
  })

  it('shows no status for a value that is not known, and a placeholder while loading', () => {
    show(<><KpiCard label="Α" value={null} status="danger" /><KpiCard label="Β" value={3} status="danger" loading /></>)
    expect(screen.queryByText('Εκτός στόχου')).toBeNull()
    expect(document.querySelector('[aria-busy="true"] .lo-kpi-skeleton')).not.toBeNull()
  })

  it('opens its list as a real button when it has one', () => {
    let opened = 0
    show(<KpiStrip label="Δείκτες"><KpiCard label="Ανοιχτά συμβάντα" value={7} onOpen={() => { opened += 1 }} /></KpiStrip>)
    fireEvent.click(screen.getByRole('button', { name: /Ανοιχτά συμβάντα/ }))
    expect(opened).toBe(1)
    expect(screen.getByRole('group', { name: 'Δείκτες' })).toBeInTheDocument()
  })
})
