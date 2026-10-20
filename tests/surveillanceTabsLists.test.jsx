// @vitest-environment jsdom
// The Surveillance tabs: the outbreak investigations (empty state, detected
// clusters that pre-fill a new investigation, the new button), the sample record's
// progress numbering and grouped details, and the shared list pattern (period filter,
// shared status component, plain patient registry columns).
import fs from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'

let profile
vi.mock('../src/core/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: profile.id, email: profile.email }, profile, isAuthenticated: true, isDemoSession: false, loading: false }),
}))

const { LanguageProvider } = await import('../src/core/i18n/LanguageContext')
const { FeedbackProvider } = await import('../src/core/feedback/FeedbackContext')
const { TenantProvider, useTenant } = await import('../src/core/tenant/TenantContext')
const { NotificationProvider } = await import('../src/core/notifications/NotificationContext')
const { LiraOutbreakInvestigationsPanel, investigationFormFromCluster } = await import('../src/features/management/LiraOutbreakInvestigationsPanel')
const { workflowProgress, sampleSummarySections, sampleSummaryFields, LaboratoryWorkflow } = await import('../src/features/laboratory/LaboratorySampleSummary')
const { inPeriod, PERIOD_DAYS } = await import('../src/features/surveillance/surveillanceOptions')

const read = file => fs.readFileSync(file, 'utf8')

beforeEach(() => {
  Element.prototype.scrollIntoView = () => {}
  localStorage.clear()
  sessionStorage.clear()
  profile = { id: 'owner-1', isPlatformOwner: true, fullName: 'Platform Owner', isDemo: false }
})
afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
})

async function openOutbreaks() {
  let api
  function Capture() { api = useTenant(); return null }
  render(<MemoryRouter><LanguageProvider><FeedbackProvider><TenantProvider><NotificationProvider><Capture />
    <LiraOutbreakInvestigationsPanel />
  </NotificationProvider></TenantProvider></FeedbackProvider></LanguageProvider></MemoryRouter>)
  await waitFor(() => expect(api?.enterSampleDemo).toBeTypeOf('function'))
  act(() => { api.enterSampleDemo() })
  return api
}

