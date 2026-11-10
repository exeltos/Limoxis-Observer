// @vitest-environment jsdom
import { Profiler } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'
import { PlatformOrganizationRecord } from '../src/features/platform/PlatformOrganizationRecord'
import { FeedbackProvider } from '../src/core/feedback/FeedbackContext'
import { LanguageProvider } from '../src/core/i18n/LanguageContext'

// A real hospital: 474 employees (one linked to the account), 1 member, 10 sign-ins, 1000 audit events.
const employees = Array.from({ length: 474 }, (_, i) => ({ dbId: `e${i}`, id: `EMP-${i}`, firstName: `Όνομα${i}`, lastName: `Επώνυμο${i}`, department: `Τμήμα ${i % 12}`, userId: i === 0 ? 'u1' : '' }))
const member = { id: 'm1', userId: 'u1', name: 'Φιλοκώστας Αριστείδης', email: 'a@iaso.gr', username: 'afilokostas', role: 'hospital_admin', status: 'active', invitationStatus: 'accepted', phone: '', jobTitle: '' }
const sessions = Array.from({ length: 10 }, (_, i) => ({ sessionId: `s${i}`, userId: 'u1', fullName: member.name, username: 'afilokostas', startedAt: new Date(Date.now() - i * 3600000).toISOString(), lastSeenAt: new Date().toISOString(), endedAt: null, active: i === 0, online: i === 0, userAgent: '', ip: '1.1.1.1', lastIp: '1.1.1.1' }))
const events = Array.from({ length: 1000 }, (_, i) => ({ id: `a${i}`, organizationId: 'org-1', actorId: 'u1', actorName: member.name, actorRole: 'hospital_admin', eventType: 'update', entityType: 'employees', entityId: `e${i % 474}`, metadata: {}, createdAt: new Date(Date.now() - i * 60000).toISOString() }))

vi.mock('../src/core/tenant/tenantService', async importOriginal => ({ ...(await importOriginal()), listOrganizationMembersDetailed: vi.fn(async () => [member]) }))
vi.mock('../src/features/employees/employeeService', () => ({ loadEmployeesAsync: vi.fn(async () => employees) }))
vi.mock('../src/features/platform/bulkAccountsService', () => ({ loadEmployeeAccounts: vi.fn(async () => ({ employees: employees.map(e => ({ employeeId: e.dbId, name: `${e.lastName} ${e.firstName}`, accountState: e.userId ? 'active' : 'none' })), departments: [] })) }))
vi.mock('../src/features/platform/platformAuditService', () => ({
  listLoginSessions: vi.fn(async () => sessions),
  listLoginAttempts: vi.fn(async () => ({ attempts: [], locks: [] })),
  releaseLoginLock: vi.fn(),
  endLoginSessions: vi.fn(),
  listPlatformAuditEvents: vi.fn(async () => events),
}))
vi.mock('../src/features/quality/resources/supplierRenewalService', () => ({ loadSupplierRenewalSender: vi.fn(async () => false), setSupplierRenewalSender: vi.fn() }))
vi.mock('../src/core/auth/AuthContext', () => ({ useAuth: () => ({ profile: { isPlatformOwner: true }, user: { id: 'o1' } }) }))

afterEach(() => cleanup())

describe('organization record with a real hospital', () => {
  it('opens a user record with 474 employees without a render storm', async () => {
    let commits = 0
    const organization = { id: 'org-1', name: 'ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ', code: 'IASO', status: 'active', is_demo: false }
    const started = performance.now()
    render(<LanguageProvider><FeedbackProvider><MemoryRouter>
      <Profiler id="record" onRender={() => { commits += 1 }}>
        <PlatformOrganizationRecord organization={organization} language="el" initialTab="users" initialUserId="u1" onUserChange={() => {}} onBack={() => {}} />
      </Profiler>
    </MemoryRouter></FeedbackProvider></LanguageProvider>)
    await waitFor(() => expect(screen.getAllByText('Φιλοκώστας Αριστείδης').length).toBeGreaterThan(0))
    await new Promise(resolve => setTimeout(resolve, 1000))
    const elapsed = performance.now() - started
    console.log('commits', commits, 'ms', Math.round(elapsed))
    // The employee picker is a searchable list: the 474 employees are not 474 <option> elements.
    expect(document.querySelectorAll('option').length).toBeLessThan(60)
    expect(commits).toBeLessThan(40)
    expect(elapsed).toBeLessThan(4000)
  })
})
