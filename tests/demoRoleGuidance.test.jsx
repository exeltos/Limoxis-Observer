// @vitest-environment jsdom
// Phase 1 of the per-role Demo guide (docs/ROLE_MENU_AND_DEMO_GUIDANCE_DESIGN.md):
// each role sees its own scenarios, and a scenario with steps is done once its
// screens have checked off every step.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { DEMO_ROLE_SCENARIOS, DEMO_SCENARIOS, demoScenariosForRole, demoStepsComplete } from '../src/features/demo/demoScenarios'
import { DEMO_STEP_EVENT, nextDemoScenario, signalDemoScenario, signalDemoStep } from '../src/features/demo/demoScenarioSignals'
import { DemoGuideDialog } from '../src/features/demo/DemoGuideDialog'
import { DemoActiveScenario } from '../src/features/demo/DemoScenarioCards'
import { useDemoEvaluation } from '../src/features/demo/useDemoEvaluation'
import { LanguageProvider } from '../src/core/i18n/LanguageContext'

vi.mock('../src/features/demo/demoEvaluationService', () => ({
  loadMyDemoProgress: vi.fn(async () => ({})), loadMyDemoApplicationRequests: vi.fn(async () => []), loadMyDemoRatings: vi.fn(async () => ({})),
  setDemoEvaluationStep: vi.fn(), rateDemoEvaluationStep: vi.fn(), requestDemoApplication: vi.fn(),
}))

const keys = scenarios => scenarios.map(scenario => scenario.key)
beforeEach(() => sessionStorage.clear())
afterEach(() => { cleanup(); sessionStorage.clear() })

describe('scenarios per role', () => {
  it('gives each phase-1 role the scenarios of its daily work, and every other role all six', () => {
    expect(keys(demoScenariosForRole('laboratory'))).toEqual(['microbiology_mdro'])
    expect(keys(demoScenariosForRole('infection_control_lead'))).toEqual(['clabsi_classification', 'microbiology_mdro', 'hand_hygiene', 'analysis_export'])
    expect(keys(demoScenariosForRole('link_nurse'))).toEqual(['hand_hygiene', 'patient_admission', 'clabsi_classification', 'incident_capa'])
    expect(demoScenariosForRole('hr_office')).toBe(DEMO_SCENARIOS)
    expect(demoScenariosForRole(null)).toBe(DEMO_SCENARIOS)
  })

  it('only uses scenario keys the database accepts', () => {
    const accepted = new Set(DEMO_SCENARIOS.map(scenario => scenario.key))
    for (const roleKeys of Object.values(DEMO_ROLE_SCENARIOS)) for (const key of roleKeys) expect(accepted.has(key)).toBe(true)
  })

  it('suggests the next scenario within the role', () => {
    const nurse = demoScenariosForRole('link_nurse')
    expect(nextDemoScenario('hand_hygiene', {}, nurse).key).toBe('patient_admission')
    expect(nextDemoScenario('incident_capa', { hand_hygiene: 'x' }, nurse).key).toBe('patient_admission')
    expect(nextDemoScenario('microbiology_mdro', {}, demoScenariosForRole('laboratory'))).toBeNull()
  })
})

describe('scenario steps', () => {
  const microbiology = DEMO_SCENARIOS.find(scenario => scenario.key === 'microbiology_mdro')

  it('is done only when every step is checked off', () => {
    expect(microbiology.steps.map(step => step.id)).toEqual(['open', 'ast', 'amr', 'communication'])
    expect(demoStepsComplete(microbiology, { open: true, ast: true, amr: true })).toBe(false)
    expect(demoStepsComplete(microbiology, { open: true, ast: true, amr: true, communication: true })).toBe(true)
    expect(demoStepsComplete(DEMO_SCENARIOS[0], {})).toBe(false)
  })

  it('signals only steps that the scenario has', () => {
    const seen = []
    const listener = event => seen.push(`${event.detail.key}/${event.detail.step}`)
    window.addEventListener(DEMO_STEP_EVENT, listener)
    signalDemoStep('microbiology_mdro', 'amr')
    signalDemoStep('microbiology_mdro', 'unknown')
    signalDemoStep('hand_hygiene', 'amr')
    window.removeEventListener(DEMO_STEP_EVENT, listener)
    expect(seen).toEqual(['microbiology_mdro/amr'])
  })
})

