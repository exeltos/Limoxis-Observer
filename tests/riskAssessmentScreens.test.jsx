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
const { RiskRecordPage } = await import('../src/features/quality/risk/RiskRecordPage')
const { OpportunityRecordPage } = await import('../src/features/quality/risk/OpportunityRecordPage')

function Where() { const location = useLocation(); return <pre data-testid="where">{location.pathname}{JSON.stringify(location.state?.qualitySource || null)}</pre> }

async function open(path) {
  let api
  function Capture() { api = useTenant(); return null }
  render(<MemoryRouter initialEntries={[path]}><LanguageProvider><FeedbackProvider><TenantProvider><NotificationProvider><Capture/>
    <Routes>
      <Route path="/quality" element={<QualityPage/>}/>
      <Route path="/quality/risks/:assessmentCode" element={<RiskAssessmentPage/>}/>
      <Route path="/quality/risks/:assessmentCode/opportunities/:opportunityId" element={<OpportunityRecordPage/>}/>
      <Route path="/quality/risks/:assessmentCode/:riskKey" element={<RiskRecordPage/>}/>
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
    // The platform owner's templates: a small button, the owner's alone.
    expect(screen.getByRole('button', { name: 'Πρότυπα πλατφόρμας' })).toBeInTheDocument()
  })

  it('hides the template button from anyone but the platform owner', async () => {
    profile = { ...profile, isPlatformOwner: false }
    await open('/quality')
    fireEvent.click(await screen.findByRole('tab', { name: /Εκτίμηση κινδύνου/ }))
    const year = String(new Date(Date.now() - 7 * 86400000).getFullYear())
    await screen.findByText(`Εκτίμηση επικινδυνότητας ${year}`)
    expect(screen.queryByRole('button', { name: 'Πρότυπα πλατφόρμας' })).not.toBeInTheDocument()
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
    // Three years of Demo data: the course over the periods is drawn.
    expect(document.querySelectorAll('.risk-trend-chart .dot-avg')).toHaveLength(3)
    fireEvent.click(screen.getByRole('tab', { name: 'Μεθοδολογία' }))
    expect(await screen.findByText(/A risk matrix for risk managers/)).toBeInTheDocument()
    // A JCI chapter of the method opens the register on its risks.
    const chapter = within(document.querySelector('.risk-jci-grid')).getByText('IPSG.5').closest('button')
    const count = Number(within(chapter).getByText(/^\d+$/).textContent)
    expect(count).toBeGreaterThan(0)
    fireEvent.click(chapter)
    await screen.findByRole('tab', { name: 'Μητρώο (14)', selected: true })
    expect(document.querySelectorAll('.risk-register tbody tr.risk-row-clickable')).toHaveLength(count)
    // «Πίσω» returns to the method, with the chapter marked.
    expect(screen.getAllByRole('button', { name: 'Πίσω σε «Μεθοδολογία»' })).toHaveLength(2)
    fireEvent.click(document.querySelector('.risk-origin-back'))
    await screen.findByRole('tab', { name: 'Μεθοδολογία', selected: true })
    expect(within(document.querySelector('.risk-jci-grid')).getByText('IPSG.5').closest('button')).toHaveClass('registry-row-returned')
  })

  it('shows the details: approval cycle with the next step, next review, the period it came from', async () => {
    const year = new Date(Date.now() - 7 * 86400000).getFullYear()
    await open(`/quality/risks/RSA-DEMO-${year}`)
    fireEvent.click(await screen.findByRole('tab', { name: 'Στοιχεία' }))
    const steps = [...document.querySelectorAll('.risk-approval li')]
    expect(steps.map(li => li.querySelector('strong').textContent)).toEqual(['Πρόχειρο', 'Σε έλεγχο', 'Εγκεκριμένη', 'Αρχειοθετημένη'])
    expect(steps[1]).toHaveClass('is-current')
    expect(within(document.querySelector('.risk-approval').closest('section')).getByRole('button', { name: /Έγκριση/ })).toBeInTheDocument()
    expect(document.querySelector('.risk-next-review').textContent).toMatch(/σε \d+ ημέρες/)
    fireEvent.click(screen.getByText('Μεταφέρθηκε από').closest('button'))
    expect(await screen.findByText(`RSA-DEMO-${year - 1}`)).toBeInTheDocument()
  })

  it('edits a risk on its own page and saves it, recomputing its level', async () => {
    const year = new Date(Date.now() - 7 * 86400000).getFullYear()
    await open(`/quality/risks/RSA-DEMO-${year}`)
    await screen.findByRole('tab', { name: 'Μητρώο (14)' })
    const register=()=>within(document.querySelector('.risk-register'))
    fireEvent.click(register().getByText('R007'))
    // The risk opens as a page: the measures are lists, in the order of the assessment.
    const residual = (await screen.findAllByRole('combobox', { name: /Πιθανότητα \(L\)/ }))[1]
    expect(screen.getByText('Προληπτικά μέτρα που ήδη λαμβάνονται')).toBeInTheDocument()
    fireEvent.change(residual, { target: { value: '4' } })
    // 4 × 3 = 12: the residual risk becomes High and needs an action plan.
    expect(screen.getByText('Υψηλός υπολειπόμενος χωρίς πρόσθετα μέτρα')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Αποθήκευση κινδύνου/ }))
    await screen.findByRole('tab', { name: 'Μητρώο (14)' })
    const row = register().getByText('R007').closest('tr')
    expect(within(row).getByText('Υψηλός')).toBeInTheDocument()
    // Back in the register, the risk just edited stays marked.
    expect(row).toHaveClass('registry-row-returned')
  })

  it('edits an opportunity on its own page: yield and effectiveness are fixed choices', async () => {
    const year = new Date(Date.now() - 7 * 86400000).getFullYear()
    await open(`/quality/risks/RSA-DEMO-${year}`)
    fireEvent.click(await screen.findByRole('tab', { name: 'Ευκαιρίες' }))
    const table = () => within(document.querySelector('.risk-opportunities'))
    const first = table().getByText('Ε001').closest('tr')
    expect(within(first).getByText('Υψηλή απόδοση')).toBeInTheDocument()
    expect(within(first).getByText('Αποτελεσματικό')).toBeInTheDocument()
    expect(table().getByText('Μερικώς αποτελεσματικό')).toBeInTheDocument()
    fireEvent.click(table().getByText('Ε001'))
    fireEvent.click(await screen.findByRole('radio', { name: 'Μερικώς αποτελεσματικό' }))
    fireEvent.click(screen.getByRole('button', { name: /Αποθήκευση ευκαιρίας/ }))
    await screen.findByRole('tab', { name: 'Ευκαιρίες' })
    const row = table().getByText('Ε001').closest('tr')
    expect(within(row).getByText('Μερικώς αποτελεσματικό')).toBeInTheDocument()
    expect(within(row).queryByText('Αποτελεσματικό')).not.toBeInTheDocument()
    expect(row).toHaveClass('registry-row-returned')
  })
})

describe('CAPA from a risk', () => {
  it('links the CAPA back to the risk of the assessment', () => {
    expect(sourcePath('RISK:RSA-260401-090000:R014')).toBe('/quality/risks/RSA-260401-090000?risk=R014')
  })
})
