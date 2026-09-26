// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

vi.mock('../src/core/supabase/client', () => ({ supabase: null }))
vi.mock('../src/core/i18n/LanguageContext', () => ({ useLanguage: () => ({ language: 'el' }) }))
const { changesByRun } = await import('../src/features/management/clinicalContentSourceService')
const { PlatformUpdateCenter } = await import('../src/features/management/PlatformUpdateCenter')

afterEach(cleanup)

const history = [
  { id: 'run-2', started_at: '2026-09-25T10:02:23Z', completed_at: '2026-09-25T10:09:58Z', status: 'completed', trigger: 'manual', checked_count: 6, changed_count: 2 },
  { id: 'run-1', started_at: '2026-09-23T21:56:00Z', completed_at: '2026-09-23T21:56:01Z', status: 'completed', trigger: 'manual', checked_count: 6, changed_count: 0 },
]
const changes = [
  { id: 'c2', checked_at: '2026-09-25T10:02:28Z', review_status: 'deferred', reviewed_at: '2026-09-25T17:16:00Z', source: { name: 'Surviving Sepsis Campaign — Pediatric', authority: 'SCCM' } },
  { id: 'c1', checked_at: '2026-09-25T10:02:26Z', review_status: 'approved', reviewed_at: '2026-09-26T16:24:00Z', source: { name: 'UK Paediatric Early Warning Systems', source_url: 'https://example.org/pews' } },
  { id: 'old', checked_at: '2026-09-20T08:00:00Z', review_status: 'approved', source: { name: 'Before any run' } },
]

describe('platform update center: changes per check', () => {
  it('assigns each detected change to the latest check that started before it', () => {
    const map = changesByRun(history, changes)
    expect(map.get('run-2').map(item => item.id)).toEqual(['c1', 'c2'])
    expect(map.has('run-1')).toBe(false)
  })

  it('lists the changed sources and their review state when the count is clicked', () => {
    render(<PlatformUpdateCenter language="el" history={history} changes={changes} onClose={() => {}} onRun={() => {}} onReview={() => {}}/>)
    const toggle = screen.getByRole('button', { name: /2 αλλαγές/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('UK Paediatric Early Warning Systems')).toBeNull()
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('UK Paediatric Early Warning Systems')).toBeInTheDocument()
    expect(screen.getByText('Surviving Sepsis Campaign — Pediatric')).toBeInTheDocument()
    expect(screen.getByText(/^Ελέγχθηκε 26\/09\/2026/)).toBeInTheDocument()
    expect(screen.getByText(/^Σε αναβολή από/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Άνοιγμα πηγής/ })).toHaveAttribute('href', 'https://example.org/pews')
    expect(screen.getByText('0 αλλαγές').tagName).toBe('SPAN')
  })
})
