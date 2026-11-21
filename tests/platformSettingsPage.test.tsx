// @vitest-environment jsdom
// Ρυθμίσεις › Ρυθμίσεις πλατφόρμας: μία σελίδα με τρεις καρτέλες (Οργανισμοί, Demo, Σελίδα παρουσίασης) στη θέση
// των γραναζιών των μητρώων Οργανισμοί και Demo.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'
import { readSource } from './helpers/readSource'

const notify = vi.hoisted(() => vi.fn())
const service = vi.hoisted(() => ({ getPlatformSettings: vi.fn(), updatePlatformSettings: vi.fn() }))
vi.mock('../src/features/platform/platformSettingsService', async importOriginal => ({ ...(await importOriginal<object>()), ...service }))
vi.mock('../src/core/feedback/FeedbackContext', async importOriginal => ({ ...(await importOriginal<object>()), useFeedback: () => ({ notify, notifyError: vi.fn() }) }))
const { PlatformSettingsPage } = await import('../src/features/platform/PlatformSettingsPage')
const { LanguageProvider } = await import('../src/core/i18n/LanguageContext')

const SETTINGS = { id: 'global', supportEmail: 'support@example.org', defaultDemoDurationDays: 30, demoAutoPurgeAfterDays: 14, organizationDeletionGraceDays: 30, maxDemoUsers: 5, maintenanceNoticeEnabled: false, maintenanceNoticeEl: '', maintenanceNoticeEn: '', publicName: 'Exeltos', publicEmail: 'info@exeltos.com', publicPhone: '694 247 1022', publicWebsite: 'https://exeltos.com/', updatedAt: null }
afterEach(() => { cleanup(); vi.clearAllMocks() })
// A field's label holds its name first, then the hint under it.
const field = (name: string) => new RegExp(`^${name}`)
const renderPage = (entry = '/platform/settings') => render(<MemoryRouter initialEntries={[entry]}><LanguageProvider><PlatformSettingsPage/></LanguageProvider></MemoryRouter>)

describe('PlatformSettingsPage', () => {
  it('shows the three tabs and saves only the fields of the open tab', async () => {
    service.getPlatformSettings.mockResolvedValue(SETTINGS)
    service.updatePlatformSettings.mockImplementation(async values => ({ ...SETTINGS, ...values, maxDemoUsers: Number(values.maxDemoUsers) }))
    renderPage()
    expect(screen.getByRole('heading', { name: 'Ρυθμίσεις πλατφόρμας' })).toBeInTheDocument()
    for (const tab of ['Οργανισμοί', 'Demo', 'Σελίδα παρουσίασης']) expect(screen.getByRole('tab', { name: tab })).toBeInTheDocument()
    expect(await screen.findByLabelText(field('Περίοδος χάριτος διαγραφής'))).toHaveValue(30)
    expect(screen.getByLabelText(field('Email υποστήριξης'))).toHaveValue('support@example.org')
    // Nothing changed: «Αποθήκευση» stays off.
    expect(screen.getByRole('button', { name: 'Αποθήκευση' })).toBeDisabled()

    fireEvent.click(screen.getByRole('tab', { name: 'Demo' }))
    expect(screen.getByLabelText(field('Διάρκεια νέου Demo'))).toHaveValue(30)
    fireEvent.change(screen.getByLabelText(field('Χρήστες ανά Demo')), { target: { value: '40' } })
    expect(screen.getByText('Επιτρέπονται 1–20.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Αποθήκευση' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText(field('Χρήστες ανά Demo')), { target: { value: '8' } })
    fireEvent.click(screen.getByRole('button', { name: 'Αποθήκευση' }))
    await waitFor(() => expect(service.updatePlatformSettings).toHaveBeenCalledWith(expect.objectContaining({ maxDemoUsers: '8', supportEmail: 'support@example.org', publicName: 'Exeltos' })))
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Οι ρυθμίσεις αποθηκεύτηκαν.', 'success', expect.anything()))

    fireEvent.click(screen.getByRole('tab', { name: 'Σελίδα παρουσίασης' }))
    for (const label of ['Εταιρεία', 'Email επικοινωνίας', 'Τηλέφωνο', 'Ιστοσελίδα']) expect(screen.getByLabelText(field(label))).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(field('Email επικοινωνίας')), { target: { value: 'not-an-email' } })
    expect(screen.getByText('Μη έγκυρο email.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Αποθήκευση' })).toBeDisabled()
  })

  it('opens a tab from the address', async () => {
    service.getPlatformSettings.mockResolvedValue(SETTINGS)
    renderPage('/platform/settings?tab=presentation')
    expect(await screen.findByLabelText(field('Εταιρεία'))).toHaveValue('Exeltos')
    expect(screen.getByRole('tab', { name: 'Σελίδα παρουσίασης' })).toHaveAttribute('aria-selected', 'true')
  })

  it('sits in the owner menu under Settings, behind the platform capability, and the registries have no gear', () => {
    const shell = readSource('src/app/AppShell.tsx')
    expect(shell).toContain("{key:'platformNav.settings',label:'platformNav.settings',path:'/platform/settings',hash:'',icon:Settings,group:'settings'}")
    expect(shell.indexOf("key:'platformNav.settings'")).toBeGreaterThan(shell.indexOf("key:'platformNav.libraries'"))
    expect(readSource('src/core/i18n/stringsEl.ts')).toContain("settings:'Ρυθμίσεις πλατφόρμας'")
    expect(readSource('src/core/i18n/stringsEn.ts')).toContain("settings:'Platform settings'")
    const app = readSource('src/app/App.tsx')
    expect(app).toContain('<Route path="platform/settings" element={gate(CAPABILITIES.VIEW_PLATFORM,<PlatformSettingsPage/>)}/>')
    expect(app).toContain("import('../features/platform/PlatformSettingsPage'), 'PlatformSettingsPage'")
    for (const file of ['src/features/platform/PlatformOrganizationsRegistry.tsx', 'src/features/platform/PlatformDemosRegistry.tsx', 'src/features/workspaces/PlatformCenterPage.tsx']) {
      const source = readSource(file)
      expect(source).not.toMatch(/onSettings|settingsKind|PlatformSettingsDialog|<Settings /)
    }
    // The Demo defaults still load from the platform settings when the Platform Center opens.
    expect(readSource('src/features/workspaces/PlatformCenterPage.tsx')).toContain('const settings=await getPlatformSettings();if(!active)return;applyDemoSettings(settings)')
  })
})
