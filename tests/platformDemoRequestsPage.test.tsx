// @vitest-environment jsdom
// Κονσόλα › Αιτήματα παρουσίασης: η λίστα του Ιδιοκτήτη Πλατφόρμας και η αλλαγή κατάστασης.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'
import { readSource } from './helpers/readSource'

const notify = vi.hoisted(() => vi.fn())
const service = vi.hoisted(() => ({ listDemoRequests: vi.fn(), updateDemoRequestStatus: vi.fn() }))
vi.mock('../src/features/platform/demoRequestsService', async importOriginal => ({ ...(await importOriginal<object>()), ...service }))
vi.mock('../src/core/feedback/FeedbackContext', async importOriginal => ({ ...(await importOriginal<object>()), useFeedback: () => ({ notify, notifyError: vi.fn() }) }))
const { PlatformDemoRequestsPage } = await import('../src/features/platform/PlatformDemoRequestsPage')
const { LanguageProvider } = await import('../src/core/i18n/LanguageContext')

const REQUEST = { id: 'r1', createdAt: '2026-11-13T10:00:00Z', fullName: 'Νίκος Γεωργίου', organizationName: 'Νοσοκομείο Άλφα', roleTitle: 'Διευθυντής Ποιότητας', email: 'nikos@example.org', phone: '210 111 2222', message: 'Παρουσίαση τον Δεκέμβριο.', language: 'el', status: 'new', handledAt: null }
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('PlatformDemoRequestsPage', () => {
  it('lists the requests and changes the status of one', async () => {
    service.listDemoRequests.mockResolvedValue([REQUEST, { ...REQUEST, id: 'r2', fullName: 'Ελένη Δήμου', email: 'eleni@example.org', status: 'closed' }])
    service.updateDemoRequestStatus.mockResolvedValue({ ...REQUEST, status: 'contacted' })
    render(<MemoryRouter><LanguageProvider><PlatformDemoRequestsPage/></LanguageProvider></MemoryRouter>)
    const row = (await screen.findByText('Νίκος Γεωργίου')).closest('tr') as HTMLElement
    for (const text of ['Νοσοκομείο Άλφα', 'nikos@example.org', '210 111 2222', 'Παρουσίαση τον Δεκέμβριο.', 'Νέο']) expect(within(row).getByText(text)).toBeInTheDocument()
    for (const header of ['Ημερομηνία', 'Ονοματεπώνυμο', 'Οργανισμός', 'Email', 'Τηλέφωνο', 'Μήνυμα', 'Κατάσταση']) expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument()
    fireEvent.click(row)
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Κατάσταση' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Έγινε επικοινωνία' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Αποθήκευση' }))
    await waitFor(() => expect(service.updateDemoRequestStatus).toHaveBeenCalledWith('r1', 'contacted'))
    await waitFor(() => expect(within(screen.getByText('Νίκος Γεωργίου').closest('tr') as HTMLElement).getByText('Έγινε επικοινωνία')).toBeInTheDocument())
  })

  it('says when there are no requests yet', async () => {
    service.listDemoRequests.mockResolvedValue([])
    render(<MemoryRouter><LanguageProvider><PlatformDemoRequestsPage/></LanguageProvider></MemoryRouter>)
    expect(await screen.findByText('Δεν υπάρχουν αιτήματα ακόμα')).toBeInTheDocument()
  })

  it('sits in the owner menu after Demo, behind the platform capability', () => {
    const shell = readSource('src/app/AppShell.tsx')
    expect(shell.indexOf("key:'platformNav.demoRequests'")).toBeGreaterThan(shell.indexOf("key:'platformNav.demos'"))
    expect(shell).toContain("path:'/platform/demo-requests'")
    expect(readSource('src/app/App.tsx')).toContain('<Route path="platform/demo-requests" element={gate(CAPABILITIES.VIEW_PLATFORM,<PlatformDemoRequestsPage/>)}/>')
  })
})
