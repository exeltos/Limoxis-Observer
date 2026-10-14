// @vitest-environment jsdom
// The activation page spends the one-time token of its link (?token_hash=) only on
// submit, and once: a retry after a later failure goes on with the session it opened.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'

const auth = vi.hoisted(() => ({ verifyOtp: vi.fn(), getSession: vi.fn(), signOut: vi.fn() }))
const functions = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('../src/core/supabase/client', () => ({ supabase: { auth, functions } }))
const { ActivateAccountPage } = await import('../src/features/auth/ActivateAccountPage')
const { LanguageProvider } = await import('../src/core/i18n/LanguageContext')

const PASSWORD = 'Str0ng!Password'
function submit() {
  const [password, confirm] = document.querySelectorAll('input.input')
  fireEvent.change(password, { target: { value: PASSWORD } })
  fireEvent.change(confirm, { target: { value: PASSWORD } })
  fireEvent.submit(password.closest('form'))
}

beforeEach(() => {
  window.history.replaceState(null, '', '/activate?token_hash=abc123&type=invite')
  auth.verifyOtp.mockResolvedValue({ data: {}, error: null })
  auth.getSession.mockResolvedValue({ data: { session: { access_token: 't' } } })
  auth.signOut.mockResolvedValue({})
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('ActivateAccountPage', () => {
  it('verifies the link token once, on submit, and retries with the session it opened', async () => {
    functions.invoke.mockResolvedValueOnce({ data: null, error: { message: 'temporary failure' } }).mockResolvedValueOnce({ data: { ok: true }, error: null })
    render(<MemoryRouter><LanguageProvider><ActivateAccountPage/></LanguageProvider></MemoryRouter>)
    expect(auth.verifyOtp).not.toHaveBeenCalled()
    submit()
    await waitFor(() => expect(functions.invoke).toHaveBeenCalledTimes(1))
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'abc123', type: 'invite' })
    expect(window.location.search).toBe('')
    submit()
    await waitFor(() => expect(functions.invoke).toHaveBeenCalledTimes(2))
    expect(auth.verifyOtp).toHaveBeenCalledTimes(1)
  })

  it('reports an expired link without calling the activation', async () => {
    auth.verifyOtp.mockResolvedValue({ data: {}, error: { message: 'expired' } })
    render(<MemoryRouter><LanguageProvider><ActivateAccountPage/></LanguageProvider></MemoryRouter>)
    submit()
    await waitFor(() => expect(auth.verifyOtp).toHaveBeenCalledTimes(1))
    expect(functions.invoke).not.toHaveBeenCalled()
    expect(await screen.findByText(/no longer active|δεν είναι πλέον ενεργή/)).toBeInTheDocument()
  })
})
