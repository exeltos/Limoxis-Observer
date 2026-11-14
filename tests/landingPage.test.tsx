// @vitest-environment jsdom
// Η δημόσια «Σελίδα παρουσίασης» (διαδρομή «/» πριν τη σύνδεση): ενότητες σε EL και EN, «Σύνδεση» προς το /login,
// στοιχεία επικοινωνίας από το rpc public_contact με αρχικές τιμές, και ο συνδεδεμένος χρήστης πάει στην εφαρμογή.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const rpc = vi.hoisted(() => vi.fn())
const authState = vi.hoisted(() => ({ isAuthenticated: false, loading: false, profile: null as null | Record<string, unknown> }))
vi.mock('../src/core/supabase/client', () => ({ supabase: { rpc } }))
vi.mock('../src/core/config/env', async importOriginal => ({ ...(await importOriginal<object>()), hasSupabaseConfig: true }))
vi.mock('../src/core/auth/AuthContext', () => ({ useAuth: () => authState }))
const { LandingPage } = await import('../src/features/auth/LandingPage')
const { ProtectedRoute } = await import('../src/core/auth/ProtectedRoute')
const { LanguageProvider } = await import('../src/core/i18n/LanguageContext')

function renderLanding() {
  return render(<MemoryRouter initialEntries={['/']}><LanguageProvider><Routes>
    <Route path="/" element={<LandingPage/>}/>
    <Route path="/login" element={<p>Οθόνη σύνδεσης</p>}/>
  </Routes></LanguageProvider></MemoryRouter>)
}

beforeEach(() => {
  try { window.localStorage.clear() } catch { /* storage unavailable */ }
  rpc.mockResolvedValue({ data: [], error: null })
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => { cleanup(); vi.clearAllMocks(); authState.isAuthenticated = false })

describe('LandingPage', () => {
  it('shows the sections in Greek, with no sign-up, and «Σύνδεση» leads to /login', async () => {
    renderLanding()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Ασφαλής επιτήρηση και καθημερινή λειτουργία')
    expect(screen.getByText('Ενιαία πλατφόρμα νοσοκομείου')).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Ενότητες' })
    for (const label of ['Λειτουργίες', 'Πώς δουλεύει', 'Επικοινωνία']) expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(6)
    for (const title of ['Επιτήρηση λοιμώξεων', 'Εργαστήριο και αντοχή', 'Πρόληψη', 'Ποιότητα', 'Προσωπικό και βάρδιες', 'Δείκτες και αναφορές με τη LIRA']) expect(screen.getByRole('heading', { level: 3, name: title })).toBeInTheDocument()
    for (const step of ['1. Ρύθμιση νοσοκομείου', '2. Καταγραφή', '3. Παρακολούθηση', '4. Αναφορές']) expect(screen.getByText(step)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ζητήστε παρουσίαση/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Στείλτε email/ })).toHaveAttribute('href', expect.stringMatching(/^mailto:info@exeltos\.com\?subject=/))
    expect(screen.getByRole('link', { name: 'Πολιτική απορρήτου' })).toHaveAttribute('href', '/privacy')
    expect(screen.getByRole('link', { name: 'Όροι χρήσης' })).toHaveAttribute('href', '/terms')
    expect(screen.queryByText(/Εγγραφή|Δημιουργία λογαριασμού/)).toBeNull()
    expect(await screen.findByRole('link', { name: 'info@exeltos.com' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: 'Σύνδεση' }))
    expect(screen.getByText('Οθόνη σύνδεσης')).toBeInTheDocument()
  })

  it('switches to English', async () => {
    renderLanding()
    fireEvent.click(screen.getByRole('button', { name: 'Switch to English' }))
    expect(await screen.findByRole('heading', { level: 1, name: /Secure surveillance and daily operations/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
    for (const title of ['Infection surveillance', 'Laboratory and resistance', 'Prevention', 'Quality', 'Staff and shifts', 'Indicators and reports with LIRA']) expect(screen.getByRole('heading', { level: 3, name: title })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'How it works' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Privacy policy' })).toBeInTheDocument()
  })

  it('shows the contact details from public_contact()', async () => {
    rpc.mockResolvedValue({ data: [{ name: 'Άλλη ΑΕ', email: 'hello@example.org', phone: '210 123 4567', website: 'example.org' }], error: null })
    renderLanding()
    expect(await screen.findByRole('link', { name: '210 123 4567' })).toHaveAttribute('href', 'tel:+302101234567')
    expect(rpc).toHaveBeenCalledWith('public_contact')
    expect(screen.getByRole('link', { name: 'hello@example.org' })).toHaveAttribute('href', expect.stringContaining('mailto:hello@example.org'))
    expect(screen.getByRole('link', { name: 'example.org' })).toHaveAttribute('href', 'https://example.org')
    expect(screen.getAllByText('Άλλη ΑΕ').length).toBeGreaterThan(0)
  })

  it('keeps the built-in details when the call fails or a field is empty', async () => {
    rpc.mockResolvedValueOnce({ data: [{ name: '', email: null, phone: '210 999 0000', website: '' }], error: null })
    renderLanding()
    expect(await screen.findByRole('link', { name: '210 999 0000' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'info@exeltos.com' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'exeltos.com' })).toHaveAttribute('href', 'https://exeltos.com/')
    cleanup()
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'down' } })
    renderLanding()
    expect(await screen.findByRole('link', { name: '694 247 1022' })).toHaveAttribute('href', 'tel:+306942471022')
    cleanup()
    rpc.mockRejectedValueOnce(new Error('offline'))
    renderLanding()
    expect(await screen.findByRole('link', { name: 'info@exeltos.com' })).toBeInTheDocument()
  })
})

describe('the «/» route', () => {
  function renderAt(path: string) {
    return render(<MemoryRouter initialEntries={[path]}><LanguageProvider><Routes>
      <Route path="/login" element={<p>Οθόνη σύνδεσης</p>}/>
      <Route element={<ProtectedRoute/>}><Route index element={<p>Αρχική εφαρμογής</p>}/><Route path="laboratory" element={<p>Εργαστήριο</p>}/></Route>
    </Routes></LanguageProvider></MemoryRouter>)
  }
  it('shows the presentation page to someone not signed in', async () => {
    renderAt('/')
    expect(await screen.findByRole('heading', { level: 1, name: /Ασφαλής επιτήρηση/ })).toBeInTheDocument()
    expect(screen.queryByText('Αρχική εφαρμογής')).toBeNull()
  })
  it('sends other app paths to /login as before', () => {
    renderAt('/laboratory')
    expect(screen.getByText('Οθόνη σύνδεσης')).toBeInTheDocument()
  })
  it('takes someone signed in straight into the app', () => {
    authState.isAuthenticated = true
    renderAt('/')
    expect(screen.getByText('Αρχική εφαρμογής')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1, name: /Ασφαλής επιτήρηση/ })).toBeNull()
  })
})
