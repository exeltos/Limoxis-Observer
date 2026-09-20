// @vitest-environment jsdom
// User request: pressing "Είσοδος Demo" on the Platform Center overview
// should NOT navigate away — it should stay on that same screen showing a
// demo preview (Demo Hospital card, demo stats), and only actually enter
// the demo hospital's full dashboard when that card is clicked. Once in
// demo mode anywhere in the app, a permanent DEMO badge should appear in
// the topbar (not the old sidebar-footer pill), letting the owner exit
// demo from any screen.
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

describe('Platform Center demo preview (PlatformDashboardView)', () => {
  it('shows "Enter Demo" and no preview card by default', () => {
    render(<PlatformDashboardView {...baseProps} demoPreview={false} onEnterDemoPreview={() => {}} onExitDemoPreview={() => {}} onEnterDemoOrganization={() => {}}/>)
    expect(screen.getByText('Είσοδος Demo')).toBeInTheDocument()
    expect(screen.queryByText('Demo Hospital')).not.toBeInTheDocument()
  })

  it('clicking "Enter Demo" only triggers the preview callback, not navigation into the org', () => {
    const onEnterDemoPreview = vi.fn()
    const onEnterDemoOrganization = vi.fn()
    render(<PlatformDashboardView {...baseProps} demoPreview={false} onEnterDemoPreview={onEnterDemoPreview} onExitDemoPreview={() => {}} onEnterDemoOrganization={onEnterDemoOrganization}/>)
    fireEvent.click(screen.getByText('Είσοδος Demo'))
    expect(onEnterDemoPreview).toHaveBeenCalledTimes(1)
    expect(onEnterDemoOrganization).not.toHaveBeenCalled()
  })

  it('while previewing, shows the Demo Hospital card and an "Exit Demo" button, and clicking the card enters the demo organization', () => {
    const onEnterDemoOrganization = vi.fn()
    const onExitDemoPreview = vi.fn()
    render(<PlatformDashboardView {...baseProps} demoPreview onEnterDemoPreview={() => {}} onExitDemoPreview={onExitDemoPreview} onEnterDemoOrganization={onEnterDemoOrganization}/>)
    expect(screen.getByText('Έξοδος από Demo')).toBeInTheDocument()
    const card = screen.getByText('Demo Hospital').closest('button')
    fireEvent.click(card)
    expect(onEnterDemoOrganization).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('Έξοδος από Demo'))
    expect(onExitDemoPreview).toHaveBeenCalledTimes(1)
  })
})

describe('AppShell topbar DEMO badge', () => {
  it('shows a clickable DEMO badge in the topbar once the Platform Owner enters the demo organization, and clicking it returns to /platform', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
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
    // Before entering demo: no DEMO badge, sidebar-less Platform Center shell.
    expect(screen.queryByText('DEMO')).not.toBeInTheDocument()

    // Mirrors onEnterDemoOrganization: enterPlatformDemo() then navigate('/').
    act(() => { tenantApi.enterPlatformDemo(); navigateFn('/') })

    await waitFor(() => expect(screen.getByText('dashboard-stub')).toBeInTheDocument())
    const badge = await waitFor(() => {
      const found = document.querySelector('.topbar-demo-badge')
      expect(found).toBeTruthy()
      return found
    })
    expect(badge).toHaveTextContent('DEMO')

    fireEvent.click(badge)
    await waitFor(() => expect(screen.getByText('platform-center-stub')).toBeInTheDocument())
    expect(document.querySelector('.topbar-demo-badge')).not.toBeInTheDocument()
  })
})
