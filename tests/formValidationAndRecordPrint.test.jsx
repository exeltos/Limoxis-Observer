// @vitest-environment jsdom
// Shared design-system rules approved after the Surveillance screens review:
// forms never save empty (required «*», messages under the fields, the first
// missing field focused, «Συμπληρώστε: …» beside the primary button), dialogs
// sized to their content, and a record page that prints every tab cleanly.
import fs from 'node:fs'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../src/features/management/useLibraries', async original => ({ ...(await original()), useLibraries: () => ({ libraries: { sampleTypes: [] } }) }))

const { LanguageProvider } = await import('../src/core/i18n/LanguageContext')
const { Field } = await import('../src/design-system/Field')
const { ManualDateField } = await import('../src/design-system/ManualDateField')
const { FormSubmit, useFormValidation } = await import('../src/design-system/FormValidation')
const { ObserverDialog } = await import('../src/design-system/ObserverDialog')
const { EntityRecordShell } = await import('../src/design-system/EntityRecordShell')
const { ExportMenu } = await import('../src/design-system/ExportMenu')
const { SampleRequestDialog } = await import('../src/features/surveillance/ClinicalRecordDialogs')

const read = path => fs.readFileSync(path, 'utf8')
afterEach(() => { cleanup(); vi.useRealTimers() })

function DepartmentForm({ onSave }) {
  const [department, setDepartment] = useState('')
  const [date, setDate] = useState('')
  const form = useFormValidation([
    { key: 'department', label: 'Τμήμα', valid: Boolean(department.trim()) },
    { key: 'date', label: 'Ημερομηνία λήψης', valid: Boolean(date) },
  ])
  return <ObserverDialog title="Δοκιμή" onClose={() => {}} footer={<FormSubmit form={form} onSubmit={() => onSave({ department, date })}>Αποθήκευση</FormSubmit>}>
    <div className="entry-grid">
      <Field label="Τμήμα" {...form.field('department')}><input value={department} onChange={event => setDepartment(event.target.value)} /></Field>
      <ManualDateField label="Ημερομηνία λήψης" {...form.field('date')} value={date} onChange={setDate} />
    </div>
  </ObserverDialog>
}

describe('forms never save empty', () => {
  it('marks required fields, says what is missing, blocks the empty submit and focuses the first missing field', async () => {
    const onSave = vi.fn()
    render(<LanguageProvider><DepartmentForm onSave={onSave} /></LanguageProvider>)
    const save = screen.getByRole('button', { name: 'Αποθήκευση' })
    // Looks disabled and explains why, before any press.
    expect(save).toHaveAttribute('aria-disabled', 'true')
    expect(document.querySelector('.form-missing-summary')).toHaveTextContent('Συμπληρώστε: Τμήμα, Ημερομηνία λήψης')
    expect(document.querySelectorAll('.lo-required-mark')).toHaveLength(2)
    // The field keeps its own name: the «*» and the message are not part of it.
    const department = screen.getByLabelText('Τμήμα')
    expect(department).not.toHaveAttribute('aria-invalid')
    fireEvent.click(save)
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getAllByText('Υποχρεωτικό πεδίο')).toHaveLength(2)
    expect(screen.getByLabelText('Τμήμα')).toBe(department)
    expect(department.closest('[data-field-key="department"]')).toHaveAttribute('data-invalid', 'true')
    await waitFor(() => expect(department).toHaveFocus())
    fireEvent.change(department, { target: { value: 'ΜΕΘ' } })
    fireEvent.change(screen.getByPlaceholderText('ηη/μμ/εεεε'), { target: { value: '20/10/2026' } })
    fireEvent.blur(screen.getByPlaceholderText('ηη/μμ/εεεε'))
    expect(save).not.toHaveAttribute('aria-disabled')
    expect(document.querySelector('.form-missing-summary')).toBeNull()
    expect(screen.queryByText('Υποχρεωτικό πεδίο')).toBeNull()
    fireEvent.click(save)
    expect(onSave).toHaveBeenCalledWith({ department: 'ΜΕΘ', date: '2026-10-20' })
  })

  it('does not send an empty «Αίτημα δείγματος» of a surveillance', async () => {
    const onSave = vi.fn()
    render(<LanguageProvider><SampleRequestDialog t={key => ({ save: 'Αποθήκευση', sampleType: 'Τύπος δείγματος', priority: 'Προτεραιότητα' })[key] || key} context={{ patient: 'Ελένη Παπαδοπούλου', episode: 'CLABSI · 12/10/2026', department: 'ΜΕΘ' }} onClose={() => {}} onSave={onSave} /></LanguageProvider>)
    const dialog = screen.getByRole('dialog', { name: 'Αίτημα δείγματος' })
    // The request names who and where; the collection time and method are the laboratory's.
    expect(within(dialog).getByText('Ελένη Παπαδοπούλου')).toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Τρόπος λήψης')).toBeNull()
    // The long example is helper text under the field, not a cut-off placeholder.
    expect(within(dialog).getByText('π.χ. περιφερική φλέβα / κεντρική γραμμή')).toHaveClass('field-hint')
    expect(dialog.querySelector('input[placeholder^="π.χ."]')).toBeNull()
    fireEvent.click(within(dialog).getByRole('button', { name: /Αποστολή αιτήματος/ }))
    expect(onSave).not.toHaveBeenCalled()
    expect(dialog.querySelector('.form-missing-summary')).toHaveTextContent('Ανατομική θέση / προέλευση')
    expect(within(dialog).getAllByText('Υποχρεωτικό πεδίο')).toHaveLength(1)
    await waitFor(() => expect(within(dialog).getByLabelText('Ανατομική θέση / προέλευση')).toHaveFocus())
    fireEvent.change(within(dialog).getByLabelText('Ανατομική θέση / προέλευση'), { target: { value: 'Περιφερική φλέβα' } })
    fireEvent.click(within(dialog).getByRole('button', { name: /Αποστολή αιτήματος/ }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ source: 'Περιφερική φλέβα', type: 'bloodCulture', priority: 'routine' }))
    expect(onSave.mock.calls[0][0]).not.toHaveProperty('collectedAt')
  })

  it('wires the rule into every surveillance creation form', () => {
    for (const file of ['NewSurveillanceFlow.jsx', 'EmployeeSurveillanceCanonicalFlow.jsx', 'EnvironmentalSurveillanceFlow.jsx', 'ClinicalRecordDialogs.jsx']) {
      const source = read(`src/features/surveillance/${file}`)
      expect(source, file).toContain('useFormValidation(')
      expect(source, file).toContain('<FormSubmit')
    }
    // Read-only context in a form row is as tall as an input (no taller info cards).
    expect(read('src/features/surveillance/NewSurveillanceSteps.jsx')).toContain('<ReadOnlyField')
    expect(read('src/styles/design-system.css')).toContain('.lo-readonly-field-value{box-sizing:border-box;min-height:var(--lo-field-height)')
  })
})

