// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { PlatformUsersRegistry, platformUserState } from '../src/features/platform/PlatformUsersRegistry'
import { demoInvitationState } from '../src/features/platform/PlatformDemosRegistry'
import { invitationState } from '../src/core/tenant/tenantService'
import { LanguageProvider } from '../src/core/i18n/LanguageContext'

afterEach(() => cleanup())

const hospital = { id: 'org-1', name: 'Γ.Ν. Λάρισας', code: 'LAR', is_demo: false }
const demoOrg = { id: 'org-2', name: 'ΤΕΣΤ ΒΕΡΓΑΣ', code: 'DEMO-1', is_demo: true }
const users = [
  { id: 'm1', userId: 'u1', name: 'Μαρία Π.', email: 'maria@lar.gr', username: 'maria', role: 'infection_control_lead', status: 'active', invitation: 'accepted', organization: hospital, kind: 'hospital', createdAt: '2026-09-01T10:00:00Z' },
  { id: 'm2', userId: 'u2', name: 'Δημήτρης Β.', email: 'dvergas@icloud.com', username: 'dvergas', role: 'hospital_admin', status: 'invited', invitation: 'pending', organization: demoOrg, demoId: 'demo-1', kind: 'demo', createdAt: '2026-10-11T10:00:00Z' },
  { id: 'p1', userId: 'o1', name: 'Platform Owner', email: 'owner@x.gr', username: 'owner', role: 'platform_owner', status: 'active', invitation: null, organization: null, kind: 'platform', createdAt: '2026-01-01T10:00:00Z' },
]

describe('Platform users', () => {
  it('lists everyone with role, organization and account state, and filters them', () => {
    const onOpenUser = vi.fn()
    render(<LanguageProvider><PlatformUsersRegistry language="el" users={users} onOpenUser={onOpenUser} /></LanguageProvider>)
    expect(screen.getAllByRole('row')).toHaveLength(4)
    const demoRow = screen.getByText('Δημήτρης Β.').closest('tr')
    expect(within(demoRow).getByText('ΤΕΣΤ ΒΕΡΓΑΣ')).toBeInTheDocument()
    expect(within(demoRow).getByText('Πρόσκληση σε αναμονή')).toBeInTheDocument()
    fireEvent.click(demoRow)
    expect(onOpenUser).toHaveBeenCalledWith(users[1])
    fireEvent.click(screen.getByRole('button', { name: /^Νοσοκομεία/ }))
    expect(screen.getAllByRole('row')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: /^Πρόσκληση σε αναμονή/ }))
    expect(screen.getByText('Δημήτρης Β.')).toBeInTheDocument()
    expect(screen.queryByText('Μαρία Π.')).toBeNull()
  })
  it('tells an expired invitation from a pending one', () => {
    expect(platformUserState({ status: 'invited', invitation: 'expired' })).toBe('expired')
    expect(platformUserState({ status: 'invited', invitation: 'pending' })).toBe('pending')
    expect(invitationState({ accepted_at: null, revoked_at: null, expires_at: '2000-01-01' })).toBe('expired')
    expect(invitationState({ accepted_at: '2026-10-01' })).toBe('accepted')
  })
  it('gives each Demo the state of its first invitation', () => {
    const demo = { organization_id: 'org-2', contact_email: 'DVERGAS@icloud.com' }
    expect(demoInvitationState(demo, users)).toBe('pending')
    expect(demoInvitationState(demo, [{ ...users[1], status: 'active' }])).toBe('accepted')
    expect(demoInvitationState({ organization_id: 'org-9' }, users)).toBe('none')
  })
})
