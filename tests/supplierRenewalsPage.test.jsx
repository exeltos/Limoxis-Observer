// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'
import { LanguageProvider } from '../src/core/i18n/LanguageContext'
import { demoResources } from '../src/features/quality/resources/resourceDemoData'
import { withSupplierStatus } from '../src/features/quality/resources/resourceModel'

const created = []
const actions = []
vi.mock('../src/core/supabase/client', () => ({ supabase: null }))
vi.mock('../src/core/feedback/FeedbackContext', () => ({ useFeedback: () => ({ notifyError: vi.fn(), notify: vi.fn(), confirm: vi.fn(async () => true) }), useOptionalFeedback: () => null }))
vi.mock('../src/core/tenant/TenantContext', () => ({ useTenant: () => ({ tenant: { id: 'org' }, role: 'quality_manager', actualRole: 'quality_manager', membership: { capabilities: [], customCapabilities: [] }, moduleEnabled: () => true }) }))
vi.mock('../src/features/quality/resources/ResourcesPanel', () => ({
  useResourceAccess: () => ({ canManage: true, canViewAll: true, ownDepartments: [] }),
  useResources: () => ({ suppliers: withSupplierStatus(demoResources().suppliers, []), equipment: [], events: [], templates: [], loading: false, reload: vi.fn(async () => {}) }),
}))
vi.mock('../src/features/quality/resources/supplierRenewalService', async original => {
  const real = await original()
  return {
    ...real,
    loadCertificateRequests: vi.fn(async () => real.demoRequests()),
    createCertificateRequests: vi.fn(async (organizationId, items, options) => { created.push({ items, options }); return { created: items.length, sent: items.length, skipped: [] } }),
    certificateRequestAction: vi.fn(async (organizationId, request, action, options) => { actions.push({ id: request.id, action, options }); return { ok: true } }),
  }
})
const { SupplierRenewalsPage } = await import('../src/features/quality/resources/SupplierRenewalsPage')
const openPage = () => render(<LanguageProvider><MemoryRouter><SupplierRenewalsPage /></MemoryRouter></LanguageProvider>)

afterEach(() => { cleanup(); created.length = 0; actions.length = 0 })

describe('Certificates to renew', () => {
  it('lists the submitted renewal, keeps it out of the selection and accepts it from the review, without sending anything', async () => {
    openPage()
    expect(await screen.findByText(/Υποβολές προς έλεγχο 1/)).toBeInTheDocument()
    const row = screen.getAllByText('Υγειονομικά Αναλώσιμα Κεντρικής Ελλάδας').map(node => node.closest('tr')).find(tr => within(tr).queryByRole('checkbox'))
    expect(within(row).getByRole('checkbox')).toBeDisabled() // its renewal was submitted
    fireEvent.click(screen.getAllByRole('button', { name: /Έλεγχος/ })[0])
    fireEvent.click(await screen.findByRole('button', { name: /Αποδοχή & αντικατάσταση/ }))
    await waitFor(() => expect(actions).toEqual([{ id: 'scr-demo-1', action: 'accept', options: { comment: '', resend: false } }]))
    expect(created).toEqual([])
  })
})
