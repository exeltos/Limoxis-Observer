// @vitest-environment jsdom
// Behavior of the laboratory sample record, exercised through the rendered UI
// on the sample demo hospital (LAB-260827-001: positive blood culture,
// Klebsiella pneumoniae, validated, critical result communicated).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { chooseOption, selectOptions } from './selectHelpers'

vi.mock('../src/core/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'owner-1' }, profile: { id: 'owner-1', isPlatformOwner: true, fullName: 'Platform Owner', isDemo: false }, isAuthenticated: true, isDemoSession: false, loading: false }),
}))

const { LanguageProvider } = await import('../src/core/i18n/LanguageContext')
const { FeedbackProvider } = await import('../src/core/feedback/FeedbackContext')
const { TenantProvider, useTenant } = await import('../src/core/tenant/TenantContext')
const { NotificationProvider } = await import('../src/core/notifications/NotificationContext')
const { LaboratorySampleRecordView } = await import('../src/features/laboratory/LaboratorySampleRecordView')
const { laboratorySamples } = await import('../src/features/laboratory/laboratoryDemoData')
const pristineSamples = structuredClone(laboratorySamples)
const { DEMO_STEP_EVENT } = await import('../src/features/demo/demoScenarioSignals')

async function openFromSurveillance(id) {
  let api
  function Capture() { api = useTenant(); return null }
  render(<MemoryRouter initialEntries={[`/surveillance/environment/${id}`]}><LanguageProvider><FeedbackProvider><TenantProvider><NotificationProvider><Capture/>
    <Routes><Route path="/surveillance/environment/:sampleId" element={<LaboratorySampleRecordView/>}/></Routes>
  </NotificationProvider></TenantProvider></FeedbackProvider></LanguageProvider></MemoryRouter>)
  await waitFor(() => expect(api?.enterSampleDemo).toBeTypeOf('function'))
  act(() => { api.enterSampleDemo() })
}
async function openSample(id = 'LAB-260827-001') {
  let api
  function Capture() { api = useTenant(); return null }
  render(<MemoryRouter initialEntries={[`/laboratory/${id}`]}><LanguageProvider><FeedbackProvider><TenantProvider><NotificationProvider><Capture/>
    <Routes><Route path="/laboratory/:sampleId" element={<LaboratorySampleRecordView/>}/></Routes>
  </NotificationProvider></TenantProvider></FeedbackProvider></LanguageProvider></MemoryRouter>)
  await waitFor(() => expect(api?.enterSampleDemo).toBeTypeOf('function'))
  act(() => { api.enterSampleDemo() })
  await waitFor(() => expect(screen.queryAllByRole('tab').length).toBeGreaterThan(0), { timeout: 5000 })
}
const body = () => document.querySelector('.entity-record-body')
const openTab = name => fireEvent.click(screen.getByRole('tab', { name }))
const menuItems = () => screen.getAllByRole('menuitem').map(item => item.textContent.trim())
const openMenu = button => { fireEvent.click(button); return menuItems() }
const closeMenu = () => fireEvent.keyDown(document, { key: 'Escape' })

beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  laboratorySamples.splice(0, laboratorySamples.length, ...structuredClone(pristineSamples))
  localStorage.clear()
})

