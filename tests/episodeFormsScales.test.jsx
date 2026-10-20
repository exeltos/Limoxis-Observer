// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'
import { LanguageProvider, translate } from '../src/core/i18n/LanguageContext'
import { higherIsWorse, scaleTrend } from '../src/features/surveillance/forms/scaleTrend'
import { scalesSection } from '../src/features/surveillance/forms/sections/scalesSection'
import { AuthProvider } from '../src/core/auth/AuthContext'
import { FeedbackProvider } from '../src/core/feedback/FeedbackContext'

const t = key => translate(key, 'el')
const fmtDate = value => String(value).slice(0, 10).split('-').reverse().join('/')
const item = (scale_key, latest, previous) => ({ scale_key, latest: { score: latest, assessed_at: '2026-10-20T08:30:00' }, previous: previous == null ? null : { score: previous, assessed_at: '2026-10-17T08:00:00' }, delta: previous == null ? null : latest - previous })

describe('scale trend in words', () => {
  it('says first, unchanged, rising and falling, and whether that is worse or better', () => {
    expect(scaleTrend({ item: item('news2', 8), t, fmtDate }).text).toBe('Πρώτη αξιολόγηση')
    expect(scaleTrend({ item: item('news2', 8, 8), t, fmtDate }).text).toBe('Αμετάβλητο από 17/10/2026')
    expect(scaleTrend({ item: item('news2', 8, 5), t, fmtDate }).text).toBe('Ανεβαίνει κατά 3 από 17/10/2026 · χειρότερα')
    expect(scaleTrend({ item: item('sofa', 4, 7), t, fmtDate }).text).toBe('Μειώνεται κατά 3 από 17/10/2026 · καλύτερα')
    // A lower Braden or GCS is worse.
    expect(scaleTrend({ item: item('braden', 10, 11), t, fmtDate }).text).toBe('Μειώνεται κατά 1 από 17/10/2026 · χειρότερα')
    expect(higherIsWorse('gcs')).toBe(false)
    expect(higherIsWorse('qsofa')).toBe(true)
  })
})

describe('scales section', () => {
  const ctx = {
    organizationId: null,
    isDemo: true,
    language: 'el',
    t,
    has: () => true,
    patient: { id: 'PT-260184', name: 'Ελένη Παπαδοπούλου', dateOfBirth: '1958-04-11' },
    admission: null,
    record: { id: 'SUR-260041', startedAt: '2026-08-24' },
    episodes: [{ id: 'SUR-260041', status: 'active' }],
    scaleRows: [{ scale_key: 'news2', score: 8, assessed_at: '2026-10-20T08:30:00' }, { scale_key: 'news2', score: 5, assessed_at: '2026-10-17T08:00:00' }],
    fmtDate,
    fmtDateTime: value => `${fmtDate(value)} 08:30`,
    startProtocol: () => {},
  }
  it('lists the latest score per scale with one «Νέα» action each and keeps the full history behind a link', async () => {
    const Section = scalesSection.Component
    render(
      <MemoryRouter>
        <LanguageProvider>
          <AuthProvider>
            <FeedbackProvider>
              <Section ctx={ctx} section={{}} />
            </FeedbackProvider>
          </AuthProvider>
        </LanguageProvider>
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Κλίμακες' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Νέα αξιολόγηση/ })).toBeInTheDocument()
    const list = await screen.findByRole('list', { name: 'Κλίμακες' })
    expect(within(list).getAllByRole('button', { name: 'Νέα' }).length).toBeGreaterThan(0)
    // «Νέα αξιολόγηση» opens the panel's own picker, prefilled flow and sepsis prompt included.
    fireEvent.click(screen.getByRole('button', { name: /Νέα αξιολόγηση/ }))
    expect(await screen.findByRole('dialog', { name: 'Επιλογή αξιολόγησης' })).toBeInTheDocument()
  })
  it('prints the latest score of every scale', () => {
    const section = scalesSection.buildReport(ctx)
    expect(section.title).toBe('Κλίμακες')
    expect(section.list).toHaveLength(1)
    expect(section.list[0]).toContain('Βαθμολογία 8')
  })
})
