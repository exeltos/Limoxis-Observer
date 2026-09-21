// @vitest-environment jsdom
// User request (revised twice): the "Είσοδος Demo" button moves to the
// topbar, next to the other Platform Owner actions. Pressing it only
// toggles TenantContext's platformDemoPreview — it must never call
// enterPlatformDemo()/navigate on its own. While previewing, the real
// organizations disappear entirely from the Platform Center's
// "Οργανισμοί" list, replaced by the single synthetic "Demo Hospital"
// entry; clicking that entry opens a read-only PlatformDemoOrganizationRecord
// (not the real, backend-backed PlatformOrganizationRecord), and only its
// own "Είσοδος" action actually calls enterPlatformDemo() and enters the
// full working demo hospital.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { fireEvent, cleanup, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { PlatformDashboardView } from '../src/features/platform/PlatformDashboardView'

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

afterEach(() => cleanup())

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

describe('PlatformDashboardView demo preview display (no entry button of its own anymore)', () => {
  it('shows the live-platform pill and real organizations by default', () => {
    render(<PlatformDashboardView {...baseProps} demoPreview={false}/>)
    expect(screen.getByText('Πλατφόρμα ενεργή')).toBeInTheDocument()
    expect(screen.getByText('Lena Hospital')).toBeInTheDocument()
    expect(screen.queryByText('Demo Hospital')).not.toBeInTheDocument()
  })

  it('shows a DEMO badge instead of the live pill when the caller marks it as previewing (organizations swap happens upstream)', () => {
    const demoOrgProps = { ...baseProps, organizations: [{ id: 'demo-hospital', name: 'Demo Hospital', code: 'DEMO', status: 'active' }], activeOrganizations: 1 }
    render(<PlatformDashboardView {...demoOrgProps} demoPreview/>)
    expect(screen.getAllByText('DEMO').length).toBeGreaterThan(0)
    expect(screen.queryByText('Πλατφόρμα ενεργή')).not.toBeInTheDocument()
    expect(screen.getByText('Demo Hospital')).toBeInTheDocument()
    expect(screen.queryByText('Lena Hospital')).not.toBeInTheDocument()
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
    await waitFor(() => expect(tenantApi?.enterPlatformDemo).toBeTypeOf('function'))
    return { get tenantApi() { return tenantApi }, get navigateFn() { return navigateFn } }
  }

  it('toggling the topbar "Είσοδος Demo" button only flips platformDemoPreview — it never enters demo or navigates', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const ctx = await renderShell()

    expect(screen.getByText('platform-center-stub')).toBeInTheDocument()
    const toggle = screen.getByText('Είσοδος Demo')
    expect(ctx.tenantApi.platformDemoPreview).toBe(false)

    fireEvent.click(toggle)
    await waitFor(() => expect(ctx.tenantApi.platformDemoPreview).toBe(true))
    expect(ctx.tenantApi.isDemo).toBe(false)
    expect(ctx.tenantApi.tenant).toBeNull()
    expect(screen.getByText('Έξοδος από Demo')).toBeInTheDocument()
    // Still on the Platform Center screen — toggling preview never navigates.
    expect(screen.getByText('platform-center-stub')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Έξοδος από Demo'))
    await waitFor(() => expect(ctx.tenantApi.platformDemoPreview).toBe(false))
    expect(screen.getByText('Είσοδος Demo')).toBeInTheDocument()
  })

  it('shows a clickable DEMO badge in the topbar once the Platform Owner actually enters the demo organization, and clicking it returns to /platform', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const ctx = await renderShell()

    expect(screen.queryByText('DEMO')).not.toBeInTheDocument()

    // Mirrors PlatformDemoOrganizationRecord's onEnter: enterPlatformDemo() then navigate('/').
    act(() => { ctx.tenantApi.enterPlatformDemo(); ctx.navigateFn('/') })

    await waitFor(() => expect(screen.getByText('dashboard-stub')).toBeInTheDocument())
    const badge = await waitFor(() => {
      const found = document.querySelector('.topbar-demo-badge')
      expect(found).toBeTruthy()
      return found
    })
    expect(badge).toHaveTextContent('DEMO')

    fireEvent.click(badge)
    await waitFor(() => expect(screen.getByText('platform-center-stub')).toBeInTheDocument())
    // Back on /platform: the badge that remains is the preview toggle in its
    // "off" state ("Είσοδος Demo"), not the active-demo exit badge ("DEMO").
    expect(screen.getByText('Είσοδος Demo')).toBeInTheDocument()
    expect(ctx.tenantApi.isDemo).toBe(false)
  })
})