describe('environmental sample opened from Surveillance', () => {
  it('opens an environmental sample at the surveillance address', async () => {
    await openFromSurveillance('ENV-260826-001')
    expect(await screen.findByRole('tab', { name: 'Δείγμα' }, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Πίσω στην επιτήρηση' })).toBeInTheDocument()
  })

  it('refuses a patient sample at the surveillance address', async () => {
    await openFromSurveillance('LAB-260827-001')
    expect(await screen.findByText('Μη επιτρεπτή πρόσβαση', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })
})

describe('laboratory record layout', () => {
  it('uses four tabs: sample, result, documents and history', async () => {
    await openSample()
    expect(screen.getAllByRole('tab').map(tab => tab.textContent.trim())).toEqual(['Δείγμα', 'Μικροβιολογικό αποτέλεσμα', 'Έγγραφα', 'Ιστορικό'])
  })

  it('keeps sample actions in the sample card menu and «Εξαγωγή» in the record header, like every record', async () => {
    await openSample()
    expect(openMenu(within(body()).getByRole('button', { name: 'Περισσότερες ενέργειες' }))).toEqual(['Επεξεργασία αποτελέσματος', 'Απόρριψη δείγματος', 'Διαγραφή'])
    closeMenu()
    expect(within(body()).queryByRole('button', { name: 'Εξαγωγή' })).not.toBeInTheDocument()
    const header = document.querySelector('.entity-record-header')
    expect(openMenu(within(header).getByRole('button', { name: 'Εξαγωγή' }))).toEqual(['Εκτύπωση', 'JSON'])
    closeMenu()
  })

  it('puts result, isolate and communication actions behind each card menu', async () => {
    await openSample()
    openTab('Μικροβιολογικό αποτέλεσμα')
    const menus = within(body()).getAllByRole('button', { name: 'Περισσότερες ενέργειες' })
    const expected = [['Επεξεργασία αποτελέσματος', 'Προσθήκη αντιβιογράμματος', 'Καταγραφή επικοινωνίας'], ['Προσθήκη αντιβιογράμματος', 'Ταξινόμηση AMR'], ['Καταγραφή επικοινωνίας']]
    expect(menus).toHaveLength(3)
    menus.forEach((menu, index) => { expect(openMenu(menu)).toEqual(expected[index]); closeMenu() })
  })

  it('walks the user through the workflow with the next step as the primary action', async () => {
    await openSample()
    const workflow = body().querySelector('.lab-workflow-card')
    for (const step of ['Παραλαβή', 'Αποτέλεσμα', 'Αντιβιόγραμμα', 'Επικοινωνία κρίσιμου', 'Έλεγχος εγγράφων', 'Οριστικοποίηση']) expect(within(workflow).getByText(step)).toBeInTheDocument()
    const next = workflow.querySelector('.lab-workflow-next')
    expect(next).toHaveTextContent('Klebsiella pneumoniae')
    fireEvent.click(within(next).getByRole('button', { name: 'Προσθήκη αντιβιογράμματος' }))
    expect(await screen.findByRole('dialog')).toHaveClass('observer-dialog')
  })
})

describe('laboratory record dialogs', () => {
  it('edits results, AST, AMR and communications in the shared dialog', async () => {
    await openSample()
    openTab('Μικροβιολογικό αποτέλεσμα')
    const [resultMenu, isolateMenu, communicationMenu] = within(body()).getAllByRole('button', { name: 'Περισσότερες ενέργειες' })
    for (const [menu, item] of [[resultMenu, 'Επεξεργασία αποτελέσματος'], [isolateMenu, 'Προσθήκη αντιβιογράμματος'], [isolateMenu, 'Ταξινόμηση AMR'], [communicationMenu, 'Καταγραφή επικοινωνίας']]) {
      fireEvent.click(menu)
      fireEvent.click(screen.getByRole('menuitem', { name: item }))
      const dialog = await screen.findByRole('dialog')
      expect(dialog).toHaveClass('observer-dialog')
      fireEvent.click(within(dialog).getAllByRole('button', { name: /Κλείσιμο|Ακύρωση/ })[0])
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    }
  })

  it('lays out the organism, AMR classification and notes as full-width rows, with read-back as a checkbox', async () => {
    await openSample()
    openTab('Μικροβιολογικό αποτέλεσμα')
    const [resultMenu, isolateMenu, communicationMenu] = within(body()).getAllByRole('button', { name: 'Περισσότερες ενέργειες' })
    fireEvent.click(resultMenu); fireEvent.click(screen.getByRole('menuitem', { name: 'Επεξεργασία αποτελέσματος' }))
    expect(screen.getByRole('dialog').querySelector('.lab-dialog-span')).not.toBeNull()
    fireEvent.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: /Κλείσιμο|Ακύρωση/ })[0])
    fireEvent.click(isolateMenu); fireEvent.click(screen.getByRole('menuitem', { name: 'Ταξινόμηση AMR' }))
    expect(within(screen.getByRole('dialog')).getByText(/Κατηγορία/, { selector: '.lab-dialog-span .lo-field-label' })).toBeInTheDocument()
    expect(selectOptions(screen.getByRole('dialog'), /Κατηγορία/).map(option => option.textContent)).toEqual(['MDR – Πολυανθεκτικό', 'XDR – Εκτεταμένα ανθεκτικό', 'PDR – Παν-ανθεκτικό'])
    fireEvent.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: /Κλείσιμο|Ακύρωση/ })[0])
    fireEvent.click(communicationMenu); fireEvent.click(screen.getByRole('menuitem', { name: 'Καταγραφή επικοινωνίας' }))
    const communication = screen.getByRole('dialog')
    expect(within(communication).getByText('Σημειώσεις', { selector: '.lab-dialog-span .lo-field-label' })).toBeInTheDocument()
    // A yes / no flag is the house checkbox.
    expect(within(communication).getByRole('checkbox', { name: /read-back|επανάληψη/i })).toBeInTheDocument()
  })

  it('requires an organism before a positive result can be saved', async () => {
    await openSample('LAB-260829-013')
    fireEvent.click(within(body()).getAllByRole('button', { name: 'Επεξεργασία αποτελέσματος' })[0])
    const dialog = await screen.findByRole('dialog')
    expect(dialog.querySelector('select')).toBeNull()
    chooseOption(dialog, /Αποτέλεσμα/, 'Θετικό')
    const save = within(dialog).getAllByRole('button').filter(button => /Αποθήκευση|Επικύρωση/.test(button.textContent)).at(-1)
    // Blocked (aria-disabled, still pressable) with a line saying what is missing.
    expect(save).toHaveAttribute('aria-disabled', 'true')
    expect(within(dialog).getByText(/Για επικύρωση συμπληρώστε:/).closest('p')).toHaveTextContent('Μικροοργανισμοί')
    fireEvent.click(save)
    expect(await within(dialog).findByText(/τουλάχιστον ένας μικροοργανισμός/)).toBeInTheDocument()
    // Organisms come from the Microorganisms library through the shared multi-select.
    fireEvent.click(dialog.querySelector('.lab-dialog-span .multi-select-button'))
    fireEvent.click(dialog.querySelector('.multi-select-panel [role="option"]'))
    await waitFor(() => expect(save).not.toHaveAttribute('aria-disabled'))
    expect(dialog.querySelector('.lab-organism-chip')).not.toBeNull()
  })
})

