// @vitest-environment jsdom
// «Ζητήστε παρουσίαση»: η φόρμα της Σελίδας παρουσίασης (υποχρεωτικά πεδία, παγίδα, επιτυχία, σφάλματα).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('../src/core/supabase/client', () => ({ supabase: { rpc } }))
vi.mock('../src/core/config/env', async importOriginal => ({ ...(await importOriginal<object>()), hasSupabaseConfig: true }))
const { LandingPage } = await import('../src/features/auth/LandingPage')
const { DemoRequestDialog } = await import('../src/features/auth/DemoRequestDialog')
const { LanguageProvider } = await import('../src/core/i18n/LanguageContext')

const inputOf = (label: RegExp) => screen.getByLabelText(label) as HTMLInputElement
function fillRequired() {
  fireEvent.change(inputOf(/^Ονοματεπώνυμο/), { target: { value: 'Μαρία Παπαδοπούλου' } })
  fireEvent.change(inputOf(/^Νοσοκομείο \/ Οργανισμός/), { target: { value: 'Γενικό Νοσοκομείο' } })
  fireEvent.change(inputOf(/^Ιδιότητα/), { target: { value: 'Υπεύθυνη Ελέγχου Λοιμώξεων' } })
  fireEvent.change(inputOf(/^Email/), { target: { value: 'maria@example.org' } })
  fireEvent.click(screen.getByRole('checkbox'))
}
const renderDialog = (onClose = vi.fn()) => render(<MemoryRouter><LanguageProvider><DemoRequestDialog language="el" contactEmail="info@exeltos.com" onClose={onClose}/></LanguageProvider></MemoryRouter>)
const send = () => fireEvent.click(screen.getByRole('button', { name: 'Αποστολή' }))

beforeEach(() => { try { window.localStorage.clear() } catch { /* storage unavailable */ } rpc.mockResolvedValue({ data: [], error: null }) })
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('DemoRequestDialog', () => {
  it('opens from «Ζητήστε παρουσίαση» on the presentation page', async () => {
    render(<MemoryRouter><LanguageProvider><LandingPage/></LanguageProvider></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /Ζητήστε παρουσίαση/ }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText(/^Ιδιότητα/)).toBeInTheDocument()
  })

  it('sends nothing while a required field or the privacy acceptance is missing', async () => {
    renderDialog()
    send()
    expect(await screen.findAllByText('Υποχρεωτικό πεδίο')).toHaveLength(4)
    expect(screen.getByText('Χρειάζεται η αποδοχή της Πολιτικής απορρήτου.')).toBeInTheDocument()
    fireEvent.change(inputOf(/^Email/), { target: { value: 'not-an-email' } })
    expect(screen.getByText('Μη έγκυρο email.')).toBeInTheDocument()
    expect(rpc).not.toHaveBeenCalled()
    expect(screen.getByRole('link', { name: 'Πολιτική απορρήτου' })).toHaveAttribute('href', '/privacy')
  })

  it('sends the request, with the hidden trap field, and confirms', async () => {
    rpc.mockResolvedValue({ data: { ok: true }, error: null })
    const { container } = renderDialog()
    fillRequired()
    fireEvent.change(inputOf(/^Τηλέφωνο/), { target: { value: '210 000 0000' } })
    const trap = container.ownerDocument.querySelector('input[name="website"]') as HTMLInputElement
    expect(trap).toHaveAttribute('tabindex', '-1')
    expect(trap.closest('[aria-hidden="true"]')).not.toBeNull()
    send()
    expect(await screen.findByText('Το αίτημά σας στάλθηκε')).toBeInTheDocument()
    expect(rpc).toHaveBeenCalledWith('submit_demo_request', expect.objectContaining({
      p_full_name: 'Μαρία Παπαδοπούλου', p_organization: 'Γενικό Νοσοκομείο', p_role: 'Υπεύθυνη Ελέγχου Λοιμώξεων',
      p_email: 'maria@example.org', p_phone: '210 000 0000', p_privacy_accepted: true, p_language: 'el', p_website: undefined,
    }))
  })

  it('passes a filled trap field to the server, which drops it quietly', async () => {
    rpc.mockResolvedValue({ data: { ok: true }, error: null })
    renderDialog()
    fillRequired()
    fireEvent.change(document.querySelector('input[name="website"]') as HTMLInputElement, { target: { value: 'http://spam.example' } })
    send()
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('submit_demo_request', expect.objectContaining({ p_website: 'http://spam.example' })))
  })

  it('says when the hourly limit is reached and offers the email when sending fails', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'DEMO_REQUEST_RATE_LIMIT', code: '54000' } })
    renderDialog()
    fillRequired()
    send()
    expect(await screen.findByRole('alert')).toHaveTextContent('Δοκιμάστε ξανά σε μία ώρα')
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'connection lost' } })
    send()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Δεν ήταν δυνατή η αποστολή'))
    expect(screen.getByRole('link', { name: 'info@exeltos.com' })).toHaveAttribute('href', 'mailto:info@exeltos.com')
    expect(screen.queryByText('Το αίτημά σας στάλθηκε')).toBeNull()
  })

  it('is in English too', () => {
    render(<MemoryRouter><LanguageProvider><DemoRequestDialog language="en" contactEmail="info@exeltos.com" onClose={vi.fn()}/></LanguageProvider></MemoryRouter>)
    for (const label of [/^Full name/, /^Hospital \/ Organization/, /^Position/, /^Email/, /^Phone/, /^Message/]) expect(screen.getByLabelText(label)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument()
  })
})
