// @vitest-environment jsdom
// The patient record fixes approved by the owner: the shared DetailList (no boxed grid),
// the discharge that asks and confirms before saving, the patient forms on the shared
// validation rule, the 24-hour clinical assessments and the patient with no admission.
import fs from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../src/features/management/useLibraries', async original => ({ ...(await original()), useLibraries: () => ({ libraries: {} }) }))

const { LanguageProvider, useLanguage } = await import('../src/core/i18n/LanguageContext')
const { DetailList } = await import('../src/design-system/DetailList')
const { AdmissionDischargeDialog, dischargeDateIssues, dischargeReasonText, hospitalNow } = await import('../src/features/surveillance/AdmissionDischargeDialog')
const { PatientFormFields, usePatientForm } = await import('../src/features/patients/PatientsPage')
const { PatientWithoutAdmission } = await import('../src/features/surveillance/PatientWithoutAdmission')
const { formatDateTime } = await import('../src/core/i18n/formatDay')
const { SECTION_TABS } = await import('../src/core/navigation/sectionTabs')

const read = path => fs.readFileSync(path, 'utf8')
afterEach(() => cleanup())

describe('surveillance tab order', () => {
  it('opens on «Επεισόδια επιτήρησης», then Ασθενείς, Εξάρσεις, Εργαζόμενοι, Περιβάλλον', () => {
    expect(SECTION_TABS.surveillance.tabs.map(tab => tab.id)).toEqual(['episodes', 'registry', 'outbreaks', 'employees', 'environmental'])
    expect(SECTION_TABS.surveillance.defaultTab).toBe('episodes')
    expect(read('src/core/help/helpManual.js')).toContain('Επεισόδια επιτήρησης, Ασθενείς, Εξάρσεις, Εργαζόμενοι, Περιβάλλον')
    expect(read('src/core/help/helpManualEn.js')).toContain('Surveillance episodes, Patients, Outbreaks, Employees, Environment')
  })
})

