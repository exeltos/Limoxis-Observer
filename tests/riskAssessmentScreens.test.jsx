// @vitest-environment jsdom
// The risk assessment screens on the Demo data: the Quality Center tab lists
// the assessments, an assessment opens with its register, analysis, period
// comparison and method, a risk can be edited and saved, and a CAPA opened
// from a risk links back to it.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { sourcePath } from '../src/features/quality/qualityDeviations'

let profile
vi.mock('../src/core/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: profile.id, email: profile.email }, profile, isAuthenticated: true, isDemoSession: false, loading: false }),
}))

const { LanguageProvider } = await import('../src/core/i18n/LanguageContext')
const { FeedbackProvider } = await import('../src/core/feedback/FeedbackContext')
const { TenantProvider, useTenant } = await import('../src/core/tenant/TenantContext')
const { NotificationProvider } = await import('../src/core/notifications/NotificationContext')
const { QualityPage } = await import('../src/features/quality/QualityPage')
const { RiskAssessmentPage } = await import('../src/features/quality/risk/RiskAssessmentPage')

function Where() { const location = useLocation(); return <pre data-testid="where">{location.pathname}{JSON.stringify(location.state?.qualitySource || null)}</pre> }

async function open(path) {
  let api
  function Capture() { api = useTenant(); return null }
  render(<MemoryRouter initialEntries={[path]}><LanguageProvider><FeedbackProvider><TenantProvider><NotificationProvider><Capture/>
    <Routes>
      <Route path="/quality" element={<QualityPage/>}/>
      <Route path="/quality/risks/:assessmentCode" element={<RiskAssessmentPage/>}/>
      <Route path="*" element={<Where/>}/>
    </Routes>
  </NotificationProvider></TenantProvider></FeedbackProvider></LanguageProvider></MemoryRouter>)
  await waitFor(() => expect(api?.enterSampleDemo).toBeTypeOf('function'))
  act(() => { api.enterSampleDemo() })
}

beforeEach(() => { localStorage.clear(); profile = { id: 'owner-1', isPlatformOwner: true, fullName: 'Platform Owner', isDemo: false } })
afterEach(() => { cleanup(); localStorage.clear() })

describe('risk assessment screens', () => {
  it('lists the assessments in the Quality Center tab', async () => {
    await open('/quality')
    fireEvent.click(await screen.findByRole('tab', { name: /Εκτίμηση κινδύνου/ }))
    const year = String(new Date(Date.now() - 7 * 86400000).getFullYear())
    expect(await screen.findByText(`Εκτίμηση επικινδυνότητας ${year}`)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Εισαγωγή από Excel/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Νέα εκτίμηση/ })).toBeInTheDocument()
  })

  it('opens an assessment with its register, analysis, comparison and method', async () => {
    const year = new Date(Date.now() - 7 * 86400000).getFullYear()
    await open(`/quality/risks/RSA-DEMO-${year}`)
    expect(await screen.findByRole('tab', { name: 'Μητρώο (14)' })).toBeInTheDocument()
    const register=()=>within(document.querySelector('.risk-register'))
    expect(register().getByText('R001')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Ανάλυση' }))
    expect(await screen.findByText('Χάρτες κινδύνου')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Σύγκριση περιόδων' }))
    expect(await screen.findByText('Μεταβολή ανά κίνδυνο')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Βελτιώθηκε/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Μεθοδολογία' }))
    expect(await screen.findByText(/A risk matrix for risk managers/)).toBeInTheDocument()
  })

  it('edits and saves a risk, recomputing its level', async () => {
    const year = new Date(Date.now() - 7 * 86400000).getFullYear()
    await open(`/quality/risks/RSA-DEMO-${year}`)
    await screen.findByRole('tab', { name: 'Μητρώο (14)' })
    const register=()=>within(document.querySelector('.risk-register'))
    fireEvent.click(register().getByText('R007'))
    const dialog = await screen.findByRole('dialog')
    const residual = within(dialog).getAllByRole('combobox', { name: /Πιθανότητα \(L\)/ })[1]
    fireEvent.change(residual, { target: { value: '4' } })
    // 4 × 3 = 12: the residual risk becomes High and needs an action plan.
    expect(within(dialog).getByText('Υψηλός υπολειπόμενος χωρίς πρόσθετα μέτρα')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Αποθήκευση κινδύνου' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const row = register().getByText('R007').closest('tr')
    expect(within(row).getByText('Υψηλός')).toBeInTheDocument()
  })
})

describe('CAPA from a risk', () => {
  it('links the CAPA back to the risk of the assessment', () => {
    expect(sourcePath('RISK:RSA-260401-090000:R014')).toBe('/quality/risks/RSA-260401-090000?risk=R014')
  })
})
