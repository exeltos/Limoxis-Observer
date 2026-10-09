// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'

const read = path => fs.readFileSync(path, 'utf8')
const migration = read('supabase/migrations/20261009120000_safe_organization_deletion.sql')
const edge = read('supabase/functions/platform-delete-organizations/index.ts')
const tenantService = read('src/core/tenant/tenantService.js')

const impactRows = [
  { organizationId: 'org-a', name: 'Demo · ΠΑΓΝΗ', code: 'DEMO-HER', isDemo: true, status: 'active', records: 1284, systemRecords: 74, files: 12, bytes: 8400000, members: 4, accountsDeleted: 4, accountsKept: 0, blockers: [] },
  { organizationId: 'org-b', name: 'Demo · Κέρκυρα', code: 'DEMO-CFU', isDemo: true, status: 'active', records: 0, systemRecords: 74, files: 0, bytes: 0, members: 1, accountsDeleted: 0, accountsKept: 1, blockers: [] },
]
const getImpact = vi.fn(async () => impactRows)
const deleteOrganizations = vi.fn(async ({ organizationIds }) => ({ ok: true, deleted: organizationIds.length, results: organizationIds.map(id => ({ organizationId: id, ok: true })) }))
vi.mock('../src/core/tenant/tenantService', () => ({
  getOrganizationDeletionImpact: (...args) => getImpact(...args),
  deletePlatformOrganizations: (...args) => deleteOrganizations(...args),
}))
const notify = vi.fn()
vi.mock('../src/core/feedback/FeedbackContext', () => ({ useFeedback: () => ({ notify, notifyError: vi.fn() }), useOptionalFeedback: () => null }))
vi.mock('../src/core/i18n/LanguageContext', () => ({ useLanguage: () => ({ language: 'el' }) }))

const { OrganizationDeleteDialog, deletionPhrase, deletionPhraseMatches } = await import('../src/features/platform/OrganizationDeleteDialog')
const { demoState } = await import('../src/features/platform/PlatformDemosRegistry')

const day = offset => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10) }

describe('organization deletion: database', () => {
  it('lets the purge run only with a single-use ticket issued after the password re-check', () => {
    expect(migration).toContain('create table if not exists public.platform_purge_tickets')
    expect(migration).toContain("raise exception 'Deletion ticket invalid or expired'")
    expect(migration).toContain('drop function if exists public.platform_purge_organization_tx(uuid, text);')
    expect(migration).toMatch(/revoke all on table public\.platform_purge_tickets from anon, authenticated/)
  })
  it('closes the direct DELETE paths on organizations', () => {
    expect(migration).toContain('drop policy if exists organizations_platform_owner_delete on public.organizations;')
    expect(migration).toContain('revoke delete on table public.organizations from anon, authenticated;')
    expect(tenantService).not.toMatch(/from\('organizations'\)\.delete\(\)/)
  })
  it('requires a real organization to be suspended and deletes table by table past RESTRICT keys and the AST guard', () => {
    expect(migration).toContain("if not v_org.is_demo and v_org.status <> 'suspended' then")
    expect(migration).toContain("perform set_config('limoxis.test_reset', 'on', true);")
    expect(migration).toMatch(/for v_pass in 1\.\.25 loop/)
    expect(migration).toContain("'storageObjects', v_objects")
  })
})

describe('organization deletion: Edge Function', () => {
  it('re-checks the password, rate-limits failures and removes storage and orphan accounts', () => {
    expect(edge).toContain('signInWithPassword')
    expect(edge).toContain("from('platform_reauth_failures')")
    // The ticketed purge, storage and account cleanup live in one shared module.
    const shared = fs.readFileSync('supabase/functions/_shared/organizationPurge.ts', 'utf8')
    expect(edge).toContain("import { purgeOrganization } from '../_shared/organizationPurge.ts'")
    expect(shared).toContain("caller.rpc('platform_purge_organization_tx'")
    expect(shared).toContain('admin.storage.from(bucket).remove(chunk)')
    expect(shared).toContain('admin.auth.admin.deleteUser(userId)')
    expect(shared).toContain("auditEvent='platform.organization.purge_cleanup'")
  })
  it('allows several organizations at once only when they are all Demo', () => {
    expect(edge).toContain('Μαζική διαγραφή επιτρέπεται μόνο για Demo')
    expect(edge).toMatch(/ΔΙΑΓΡΑΦΗ \$\{count\}/)
  })
  it('replaces the old purge function', () => {
    expect(fs.existsSync('supabase/functions/platform-purge-organization')).toBe(false)
    expect(tenantService).toContain("invokeAuthenticatedFunction('platform-delete-organizations'")
  })
})

