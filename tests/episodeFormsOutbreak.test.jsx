// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'
import { LanguageProvider, translate } from '../src/core/i18n/LanguageContext'
import { outbreakSection, outbreakText } from '../src/features/surveillance/forms/sections/outbreakSection'
import { loadPatientOutbreakLinks } from '../src/features/lira/liraPatientLinks'

const t = key => translate(key, 'el')
const link = { id: 'inv-1', title: 'Klebsiella pneumoniae CPE', status: 'active', department: 'ΜΕΘ', departmentEn: 'ICU', from: '2026-10-05', cases: 4 }
const ctx = { role: 'infection_control_lead', language: 'el', t, has: () => true, patient: { id: 'PT-260184', recordId: 'p1' }, goTo: vi.fn() }

describe('«Συνδέεται με έξαρση»', () => {
  it('is visible to the roles that read the outbreak investigations and to no one else', () => {
    for (const role of ['hospital_admin', 'infection_control_lead', 'infection_control_member', 'laboratory', 'doctor_reviewer', 'quality_manager', 'platform_owner']) expect(outbreakSection.canSee({ ...ctx, role })).toBe(true)
    for (const role of ['link_nurse', 'department_manager', 'hospital_director', 'occupational_physician', 'pharmacy']) expect(outbreakSection.canSee({ ...ctx, role })).toBe(false)
  })

  it('reads the investigation of the patient in the demo (active Klebsiella investigation) and nothing for other patients', async () => {
    const [demo] = await loadPatientOutbreakLinks(null, { patientCode: 'PT-260184' }, { isDemo: true })
    expect(demo).toMatchObject({ status: 'active', cases: 4, department: 'ΜΕΘ' })
    expect(await loadPatientOutbreakLinks(null, { patientCode: 'PT-999' }, { isDemo: true })).toEqual([])
    expect(await loadPatientOutbreakLinks('org', { patientRecordId: null }, { isDemo: false })).toEqual([])
  })

  it('says it in words: investigation, department, month, state and number of cases', () => {
    expect(outbreakText(ctx, link)).toMatch(/^Klebsiella pneumoniae CPE · ΜΕΘ · Οκτώβριος 2026 \(ενεργή διερεύνηση, 4 κρούσματα\)$/)
  })

  it('shows one line with a link only for roles that can open investigations, and nothing without a link', () => {
    const Line = outbreakSection.Component
    const goTo = vi.fn()
    const { container, rerender } = render(
      <MemoryRouter>
        <LanguageProvider>
          <Line ctx={{ ...ctx, goTo }} section={{ value: [link] }} />
        </LanguageProvider>
      </MemoryRouter>,
    )
    expect(screen.getByText(/Συνδέεται με έξαρση:/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Άνοιγμα διερεύνησης' }))
    expect(goTo).toHaveBeenCalledWith('/surveillance?tab=outbreaks&investigation=inv-1', { returnTab: 'episodeForms' })
    rerender(
      <MemoryRouter>
        <LanguageProvider>
          <Line ctx={{ ...ctx, has: () => false }} section={{ value: [link] }} />
        </LanguageProvider>
      </MemoryRouter>,
    )
    expect(screen.queryByRole('button', { name: 'Άνοιγμα διερεύνησης' })).toBeNull()
    expect(screen.getByText(/Συνδέεται με έξαρση:/)).toBeInTheDocument()
    rerender(
      <MemoryRouter>
        <LanguageProvider>
          <Line ctx={ctx} section={{ value: [] }} />
        </LanguageProvider>
      </MemoryRouter>,
    )
    expect(container.textContent).toBe('')
  })

  it('prints the link and leaves the report out when there is none', () => {
    expect(outbreakSection.buildReport(ctx, { value: [link] }).list[0]).toContain('Klebsiella pneumoniae CPE')
    expect(outbreakSection.buildReport(ctx, { value: [] })).toBeNull()
  })
})
