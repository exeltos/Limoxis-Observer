// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'
import { LanguageProvider, translate } from '../src/core/i18n/LanguageContext'
import { incidentRows, incidentsSection } from '../src/features/surveillance/forms/sections/incidentsSection'
import { incidentSource } from '../src/features/surveillance/forms/formPrefill'
import { incidentPrefill } from '../src/features/quality/IncidentReportPage'

const t = key => translate(key, 'el')
const fmtDate = value => String(value).slice(0, 10).split('-').reverse().join('/')
const record = { id: 'SUR-260041', recordId: 'case-uuid', startedAt: '2026-08-24', departmentId: 'dep-1', department: 'ΜΕΘ' }
const ctx = {
  isDemo: false,
  language: 'el',
  t,
  has: () => true,
  patient: { id: 'PT-260184', recordId: 'patient-uuid', name: 'Ελένη Παπαδοπούλου' },
  admission: { id: 'adm-uuid', admissionDate: '2026-08-20', department: 'ΜΕΘ' },
  record,
  episodes: [record],
  fmtDate,
  goTo: vi.fn(),
}
const incident = { id: 'INC-1', displayId: 'ΣΥΜ-031', title: 'Αποσύνδεση κεντρικού καθετήρα', department: 'ΜΕΘ', status: 'underReview', date: '2026-10-19' }

describe('incident report from an episode', () => {
  it('links patient, admission and episode (record ids in production, codes in the demo) and names the department', () => {
    expect(incidentSource(ctx)).toMatchObject({ linkedPatient: 'patient-uuid', linkedSurveillance: 'case-uuid', linkedAdmission: 'adm-uuid', departmentId: 'dep-1', department: 'ΜΕΘ' })
    expect(incidentSource({ ...ctx, isDemo: true })).toMatchObject({ linkedPatient: 'PT-260184', linkedSurveillance: 'SUR-260041', linkedAdmission: '' })
    expect(incidentSource({ ...ctx, record: null }).linkedSurveillance).toBe('')
  })

  it('the existing form starts from it: a clinical report with the links, the episode department and today', () => {
    const draft = incidentPrefill({ episodeSource: incidentSource(ctx) }, 'el')
    expect(draft).toMatchObject({ reportKind: 'clinical', linkedPatient: 'patient-uuid', linkedSurveillance: 'case-uuid', linkedAdmission: 'adm-uuid', departmentId: 'dep-1' })
    expect(draft.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(draft.episodeSource.patientLabel).toBe('PT-260184 · Ελένη Παπαδοπούλου')
  })

  it('is seen by whoever can report an incident or read Quality, and not by others', () => {
    expect(incidentsSection.canSee(ctx)).toBe(true)
    expect(incidentsSection.canSee({ ...ctx, has: () => false })).toBe(false)
    expect(incidentsSection.canSee({ ...ctx, record: null, admission: null })).toBe(false)
  })

  it('lists a linked incident as an uniform row with one «Άνοιγμα», and starts the report with one button', () => {
    expect(incidentRows(ctx, [incident, { ...incident, id: 'INC-2', status: 'closed' }]).map(row => row.done)).toEqual([false, true])
    const goTo = vi.fn()
    const Section = incidentsSection.Component
    render(
      <MemoryRouter>
        <LanguageProvider>
          <Section ctx={{ ...ctx, goTo }} section={{ value: [incident] }} />
        </LanguageProvider>
      </MemoryRouter>,
    )
    const list = screen.getByRole('list', { name: 'Συμβάντα' })
    expect(within(list).getByText('Αποσύνδεση κεντρικού καθετήρα')).toBeInTheDocument()
    expect(within(list).getByText('Εκκρεμεί')).toBeInTheDocument()
    fireEvent.click(within(list).getByRole('button', { name: 'Άνοιγμα' }))
    expect(goTo).toHaveBeenCalledWith('/quality/incidents/INC-1', { returnTab: 'episodeForms' })
    fireEvent.click(screen.getByRole('button', { name: /Αναφορά συμβάντος/ }))
    expect(goTo).toHaveBeenLastCalledWith('/quality/report', expect.objectContaining({ returnTab: 'episodeForms', state: { episodeSource: expect.objectContaining({ linkedSurveillance: 'case-uuid' }) } }))
  })

  it('says what will appear when no incident is linked', () => {
    const Section = incidentsSection.Component
    render(
      <MemoryRouter>
        <LanguageProvider>
          <Section ctx={ctx} section={{ value: [] }} />
        </LanguageProvider>
      </MemoryRouter>,
    )
    expect(screen.getByText(/Δεν υπάρχει συμβάν συνδεδεμένο/)).toBeInTheDocument()
  })

  it('prints the linked incidents', () => {
    const report = incidentsSection.buildReport(ctx, { value: [incident] })
    expect(report.title).toBe('Συμβάντα')
    expect(report.list[0]).toContain('ΣΥΜ-031')
    expect(incidentsSection.buildReport(ctx, { value: [] })).toBeNull()
  })
})
