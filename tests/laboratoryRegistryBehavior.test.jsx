// @vitest-environment jsdom
// The laboratory registry on the sample demo hospital: honest empty states and
// the New sample dialog in the shared dialog shell.
import { afterEach, describe, expect, it, vi } from 'vitest'
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
const { LaboratoryWorkspace } = await import('../src/features/laboratory/LaboratoryWorkspace')

async function openRegistry() {
  let api
  function Capture() { api = useTenant(); return null }
  render(<MemoryRouter initialEntries={['/laboratory']}><LanguageProvider><FeedbackProvider><TenantProvider><NotificationProvider><Capture/>
    <Routes><Route path="/laboratory" element={<LaboratoryWorkspace/>}/></Routes>
  </NotificationProvider></TenantProvider></FeedbackProvider></LanguageProvider></MemoryRouter>)
  await waitFor(() => expect(api?.enterSampleDemo).toBeTypeOf('function'))
  act(() => { api.enterSampleDemo() })
  await waitFor(() => expect(document.querySelectorAll('tbody tr').length).toBeGreaterThan(0))
}

afterEach(() => { cleanup(); sessionStorage.clear() })

describe('laboratory registry', () => {
  it('says nothing matches when the search hides every sample, and hides the pager', async () => {
    await openRegistry()
    fireEvent.change(document.querySelector('.filter-system input, input[type="search"], input[placeholder]'), { target: { value: 'zzzz-no-such-sample' } })
    expect(await screen.findByText('Δεν βρέθηκαν εγγραφές με αυτή την αναζήτηση ή τα φίλτρα')).toBeInTheDocument()
    expect(document.querySelector('.registry-pagination')).toBeNull()
  })

  it('opens New sample in the shared dialog, closed by its × alone, with app date fields', async () => {
    await openRegistry()
    fireEvent.click(screen.getByRole('button', { name: /Δημιουργία/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Καταχώρηση δείγματος' })
    expect(within(dialog).getAllByRole('button', { name: 'Κλείσιμο' })).toHaveLength(1)
    expect(within(dialog).queryByRole('button', { name: 'Ακύρωση' })).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: /Ασθενής/ }))
    fireEvent.click(within(dialog).getByRole('button', { name: /Υπάρχων ασθενής/ }))
    expect(dialog.querySelector('input[type="datetime-local"]')).toBeNull()
    expect(within(dialog).getByText('Λήψη *')).toBeInTheDocument()
    expect(within(dialog).getByText('Ώρα λήψης')).toBeInTheDocument()
  })
})
