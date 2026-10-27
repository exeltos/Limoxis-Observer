// @vitest-environment jsdom
// The risk assessment screens on the Demo data: the Quality Center tab lists
// the assessments, an assessment opens with its register, analysis, period
// comparison and method, a risk can be edited and saved, and a CAPA opened
// from a risk links back to it.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { chooseOption, selectInput } from './selectHelpers'
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

let historyBack
// A record opens read-only; «Επεξεργασία» in its … menu unlocks it.
async function startEditing() {
  fireEvent.click(await screen.findByRole('button', { name: 'Ενέργειες εγγραφής' }))
  fireEvent.click(screen.getByRole('menuitem', { name: /Επεξεργασία/ }))
}
async function open(path) {
  let api
  function Capture() { api = useTenant(); const navigate = useNavigate(); historyBack = () => navigate(-1); return null }
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
    fireEvent.click(await screen.findByRole('tab', { name: /Κίνδυνοι/ }))
    const year = String(new Date(Date.now() - 7 * 86400000).getFullYear())
    expect(await screen.findByText(`Εκτίμηση επικινδυνότητας ${year}`)).toBeInTheDocument()
    // New assessment and Excel import live in the page's «Create» menu, as in every tab.
    fireEvent.click(screen.getByRole('button', { name: 'Δημιουργία' }))
    expect(screen.getByRole('menuitem', { name: /Εκτίμηση κινδύνου/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Εισαγωγή από Excel/ })).toBeInTheDocument()
    // The platform templates are gone: no button for them, not even for the platform owner.
    expect(screen.queryByRole('button', { name: 'Πρότυπα πλατφόρμας' })).not.toBeInTheDocument()
  })

  it('opens an assessment with its register, analysis (with the comparison) and details (with the method)', async () => {
    const year = new Date(Date.now() - 7 * 86400000).getFullYear()
    await open(`/quality/risks/RSA-DEMO-${year}`)
    expect(await screen.findByRole('tab', { name: 'Μητρώο (14)' })).toBeInTheDocument()
    const register=()=>within(document.querySelector('.risk-register'))
    expect(register().getByText('R001')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Ανάλυση' }))
    expect(await screen.findByText('Χάρτες κινδύνου')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Σύγκριση περιόδων' }))
    expect(await screen.findByText('Μεταβολή ανά κίνδυνο')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Βελτιώθηκε/ })).toBeInTheDocument()
    // Three years of Demo data: the course over the periods is drawn.
    expect(document.querySelectorAll('.risk-trend-chart .dot-avg')).toHaveLength(3)
    fireEvent.click(screen.getByRole('tab', { name: 'Στοιχεία' }))
    fireEvent.click(await screen.findByRole('radio', { name: 'Μεθοδολογία' }))
    expect(await screen.findByText(/A risk matrix for risk managers/)).toBeInTheDocument()
    // A JCI chapter of the method opens the register on its risks.
    const chapter = within(document.querySelector('.risk-jci-grid')).getByText('IPSG.5').closest('button')
    const count = Number(within(chapter).getByText(/^\d+$/).textContent)
    expect(count).toBeGreaterThan(0)
    document.querySelector('.risk-tab-scroll').scrollTop = 240
    fireEvent.click(chapter)
    await screen.findByRole('tab', { name: 'Μητρώο (14)', selected: true })
    expect(document.querySelectorAll('.risk-register tbody tr.risk-row-clickable')).toHaveLength(count)
    // «Πίσω» returns to the method, with the chapter marked.
    expect(screen.getAllByRole('button', { name: 'Πίσω σε «Μεθοδολογία»' })).toHaveLength(2)
    fireEvent.click(document.querySelector('.risk-origin-back'))
    await screen.findByRole('radio', { name: 'Μεθοδολογία', checked: true })
    expect(within(document.querySelector('.risk-jci-grid')).getByText('IPSG.5').closest('button')).toHaveClass('registry-row-returned')
    expect(document.querySelector('.risk-tab-scroll').scrollTop).toBe(240)
    // The browser's back button also returns to the same spot.
    document.querySelector('.risk-tab-scroll').scrollTop = 120
    fireEvent.click(within(document.querySelector('.risk-jci-grid')).getByText('IPSG.5').closest('button'))
    await screen.findByRole('tab', { name: 'Μητρώο (14)', selected: true })
    act(() => historyBack())
    await screen.findByRole('radio', { name: 'Μεθοδολογία', checked: true })
    expect(document.querySelector('.risk-tab-scroll').scrollTop).toBe(120)
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
    // The risk opens as a record (its values, no form); «Επεξεργασία» opens the form.
    expect(await screen.findByText('Μέτρα που ήδη λαμβάνονται')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /Πιθανότητα \(L\)/ })).toBeNull()
    expect(screen.getByRole('tab', { name: /Στην πράξη/ })).toBeInTheDocument()
    await startEditing()
    const residual = (await screen.findAllByRole('combobox', { name: /Πιθανότητα \(L\)/ }))[1]
    expect(residual).toBeEnabled()
    expect(screen.getByText('Προληπτικά μέτρα που ήδη λαμβάνονται')).toBeInTheDocument()
    // «Ακύρωση» drops the edits, the measure lists included, and returns to the record.
    const measure = () => document.querySelector('.risk-measures textarea')
    const before = measure().value
    fireEvent.change(measure(), { target: { value: 'Ακυρωμένο μέτρο' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ακύρωση' }))
    expect(await screen.findByText('Μέτρα που ήδη λαμβάνονται')).toBeInTheDocument()
    await startEditing()
    expect(measure().value).toBe(before)
    // L is a searchable pick: typing 4 and Enter chooses «4 · …».
    const likelihood = screen.getAllByRole('combobox', { name: /Πιθανότητα \(L\)/ })[1]
    fireEvent.change(likelihood, { target: { value: '4' } })
    fireEvent.keyDown(likelihood, { key: 'Enter' })
    // 4 × 3 = 12: the residual risk becomes High and needs an action plan.
    expect(screen.getByText('Υψηλός υπολειπόμενος χωρίς πρόσθετα μέτρα')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Αποθήκευση κινδύνου/ }))
    // Saved, the risk stays open as a record with its new level; «Πίσω» returns to the register.
    expect(await screen.findByText('Μέτρα που ήδη λαμβάνονται')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Πίσω στην εκτίμηση' })[0])
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
    expect(await waitFor(() => selectInput(document.body, /^Αξιολόγηση/))).toBeDisabled()
    await startEditing()
    chooseOption(document.body, /^Αξιολόγηση/, 'Μερικώς αποτελεσματικό')
    fireEvent.click(screen.getByRole('button', { name: /Αποθήκευση ευκαιρίας/ }))
    await screen.findByRole('tab', { name: 'Ευκαιρίες' })
    const row = table().getByText('Ε001').closest('tr')
    expect(within(row).getByText('Μερικώς αποτελεσματικό')).toBeInTheDocument()
    expect(within(row).queryByText('Αποτελεσματικό')).not.toBeInTheDocument()
    expect(row).toHaveClass('registry-row-returned')
  })

  it('deletes an opportunity from the … menu of its page, after a confirmation', async () => {
    const year = new Date(Date.now() - 7 * 86400000).getFullYear()
    await open(`/quality/risks/RSA-DEMO-${year}`)
    fireEvent.click(await screen.findByRole('tab', { name: 'Ευκαιρίες' }))
    const table = () => within(document.querySelector('.risk-opportunities'))
    expect(table().queryByRole('button', { name: 'Ενέργειες' })).toBeNull()
    // The row's open button is its keyboard way in.
    expect(table().getAllByRole('button', { name: 'Άνοιγμα ευκαιρίας' }).length).toBeGreaterThan(0)
    const count = document.querySelectorAll('.risk-opportunities tbody tr.risk-row-clickable').length
    fireEvent.click(table().getByText('Ε001'))
    fireEvent.click(await screen.findByRole('button', { name: 'Ενέργειες εγγραφής' }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Διαγραφή/ }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Διαγραφή/ }))
    await screen.findByRole('tab', { name: 'Ευκαιρίες' })
    await waitFor(() => expect(document.querySelectorAll('.risk-opportunities tbody tr.risk-row-clickable')).toHaveLength(count - 1))
  })
})

describe('CAPA from a risk', () => {
  it('links the CAPA back to the risk of the assessment', () => {
    expect(sourcePath('RISK:RSA-260401-090000:R014')).toBe('/quality/risks/RSA-260401-090000?risk=R014')
  })
})
