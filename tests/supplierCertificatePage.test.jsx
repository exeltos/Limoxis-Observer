// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LanguageProvider } from '../src/core/i18n/LanguageContext'

const calls = []
let access = null
vi.mock('../src/core/supabase/client', () => ({ supabase: { rpc: vi.fn(), functions: { invoke: vi.fn(async () => ({})) } } }))
vi.mock('../src/features/quality/resources/supplierRenewalService', () => ({
  loadSupplierCertificateAccess: vi.fn(async () => { if (!access) throw new Error('SUPPLIER_CERTIFICATE_ACCESS_NOT_AVAILABLE'); return access }),
  submitSupplierCertificate: vi.fn(async (token, form, file) => { calls.push({ token, form, file: file?.name }); return { ok: true } }),
}))
const { SupplierCertificatePage } = await import('../src/features/quality/resources/SupplierCertificatePage')

const sent = { status: 'sent', organizationName: 'Γενικό Νοσοκομείο', supplierName: 'Ιατροτεχνική Α.Ε.', certificate: { type: 'ISO 13485', number: 'MD-1', issuer: 'TÜV', expiresOn: '2026-09-24' }, expiresAt: '2099-11-02T00:00:00Z' }
const openPage = () => render(<LanguageProvider><MemoryRouter initialEntries={['/supplier-certificate/SCR-1']}><Routes><Route path="/supplier-certificate/:token" element={<SupplierCertificatePage />} /></Routes></MemoryRouter></LanguageProvider>)

afterEach(() => { cleanup(); calls.length = 0; access = null })

describe('the supplier certificate public page', () => {
  it('shows the expired certificate and checks the form before sending', async () => {
    access = sent
    openPage()
    expect(await screen.findByText('Ιατροτεχνική Α.Ε.', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('MD-1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Υποβολή πιστοποιητικού/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/αριθμός πιστοποιητικού/)
    expect(calls).toEqual([])
  })

  it('says when the link was already used', async () => {
    access = { ...sent, status: 'submitted' }
    openPage()
    await waitFor(() => expect(screen.getByText(/το πιστοποιητικό υποβλήθηκε/)).toBeInTheDocument())
  })

  it('says when the link is unknown', async () => {
    openPage()
    await waitFor(() => expect(screen.getByText(/δεν είναι διαθέσιμος/)).toBeInTheDocument())
  })
})
