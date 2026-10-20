// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'
import { LanguageProvider, translate } from '../src/core/i18n/LanguageContext'
import { configureDataEnvironment } from '../src/core/data/dataEnvironment'
import { canSeeExposure, exposureStatus } from '../src/features/surveillance/EmployeeExposureSection'
import { canOpenExposures, exposureSourceSection } from '../src/features/surveillance/forms/sections/exposureSourceSection'
import { countSourceExposuresAsync, loadExposureIncidentsForRecordAsync } from '../src/features/occupational-health/exposureIncidentService'
import { exposureTypeLabel, followUpLabel } from '../src/features/occupational-health/ExposureIncidentEditor'

const t = key => translate(key, 'el')
// The sample exposures live in the demo data environment.
configureDataEnvironment({ mode: 'demo', demoAccountId: 'test' })
const ctx = { role: 'infection_control_lead', isDemo: true, language: 'el', t, has: () => true, episodes: [{ id: 'SUR-260041' }], goTo: vi.fn() }

describe('staff exposure section', () => {
  it('is for the occupational physician (or the manage-occupational-health permission), nobody else', () => {
    expect(canSeeExposure({ isDemo: false, role: 'occupational_physician', has: () => false })).toBe(true)
    expect(canSeeExposure({ isDemo: false, role: 'hospital_admin', has: cap => cap === 'manage_occupational_health' })).toBe(true)
    for (const role of ['infection_control_lead', 'hr_office', 'department_manager', 'hospital_director'])
      expect(canSeeExposure({ isDemo: false, role, has: () => false })).toBe(false)
  })

  it('has a status in plain words from the follow-up', () => {
    expect(exposureStatus({ followUpStatus: 'completed' }, '2026-10-20')).toBe('done')
    expect(exposureStatus({ followUpStatus: 'pending', followUpDueAt: '2026-10-19' }, '2026-10-20')).toBe('overdue')
    expect(exposureStatus({ followUpStatus: 'scheduled', followUpDueAt: '2026-10-25' }, '2026-10-20')).toBe('pending')
    expect(exposureTypeLabel('needlestick', false)).toBe('Τρύπημα βελόνας')
    expect(followUpLabel('completed', true)).toBe('Completed')
  })

  it('reads the exposures recorded from a staff record (demo sample: ESUR-260801 has one, linked to the source episode)', async () => {
    const rows = await loadExposureIncidentsForRecordAsync(null, 'ESUR-260801')
    expect(rows.map(row => row.id)).toEqual(['EXP-01'])
    expect(rows[0].sourceCaseId).toBe('SUR-260041')
    expect(await loadExposureIncidentsForRecordAsync(null, 'ESUR-none')).toEqual([])
  })
})

describe('source patient note «Πηγή έκθεσης προσωπικού»', () => {
  it('counts employees, never names them', async () => {
    expect(await countSourceExposuresAsync(null, 'SUR-260041')).toBe(2)
    expect(await countSourceExposuresAsync(null, 'SUR-none')).toBe(0)
    expect(await exposureSourceSection.load(ctx)).toBe(2)
  })

  it('shows the number as a line, the link «Προβολή» only to roles that may read the exposures', () => {
    const Line = exposureSourceSection.Component
    const goTo = vi.fn()
    const { container, rerender } = render(
      <MemoryRouter>
        <LanguageProvider>
          <Line ctx={{ ...ctx, role: 'occupational_physician', goTo }} section={{ value: 2 }} />
        </LanguageProvider>
      </MemoryRouter>,
    )
    expect(screen.getByText(/Πηγή έκθεσης προσωπικού:/)).toBeInTheDocument()
    expect(container.textContent).toContain('2 εργαζόμενοι')
    fireEvent.click(screen.getByRole('button', { name: 'Προβολή' }))
    expect(goTo).toHaveBeenCalledWith('/occupational-health', { returnTab: 'episodeForms' })
    const plain = { ...ctx, has: cap => cap !== 'manage_occupational_health' }
    expect(canOpenExposures(plain)).toBe(false)
    rerender(
      <MemoryRouter>
        <LanguageProvider>
          <Line ctx={plain} section={{ value: 1 }} />
        </LanguageProvider>
      </MemoryRouter>,
    )
    expect(container.textContent).toContain('1 εργαζόμενος')
    expect(screen.queryByRole('button', { name: 'Προβολή' })).toBeNull()
    rerender(
      <MemoryRouter>
        <LanguageProvider>
          <Line ctx={plain} section={{ value: 0 }} />
        </LanguageProvider>
      </MemoryRouter>,
    )
    expect(container.textContent).toBe('')
  })

  it('is hidden without access to the episode and prints only a number', () => {
    expect(exposureSourceSection.canSee({ ...ctx, has: () => false })).toBe(false)
    expect(exposureSourceSection.canSee({ ...ctx, episodes: [] })).toBe(false)
    expect(exposureSourceSection.buildReport(ctx, { value: 2 }).list).toEqual(['2 εργαζόμενοι'])
    expect(exposureSourceSection.buildReport(ctx, { value: 0 })).toBeNull()
  })
})