describe('guide and scenario card', () => {
  it('lists the role scenarios with their steps', () => {
    render(<LanguageProvider><DemoGuideDialog language="el" scenarios={demoScenariosForRole('laboratory')} onOpenScenario={() => {}} onClose={() => {}}/></LanguageProvider>)
    expect(screen.getByText(/Ένα σύντομο σενάριο με την καθημερινή δουλειά του ρόλου σας/)).toBeInTheDocument()
    expect(screen.getByText('0 από 1 ολοκληρωμένα')).toBeInTheDocument()
    const steps = screen.getByRole('list', { name: 'Βήματα' })
    expect(within(steps).getAllByRole('listitem').map(item => item.textContent)).toEqual(['Ανοίξτε μια θετική καλλιέργεια', 'Καταχωρίστε αντιβιόγραμμα', 'Ταξινομήστε το AMR (MDR/XDR/PDR)', 'Καταγράψτε την επικοινωνία του κρίσιμου αποτελέσματος'])
  })

  it('keeps the six-scenario guide for roles without their own set', () => {
    render(<LanguageProvider><DemoGuideDialog language="el" onOpenScenario={() => {}} onClose={() => {}}/></LanguageProvider>)
    expect(screen.getByText(/Έξι σύντομα σενάρια/)).toBeInTheDocument()
    expect(screen.getByText('0 από 6 ολοκληρωμένα')).toBeInTheDocument()
  })

  it('checks off done steps and points at the next one', () => {
    const scenarios = demoScenariosForRole('infection_control_lead')
    render(<DemoActiveScenario scenario={scenarios[1]} scenarios={scenarios} stepsDone={{ open: true, ast: true }} language="el" onDone={() => {}} onClose={() => {}}/>)
    expect(screen.getByText('Σενάριο 2 από 4')).toBeInTheDocument()
    const items = within(screen.getByRole('list', { name: 'Βήματα' })).getAllByRole('listitem')
    expect(items.map(item => item.className)).toEqual(['is-done', 'is-done', 'is-next', ''])
    expect(items[2]).toHaveAttribute('aria-current', 'step')
  })
})

describe('the guide flow for the Laboratory role', () => {
  let api
  let goTo
  function Harness() {
    const navigate = useNavigate()
    goTo = navigate
    api = useDemoEvaluation({ enabled: true, organizationId: 'demo-1', organizationName: 'Demo', userId: 'owner-1', profile: {}, isPlatformOwner: true, role: 'laboratory', language: 'el', navigate })
    return api.dialogs
  }
  const step = id => act(() => { signalDemoStep('microbiology_mdro', id) })

  it('walks a scenario step by step, then asks for its rating', async () => {
    render(<MemoryRouter initialEntries={['/']}><LanguageProvider><Harness/></LanguageProvider></MemoryRouter>)
    expect(api.guideTotal).toBe(1)
    step('ast') // before the scenario starts: not counted
    act(() => api.openGuide())
    fireEvent.click(await screen.findByRole('button', { name: /Ξεκινήστε/ }))
    const card = await screen.findByRole('complementary', { name: 'Σενάριο αξιολόγησης' })
    expect(within(card).getByText('Σενάριο 1 από 1')).toBeInTheDocument()
    expect(within(card).getAllByRole('listitem').map(item => item.className)).toEqual(['is-next', '', '', ''])

    act(() => goTo('/laboratory/LAB-260827-001'))
    await waitFor(() => expect(within(card).getAllByRole('listitem')[0]).toHaveClass('is-done'))
    step('ast'); step('amr')
    act(() => { signalDemoScenario('hand_hygiene') })
    expect(within(card).getAllByRole('listitem').map(item => item.className)).toEqual(['is-done', 'is-done', 'is-done', 'is-next'])
    expect(api.guideDone).toBe(0)

    step('communication')
    expect(await screen.findByText('Ολοκληρώσατε το σενάριο')).toBeInTheDocument()
    expect(screen.queryByRole('complementary', { name: 'Σενάριο αξιολόγησης' })).not.toBeInTheDocument()
    expect(api.guideDone).toBe(1)
  })
})
