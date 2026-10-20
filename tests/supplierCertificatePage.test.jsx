// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LanguageProvider } from '../src/core/i18n/LanguageContext'

const calls = []
const loads = []
let access = null
vi.mock('../src/core/supabase/client', () => ({ supabase: { rpc: vi.fn(), functions: { invoke: vi.fn(async () => ({})) } } }))
vi.mock('../src/features/quality/resources/supplierRenewalService', async original => {
  const real = await original()
  return {
    ...real,
    loadSupplierCertificateAccess: vi.fn(async token => { loads.push(token); if (real.isDemoAccessToken(token)) return real.demoSupplierAccess(); if (!access) throw new Error('SUPPLIER_CERTIFICATE_ACCESS_NOT_AVAILABLE'); return access }),
    submitSupplierCertificate: vi.fn(async (token, itemId, form, file) => { calls.push({ token, itemId, form, file: file?.name }); return { ok: true } }),
  }
})
const { SupplierCertificatePage } = await import('../src/features/quality/resources/SupplierCertificatePage')

const items = [
  { id: 'i1', status: 'pending', type: 'ISO 13485', number: 'MD-1', issuer: 'TÜV', expiresOn: '2026-09-24' },
  { id: 'i2', status: 'submitted', type: 'ISO 9001', number: 'QM-7', issuer: 'TÜV', expiresOn: '2026-08-01', submittedAt: '2026-10-18T10:00:00Z' },
  { id: 'i3', status: 'pending', type: 'ISO 14001', number: 'EM-3', issuer: 'TÜV', expiresOn: '2026-07-01' },
]
const sent = { status: 'sent', organizationName: 'Γενικό Νοσοκομείο', supplierName: 'Ιατροτεχνική Α.Ε.', items, expiresAt: '2099-11-02T00:00:00Z' }
const openPage = (token = 'SCR-1') => render(<LanguageProvider><MemoryRouter initialEntries={[`/supplier-certificate/${token}`]}><Routes><Route path="/supplier-certificate/:token" element={<SupplierCertificatePage />} /></Routes></MemoryRouter></LanguageProvider>)

afterEach(() => { cleanup(); calls.length = 0; loads.length = 0; access = null })

describe('the supplier certificate public page', () => {
  it('lists every certificate of the request, each with its own form, and checks it before sending', async () => {
    access = sent
    openPage()
    expect(await screen.findByText('Ιατροτεχνική Α.Ε.', { exact: false })).toBeInTheDocument()
    expect(screen.getByText(/Υποβλήθηκαν 1 από 3/)).toBeInTheDocument()
    expect(screen.getByText('MD-1')).toBeInTheDocument()
    expect(screen.getByText('EM-3')).toBeInTheDocument()
    const buttons = screen.getAllByRole('button', { name: /Υποβολή πιστοποιητικού/ })
    expect(buttons).toHaveLength(2) // the submitted one has no form
    fireEvent.click(buttons[0])
    expect(await screen.findByRole('alert')).toHaveTextContent(/αριθμός πιστοποιητικού/)
    expect(calls).toEqual([])
  })

  it('thanks the supplier once nothing is left to submit', async () => {
    access = { ...sent, items: items.map(item => ({ ...item, status: 'submitted' })) }
    openPage()
    await waitFor(() => expect(screen.getByText(/Υποβλήθηκαν και τα 3 πιστοποιητικά/)).toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Ευχαριστούμε' })).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Υποβολή πιστοποιητικού/ })).not.toBeInTheDocument()
  })

  it('shows the hospital, what is asked, the progress and each certificate as a card', async () => {
    access = { ...sent, organizationEmail: 'quality@hospital.gr', organizationPhone: '210 1234567' }
    const { container } = openPage()
    expect(await screen.findByText('Γενικό Νοσοκομείο', { selector: '.supplier-portal-hospital' })).toBeInTheDocument()
    expect(container.querySelector('.supplier-portal-monogram')).toHaveTextContent('ΓΝ')
    expect(screen.getByText(/ISO 22000 \/ HACCP/)).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1')
    expect(screen.getAllByText('Έληξε', { selector: '.supplier-certificate-pill' })).toHaveLength(2)
    expect(screen.getByText(/Υποβλήθηκε στις 18\/10\/2026/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'quality@hospital.gr' })).toHaveAttribute('href', 'mailto:quality@hospital.gr')
    expect(screen.getByText(/Μην τον προωθήσετε/)).toBeInTheDocument()
  })

  it('shows the hospital logo when it has one', async () => {
    access = { ...sent, organizationLogo: 'data:image/png;base64,AAAA' }
    const { container } = openPage()
    await screen.findByText(/Υποβλήθηκαν 1 από 3/)
    expect(container.querySelector('img.supplier-portal-logo')).toHaveAttribute('src', 'data:image/png;base64,AAAA')
    expect(container.querySelector('.supplier-portal-monogram')).toBeNull()
  })

  it('the file zone takes a PDF or image up to 10 MB, shows it and can remove it', async () => {
    access = sent
    openPage()
    const card = (await screen.findAllByRole('button', { name: /Υποβολή πιστοποιητικού/ }))[0].closest('section')
    const input = card.querySelector('input[type=file]')
    const big = new File(['x'], 'big.pdf', { type: 'application/pdf' })
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 })
    fireEvent.change(input, { target: { files: [big] } })
    expect(within(card).getByRole('alert')).toHaveTextContent('αρχείο έως 10 MB')
    fireEvent.change(input, { target: { files: [new File(['x'], 'notes.txt', { type: 'text/plain' })] } })
    expect(within(card).getByRole('alert')).toHaveTextContent('PDF ή εικόνα')
    fireEvent.change(input, { target: { files: [new File(['%PDF'], 'ISO-13485.pdf', { type: 'application/pdf' })] } })
    expect(within(card).getByText('ISO-13485.pdf')).toBeInTheDocument()
    expect(within(card).queryByRole('alert')).not.toBeInTheDocument()
    fireEvent.click(within(card).getByRole('button', { name: /Αφαίρεση αρχείου ISO-13485.pdf/ }))
    expect(within(card).queryByText('ISO-13485.pdf')).not.toBeInTheDocument()
    expect(within(card).getByText(/Σύρετε εδώ το αρχείο/)).toBeInTheDocument()
  })

  it('says when the link is unknown', async () => {
    openPage()
    await waitFor(() => expect(screen.getByText(/δεν είναι διαθέσιμος/)).toBeInTheDocument())
    expect(screen.getByLabelText(/Σύνδεσμος ή κωδικός από το email/)).toBeInTheDocument()
  })

  it('the demo link shows an invented sample and keeps the submission on the page', async () => {
    openPage('demo')
    expect(await screen.findByText(/Προεπισκόπηση με δείγμα/)).toBeInTheDocument()
    expect(screen.getByText(/Υποβλήθηκαν 0 από 3/)).toBeInTheDocument()
    const first = screen.getAllByRole('button', { name: /Υποβολή πιστοποιητικού/ })[0].closest('section')
    fireEvent.change(within(first).getByLabelText(/Αριθμός πιστοποιητικού/), { target: { value: 'QM-2290/2' } })
    expect(loads).toEqual(['demo'])
  })
})
