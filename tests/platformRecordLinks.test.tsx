// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { athensDateTime, buildUserIndex, findIndexedUser, organizationRecordTarget, userRecordPath, userRecordTarget } from '../src/features/platform/platformOverviewShared'
import { PlatformLoginSessionsView } from '../src/features/platform/PlatformLoginSessionsView'
import { PlatformLiveSessionsCard } from '../src/features/platform/PlatformLiveSessionsCard'
import { PlatformOrganizationsRegistry } from '../src/features/platform/PlatformOrganizationsRegistry'
import { FeedbackProvider } from '../src/core/feedback/FeedbackContext'
import { LanguageProvider } from '../src/core/i18n/LanguageContext'

const hospital = { id: 'org-1', name: 'Γ.Ν. Λάρισας', code: 'LAR', is_demo: false }
const demoOrg = { id: 'org-2', name: 'ΤΕΣΤ ΒΕΡΓΑΣ', code: 'DEMO-1', is_demo: true }
const users = [
  { id: 'm1', userId: 'u1', name: 'Μαρία Π.', email: 'Maria@lar.gr', username: 'maria', role: 'infection_control_lead', status: 'active', organization: hospital, kind: 'hospital' },
  { id: 'm2', userId: 'u2', name: 'Δημήτρης Β.', email: 'dvergas@icloud.com', username: 'dvergas', role: 'hospital_admin', status: 'active', organization: demoOrg, demoId: 'demo-1', kind: 'demo' },
  { id: 'p1', userId: 'o1', name: 'Platform Owner', email: 'owner@x.gr', username: 'owner', role: 'platform_owner', status: 'active', organization: null, kind: 'platform' },
]
const now = Date.now()
const minutesAgo = value => new Date(now - value * 60000).toISOString()
const sessions = [
  { sessionId: 's1', userId: 'o1', fullName: 'Platform Owner', username: 'owner', email: '', isPlatformOwner: true, organizations: '', ip: '1.1.1.1', lastIp: '1.1.1.1', userAgent: 'Mozilla/5.0 (Macintosh) Chrome/120', startedAt: minutesAgo(30), lastSeenAt: minutesAgo(1), endedAt: null, endedReason: '', active: true, online: true },
  { sessionId: 's2', userId: 'u1', fullName: 'Μαρία Π.', username: 'maria', email: 'maria@lar.gr', isPlatformOwner: false, organizations: 'Γ.Ν. Λάρισας', ip: '2.2.2.2', lastIp: '2.2.2.2', userAgent: 'Mozilla/5.0 (Windows) Chrome/120', startedAt: minutesAgo(60), lastSeenAt: minutesAgo(2), endedAt: null, endedReason: '', active: true, online: true },
  { sessionId: 's3', userId: 'u2', fullName: 'Δημήτρης Β.', username: 'dvergas', email: 'dvergas@icloud.com', isPlatformOwner: false, organizations: 'ΤΕΣΤ ΒΕΡΓΑΣ', ip: '3.3.3.3', lastIp: '3.3.3.3', userAgent: 'Mozilla/5.0 (Windows) Chrome/120', startedAt: minutesAgo(90), lastSeenAt: minutesAgo(80), endedAt: minutesAgo(80), endedReason: 'signed_out', active: false, online: false },
]
const attempts = [
  { id: 1, identifier: 'MARIA', ip: '2.2.2.2', userAgent: '', success: true, reason: 'ok', createdAt: minutesAgo(5) },
  { id: 2, identifier: 'admin', ip: '9.9.9.9', userAgent: '', success: false, reason: 'unknown_user', createdAt: minutesAgo(4) },
]

vi.mock('../src/features/platform/platformAuditService', () => ({
  listLoginSessions: vi.fn(async () => sessions),
  listLoginAttempts: vi.fn(async () => ({ attempts, locks: [] })),
  releaseLoginLock: vi.fn(),
  endLoginSessions: vi.fn(),
  listPlatformAuditEvents: vi.fn(async () => []),
}))
vi.mock('../src/core/tenant/tenantService', async importOriginal => ({ ...(await importOriginal()), listPlatformUsers: vi.fn(async () => users) }))
vi.mock('../src/core/auth/AuthContext', () => ({ useAuth: () => ({ profile: { isPlatformOwner: true }, user: { id: 'o1' } }) }))
vi.mock('../src/core/tenant/TenantContext', () => ({ useTenant: () => ({ memberships: [{ id: 'mm1', organization: hospital }] }) }))

afterEach(() => cleanup())

function Probe() {
  const location = useLocation()
  return <output data-testid="where">{`${location.pathname}${location.search}${location.hash}`}|{JSON.stringify(location.state)}</output>
}
const renderAt = (element, path = '/platform/audit?view=sessions') => render(
  <LanguageProvider><FeedbackProvider><MemoryRouter initialEntries={[path]}><Routes><Route path="*" element={<>{element}<Probe /></>} /></Routes></MemoryRouter></FeedbackProvider></LanguageProvider>,
)
const where = () => screen.getByTestId('where').textContent