describe('Demo state in the registry', () => {
  it('treats an active entitlement past its end date as expired and flags the last week', () => {
    expect(demoState({ status: 'active', valid_from: day(-30), valid_until: day(20) })).toBe('active')
    expect(demoState({ status: 'active', valid_from: day(-30), valid_until: day(3) })).toBe('expiring')
    expect(demoState({ status: 'active', valid_from: day(-30), valid_until: day(-1) })).toBe('expired')
    expect(demoState({ status: 'paused', valid_from: day(-30), valid_until: day(10) })).toBe('paused')
    expect(demoState({ status: 'expired', valid_from: day(-30), valid_until: day(10) })).toBe('expired')
  })
})

describe('OrganizationDeleteDialog', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks() })

  it('asks for the organization code for one, and "ΔΙΑΓΡΑΦΗ <n>" for several', () => {
    expect(deletionPhrase([{ code: 'DEMO-HER' }], 'el')).toBe('DEMO-HER')
    expect(deletionPhrase([{ code: 'A' }, { code: 'B' }], 'el')).toBe('ΔΙΑΓΡΑΦΗ 2')
    expect(deletionPhrase([{ code: 'A' }, { code: 'B' }], 'en')).toBe('DELETE 2')
    expect(deletionPhraseMatches('  διαγραφη 2 ', [{ code: 'A' }, { code: 'B' }], 'el')).toBe(true)
    expect(deletionPhraseMatches('demo-her', [{ code: 'DEMO-HER' }], 'el')).toBe(true)
    expect(deletionPhraseMatches('DEMO', [{ code: 'DEMO-HER' }], 'el')).toBe(false)
  })

  it('shows the impact and deletes several Demo after the phrase and password', async () => {
    const onDeleted = vi.fn()
    render(<OrganizationDeleteDialog organizations={[{ id: 'org-a', name: 'Demo · ΠΑΓΝΗ', code: 'DEMO-HER', is_demo: true }, { id: 'org-b', name: 'Demo · Κέρκυρα', code: 'DEMO-CFU', is_demo: true }]} onDeleted={onDeleted} onClose={vi.fn()}/>)
    expect((await screen.findAllByText('1.284')).length).toBe(2)
    expect(screen.getByText(/1 μέλος και άλλου οργανισμού/)).toBeInTheDocument()
    const submit = screen.getByRole('button', { name: /Οριστική διαγραφή 2 Demo/ })
    expect(submit).toBeDisabled()
    const [phraseInput, passwordInput] = document.querySelectorAll('.organization-delete-confirm input')
    fireEvent.change(phraseInput, { target: { value: 'ΔΙΑΓΡΑΦΗ 2' } })
    fireEvent.change(passwordInput, { target: { value: 'secret' } })
    expect(submit).toBeEnabled()
    fireEvent.click(submit)
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(['org-a', 'org-b'], expect.anything()))
    expect(deleteOrganizations).toHaveBeenCalledWith({ organizationIds: ['org-a', 'org-b'], password: 'secret', confirmation: 'ΔΙΑΓΡΑΦΗ 2' })
  })

  it('blocks a real organization that is not suspended', async () => {
    getImpact.mockResolvedValueOnce([{ organizationId: 'real', name: 'Κλινική', code: 'KL-1', isDemo: false, status: 'active', records: 10, systemRecords: 74, files: 0, bytes: 0, members: 2, accountsDeleted: 2, accountsKept: 0, blockers: ['not_suspended'] }])
    render(<OrganizationDeleteDialog organizations={[{ id: 'real', name: 'Κλινική', code: 'KL-1', is_demo: false }]} onDeleted={vi.fn()} onClose={vi.fn()}/>)
    expect(await screen.findByRole('alert')).toHaveTextContent('μόνο αφού τεθούν σε παύση')
    const [phraseInput, passwordInput] = document.querySelectorAll('.organization-delete-confirm input')
    fireEvent.change(phraseInput, { target: { value: 'KL-1' } })
    fireEvent.change(passwordInput, { target: { value: 'secret' } })
    expect(screen.getByRole('button', { name: /^Οριστική διαγραφή$/ })).toBeDisabled()
  })
})
