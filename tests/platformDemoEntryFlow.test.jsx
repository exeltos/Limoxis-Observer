// @vitest-environment jsdom
// The Platform Owner's topbar "Είσοδος Demo" opens their own Demo organization
// (enterPlatformDemo), as the evaluators see theirs, and lands on its home page.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { fireEvent, cleanup, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { PlatformDashboardView } from '../src/features/platform/PlatformDashboardView'

vi.mock('../src/core/tenant/tenantService', async (importOriginal) => ({
  ...(await importOriginal()),
  openPlatformOwnerDemo: vi.fn(async () => 'owner-demo-org'),
  getPlatformOwnerDemoMembership: vi.fn(async (organizationId) => ({
    id: `platform-owner:${organizationId}`,
    role: 'hospital_admin',
    organization: { id: organizationId, name: 'ΑΡΗΣ ΤΕΣΤ', is_demo: true, mode: 'production', status: 'active' },
  })),
}))

vi.mock('../src/core/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'owner-1' },
    profile: { id: 'owner-1', isPlatformOwner: true, fullName: 'Platform Owner', isDemo: false },
    isAuthenticated: true,
    isDemoSession: false,
    loading: false,
    logout: vi.fn(),
  }),
}))

afterEach(() => { cleanup(); sessionStorage.clear(); localStorage.clear() })

const tx = (el) => el
const baseProps = {
  tx,
  organizations: [{ id: 'org-1', name: 'Lena Hospital', code: 'DEMO-1', city: 'Θεσσαλονίκη', status: 'active' }],
  activeOrganizations: 1,
  activeDemos: [],
  expiringDemos: [],
  loadingStats: false,
  onNavigate: () => {},
}

describe('PlatformDashboardView', () => {
  it('shows the live-platform pill; organizations open from their own card', () => {
    render(<PlatformDashboardView {...baseProps}/>)
    expect(screen.getByText('Πλατφόρμα ενεργή')).toBeInTheDocument()
    // Hospitals appear on the Overview only in the health list (last activity, errors / 24 h).
    expect(screen.getByText('Lena Hospital').closest('.platform-health-row')).not.toBeNull()
    expect(screen.getAllByText(/Οργανισμοί/).length).toBeGreaterThan(0)
  })
})

describe('AppShell topbar demo controls', () => {
  async function renderShell() {
    const { LanguageProvider } = await import('../src/core/i18n/LanguageContext')
    const { FeedbackProvider } = await import('../src/core/feedback/FeedbackContext')
    const { NotificationProvider } = await import('../src/core/notifications/NotificationContext')
    const { TenantProvider, useTenant } = await import('../src/core/tenant/TenantContext')
    const { AppShell } = await import('../src/app/AppShell')

    let tenantApi, navigateFn
    function Capture() { tenantApi = useTenant(); navigateFn = useNavigate(); return null }

    render(
      <MemoryRouter initialEntries={['/platform']}>
        <LanguageProvider>
          <FeedbackProvider>
            <TenantProvider>
              <NotificationProvider>
                <Routes>
                  <Route path="/platform" element={<AppShell/>}>
                    <Route index element={<><Capture/><div>platform-center-stub</div></>}/>
                  </Route>
                  <Route path="/" element={<AppShell/>}>
                    <Route index element={<><Capture/><div>dashboard-stub</div></>}/>
                  </Route>
                </Routes>
              </NotificationProvider>
            </TenantProvider>
          </FeedbackProvider>
        </LanguageProvider>
      </MemoryRouter>,
    )
    await waitFor(() => expect(tenantApi?.enterSampleDemo).toBeTypeOf('function'))
    return { get tenantApi() { return tenantApi }, get navigateFn() { return navigateFn } }
  }

  it('the topbar "Είσοδος Demo" opens the Owner\'s own Demo organization on its home page', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const ctx = await renderShell()

    expect(screen.getByText('platform-center-stub')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Είσοδος Demo'))
    await waitFor(() => expect(screen.getByText('dashboard-stub')).toBeInTheDocument(), { timeout: 5000 })
    expect(ctx.tenantApi.tenant?.name).toBe('ΑΡΗΣ ΤΕΣΤ')
  })

  it('shows a clickable DEMO badge in the topbar once the Platform Owner actually enters the demo organization, and clicking it returns to /platform', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const ctx = await renderShell()

    expect(screen.queryByText('DEMO')).not.toBeInTheDocument()

    // The browser-only sample hospital (what the Help preview's "Demo" opens), then navigate('/').
    act(() => { ctx.tenantApi.enterSampleDemo(); ctx.navigateFn('/') })

    await waitFor(() => expect(screen.getByText('dashboard-stub')).toBeInTheDocument(), { timeout: 5000 })
    const badge = await waitFor(() => {
      const found = document.querySelector('.topbar-demo-badge')
      expect(found).toBeTruthy()
      return found
    })
    expect(badge).toHaveTextContent('DEMO')

    fireEvent.click(badge)
    await waitFor(() => expect(screen.getByText('platform-center-stub')).toBeInTheDocument())
    // Back on /platform: the topbar offers the way in again.
    expect(screen.getByText('Είσοδος Demo')).toBeInTheDocument()
    expect(ctx.tenantApi.isDemo).toBe(false)
  })
})
