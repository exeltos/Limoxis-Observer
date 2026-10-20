// @vitest-environment jsdom
// Surveillance «Create» menu, staff record page, tablet environment list,
// and the Laboratory list / dialogs on the shared patterns.
import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import { act } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../src/core/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'owner-1' }, profile: { id: 'owner-1', isPlatformOwner: true, fullName: 'Platform Owner', isDemo: false }, isAuthenticated: true, isDemoSession: false, loading: false }),
}))

const { LanguageProvider } = await import('../src/core/i18n/LanguageContext')
const { FeedbackProvider } = await import('../src/core/feedback/FeedbackContext')
const { TenantProvider, useTenant } = await import('../src/core/tenant/TenantContext')
const { NotificationProvider } = await import('../src/core/notifications/NotificationContext')
const { OverflowMenu } = await import('../src/design-system/OverflowMenu')
const { GovernedReasonDialog } = await import('../src/design-system/GovernedReasonDialog')
const { EmployeeSurveillanceRecordPage } = await import('../src/features/surveillance/EmployeeSurveillanceRecordPage')
const { buildLaboratorySampleReport } = await import('../src/features/laboratory/laboratorySampleReport')
const { labStatusLabel, labResultLabel, LAB_STATUS_ORDER } = await import('../src/features/laboratory/LaboratoryStatus')

const read = file => fs.readFileSync(file, 'utf8')
afterEach(cleanup)

