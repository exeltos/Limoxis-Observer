// @vitest-environment jsdom
// The «Ορισμός κωδικού» link of an account created from the employee roster
// (/activate?access=ACT-…): the page asks redeem-access-token what the link is for
// (hospital, username, role, validity) and sets the password through it, with no
// session and without the Supabase invitation flow.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'

const auth = vi.hoisted(() => ({ verifyOtp: vi.fn(), getSession: vi.fn(), signOut: vi.fn() }))
const functions = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('../src/core/supabase/client', () => ({ supabase: { auth, functions } }))
const { ActivateAccountPage } = await import('../src/features/auth/ActivateAccountPage')
const { LanguageProvider } = await import('../src/core/i18n/LanguageContext')

const TOKEN = `ACT-${'a'.repeat(64)}`
const CONTEXT = { ok: true, organizationName: 'Γ.Ν. Θεσσαλονίκης «Παπανικολάου»', username: 'IP40718', roleLabel: 'Χρήστης Τμήματος', departmentName: 'ΜΕΘ', expiresAt: '2026-10-27T21:59:59Z' }
const page = () => render(<MemoryRouter><LanguageProvider><ActivateAccountPage/></LanguageProvider></MemoryRouter>)
function fill(value) {
  const [password, confirm] = document.querySelectorAll('input.input')
  fireEvent.change(password, { target: { value } })
  fireEvent.change(confirm, { target: { value } })
  return password.closest('form')
}

beforeEach(() => window.history.replaceState(null, '', `/activate?access=${TOKEN}`))
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('ActivateAccountPage with an access link', () => {
  it('shows what the link is for, rates the password and activates through redeem-access-token', async () => {
    functions.invoke.mockResolvedValueOnce({ data: CONTEXT, error: null }).mockResolvedValueOnce({ data: { ok: true, activated: true, username: 'IP40718' }, error: null })
    page()
    expect(await screen.findByText('Γ.Ν. Θεσσαλονίκης «Παπανικολάου»')).toBeInTheDocument()
    expect(functions.invoke).toHaveBeenCalledWith('redeem-access-token', { body: { action: 'inspect', token: TOKEN } })
    expect(screen.getByText('Χρήστης Τμήματος · ΜΕΘ')).toBeInTheDocument()
    fill('Kalimera2026')
    expect(screen.getByText(/μέτρια · προσθέστε ένα σύμβολο/)).toBeInTheDocument()
    fireEvent.submit(fill('Kalimera2026!'))
    await waitFor(() => expect(functions.invoke).toHaveBeenCalledTimes(2))
    expect(functions.invoke).toHaveBeenLastCalledWith('redeem-access-token', { body: { action: 'activate', token: TOKEN, password: 'Kalimera2026!' } })
    expect(await screen.findByText('Ο λογαριασμός ενεργοποιήθηκε')).toBeInTheDocument()
    expect(auth.verifyOtp).not.toHaveBeenCalled()
    expect(auth.getSession).not.toHaveBeenCalled()
  })

  it('says the link is no longer active when it expired or was used', async () => {
    functions.invoke.mockResolvedValueOnce({ data: { ok: false, code: 'ACCESS_NOT_AVAILABLE' }, error: { message: 'Edge Function returned a non-2xx status code' } })
    page()
    expect(await screen.findByText(/δεν είναι πλέον ενεργός/)).toBeInTheDocument()
    fill('Kalimera2026!')
    expect(screen.getByRole('button', { name: 'Ενεργοποίηση λογαριασμού' })).toBeDisabled()
  })
})
