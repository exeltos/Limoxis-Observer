// @vitest-environment jsdom
// User request: check that every left-sidebar button works when the
// Platform Owner uses "Είσοδος Demo" (enterPlatformDemo()) — that flow
// sets isDemo=true and tenant=demo-hospital but KEEPS role=PLATFORM_OWNER
// (not ROLES.DEMO), which is a different combination than a normal demo
// account login. tests/platformOwnerDemoSurveillanceCrash.test.jsx already
// caught a real crash there (surveillanceDemoData used `state` instead of
// `status`). This sweeps every other page reachable from the Platform
// Owner's sidebar the same way, so a similar mismatch elsewhere doesn't
// slip through.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { cleanup, render, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'

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

const pages = [
  ['Dashboard', () => import('../src/features/dashboard/DashboardPage').then(m => m.DashboardPage)],
  ['Patients', () => import('../src/features/patients/PatientsPage').then(m => m.PatientsPage)],
  ['Laboratory', () => import('../src/features/laboratory/LaboratoryPage').then(m => m.LaboratoryPage)],
  ['Prevention', () => import('../src/features/prevention/PreventionPage').then(m => m.PreventionPage)],
  ['Controls', () => import('../src/features/controls/ControlsPage').then(m => m.ControlsPage)],
  ['Quality', () => import('../src/features/quality/QualityPage').then(m => m.QualityPage)],
  ['Employees', () => import('../src/features/employees/EmployeesPage').then(m => m.EmployeesPage)],
  ['Analysis', () => import('../src/features/analysis/AnalysisPage').then(m => m.AnalysisPage)],
  ['Indicators', () => import('../src/features/indicators/IndicatorsPage').then(m => m.IndicatorsPage)],
  ['Training', () => import('../src/features/training/TrainingPageRoute').then(m => m.TrainingPageRoute)],
  ['Committees', () => import('../src/features/committees/CommitteesPage').then(m => m.CommitteesPage)],
  ['Documents', () => import('../src/features/documents/DocumentsPage').then(m => m.DocumentsPage)],
  ['Management', () => import('../src/features/management/ManagementPage').then(m => m.ManagementPage)],
]

describe.each(pages)('Platform Owner "Enter Demo" mode: %s page', (name, loadPage) => {
  it(`renders ${name} without throwing`, async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { LanguageProvider } = await import('../src/core/i18n/LanguageContext')
    const { FeedbackProvider } = await import('../src/core/feedback/FeedbackContext')
    const { TenantProvider, useTenant } = await import('../src/core/tenant/TenantContext')
    const { NotificationProvider } = await import('../src/core/notifications/NotificationContext')
    const Page = await loadPage()

    let tenantApi
    function Capture() { tenantApi = useTenant(); return null }

    render(
      <MemoryRouter>
        <LanguageProvider>
          <FeedbackProvider>
            <TenantProvider>
              <Capture/>
              <NotificationProvider>
                <Page/>
              </NotificationProvider>
            </TenantProvider>
          </FeedbackProvider>
        </LanguageProvider>
      </MemoryRouter>,
    )

    await waitFor(() => expect(tenantApi?.enterPlatformDemo).toBeTypeOf('function'))

    expect(() => act(() => { tenantApi.enterPlatformDemo() })).not.toThrow()

    await waitFor(() => {
      expect(tenantApi.isDemo).toBe(true)
      expect(tenantApi.tenant?.id).toBe('demo-hospital')
    })
    await waitFor(() => expect(document.body.textContent.trim().length).toBeGreaterThan(0))
  })
})
