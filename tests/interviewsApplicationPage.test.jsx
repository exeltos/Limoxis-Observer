// @vitest-environment jsdom
// The candidate's tablet form (/apply) with the demo code: no database.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LanguageProvider } from '../src/core/i18n/LanguageContext'

const rpc = vi.fn()
vi.mock('../src/core/supabase/client', () => ({ supabase: { rpc: (...args) => rpc(...args) } }))
const { ApplicationPage } = await import('../src/features/interviews/apply/ApplicationPage')

const renderAt = path => render(<LanguageProvider><MemoryRouter initialEntries={[path]}><Routes>
  <Route path="/apply" element={<ApplicationPage />} />
  <Route path="/apply/:token" element={<ApplicationPage />} />
</Routes></MemoryRouter></LanguageProvider>)

describe('Tablet application page', () => {
  beforeEach(() => { sessionStorage.clear(); rpc.mockReset() })
  afterEach(cleanup)

  it('welcomes with the hospital and position, then checks each step before going on', async () => {
    renderAt('/apply/demo')
    expect(await screen.findByText('Καλώς ήρθατε')).toBeInTheDocument()
    expect(screen.getAllByText('ΤΕ Νοσηλευτική').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: /Ξεκινάμε/ }))
    expect(await screen.findByRole('heading', { name: 'Προσωπικά στοιχεία' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Επόμενο/ }))
    expect(await screen.findByText('Γράψτε το επώνυμό σας.')).toBeInTheDocument()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('keeps the form in this tab while it is filled in', async () => {
    renderAt('/apply/demo')
    fireEvent.click(await screen.findByRole('button', { name: /Ξεκινάμε/ }))
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Νικολάου' } })
    const saved = JSON.parse(sessionStorage.getItem('limoxis.apply.DEMO'))
    expect(saved).toMatchObject({ step: 1, draft: { lastName: 'Νικολάου' } })
  })

  it('shows a used link as such, and the code entry without a code', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'HR_APPLICATION_USED' } })
    renderAt('/apply/ABCD-EFGH-2345')
    expect(await screen.findByText(/έχει ήδη χρησιμοποιηθεί/)).toBeInTheDocument()
    expect(rpc).toHaveBeenCalledWith('hr_application_public', { p_token: 'ABCDEFGH2345' })
    cleanup()
    renderAt('/apply')
    expect(screen.getByPlaceholderText('XXXX-XXXX-XXXX')).toBeInTheDocument()
  })
})