describe('dialog sizing', () => {
  it('offers small / medium / large and sizes a dialog to its content with the footer in view', () => {
    render(<LanguageProvider><ObserverDialog title="Μικρό" width="small" onClose={() => {}} footer={<button>OK</button>}><p>Ένα πεδίο</p></ObserverDialog></LanguageProvider>)
    expect(screen.getByRole('dialog', { name: 'Μικρό' })).toHaveClass('observer-dialog-compact')
    cleanup()
    render(<LanguageProvider><ObserverDialog title="Μεγάλο" width="large" fixedHeight onClose={() => {}}><p>…</p></ObserverDialog></LanguageProvider>)
    expect(screen.getByRole('dialog', { name: 'Μεγάλο' })).toHaveClass('observer-dialog-wide')
    // No fixed tall window: the height comes from the content (max: the screen).
    expect(read('src/styles/foundation.css')).not.toMatch(/\.observer-dialog-fixed-height\{\s*height:/)
    expect(read('src/features/surveillance/EmployeeSurveillanceCanonicalFlow.jsx')).not.toContain('fixedHeight')
  })
})

describe('printing a record page', () => {
  const tabs = [{ id: 'one', label: 'Σύνοψη' }, { id: 'two', label: 'Δείγματα' }, { id: 'three', label: 'Ιστορικό' }]
  const content = { one: 'Περιεχόμενο σύνοψης', two: 'Περιεχόμενο δειγμάτων', three: 'Περιεχόμενο ιστορικού' }
  it('prints every tab in sequence from «Εξαγωγή › Εκτύπωση», not only the tab on screen', async () => {
    vi.useFakeTimers()
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    const pagePrint = vi.fn()
    render(<MemoryRouter><LanguageProvider><EntityRecordShell title="Ελένη Παπαδοπούλου" eyebrow="PT-260184" tabs={tabs} activeTab="one" renderTab={id => <p>{content[id]}</p>} headerActions={<ExportMenu onPrint={pagePrint} />}>
      <p>{content.one}</p>
    </EntityRecordShell></LanguageProvider></MemoryRouter>)
    expect(screen.queryByText(content.two)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Εξαγωγή: Εκτύπωση' }))
    expect(pagePrint).not.toHaveBeenCalled()
    const sections = [...document.querySelectorAll('.record-print-section')]
    expect(sections.map(section => section.textContent)).toEqual(['ΣύνοψηΠεριεχόμενο σύνοψης', 'ΔείγματαΠεριεχόμενο δειγμάτων', 'ΙστορικόΠεριεχόμενο ιστορικού'])
    expect(document.querySelector('.record-print-header')).toHaveTextContent(/Ημερομηνία εκτύπωσης: \d{2}\/\d{2}\/\d{4}/)
    expect(document.querySelector('style')?.textContent).toContain('counter(page)')
    act(() => { vi.advanceTimersByTime(500) })
    expect(print).toHaveBeenCalledTimes(1)
    act(() => { window.dispatchEvent(new Event('afterprint')) })
    expect(document.querySelector('.record-print-section')).toBeNull()
    expect(screen.queryByText(content.two)).toBeNull()
    print.mockRestore()
  })

  it('hides the on-screen controls in print and starts each tab on a new page', () => {
    const css = read('src/styles/print.css')
    for (const control of ['.entity-record-tabs', '.entity-record-back-left', '.entity-record-sequence', '.lo-export-menu', '.lo-overflow-menu', '.registry-pagination', '.button', '.lo-icon-button']) expect(css).toContain(control)
    expect(css).toContain('.record-print-section{break-before:page}')
    expect(css).toContain('.record-print-header,.record-print-footer{display:none}')
    // The surveillance episode and the laboratory sample print all their tabs.
    expect(read('src/features/surveillance/PatientClinicalCanonicalPage.jsx')).toContain('renderTab={renderTab}')
    expect(read('src/features/laboratory/LaboratorySampleRecordFunctionalView.jsx')).toContain('renderTab={renderTab}')
  })
})
