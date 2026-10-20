// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'
import { LanguageProvider, translate } from '../src/core/i18n/LanguageContext'
import { FeedbackProvider } from '../src/core/feedback/FeedbackContext'
import { canSeeNotifiable, notifiableRows, notifiableSection } from '../src/features/surveillance/forms/sections/notifiableSection'
import { visibleEpisodeFormSections } from '../src/features/surveillance/forms/formsRegistry'

const t = key => translate(key, 'el')
const sample = {
  id: 'LAB-1',
  recordId: 'rec-1',
  sampleCode: 'LAB-260771',
  type: 'bloodCulture',
  collectedAt: '2026-10-15T08:25:00',
  microbiologyResults: [{ id: 'm1', result: 'positive', resultStatus: 'validated', organism: 'Neisseria meningitidis' }],
}
const ctx = {
  role: 'infection_control_lead',
  organizationId: null,
  isDemo: true,
  language: 'el',
  t,
  has: () => true,
  patient: { id: 'PT-1', name: 'Ελένη Παπαδοπούλου', recordId: 'p1' },
  admission: null,
  record: null,
  episodes: [],
  samples: [sample],
  fmtDate: value => String(value).slice(0, 10).split('-').reverse().join('/'),
  fmtDateTime: value => String(value),
}

describe('notifiable disease section', () => {
  it('is visible only to the roles the database lets read the reports', () => {
    for (const role of ['hospital_admin', 'infection_control_lead', 'infection_control_member', 'laboratory', 'platform_owner']) expect(canSeeNotifiable({ ...ctx, role })).toBe(true)
    for (const role of ['doctor_reviewer', 'department_manager', 'link_nurse', 'quality_manager', 'hospital_director', 'occupational_physician'])
      expect(canSeeNotifiable({ ...ctx, role })).toBe(false)
    expect(visibleEpisodeFormSections({ ...ctx, role: 'link_nurse' }).some(section => section.id === 'notifiable')).toBe(false)
  })

  it('is one of the sections shown for a patient without an admission', () => {
    expect(notifiableSection.withoutAdmission).toBe(true)
    expect(visibleEpisodeFormSections(ctx).some(section => section.id === 'notifiable')).toBe(true)
  })

  it('lists a finding as pending with its disease and sample, and a saved report in plain words', () => {
    const [pending] = notifiableRows(ctx, [])
    expect(pending).toMatchObject({ title: 'Μηνιγγιτιδοκοκκική νόσος', status: 'pending', sample: 'LAB-260771', date: '2026-10-15' })
    const key = pending.finding.findingKey
    const [notified] = notifiableRows(ctx, [{ id: 'r1', findingKey: key, status: 'notified', notifiedAt: '2026-10-16', reference: 'ΕΟΔΥ-1' }])
    expect(notified.status).toBe('notified')
    expect(notified.report.reference).toBe('ΕΟΔΥ-1')
  })

  it('adds a clinical notification that has no laboratory finding', () => {
    const rows = notifiableRows({ ...ctx, samples: [] }, [{ id: 'c1', findingKey: 'clinical|1', status: 'notified', notifiedAt: '2025-09-25', patientRecordId: 'p1', disease: 'ΕΛΟΝΟΣΙΑ', createdAt: '2025-09-25T10:00:00Z' }])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ title: 'ΕΛΟΝΟΣΙΑ', status: 'notified', date: '2025-09-25' })
  })

  it('renders the uniform row: «Δηλωτέο» signal, «Εκκρεμεί», one action «Νέα δήλωση» that opens the prefilled form', async () => {
    const Section = notifiableSection.Component
    render(
      <MemoryRouter>
        <LanguageProvider>
          <FeedbackProvider>
            <Section ctx={ctx} section={{ value: [] }} reload={() => {}} />
          </FeedbackProvider>
        </LanguageProvider>
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Δηλωτέα νοσήματα' })).toBeInTheDocument()
    const list = screen.getByRole('list', { name: 'Δηλωτέα νοσήματα' })
    expect(within(list).getByText('Μηνιγγιτιδοκοκκική νόσος')).toBeInTheDocument()
    expect(within(list).getByText('Δηλωτέο')).toBeInTheDocument()
    expect(within(list).getByText('Εκκρεμεί')).toBeInTheDocument()
    fireEvent.click(within(list).getByRole('button', { name: 'Νέα δήλωση' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Προσυμπληρωμένα')).toBeInTheDocument()
    expect(within(dialog).getByText('PT-1 · Ελένη Παπαδοπούλου')).toBeInTheDocument()
    expect(within(dialog).getByText('LAB-260771')).toBeInTheDocument()
  })

  it('says in one sentence what will appear when there is nothing', () => {
    const Section = notifiableSection.Component
    render(
      <MemoryRouter>
        <LanguageProvider>
          <FeedbackProvider>
            <Section ctx={{ ...ctx, samples: [] }} section={{ value: [] }} reload={() => {}} />
          </FeedbackProvider>
        </LanguageProvider>
      </MemoryRouter>,
    )
    expect(screen.getByText(/Δεν υπάρχει δηλωτέο εύρημα ή δήλωση/)).toBeInTheDocument()
  })
})