// User-reported: the AST/AMR card's per-organism badge used the app's green
// success tone, even for "no classification yet". In an IPC tool a green
// MDR/XDR/PDR badge is misleading, so like every other resistance badge in
// the app it is red for a real classification and absent when there is none.
describe('AMR classification badge', () => {
  it('shows no badge without a classification and a red badge once one is recorded, and tells the Demo guide', async () => {
    const steps = []
    const listener = event => steps.push(`${event.detail.key}/${event.detail.step}`)
    window.addEventListener(DEMO_STEP_EVENT, listener)
    await openSample()
    openTab('Μικροβιολογικό αποτέλεσμα')
    const isolate = () => body().querySelector('.lab-isolate-card')
    expect(isolate()).toHaveAttribute('data-demo-step', 'microbiology_mdro:amr')
    expect(isolate().querySelector('.status-badge')).toBeNull()
    fireEvent.click(within(isolate()).getByRole('button', { name: 'Περισσότερες ενέργειες' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ταξινόμηση AMR' }))
    const dialog = await screen.findByRole('dialog')
    chooseOption(dialog, /Κατηγορία/, /^MDR/)
    fireEvent.click(within(dialog).getAllByRole('button').filter(button => /Αποθήκευση/.test(button.textContent)).at(-1))
    await waitFor(() => expect(isolate().querySelector('.status-badge')).toHaveTextContent('MDR'))
    expect(steps).toEqual(['microbiology_mdro/amr'])
    window.removeEventListener(DEMO_STEP_EVENT, listener)
    expect(isolate().querySelector('.status-badge')).toHaveClass('danger')
    expect(isolate().querySelector('.status-badge')).not.toHaveClass('active')
  })
})
