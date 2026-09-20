// @vitest-environment jsdom
// User-reported: clicking "Είσοδος Demo" (Enter Demo) from the Platform
// Center page, then opening Surveillance from the sidebar, breaks. That
// button calls TenantContext's enterPlatformDemo(), which sets
// platformDemoMode=true and keeps the Platform Owner's actual role
// (ROLES.PLATFORM_OWNER), not ROLES.DEMO — the tenant becomes the demo
// hospital and isDemo becomes true, but the role is different from a
// normal demo-account login. This test renders SurveillanceCanonicalPage
// in that exact state to catch any crash that only manifests for
// PLATFORM_OWNER + isDemo, which a normal demo-account render wouldn't.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'
import { ROLES } from '../src/core/permissions/roles'

vi.mock('../src/core/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'owner-1' },
    profile: { id: 'owner-1', isPlatformOwner: true, fullName: 'Platform Owner', isDemo: false },
    isAuthenticated: true,
    isDemoSession: false,
    loading: false,
  }),
}))

afterEach(() => cleanup())

describe('Platform Owner "Enter Demo" mode does not crash Surveillance', () => {
  it('renders the Surveillance workspace instead of throwing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { LanguageProvider } = await import('../src/core/i18n/LanguageContext')
    const { FeedbackProvider } = await import('../src/core/feedback/FeedbackContext')
    const { TenantProvider, useTenant } = await import('../src/core/tenant/TenantContext')
    const { SurveillanceCanonicalPage } = await import('../src/features/surveillance/SurveillanceCanonicalPage')

    let tenantApi
    function Capture() { tenantApi = useTenant(); return null }

    render(
      <MemoryRouter>
        <LanguageProvider>
          <FeedbackProvider>
            <TenantProvider>
              <Capture/>
              <SurveillanceCanonicalPage/>
            </TenantProvider>
          </FeedbackProvider>
        </LanguageProvider>
      </MemoryRouter>,
    )

    await waitFor(() => expect(tenantApi?.enterPlatformDemo).toBeTypeOf('function'))
    act(() => { tenantApi.enterPlatformDemo() })

    await waitFor(() => {
      expect(tenantApi.isDemo).toBe(true)
      expect(tenantApi.role).toBe(ROLES.PLATFORM_OWNER)
      expect(tenantApi.tenant?.id).toBe('demo-hospital')
    })

    // The crash (if any) happens during/after this re-render with the new
    // demo tenant context, so assert the page actually painted content
    // instead of throwing (which React Testing Library would surface as
    // an uncaught error) or silently rendering nothing.
    await waitFor(() => expect(document.body.textContent.trim().length).toBeGreaterThan(0))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