describe('record paths and targets', () => {
  it('builds the user record path used by the platform users list', () => {
    expect(userRecordPath({ organizationId: 'org-1', userId: 'u1' })).toBe('/platform#organizations?organization=org-1&tab=users&user=u1')
    expect(userRecordPath({ organizationId: '', userId: 'u1' })).toBe('')
  })
  it('opens a hospital user under the organization, a Demo user in the Demo record, the Owner nowhere', () => {
    const known = new Set(['org-1'])
    const target = userRecordTarget(users[0], { returnTo: '/platform/audit?view=sessions', organizationIds: known })
    expect(target.to).toBe('/platform#organizations?organization=org-1&tab=users&user=u1')
    expect(target.state).toMatchObject({ returnTo: '/platform/audit?view=sessions', userReturnTo: '/platform/audit?view=sessions' })
    expect(userRecordTarget(users[1], { organizationIds: known }).to).toBe('/platform#demo?demo=demo-1')
    expect(userRecordTarget(users[2], { organizationIds: known })).toBeNull()
    expect(userRecordTarget({ userId: 'u9', organization: null, kind: 'none' })).toBeNull()
  })
  it('opens only organizations the owner can reach', () => {
    expect(organizationRecordTarget('org-1', { returnTo: '/platform', organizationIds: new Set(['org-1']) }).to).toBe('/platform#organizations?organization=org-1&tab=details')
    expect(organizationRecordTarget('org-2', { organizationIds: new Set(['org-1']) })).toBeNull()
    expect(organizationRecordTarget('', {})).toBeNull()
  })
  it('finds a user by id, membership or username / e-mail (any case) and never the Owner', () => {
    const index = buildUserIndex(users)
    expect(findIndexedUser(index, { userId: 'u1' }).name).toBe('Μαρία Π.')
    expect(findIndexedUser(index, { memberId: 'm2' }).name).toBe('Δημήτρης Β.')
    expect(findIndexedUser(index, { identifier: 'MARIA@lar.gr' }).userId).toBe('u1')
    expect(findIndexedUser(index, { userId: 'o1' })).toBeNull()
    expect(findIndexedUser(index, { identifier: 'owner' })).toBeNull()
    expect(findIndexedUser(index, { identifier: 'admin' })).toBeNull()
  })
  it('writes dates as dd/mm/yyyy, hh:mm in Athens time, winter and summer', () => {
    expect(athensDateTime('2026-11-10T10:05:00Z')).toBe('10/11/2026, 12:05')
    expect(athensDateTime('2026-07-01T21:30:00Z')).toBe('02/07/2026, 00:30')
    expect(athensDateTime('')).toBe('—')
  })
})

describe('sign-ins open the user record', () => {
  it('a session row name opens that user, Back returns to the sign-ins; the Owner is plain text', async () => {
    renderAt(<PlatformLoginSessionsView language="el" />)
    const link = await screen.findByRole('button', { name: 'Μαρία Π.' })
    expect(screen.queryByRole('button', { name: 'Platform Owner' })).toBeNull()
    expect(screen.getByText('Platform Owner')).toBeInTheDocument()
    fireEvent.click(link)
    await waitFor(() => expect(where()).toContain('/platform#organizations?organization=org-1&tab=users&user=u1'))
    expect(where()).toContain('"userReturnTo":"/platform/audit?view=sessions"')
  })
  it('a Demo user opens the Demo record', async () => {
    renderAt(<PlatformLoginSessionsView language="el" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Δημήτρης Β.' }))
    await waitFor(() => expect(where()).toContain('/platform#demo?demo=demo-1'))
  })
  it('an attempt opens the user whose username matches, an unknown name stays text', async () => {
    renderAt(<PlatformLoginSessionsView language="el" />, '/platform/audit?view=sessions&mode=attempts')
    const link = await screen.findByRole('button', { name: 'MARIA' })
    expect(screen.queryByRole('button', { name: 'admin' })).toBeNull()
    fireEvent.click(link)
    await waitFor(() => expect(where()).toContain('user=u1'))
    expect(where()).toContain('"userReturnTo":"/platform/audit?view=sessions&mode=attempts"')
  })
})

describe('Overview and Organizations', () => {
  it('«Συνδεδεμένοι τώρα»: each person opens the record, Back returns to the Overview; the Owner is plain text', async () => {
    const tx = el => el
    renderAt(<PlatformLiveSessionsCard tx={tx} onNavigate={() => {}} users={users} />, '/platform')
    const link = await screen.findByRole('button', { name: 'Μαρία Π.' })
    expect(screen.queryByRole('button', { name: 'Platform Owner' })).toBeNull()
    fireEvent.click(link)
    await waitFor(() => expect(where()).toContain('/platform#organizations?organization=org-1&tab=users&user=u1'))
    expect(where()).toContain('"userReturnTo":"/platform"')
  })
  it('an organization row opens that organization', () => {
    const onOpenOrganization = vi.fn()
    renderAt(<PlatformOrganizationsRegistry tx={el => el} query="" onQueryChange={() => {}} organizations={[hospital]} members={[]} onCreate={() => {}} onOpenOrganization={onOpenOrganization} />, '/platform#organizations')
    fireEvent.click(screen.getByText('Γ.Ν. Λάρισας').closest('tr'))
    expect(onOpenOrganization).toHaveBeenCalledWith(hospital)
  })
})