describe('Outbreak investigations tab', () => {
  it('says what to do when there are none, with one primary button, and lists the detected clusters', async () => {
    await openOutbreaks()
    expect(await screen.findByText('Δεν υπάρχουν διερευνήσεις εξάρσεων.')).toBeInTheDocument()
    expect(screen.getByText('Ξεκινήστε διερεύνηση όταν δύο ή περισσότεροι ασθενείς έχουν τον ίδιο μικροοργανισμό στο ίδιο τμήμα.')).toBeInTheDocument()
    const newButtons = screen.getAllByRole('button', { name: /Νέα διερεύνηση/ })
    expect(newButtons).toHaveLength(1)
    expect(newButtons[0]).not.toBeDisabled()
    // The clusters the app already detected are offered above the (empty) list.
    expect(await screen.findByText('Πιθανές συρροές')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Έναρξη διερεύνησης' }).length).toBeGreaterThan(0)
  })

  it('pre-fills a new investigation from a cluster and keeps it on the screen in the demo', async () => {
    await openOutbreaks()
    const start = (await screen.findAllByRole('button', { name: 'Έναρξη διερεύνησης' }))[0]
    const cluster = start.closest('li')
    const organism = cluster.querySelector('strong').textContent
    fireEvent.click(start)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByDisplayValue(organism)).toBeInTheDocument()
    expect(within(dialog).getByDisplayValue(new RegExp(`^${organism} — `))).toBeInTheDocument()
    expect(within(dialog).getByText(/Από την ανίχνευση συρροής/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Αποθήκευση' }))
    await waitFor(() => expect(screen.queryByText('Δεν υπάρχουν διερευνήσεις εξάρσεων.')).not.toBeInTheDocument(), { timeout: 5000 })
    expect(screen.getAllByText(new RegExp(organism)).length).toBeGreaterThan(0)
  })

  it('builds the cluster pre-fill from the cluster fields only', () => {
    const form = investigationFormFromCluster({ organism: 'Klebsiella pneumoniae', department: 'ΜΕΘ', count: 4, windowDays: 14, firstDate: '2026-10-04', lastDate: '2026-10-17' })
    expect(form).toMatchObject({ title: 'Klebsiella pneumoniae — ΜΕΘ', organism: 'Klebsiella pneumoniae', from: '2026-10-04', to: '2026-10-17' })
    expect(form.cluster).toEqual({ department: 'ΜΕΘ', count: 4, windowDays: 14 })
  })

  it('hides the button for a role that cannot create and never leaves it greyed without a reason', () => {
    const source = read('src/features/management/LiraOutbreakInvestigationsPanel.jsx')
    expect(source).not.toContain('disabled={isDemo}')
    expect(source).toContain('INVESTIGATION_ROLES.includes(role)')
    expect(source).toContain('title={blockedReason||undefined}')
    expect(source).toContain('if(!tenant?.id||isDemo)return')
    expect(read('src/core/i18n/stringsEl.js')).toContain("outbreaksSubtitle:'Διερευνήσεις πιθανών συρροών και εξάρσεων λοιμώξεων.'")
    expect(read('src/features/sections/SectionPages.jsx')).not.toContain('workspace-fill"><LiraOutbreakInvestigationsPanel')
  })
})

describe('Sample progress numbering', () => {
  const steps = [
    { id: 'received', state: 'done' },
    { id: 'result', state: 'done' },
    { id: 'ast', state: 'na' },
    { id: 'communication', state: 'na' },
    { id: 'documents', state: 'next' },
    { id: 'final', state: 'pending' },
  ]
  it('numbers and counts only the steps that apply', () => {
    const progress = workflowProgress(steps)
    expect(progress.total).toBe(4)
    expect(progress.done).toBe(2)
    expect(steps.filter(step => step.state !== 'na').map(progress.numberOf)).toEqual([1, 2, 3, 4])
  })
  it('shows a dash for a skipped step and the applicable number for the others', () => {
    const labelled = steps.map(step => ({ ...step, label: step.id }))
    const { container } = render(<LanguageProvider><LaboratoryWorkflow steps={labelled} language="el" /></LanguageProvider>)
    const markers = [...container.querySelectorAll('.lab-workflow-marker')]
    expect(markers.map(marker => marker.textContent)).toEqual(['', '', '', '', '3', '4'])
    expect(markers[2].querySelector('svg')).not.toBeNull()
    expect(container.querySelector('.lab-workflow-count')).toHaveTextContent('2/4')
  })
})

describe('Sample details', () => {
  it('groups the fields into Sampling and Receipt for the shared DetailList', () => {
    const t = key => key
    const sample = { subjectType: 'environment', type: 'surface', subjectName: 'ΜΕΘ · Κλίνη 4', department: 'ΜΕΘ', priority: 'routine', collectedAt: '2026-10-17T05:30:00', receivedAt: '2026-10-17T06:10:00', environmentalBatchId: 'ENV-B-0826' }
    const fields = sampleSummaryFields({ sample, t, language: 'el', fmt: value => String(value || '') })
    const sections = sampleSummarySections(fields, 'el')
    expect(sections.map(section => section.title)).toEqual(['Δειγματοληψία', 'Παραλαβή'])
    expect(sections[0].items.map(item => item.key)).toEqual(expect.arrayContaining(['subject', 'department', 'sampleType', 'method', 'collected']))
    expect(sections[1].items.map(item => item.key)).toEqual(['received', 'turnaround', 'surveillance'])
    expect(sampleSummarySections(fields, 'en').map(section => section.title)).toEqual(['Sampling', 'Receipt'])
    const source = read('src/features/laboratory/LaboratorySampleSummary.jsx')
    expect(source).toContain('<DetailList sections={sampleSummarySections(fields, language)}')
    expect(source).not.toContain('<RecordDetailsGrid')
  })
})

describe('List pattern of the Surveillance tabs', () => {
  it('filters by period on the start date', () => {
    expect(PERIOD_DAYS).toEqual([7, 30, 90, 365])
    const day = offset => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10)
    expect(inPeriod(day(3), '7')).toBe(true)
    expect(inPeriod(day(20), '7')).toBe(false)
    expect(inPeriod(day(20), '30')).toBe(true)
    expect(inPeriod('', '30')).toBe(false)
    expect(inPeriod('', 'all')).toBe(true)
  })
  it('puts the period filter in the episodes, staff, environment and patient lists', () => {
    for (const file of ['src/features/surveillance/SurveillanceCanonicalPage.jsx', 'src/features/patients/PatientsPage.jsx']) {
      const source = read(file)
      expect(source).toContain("t('svPeriod')")
      expect(source).toContain('inPeriod(')
    }
  })
  it('uses the shared status component for the environment status and a plain word for the patient status', () => {
    expect(read('src/features/surveillance/EnvironmentalSurveillanceFlow.jsx')).toContain('<StatusBadge tone={status.tone}>')
    const patients = read('src/features/patients/PatientsPage.jsx')
    expect(patients).toContain("<td>{t(patient.status)}</td>")
    expect(patients).toContain("columns={[{key:'id',label:t('patientId')},{key:'name',label:t('name')},{key:'department',label:t('department')},{key:'admission',label:t('admissionDate')},{key:'status',label:t('status')},{key:'alerts',label:t('clinicalAlerts')}]}")
    // The clinical safety signals (isolation / MDR) keep their badge component.
    expect(patients).toContain('<PatientInfectionFlags')
    expect(patients).toContain('<ClinicalRiskText')
  })
})
