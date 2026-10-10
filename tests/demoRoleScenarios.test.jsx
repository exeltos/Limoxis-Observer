// @vitest-environment jsdom
// Phase 2C of the per-role Demo guide (docs/ROLE_MENU_AND_DEMO_GUIDANCE_DESIGN.md):
// the scenarios of HR, occupational health, quality, pharmacy, committee
// secretariat, hospital administration and department management, shown once
// the database accepts their keys (20261028120000_demo_role_guidance.sql).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import fs from 'node:fs'
import { DEMO_ALL_SCENARIOS, DEMO_ROLE_SCENARIOS, DEMO_SCENARIOS, demoScenariosForEvaluator, demoScenariosForRole } from '../src/features/demo/demoScenarios'
import { DEMO_STEP_EVENT, signalDemoStep } from '../src/features/demo/demoScenarioSignals'
import { useDemoEvaluation } from '../src/features/demo/useDemoEvaluation'
import { LanguageProvider } from '../src/core/i18n/LanguageContext'

let extended = true
vi.mock('../src/features/demo/demoEvaluationService', () => ({
  loadMyDemoProgress: vi.fn(async () => ({})), loadMyDemoApplicationRequests: vi.fn(async () => []), loadMyDemoRatings: vi.fn(async () => ({})),
  setDemoEvaluationStep: vi.fn(), rateDemoEvaluationStep: vi.fn(), requestDemoApplication: vi.fn(), submitDemoScenarioFeedback: vi.fn(),
  hasExtendedDemoSchema: () => extended,
}))

const keys = scenarios => scenarios.map(scenario => scenario.key)
beforeEach(() => { extended = true; sessionStorage.clear() })
afterEach(() => { cleanup(); sessionStorage.clear() })

describe('scenarios of every role', () => {
  it('gives each role the scenarios of its daily work once the database accepts them', () => {
    const forRole = role => keys(demoScenariosForRole(role, { extended: true }))
    expect(forRole('hr_office')).toEqual(['employee_record', 'performance_evaluation'])
    expect(forRole('occupational_physician')).toEqual(['occupational_visit', 'occupational_exposure'])
    expect(forRole('quality_manager')).toEqual(['incident_capa', 'quality_audit'])
    expect(forRole('pharmacy')).toEqual(['antimicrobial_consumption'])
    expect(forRole('committee_secretariat')).toEqual(['committee_minutes'])
    expect(forRole('hospital_admin')).toEqual(['users_roles', 'custom_roles', 'analysis_export'])
    expect(forRole('department_manager')).toEqual(['department_overview', 'staff_training'])
    expect(forRole('department_user')).toEqual(['department_overview'])
    expect(forRole('doctor_reviewer')).toEqual(['clabsi_classification', 'microbiology_mdro'])
  })

  it('before the migration keeps the original scenarios, or all six', () => {
    expect(keys(demoScenariosForRole('quality_manager'))).toEqual(['incident_capa'])
    expect(keys(demoScenariosForRole('hospital_admin'))).toEqual(['analysis_export'])
    expect(demoScenariosForRole('hr_office')).toBe(DEMO_SCENARIOS)
  })

  it('uses exactly the scenario keys the migration accepts', () => {
    const sql = fs.readFileSync('supabase/migrations/20261028120000_demo_role_guidance.sql', 'utf8')
    const list = sql.match(/check \(step_key in \(([\s\S]*?)\)\);/)[1]
    const accepted = [...list.matchAll(/'([a-z_]+)'/g)].map(match => match[1])
    expect(accepted.filter(key => key !== 'guide_opened').sort()).toEqual(keys(DEMO_ALL_SCENARIOS).sort())
    for (const roleKeys of Object.values(DEMO_ROLE_SCENARIOS)) for (const key of roleKeys) expect(accepted).toContain(key)
  })

  it('opens record steps on the record only, never on its "new" form', () => {
    const route = (key, id) => DEMO_ALL_SCENARIOS.find(scenario => scenario.key === key).steps.find(step => step.id === id).route
    expect(route('employee_record', 'open').test('/employees/EMP-001')).toBe(true)
    expect(route('employee_record', 'open').test('/employees/new')).toBe(false)
    expect(route('committee_minutes', 'open').test('/committees/CMT-1')).toBe(true)
    expect(route('department_overview', 'control').test('/controls/new')).toBe(false)
    expect(route('staff_training', 'open').test('/training/TRN-1')).toBe(true)
  })

  it('accepts the new scenarios\' steps from their screens', () => {
    const seen = []
    const listener = event => seen.push(`${event.detail.key}/${event.detail.step}`)
    window.addEventListener(DEMO_STEP_EVENT, listener)
    signalDemoStep('users_roles', 'role')
    signalDemoStep('custom_roles', 'role')
    window.removeEventListener(DEMO_STEP_EVENT, listener)
    expect(seen).toEqual(['users_roles/role'])
  })
})

describe('the Platform Owner panel', () => {
  it('lists an evaluator\'s scenarios by the role they come from', () => {
    expect(demoScenariosForEvaluator(['guide_opened', 'hand_hygiene'])).toBe(DEMO_SCENARIOS)
    expect(keys(demoScenariosForEvaluator(['guide_opened', 'custom_roles']))).toEqual(['users_roles', 'custom_roles', 'analysis_export'])
    expect(keys(demoScenariosForEvaluator(['quality_audit', 'pharmacy_unknown']))).toEqual(['incident_capa', 'quality_audit'])
    expect(keys(demoScenariosForEvaluator(['quality_audit', 'antimicrobial_consumption']))).toEqual([...keys(DEMO_SCENARIOS), 'quality_audit', 'antimicrobial_consumption'])
  })
})

describe('the guide flow for the HR office', () => {
  let api
  let goTo
  function Harness() {
    const navigate = useNavigate()
    goTo = navigate
    api = useDemoEvaluation({ enabled: true, organizationId: 'demo-1', organizationName: 'Demo', userId: 'owner-1', profile: {}, isPlatformOwner: true, role: 'hr_office', language: 'el', navigate })
    return api.dialogs
  }

  it('opens the employee record, then checks off the tabs it asks for', async () => {
    render(<MemoryRouter initialEntries={['/']}><LanguageProvider><Harness/></LanguageProvider></MemoryRouter>)
    await waitFor(() => expect(api.guideTotal).toBe(2))
    act(() => api.openGuide())
    fireEvent.click((await screen.findAllByRole('button', { name: /Ξεκινήστε/ }))[0])
    // The scenario starts with its guided tour; ended, the card shows the steps.
    fireEvent.click(await screen.findByRole('button', { name: 'Τέλος ξενάγησης' }))
    const card = await screen.findByRole('complementary', { name: 'Σενάριο αξιολόγησης' })
    expect(within(card).getByText('Καρτέλα εργαζομένου')).toBeInTheDocument()
    act(() => goTo('/employees/new'))
    expect(within(card).getAllByRole('listitem')[0]).not.toHaveClass('is-done')
    act(() => goTo('/employees/EMP-001'))
    await waitFor(() => expect(within(card).getAllByRole('listitem')[0]).toHaveClass('is-done'))
    act(() => { signalDemoStep('performance_evaluation', 'evaluations') }) // another scenario: not counted
    act(() => { signalDemoStep('employee_record', 'training') })
    expect(within(card).getAllByRole('listitem').map(item => item.className)).toEqual(['is-done', 'is-done', 'is-next'])
    act(() => { signalDemoStep('employee_record', 'documents') })
    expect(await screen.findByText('Ολοκληρώσατε το σενάριο')).toBeInTheDocument()
    expect(api.guideDone).toBe(1)
  })
})
