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
const itemActions = []
const ACCESS = { canManage: true, canViewAll: true, canSend: false, owner: false, ownDepartments: [] }
let access = ACCESS
vi.mock('../src/core/supabase/client', () => ({ supabase: null }))
vi.mock('../src/core/feedback/FeedbackContext', () => ({ useFeedback: () => ({ notifyError: vi.fn(), notify: vi.fn(), confirm: vi.fn(async () => true) }), useOptionalFeedback: () => null }))
vi.mock('../src/core/tenant/TenantContext', () => ({ useTenant: () => ({ tenant: { id: 'org' }, role: 'quality_manager', actualRole: 'quality_manager', membership: { capabilities: [], customCapabilities: [] }, moduleEnabled: () => true }) }))
vi.mock('../src/features/quality/resources/ResourcesPanel', () => ({
  useResourceAccess: () => access,
  useResources: () => ({ suppliers: withSupplierStatus(demoResources().suppliers, []), equipment: [], events: [], templates: [], loading: false, reload: vi.fn(async () => {}) }),
}))
vi.mock('../src/features/quality/resources/supplierRenewalService', async original => {
  const real = await original()
  return {
    ...real,
    loadCertificateRequests: vi.fn(async () => real.demoRequests()),
    createCertificateRequests: vi.fn(async (organizationId, items, options) => { created.push({ items, options }); return { created: items.length, sent: 1, skipped: [] } }),
    certificateRequestAction: vi.fn(async (organizationId, request, action) => { actions.push({ id: request.id, action }); return { ok: true } }),
    certificateItemAction: vi.fn(async (organizationId, item, action, options) => { itemActions.push({ id: item.id, action, options }); return { ok: true } }),
  }
})
const { SupplierRenewalsPage } = await import('../src/features/quality/resources/SupplierRenewalsPage')
const openPage = () => render(<LanguageProvider><MemoryRouter><SupplierRenewalsPage /></MemoryRouter></LanguageProvider>)
const rowOf = name => screen.getAllByText(name).map(node => node.closest('tr')).find(tr => tr && within(tr).queryByRole('checkbox'))
const lastButton = name => screen.getAllByRole('button', { name }).at(-1)

afterEach(() => { cleanup(); created.length = 0; actions.length = 0; itemActions.length = 0; access = ACCESS })

describe('Certificates to renew', () => {
  it('groups the certificates by supplier and accepts a submitted one from the review, without sending anything', async () => {
    openPage()
    expect(await screen.findByText(/Υποβολές προς έλεγχο 1/)).toBeInTheDocument()
    const row = rowOf('Υγειονομικά Αναλώσιμα Κεντρικής Ελλάδας')
    expect(within(row).getByText('ISO 14001 · EM-2291')).toBeInTheDocument()
    expect(within(row).getByText('ISO 45001 · OH-2292')).toBeInTheDocument()
    expect(within(row).getByRole('checkbox')).toBeDisabled() // all three are in its request
    fireEvent.click(screen.getAllByRole('button', { name: /Έλεγχος/ })[0])
    fireEvent.click(await screen.findByRole('button', { name: /Αποδοχή & αντικατάσταση/ }))
    await waitFor(() => expect(itemActions).toEqual([{ id: 'scri-demo-1', action: 'accept', options: { comment: '', resend: false } }]))
    expect(created).toEqual([])
    expect(actions).toEqual([])
  })

  it('shows «no answer» and keeps the reminder disabled for a Quality user who was not designated', async () => {
    openPage()
    const row = await waitFor(() => rowOf('Γαλακτοκομικά Κάμπου Α.Ε.'))
    expect(within(row).getByText('Χωρίς απάντηση (10 ημέρες)')).toBeInTheDocument()
    const remind = within(row).getByRole('button', { name: /Υπενθύμιση/ })
    expect(remind).toBeDisabled()
    expect(remind.parentElement).toHaveAttribute('title', 'Μόνο ο διαχειριστής, ο υπεύθυνος ποιότητας ή όσοι έχει ορίσει ο Ιδιοκτήτης')
    expect(screen.getByText(/Αποστολή και υπενθυμίσεις: Μόνο ο διαχειριστής, ο υπεύθυνος ποιότητας ή όσοι έχει ορίσει ο Ιδιοκτήτης/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /χωρίς απάντηση \(7\+ ημέρες\)/ }))
    await waitFor(() => expect(rowOf('Υγειονομικά Αναλώσιμα Κεντρικής Ελλάδας')).toBeUndefined()) // still listed in the review above
    expect(rowOf('Γαλακτοκομικά Κάμπου Α.Ε.')).toBeTruthy()
  })

  it('a designated sender reminds with the same link and sends one e-mail per supplier', async () => {
    access = { ...ACCESS, canSend: true }
    openPage()
    const row = await waitFor(() => rowOf('Γαλακτοκομικά Κάμπου Α.Ε.'))
    fireEvent.click(within(row).getByRole('button', { name: /Υπενθύμιση/ }))
    await waitFor(() => expect(actions).toEqual([{ id: 'scr-demo-2', action: 'remind' }]))
    fireEvent.click(within(rowOf('Βιοϊατρική Συντήρηση Ο.Ε.')).getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /Έγκριση & αποστολή \(1 email\)/ }))
    await screen.findByText('Έγκριση & αποστολή αιτημάτων ανανέωσης')
    fireEvent.click(lastButton(/Έγκριση & αποστολή \(1 email\)/))
    await waitFor(() => expect(created).toEqual([{ items: [{ certification_id: 'c5b', recipient_email: 'tech@example.com' }], options: { send: true } }]))
  })

  it('a Quality user without the add-on only proposes', async () => {
    openPage()
    const ready = await waitFor(() => rowOf('Βιοϊατρική Συντήρηση Ο.Ε.'))
    fireEvent.click(within(ready).getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /Πρόταση για αποστολή \(1\)/ }))
    fireEvent.click(await screen.findByRole('button', { name: /^Πρόταση \(1\)/ }))
    await waitFor(() => expect(created).toEqual([{ items: [{ certification_id: 'c5b', recipient_email: 'tech@example.com' }], options: { send: false } }]))
  })
})
