// @vitest-environment jsdom
// «Εργαζόμενοι χωρίς λογαριασμό» (N1): rows without e-mail are locked, the role
// is required and empty at first, «Ορισμός ρόλου σε όλους τους επιλεγμένους»
// fills the missing ones, and the confirmation runs the creation.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

const feedback = { notify: vi.fn(), notifyError: vi.fn(), confirm: vi.fn(async () => true) }
const service = vi.hoisted(() => ({
  previewBulkAccounts: vi.fn(),
  createBulkAccounts: vi.fn(),
  resendAccountAccess: vi.fn(),
}))
vi.mock('../src/core/supabase/client', () => ({ supabase: null, invokeAuthenticatedFunction: vi.fn() }))
vi.mock('../src/core/feedback/FeedbackContext', () => ({ useFeedback: () => feedback, useOptionalFeedback: () => feedback }))
vi.mock('../src/features/platform/bulkAccountsService', () => service)
const { LanguageProvider } = await import('../src/core/i18n/LanguageContext')
const { BulkAccountsPanel } = await import('../src/features/platform/BulkAccountsPanel')
const { normalizeRosterRow } = await import('../src/features/platform/bulkAccountsModel')

const organization = { id: 'org-1', name: 'Γ.Ν. Δοκιμής', contact_email: 'info@h.gr' }
const roster = {
  departments: [{ id: 'd1', name: 'ΜΕΘ' }],
  employees: [
    { employee_id: 'e1', full_name: 'Ιωάννα Παππά', profession_name: 'Νοσηλεύτρια ΤΕ', department_id: 'd1', department_name: 'ΜΕΘ', email: 'i@h.gr', account_state: 'none' },
    { employee_id: 'e2', full_name: 'Βασίλειος Ζερβός', department_name: 'ΤΕΠ', email: null, account_state: 'none', blocked_reason: 'missing_email' },
    { employee_id: 'e3', full_name: 'Μιχάλης Τσιρίγος', department_id: 'd1', department_name: 'ΜΕΘ', email: 'm@h.gr', account_state: 'none' },
  ].map(normalizeRosterRow),
}
const onReload = vi.fn(async () => {})
const panel = () => render(<LanguageProvider><BulkAccountsPanel organization={organization} roster={roster} onReload={onReload} onAccountsChanged={vi.fn()} onOpenEmployee={vi.fn()}/></LanguageProvider>)
const row = name => screen.getByText(name).closest('tr')

afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('BulkAccountsPanel', () => {
  it('locks the employees without e-mail and keeps the button disabled until every selected person has a role', async () => {
    panel()
    expect(within(row('Βασίλειος Ζερβός')).getByRole('checkbox')).toBeDisabled()
    expect(within(row('Βασίλειος Ζερβός')).getByText(/Λείπει email/)).toBeInTheDocument()
    fireEvent.click(within(row('Ιωάννα Παππά')).getByRole('checkbox'))
    fireEvent.click(within(row('Μιχάλης Τσιρίγος')).getByRole('checkbox'))
    expect(within(row('Ιωάννα Παππά')).getByLabelText('Ρόλος: Ιωάννα Παππά')).toHaveValue('')
    expect(screen.getByText('χωρίς ρόλο: 2')).toBeInTheDocument()
    const create = screen.getByRole('button', { name: 'Δημιουργία λογαριασμών & αποστολή' })
    expect(create).toBeDisabled()
    fireEvent.change(within(row('Ιωάννα Παππά')).getByLabelText('Ρόλος: Ιωάννα Παππά'), { target: { value: 'department_user' } })
    expect(within(row('Ιωάννα Παππά')).getByLabelText('Τμήμα: Ιωάννα Παππά')).toHaveValue('d1')
    // «Ορισμός ρόλου σε όλους τους επιλεγμένους» fills only the one without a role.
    fireEvent.click(screen.getByRole('button', { name: /Ορισμός ρόλου σε όλους τους επιλεγμένους/ }))
    expect(screen.getByText('Ρόλος για 1 επιλεγμένους')).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: /Διαχειριστής Νοσοκομείου/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: /Φαρμακείο/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Εφαρμογή σε 1' }))
    expect(within(row('Μιχάλης Τσιρίγος')).getByLabelText('Ρόλος: Μιχάλης Τσιρίγος')).toHaveValue('pharmacy')
    expect(within(row('Ιωάννα Παππά')).getByLabelText('Ρόλος: Ιωάννα Παππά')).toHaveValue('department_user')
    expect(create).toBeEnabled()
  })

  it('confirms, then creates the accounts in one run and shows the result', async () => {
    service.previewBulkAccounts.mockResolvedValue({ ok: true, expiresAt: '2026-10-27T21:59:00Z', existing: [{ employeeId: 'e3', name: 'Μιχάλης Τσιρίγος', role: 'pharmacy', organizations: ['Γ.Ν. Άλλο'] }], skipped: [], emailPreview: { name: 'Ιωάννα Παππά', subject: 'Θέμα', html: '<p>x</p>' } })
    service.createBulkAccounts.mockResolvedValue({ results: [{ employeeId: 'e1', status: 'created' }, { employeeId: 'e3', status: 'linked_existing' }] })
    panel()
    for (const [name, role] of [['Ιωάννα Παππά', 'department_user'], ['Μιχάλης Τσιρίγος', 'pharmacy']]) fireEvent.change(within(row(name)).getByLabelText(`Ρόλος: ${name}`), { target: { value: role } })
    fireEvent.click(screen.getByRole('button', { name: 'Δημιουργία λογαριασμών & αποστολή' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('1 email υπάρχει ήδη σε άλλο νοσοκομείο')).toBeInTheDocument()
    // The existing account is left out until the owner confirms that person.
    expect(within(dialog).getByRole('button', { name: /Δημιουργία 1 & αποστολή/ })).toBeEnabled()
    fireEvent.click(within(dialog).getByRole('checkbox'))
    fireEvent.click(within(dialog).getByRole('button', { name: /Δημιουργία 2 & αποστολή/ }))
    await waitFor(() => expect(service.createBulkAccounts).toHaveBeenCalledTimes(1))
    const [organizationId, items, options] = service.createBulkAccounts.mock.calls[0]
    expect(organizationId).toBe('org-1')
    expect(items).toEqual([{ employeeId: 'e1', role: 'department_user', departmentId: 'd1' }, { employeeId: 'e3', role: 'pharmacy', departmentId: null }])
    expect(options.confirmExisting).toEqual(['e3'])
    await waitFor(() => expect(onReload).toHaveBeenCalled())
    expect(feedback.notify).toHaveBeenCalledWith('Δημιουργήθηκαν 2 λογαριασμοί και στάλθηκαν τα email.', 'success', expect.anything())
  })
})
