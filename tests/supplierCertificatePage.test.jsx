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
    expect(screen.queryByRole('button', { name: /Υποβολή πιστοποιητικού/ })).not.toBeInTheDocument()
  })

  it('says when the link is unknown', async () => {
    openPage()
    await waitFor(() => expect(screen.getByText(/δεν είναι διαθέσιμος/)).toBeInTheDocument())
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