describe('shared dropdown menu (the «Create» entries)', () => {
  const items = [
    { id: 'a', label: 'Ασθενής', onClick: vi.fn() },
    { id: 'b', label: 'Εργαζόμενος', onClick: vi.fn() },
  ]
  const renderMenu = () => render(<LanguageProvider><OverflowMenu label="Δημιουργία" trigger="Δημιουργία" triggerTone="primary" items={items} /></LanguageProvider>)

  it('moves the focus into the menu, walks it with the arrow keys and closes on Escape', () => {
    renderMenu()
    fireEvent.click(screen.getByRole('button', { name: 'Δημιουργία' }))
    const entries = screen.getAllByRole('menuitem')
    expect(entries[0]).toHaveFocus()
    fireEvent.keyDown(document, { key: 'ArrowDown' })
    expect(entries[1]).toHaveFocus()
    fireEvent.keyDown(document, { key: 'ArrowDown' })
    expect(entries[0]).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('runs the chosen entry and closes', () => {
    renderMenu()
    fireEvent.click(screen.getByRole('button', { name: 'Δημιουργία' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Εργαζόμενος' }))
    expect(items[1].onClick).toHaveBeenCalled()
    expect(screen.queryByRole('menu')).toBeNull()
  })
})

describe('staff surveillance record page', () => {
  async function openRecord(id = 'ESUR-260801') {
    let api
    function Capture() { api = useTenant(); return null }
    render(<MemoryRouter initialEntries={[`/surveillance/staff/${id}`]}><LanguageProvider><FeedbackProvider><TenantProvider><NotificationProvider><Capture />
      <Routes><Route path="/surveillance/staff/:recordId" element={<EmployeeSurveillanceRecordPage />} /></Routes>
    </NotificationProvider></TenantProvider></FeedbackProvider></LanguageProvider></MemoryRouter>)
    await waitFor(() => expect(api?.enterSampleDemo).toBeTypeOf('function'))
    act(() => { api.enterSampleDemo() })
  }

  it('opens as a record page with the tabs Summary, Documents and History', async () => {
    await openRecord()
    await waitFor(() => expect(screen.queryAllByRole('tab').length).toBeGreaterThan(0), { timeout: 5000 })
    expect(screen.getAllByRole('tab').map(tab => tab.textContent.trim())).toEqual(['Σύνοψη', 'Έγγραφα', 'Ιστορικό'])
    expect(screen.getAllByText('Παπαδοπούλου Μαρία').length).toBeGreaterThan(0)
    expect(document.querySelector('.lo-detail-list')).not.toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows the history tab', async () => {
    await openRecord()
    await waitFor(() => expect(screen.queryAllByRole('tab').length).toBeGreaterThan(0), { timeout: 5000 })
    fireEvent.click(screen.getByRole('tab', { name: 'Ιστορικό' }))
    expect(await screen.findByText('Έναρξη επιτήρησης')).toBeInTheDocument()
  })

  it('says when the record does not exist', async () => {
    await openRecord('nope')
    expect(await screen.findByText('Δεν υπάρχουν δεδομένα', {}, { timeout: 5000 })).toBeInTheDocument()
  })

  it('is routed, and the list opens it instead of a window', () => {
    expect(read('src/app/App.jsx')).toContain('path="surveillance/staff/:recordId"')
    const page = read('src/features/surveillance/SurveillanceCanonicalPage.jsx')
    expect(page).toContain('/surveillance/staff/')
    expect(page).not.toContain('EmployeeSurveillanceRecordDialog')
  })
})

describe('environment list on a tablet', () => {
  it('is a bare table with the secondary columns moved under the code', () => {
    const flow = read('src/features/surveillance/EnvironmentalSurveillanceFlow.jsx')
    expect(flow).toContain('bare')
    expect(flow.match(/env-col-secondary/g).length).toBeGreaterThanOrEqual(6)
    expect(flow).toContain('env-inline-secondary')
    expect(read('src/features/surveillance/surveillanceRegistry.css')).toMatch(/@media \(max-width: 1100px\)[\s\S]*env-col-secondary[\s\S]*display: none/)
  })
})

describe('laboratory list', () => {
  it('uses plain words for statuses and results', () => {
    expect(LAB_STATUS_ORDER).toEqual(['requested', 'collected', 'received', 'processing', 'completed', 'rejected', 'cancelled'])
    expect(labStatusLabel('requested', 'el')).toBe('Αναμένεται λήψη')
    expect(labStatusLabel('processing', 'en')).toBe('In progress')
    const t = key => ({ positive: 'Θετικό' })[key] || key
    expect(labResultLabel({ result: 'positive', status: 'completed' }, t, 'el')).toBe('Θετικό')
    expect(labResultLabel({ result: null, status: 'processing' }, t, 'el')).toBe('Αναμένεται')
    expect(labResultLabel({ result: 'draft', status: 'processing' }, t, 'en')).toBe('Awaiting result')
    expect(labResultLabel({ result: null, status: 'rejected' }, t, 'el')).toBe('')
  })

  it('follows the surveillance list pattern: period filter, row click, bare table, empty state with the one action', () => {
    const lab = read('src/features/laboratory/LaboratoryWorkspace.jsx')
    expect(lab).toContain('inPeriod(')
    expect(lab).toContain('PERIOD_DAYS.map')
    expect(lab).toContain('<RegistryTable bare')
    expect(lab).toContain('clickable-row')
    expect(lab).toContain('emptyAction={empty.action}')
    expect(lab).toContain('Καταχώρηση δείγματος')
    expect(lab).toContain('<FormSubmit form={form}')
    expect(lab).not.toContain('fixedHeight')
  })
})

describe('laboratory dialogs', () => {
  it('use the shared validation, sized to their content', () => {
    const dialogs = read('src/features/laboratory/LaboratorySampleDialogs.jsx')
    expect(dialogs).not.toContain('fixedHeight')
    expect(dialogs).not.toContain("} *`")
    expect(dialogs.match(/useFormValidation\(/g).length).toBe(4)
    expect(dialogs).toContain("placeholder={en ? 'Select result' : 'Επιλέξτε αποτέλεσμα'}")
    expect(dialogs).toContain('Για επικύρωση συμπληρώστε:')
  })

  it('asks for the rejection reason with the required mark and a message', async () => {
    const confirm = vi.fn()
    render(<LanguageProvider><GovernedReasonDialog open danger title="Απόρριψη δείγματος" label="Αιτιολογία απόρριψης *" confirmLabel="Απόρριψη δείγματος" onCancel={() => {}} onConfirm={confirm} /></LanguageProvider>)
    const dialog = screen.getByRole('dialog')
    expect(dialog.querySelectorAll('.lo-required-mark').length).toBe(1)
    expect(dialog.textContent).not.toContain('**')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Απόρριψη δείγματος' }))
    expect(confirm).not.toHaveBeenCalled()
    expect(await within(dialog).findByText('Υποχρεωτικό πεδίο')).toBeInTheDocument()
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Αλλοιωμένο υλικό' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Απόρριψη δείγματος' }))
    expect(confirm).toHaveBeenCalledWith('Αλλοιωμένο υλικό')
  })

  it('the printed report says «not entered» for an empty draft result and prints a real one', () => {
    const t = key => key
    const tx = key => key
    const fmt = value => String(value || '')
    const base = { sample: { id: 'LAB-1', type: 'bloodCulture', status: 'processing' }, steps: [], language: 'el', t, tx, fmt }
    const empty = buildLaboratorySampleReport({ ...base, progress: { result: { resultStatus: 'draft' }, organisms: [] } })
    expect(empty.sections.find(section => section.id === 'result').pairs).toEqual([])
    const filled = buildLaboratorySampleReport({ ...base, progress: { result: { result: 'positive', resultStatus: 'draft' }, organisms: ['Klebsiella pneumoniae'] } })
    expect(filled.sections.find(section => section.id === 'result').pairs.length).toBeGreaterThan(1)
  })

  it('the microbiology tab has an empty state whose primary button is not repeated in the menu', () => {
    const view = read('src/features/laboratory/LaboratorySampleRecordFunctionalView.jsx')
    expect(view).toContain('<RegistryEmptyState')
    expect(view).toContain('emptyState={resultEmptyState}')
    expect(view).toMatch(/received &&\s+!resultEmpty && \{/)
    expect(read('src/features/laboratory/laboratorySampleReport.js')).toContain('result.result || organisms.length')
  })
})
