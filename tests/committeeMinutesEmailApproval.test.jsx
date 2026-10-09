// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LanguageProvider } from '../src/core/i18n/LanguageContext'

const calls = []
let access = null
vi.mock('../src/core/supabase/client', () => ({ supabase: { rpc: vi.fn(), functions: { invoke: vi.fn(async () => ({})) } } }))
vi.mock('../src/core/feedback/FeedbackContext', () => ({ useFeedback: () => ({ notifyError: vi.fn(), notify: vi.fn() }) }))
vi.mock('../src/features/committees/committeeExternalApprovalService', async (original) => {
  const real = await original()
  return {
    ...real,
    loadExternalMinutesAsync: vi.fn(async () => access),
    decideExternalMinutesAsync: vi.fn(async (token, decision, comment) => { calls.push({ token, decision, comment }); return { ok: true, status: decision } }),
  }
})
const { membersWithoutAccount } = await import('../src/features/committees/committeeExternalApprovalService')
const { ExternalApproversDialog } = await import('../src/features/committees/ExternalApproversDialog')
const { MinutesApprovalPage } = await import('../src/features/committees/MinutesApprovalPage')

const read = path => fs.readFileSync(path, 'utf8')
const pending = { status: 'pending', memberName: 'Κώστας Σταθόπουλος', organizationName: 'Γενικό Νοσοκομείο', committeeName: 'ΕΝΛ', meetingTitle: 'Μηνιαία συνεδρίαση', scheduledAt: '2026-10-14T12:00:00Z', minutesNumber: '11/2026', topics: [{ subject: 'Συρροή KPC', decision: 'Συνεχίζεται το screening.' }], attendees: ['Α', 'Β'], expiresAt: '2026-10-16T09:00:00Z' }
const openPage = (path) => render(<LanguageProvider><MemoryRouter initialEntries={[path]}><Routes><Route path="/minutes-approval/:token" element={<MinutesApprovalPage/>}/></Routes></MemoryRouter></LanguageProvider>)

afterEach(() => { cleanup(); calls.length = 0; access = null })

describe('minutes approval by members without an account', () => {
  it('finds the present voting members without an account', () => {
    const members = [{ id: 'm1', dbId: 'd1', name: 'Με λογαριασμό', userId: 'u1' }, { id: 'm2', dbId: 'd2', name: 'Χωρίς', email: 'x@h.gr' }, { id: 'm3', dbId: 'd3', name: 'Απών' }, { id: 'm4', dbId: 'd4', name: 'Σύμβουλος' }]
    const attendance = [{ memberId: 'm1', status: 'present', voting: true }, { memberId: 'm2', status: 'present', voting: true }, { memberId: 'm3', status: 'absent', voting: true }, { memberId: 'm4', status: 'present', voting: false }]
    expect(membersWithoutAccount(attendance, members)).toEqual([{ memberId: 'm2', memberDbId: 'd2', name: 'Χωρίς', email: 'x@h.gr' }])
  })

  it('chooses e-mail when an address is known, paper otherwise, and blocks an invalid address', () => {
    const onSubmit = vi.fn()
    render(<LanguageProvider><ExternalApproversDialog approvers={[{ memberId: 'a', memberDbId: 'da', name: 'Άννα', email: 'anna@h.gr' }, { memberId: 'b', memberDbId: 'db', name: 'Βασίλης', email: '' }]} busy={false} en={false} onClose={() => {}} onSubmit={onSubmit}/></LanguageProvider>)
    const submit = screen.getByRole('button', { name: /Υποβολή για έγκριση/ })
    expect(submit).toBeEnabled()
    fireEvent.click(screen.getAllByLabelText(/Σύνδεσμος με email/)[1])
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getAllByPlaceholderText('name@hospital.gr')[1], { target: { value: 'vasilis@h.gr' } })
    fireEvent.click(submit)
    expect(onSubmit).toHaveBeenCalledWith([expect.objectContaining({ memberId: 'a', method: 'email', email: 'anna@h.gr' }), expect.objectContaining({ memberId: 'b', method: 'email', email: 'vasilis@h.gr' })])
  })

  it('shows the minutes on the public page and records an approval once', async () => {
    access = pending
    openPage('/minutes-approval/CMA-1')
    expect(await screen.findByText('Συρροή KPC')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Εγκρίνω τα πρακτικά/ }))
    await waitFor(() => expect(screen.getByText(/η έγκρισή σας καταγράφηκε/)).toBeInTheDocument())
    expect(calls).toEqual([{ token: 'CMA-1', decision: 'approved', comment: '' }])
  })

  it('needs a comment to request changes (link opened from the e-mail button)', async () => {
    access = pending
    openPage('/minutes-approval/CMA-2?decision=changes')
    const send = await screen.findByRole('button', { name: /Αποστολή αιτήματος/ })
    expect(send).toBeDisabled()
    fireEvent.change(screen.getByPlaceholderText(/θέμα 2/), { target: { value: 'Θέμα 1: λάθος ημερομηνία' } })
    fireEvent.click(send)
    await waitFor(() => expect(calls).toEqual([{ token: 'CMA-2', decision: 'rejected', comment: 'Θέμα 1: λάθος ημερομηνία' }]))
  })

  it('explains expired and already answered links', async () => {
    access = { ...pending, status: 'expired' }
    openPage('/minutes-approval/CMA-3')
    expect(await screen.findByText('Ο σύνδεσμος έληξε')).toBeInTheDocument()
    cleanup()
    access = { ...pending, status: 'approved', decidedAt: '2026-10-10T10:00:00Z' }
    openPage('/minutes-approval/CMA-4')
    expect(await screen.findByText('Έχετε ήδη εγκρίνει τα πρακτικά')).toBeInTheDocument()
  })

  it('stores only a hash of the single-use token and finalizes across both approval tables', () => {
    const sql = read('supabase/migrations/20261019120000_committee_minutes_email_approval.sql')
    expect(sql).toContain("token_hash = encode(sha256(convert_to(v_token, 'UTF8')), 'hex')")
    expect(sql).not.toMatch(/^\s+token text/m)
    expect(sql).toContain("interval '7 days'")
    expect(sql).toContain('private.committee_minutes_try_finalize')
    expect(sql).toContain("raise exception 'COMMITTEE_MINUTES_APPROVER_ACCOUNT_REQUIRED' using detail")
    expect(sql).toContain('grant execute on function public.committee_minutes_external_decide(text, text, text) to anon, authenticated')
    expect(read('src/app/App.jsx')).toContain('path="minutes-approval/:token"')
    expect(read('supabase/functions/process-notification-outbox/index.ts')).toContain("'committee_minutes_external_approval'")
  })
})
