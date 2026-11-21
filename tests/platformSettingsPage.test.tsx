// @vitest-environment jsdom
// Ρυθμίσεις › Ρυθμίσεις πλατφόρμας: μία σελίδα σε όλο το πλάτος με τρεις ομάδες (Οργανισμοί, Demo, Σελίδα παρουσίασης) στη θέση
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
  it('shows the three groups on one screen and saves only the fields of its own group', async () => {
    service.getPlatformSettings.mockResolvedValue(SETTINGS)
    service.updatePlatformSettings.mockImplementation(async values => ({ ...SETTINGS, ...values, maxDemoUsers: Number(values.maxDemoUsers) }))
    const { container } = renderPage()
    expect(screen.getByRole('heading', { name: 'Ρυθμίσεις πλατφόρμας' })).toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(await screen.findByLabelText(field('Περίοδος χάριτος διαγραφής'))).toHaveValue(30)
    expect(screen.getByLabelText(field('Email υποστήριξης'))).toHaveValue('support@example.org')
    expect(screen.getByLabelText(field('Διάρκεια νέου Demo'))).toHaveValue(30)
    for (const label of ['Εταιρεία', 'Email επικοινωνίας', 'Τηλέφωνο', 'Ιστοσελίδα']) expect(screen.getByLabelText(field(label))).toBeInTheDocument()
    const saves = () => screen.getAllByRole('button', { name: 'Αποθήκευση' })
    // Nothing changed: every «Αποθήκευση» stays off.
    expect(saves()).toHaveLength(3)
    for (const button of saves()) expect(button).toBeDisabled()

    fireEvent.change(screen.getByLabelText(field('Χρήστες ανά Demo')), { target: { value: '40' } })
    expect(screen.getByText('Επιτρέπονται 1–20.')).toBeInTheDocument()
    const demoSave = container.querySelectorAll('.platform-settings-form')[1].querySelector('button') as HTMLButtonElement
    expect(demoSave).toBeDisabled()
    fireEvent.change(screen.getByLabelText(field('Χρήστες ανά Demo')), { target: { value: '8' } })
    expect(saves()[0]).toBeDisabled()
    fireEvent.click(demoSave)
    await waitFor(() => expect(service.updatePlatformSettings).toHaveBeenCalledWith(expect.objectContaining({ maxDemoUsers: '8', supportEmail: 'support@example.org', publicName: 'Exeltos' })))
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Οι ρυθμίσεις αποθηκεύτηκαν.', 'success', expect.anything()))

    fireEvent.change(screen.getByLabelText(field('Email επικοινωνίας')), { target: { value: 'not-an-email' } })
    expect(screen.getByText('Μη έγκυρο email.')).toBeInTheDocument()
    expect(saves()[2]).toBeDisabled()
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
