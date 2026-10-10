// @vitest-environment jsdom
// Saving a new incident opens it (its corrective action is created from there);
// other quality records return to where the user came from.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

let profile
vi.mock('../src/core/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: profile.id, email: profile.email }, profile, isAuthenticated: true, isDemoSession: false, loading: false }),
}))

const { LanguageProvider } = await import('../src/core/i18n/LanguageContext')
const { FeedbackProvider } = await import('../src/core/feedback/FeedbackContext')
const { TenantProvider, useTenant } = await import('../src/core/tenant/TenantContext')
const { NotificationProvider } = await import('../src/core/notifications/NotificationContext')
const { QualityCreatePage } = await import('../src/features/quality/QualityCreatePage')

function Where() {
  const location = useLocation()
  return <pre data-testid="where">{location.pathname}</pre>
}

async function create(recordType) {
  let api
  function Capture() { api = useTenant(); return null }
  render(<MemoryRouter initialEntries={['/quality', `/quality/${recordType}/new`]} initialIndex={1}><LanguageProvider><FeedbackProvider><TenantProvider><NotificationProvider><Capture/>
    <Routes>
      <Route path="/quality/:recordType/new" element={<QualityCreatePage/>}/>
      <Route path="*" element={<Where/>}/>
    </Routes>
  </NotificationProvider></TenantProvider></FeedbackProvider></LanguageProvider></MemoryRouter>)
  await waitFor(() => expect(api?.enterSampleDemo).toBeTypeOf('function'))
  act(() => { api.enterSampleDemo() })
  const title = await screen.findByRole('textbox', { name: /Τίτλος/ }).catch(() => document.querySelector('main input[type="text"], main input:not([type])'))
  fireEvent.change(title, { target: { value: 'Πτώση ασθενούς' } })
  fireEvent.click(screen.getByRole('button', { name: 'Αποθήκευση' }))
  return screen.findByTestId('where')
}

beforeEach(() => { localStorage.clear(); profile = { id: 'owner-1', isPlatformOwner: true, fullName: 'Platform Owner', isDemo: false } })
afterEach(() => { cleanup(); localStorage.clear() })

describe('saving a quality record', () => {
  it('opens a new incident', async () => {
    expect((await create('incidents')).textContent).toMatch(/^\/quality\/incidents\/[^/]+$/)
  })

  it('returns to the Quality Center after any other record', async () => {
    expect((await create('audits')).textContent).toBe('/quality')
  })
})
