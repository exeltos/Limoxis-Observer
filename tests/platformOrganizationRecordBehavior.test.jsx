// @vitest-environment jsdom
// Behavior of the Platform Owner organization record, exercised through the
// rendered UI with the tenant services mocked.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'

const feedback = { notify: vi.fn(), notifyError: vi.fn(), confirm: vi.fn(async () => true) }
let members
const service = {
  listOrganizationMembersDetailed: vi.fn(async () => members),
  manageOrganizationUser: vi.fn(async () => ({})),
  createOrganizationUser: vi.fn(async () => ({ emailSent: true })),
  updatePlatformOrganization: vi.fn(async (id, draft) => ({ id, ...draft })),
  setPlatformOrganizationStatus: vi.fn(async () => ({})),
}
vi.mock('../src/core/supabase/client', () => ({ supabase: { rpc: vi.fn(async () => ({ data: null, error: null })), from: vi.fn(), functions: { invoke: vi.fn() } } }))
vi.mock('../src/core/feedback/FeedbackContext', () => ({ useFeedback: () => feedback, useOptionalFeedback: () => feedback }))
vi.mock('../src/core/tenant/tenantService', async original => ({
  ...(await original()),
  listOrganizationMembersDetailed: (...args) => service.listOrganizationMembersDetailed(...args),
  manageOrganizationUser: (...args) => service.manageOrganizationUser(...args),
  createOrganizationUser: (...args) => service.createOrganizationUser(...args),
  updatePlatformOrganization: (...args) => service.updatePlatformOrganization(...args),
  setPlatformOrganizationStatus: (...args) => service.setPlatformOrganizationStatus(...args),
}))
vi.mock('../src/features/employees/employeeService', async original => ({ ...(await original()), loadEmployeesAsync: vi.fn(async () => []) }))

const { LanguageProvider } = await import('../src/core/i18n/LanguageContext')
const { PlatformOrganizationRecord } = await import('../src/features/platform/PlatformOrganizationRecord')

const organization = { id: 'org-1', name: 'Γενικό Νοσοκομείο Δοκιμής', code: 'GNT', type: 'hospital', status: 'active', city: 'Αθήνα', country: 'Ελλάδα' }
const admin = { userId: 'u-1', name: 'Άννα Διαχειρίστρια', email: 'anna@h.gr', role: 'hospital_admin', status: 'active' }
const user = { userId: 'u-2', name: 'Βασίλης Χρήστης', email: 'vasilis@h.gr', role: 'department_user', status: 'active' }
let handlers
function openRecord(initialTab = 'details') {
  handlers = { onDelete: vi.fn(), onEnter: vi.fn(), onBack: vi.fn(), onTabChange: vi.fn(), onChanged: vi.fn() }
  return render(<MemoryRouter><LanguageProvider><PlatformOrganizationRecord organization={organization} initialTab={initialTab} {...handlers}/></LanguageProvider></MemoryRouter>)
}
const shell = () => document.querySelector('.entity-record-shell')

beforeEach(() => { members = [admin, user] })
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('organization record shell', () => {
  it('uses the canonical record shell with the organization identity and its tabs', async () => {
    openRecord()
    expect(shell()).toHaveClass('platform-owner-record-shell', 'platform-organization-record-workspace')
    expect(within(shell().querySelector('header')).getByText('ΚΑΡΤΕΛΑ ΟΡΓΑΝΙΣΜΟΥ')).toBeInTheDocument()
    expect(within(shell().querySelector('header')).getByRole('heading', { name: organization.name })).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Στοιχεία & Ρυθμίσεις', 'Χρήστες & Ρόλοι (2)', 'Λειτουργία & Συμβάντα', 'Αντίγραφο & διαγραφή']))
  })

  it('groups the organization actions and edits or deletes through the shared action buttons', async () => {
    openRecord()
    const actions = screen.getByLabelText('Ενέργειες οργανισμού')
    expect(within(actions).getByRole('button', { name: 'Είσοδος στον οργανισμό' })).toBeInTheDocument()
    expect(within(actions).getByRole('button', { name: 'Παύση οργανισμού' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Επεξεργασία' })).toHaveClass('lo-icon-button-edit')
    const remove = screen.getByRole('button', { name: 'Οριστική διαγραφή οργανισμού' })
    expect(remove).toHaveClass('lo-icon-button-danger')
    expect(document.querySelector('.button-danger')).toBeNull()
    fireEvent.click(remove)
    await waitFor(() => expect(handlers.onDelete).toHaveBeenCalled())
  })

  it('opens the details with the shared KPI cards and the sectioned form', async () => {
    openRecord()
    const strip = document.querySelector('.platform-owner-details > .module-summary-strip')
    expect(strip).not.toBeNull()
    expect(strip.firstElementChild).toHaveClass('metric-card')
    expect(document.querySelector('.platform-form-shell .platform-form-section')).not.toBeNull()
  })
})

describe('organization users', () => {
  it('shows each member with a localized role label', async () => {
    openRecord('users')
    const row = (await screen.findByText(user.name)).closest('tr')
    expect(within(row).getByText('Χρήστης Τμήματος')).toBeInTheDocument()
    expect(within((await screen.findByText(admin.name)).closest('tr')).getByText('Διαχειριστής Νοσοκομείου')).toBeInTheDocument()
  })

  it('invites a Hospital Admin when the organization has none', async () => {
    members = [user]
    openRecord()
    fireEvent.change(await screen.findByLabelText(/Ονοματεπώνυμο νέου Διαχειριστή Νοσοκομείου/), { target: { value: 'Γιώργος Νέος' } })
    fireEvent.change(screen.getByLabelText(/Email πρόσκλησης/), { target: { value: 'giorgos@h.gr' } })
    fireEvent.click(screen.getByRole('button', { name: /Ορισμός Διαχειριστή Νοσοκομείου & πρόσκληση/ }))
    await waitFor(() => expect(service.createOrganizationUser).toHaveBeenCalledWith({ organizationId: 'org-1', fullName: 'Γιώργος Νέος', role: 'hospital_admin', email: 'giorgos@h.gr' }))
  })

  it('updates a selected user, including a new role, through the manage-user action', async () => {
    openRecord('users')
    fireEvent.click((await screen.findByText(user.name)).closest('tr'))
    fireEvent.click(await screen.findByRole('button', { name: 'Επεξεργασία' }))
    const role = screen.getAllByRole('combobox').find(select => select.value === 'department_user')
    fireEvent.change(role, { target: { value: 'department_manager' } })
    fireEvent.click(screen.getByRole('button', { name: /Αποθήκευση/ }))
    await waitFor(() => expect(service.manageOrganizationUser).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-1', userId: 'u-2', action: 'update', role: 'department_manager' })))
  })
})