describe('DetailList', () => {
  it('lists label / value pairs in sections, with «—» for a missing value and no boxed cells', () => {
    const { container } = render(<LanguageProvider><DetailList sections={[
      { title: 'Στοιχεία ασθενούς', items: [{ label: 'Επώνυμο', value: 'Ιωαννίδη' }, { label: 'Πατρώνυμο', value: '' }, { label: 'Σημειώσεις', value: 'Μακρύ κείμενο', wide: true }] },
      { title: 'Νοσηλεία', items: [{ label: 'Τμήμα', value: 'ΜΕΘ' }] },
    ]} /></LanguageProvider>)
    expect(screen.getAllByRole('heading', { level: 4 }).map(node => node.textContent)).toEqual(['Στοιχεία ασθενούς', 'Νοσηλεία'])
    expect(container.querySelectorAll('.lo-detail-item')).toHaveLength(4)
    expect(container.querySelector('.detail-item')).toBeNull()
    expect(screen.getByText('Πατρώνυμο').nextElementSibling).toHaveTextContent('—')
    expect(screen.getByText('Πατρώνυμο').closest('.lo-detail-item')).toHaveClass('is-empty')
    expect(screen.getByText('Σημειώσεις').closest('.lo-detail-item')).toHaveClass('is-wide')
    const css = read('src/design-system/DetailList.css')
    expect(css).toContain('grid-template-columns:repeat(2,minmax(0,1fr))')
    expect(css).not.toMatch(/text-overflow|white-space:nowrap/)
  })

  it('collects the missing identity fields in one muted line with an «Επεξεργασία» link', () => {
    const onEdit = vi.fn()
    render(<LanguageProvider><DetailList sections={[{ title: 'Στοιχεία ασθενούς', collapseMissing: true, onEditMissing: onEdit, items: [{ label: 'Επώνυμο', value: 'Ιωαννίδη' }, { label: 'Πατρώνυμο', value: '' }, { label: 'Φύλο', value: null }] }]} /></LanguageProvider>)
    expect(screen.getByText(/Δεν έχουν καταχωριστεί: Πατρώνυμο, Φύλο/)).toBeInTheDocument()
    expect(screen.queryByText('Φύλο', { selector: 'dt' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Επεξεργασία' }))
    expect(onEdit).toHaveBeenCalled()
  })

  it('replaces the grid in the patient record summary and the episode summary', () => {
    const source = read('src/features/surveillance/ClinicalAdmissions.jsx')
    expect(source).toContain('<DetailList')
    expect(source).not.toContain('detail-grid patient-detail-grid')
  })
})

describe('patient discharge', () => {
  function Harness({ onConfirm, admissionDate = '2026-10-11' }) {
    const { t, language } = useLanguage()
    return <AdmissionDischargeDialog patient={{ name: 'Νεογέννητο Ιωαννίδη' }} admission={{ admissionDate, department: 'ΜΕΘ' }} t={t} language={language} fmtDate={value => value} onClose={() => {}} onConfirm={onConfirm} />
  }
  const choose = async name => {
    fireEvent.focus(screen.getByRole('combobox'))
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(await screen.findByRole('option', { name }))
  }

  it('does not save from the first step: asks the reason, then shows the summary and waits for «Επιβεβαίωση εξιτηρίου»', async () => {
    const onConfirm = vi.fn()
    render(<LanguageProvider><Harness onConfirm={onConfirm} /></LanguageProvider>)
    const dialog = screen.getByRole('dialog', { name: 'Εξιτήριο ασθενούς' })
    // Default: now on the hospital's clock.
    const now = hospitalNow()
    expect(within(dialog).getByPlaceholderText('ωω:λλ')).toHaveValue(now.time)
    // The empty reason blocks the step and says so.
    expect(dialog.querySelector('.form-missing-summary')).toHaveTextContent('Συμπληρώστε: Αιτία εξιτηρίου')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Συνέχεια' }))
    expect(within(dialog).getByText('Υποχρεωτικό πεδίο')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Επιβεβαίωση εξιτηρίου' })).toBeNull()
    await choose('Μεταφορά σε άλλο νοσοκομείο')
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Σημείωση/ }), { target: { value: 'Στο ΑΧΕΠΑ' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Συνέχεια' }))
    // Step 2: the summary; nothing saved yet.
    expect(onConfirm).not.toHaveBeenCalled()
    const confirm = await screen.findByRole('button', { name: 'Επιβεβαίωση εξιτηρίου' })
    expect(screen.getByText('Μεταφορά σε άλλο νοσοκομείο')).toBeInTheDocument()
    expect(screen.getByText('Στο ΑΧΕΠΑ')).toBeInTheDocument()
    // «Επιστροφή» goes back to the form with the answers kept.
    fireEvent.click(screen.getByRole('button', { name: 'Επιστροφή' }))
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Συνέχεια' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Συνέχεια' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Επιβεβαίωση εξιτηρίου' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ date: now.date, reasonCode: 'transfer_out', reason: `Μεταφορά σε άλλο νοσοκομείο · ${now.time} — Στο ΑΧΕΠΑ` }))
    expect(confirm).toBeTruthy()
  })

  it('offers the five reasons', async () => {
    render(<LanguageProvider><Harness onConfirm={() => {}} /></LanguageProvider>)
    fireEvent.focus(screen.getByRole('combobox'))
    fireEvent.click(screen.getByRole('combobox'))
    const options = (await screen.findAllByRole('option')).map(node => node.textContent)
    expect(options).toEqual(['Εξιτήριο', 'Μεταφορά σε άλλο νοσοκομείο', 'Θάνατος', 'Αποχώρηση με δική του ευθύνη', 'Άλλο'])
  })

  it('refuses a date in the future or before the admission', () => {
    const text = { future: 'F', beforeAdmission: 'B', timeFuture: 'T' }
    const now = { date: '2026-10-20', time: '12:00' }
    expect(dischargeDateIssues({ date: '2026-10-21', time: '10:00', admissionDate: '2026-10-11', now }, text)).toEqual({ date: 'F' })
    expect(dischargeDateIssues({ date: '2026-10-10', time: '10:00', admissionDate: '2026-10-11', now }, text)).toEqual({ date: 'B' })
    expect(dischargeDateIssues({ date: '2026-10-20', time: '12:01', admissionDate: '2026-10-11', now }, text)).toEqual({ time: 'T' })
    expect(dischargeDateIssues({ date: '2026-10-20', time: '11:59', admissionDate: '2026-10-11', now }, text)).toEqual({})
    expect(dischargeReasonText({ reason: 'death', time: '09:30', note: '' })).toBe('Θάνατος · 09:30')
  })

  it('records the discharge only from the confirmation step, with the reason in the admission notes', () => {
    const source = read('src/features/surveillance/ClinicalAdmissions.jsx')
    expect(source).toContain('onConfirm={confirmDischarge}')
    expect(source).toContain('await dischargeAdmission(tenantId, patient, admission, result, { isDemo })')
    expect(read('supabase/migrations/20260918104000_patient_admission_lifecycle.sql')).toContain("'Discharge: '||trim(p_reason)")
  })
})

describe('patient forms use the shared validation', () => {
  function Form({ patient = null }) {
    const { t, language } = useLanguage()
    const form = usePatientForm({ patient, departments: [] })
    return <div><PatientFormFields form={form} t={t} language={language} departments={[]} /><button onClick={form.validation.submit(() => {})}>Αποθήκευση</button><p data-testid="missing">{form.validation.missingLabels.join(', ')}</p></div>
  }

  it('«Νέος ασθενής»: «*», «Συμπληρώστε: …», messages and the first missing field focused; sex is a select with «Επιλέξτε»', async () => {
    const { container } = render(<LanguageProvider><Form /></LanguageProvider>)
    expect(container.querySelectorAll('.lo-required-mark').length).toBeGreaterThanOrEqual(5)
    expect(screen.getByTestId('missing')).toHaveTextContent('Κωδικός ασθενούς, Όνομα, Επώνυμο, Φύλο, Ημερομηνία εισαγωγής')
    const sex = container.querySelector('[data-field-key="sex"] input')
    expect(sex).toHaveAttribute('placeholder', 'Επιλέξτε')
    fireEvent.click(screen.getByRole('button', { name: 'Αποθήκευση' }))
    expect(screen.getAllByText('Υποχρεωτικό πεδίο')).toHaveLength(5)
    await waitFor(() => expect(container.querySelector('[data-field-key="patientCode"] input')).toHaveFocus())
  })

  it('«Επεξεργασία ασθενούς»: the calculated age is helper text under the date of birth, gestational age follows birth weight', () => {
    const born = new Date(Date.now() - 9 * 86400000).toISOString().slice(0, 10)
    const { container } = render(<LanguageProvider><Form patient={{ id: 'PT-1', firstName: 'Α', lastName: 'Β', sex: 'female', dateOfBirth: born, birthWeightGrams: 980, gestationalAgeWeeks: 27 }} /></LanguageProvider>)
    const birth = container.querySelector('[data-field-key="dateOfBirth"]')
    expect(within(birth).getByText(/Υπολογιζόμενη ηλικία/)).toHaveClass('field-hint')
    const keys = [...container.querySelectorAll('[data-field-key]')].map(node => node.getAttribute('data-field-key'))
    expect(keys.indexOf('gestationalAgeWeeks')).toBe(keys.indexOf('birthWeightGrams') + 1)
    expect(read('src/styles/features.css')).toContain('.patient-details-editor .patient-entry-grid.patient-entry-grid-wide:is(.entry-grid,#lo-patient-form){grid-template-columns:repeat(2,minmax(0,1fr))!important')
  })

  it('wires the create page and the in-place edit to FormSubmit', () => {
    expect(read('src/features/patients/PatientCreatePage.jsx')).toContain('<FormSubmit form={form.validation}')
    expect(read('src/features/surveillance/ClinicalAdmissions.jsx')).toContain('form={form.validation}')
  })
})

describe('clinical assessments', () => {
  it('shows times in 24-hour format, as the history does', () => {
    const afternoon = formatDateTime('2026-10-15T14:05:00', 'el')
    expect(afternoon).toMatch(/14:05/)
    expect(afternoon).not.toMatch(/μ\.μ\.|π\.μ\./)
    const panel = read('src/features/clinical-scales/PatientClinicalScalesPanel.jsx')
    expect(panel).toContain("formatDateTime(value,en?'en':'el')")
    expect(panel).not.toContain("hour:'2-digit',minute:'2-digit'}).format")
  })

  it('has no native select in the «Νέα αξιολόγηση» dialog, and the missing-fields message is the shared one in the footer', () => {
    const panel = read('src/features/clinical-scales/PatientClinicalScalesPanel.jsx')
    const dialog = panel.slice(panel.indexOf('{selected&&<ObserverDialog'))
    expect(dialog).not.toContain('<select')
    expect(dialog).toContain('<SearchableSelect')
    expect(dialog).toContain('<FormSubmit form={validation}')
  })
})

describe('patient with no admission', () => {
  it('says so, offers «Νέα νοσηλεία» and lists what does exist', () => {
    const onNew = vi.fn()
    const t = key => ({ 'clinicalRecords.noAdmissionTitle': 'Δεν υπάρχει καταγεγραμμένη νοσηλεία για τον ασθενή.', 'clinicalRecords.newAdmission': 'Νέα νοσηλεία', 'clinicalRecords.nothingElseOnRecord': 'Δεν υπάρχει άλλη καταχώριση.', 'clinicalRecords.onRecordTitle': 'Τι υπάρχει', 'clinicalRecords.samplesCountLabel': 'Δείγματα' })[key] || key
    render(<MemoryRouter><LanguageProvider><PatientWithoutAdmission patient={{ recordId: 'p1' }} isDemo canAdmit onNewAdmission={onNew} samplesCount={2} t={t} fmtDate={value => value} /></LanguageProvider></MemoryRouter>)
    expect(screen.getByText('Δεν υπάρχει καταγεγραμμένη νοσηλεία για τον ασθενή.')).toBeInTheDocument()
    expect(screen.getByText('Δείγματα')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Νέα νοσηλεία' }))
    expect(onNew).toHaveBeenCalled()
  })
})
