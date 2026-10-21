// @vitest-environment jsdom
// A patient's surveillance record on the sample Demo hospital: one Summary
// that leads with what needs attention and holds the clinical picture (the
// former "Clinical data" tab), scales named in the header, an overdue review
// marked in the journey, and follow-ups offered only for samples with a result.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { summaryAttention } from '../src/features/surveillance/recordAttention'

let profile
vi.mock('../src/core/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: profile.id, email: profile.email },
    profile,
    isAuthenticated: true,
    isDemoSession: false,
    loading: false,
  }),
}))

const { LanguageProvider } = await import('../src/core/i18n/LanguageContext')
const { FeedbackProvider } = await import('../src/core/feedback/FeedbackContext')
const { TenantProvider, useTenant } = await import('../src/core/tenant/TenantContext')
const { NotificationProvider } = await import('../src/core/notifications/NotificationContext')
const { PatientClinicalRecordRoute } =
  await import('../src/features/surveillance/PatientClinicalRecordRoute')

async function openRecord(id) {
  let api
  function Capture() {
    api = useTenant()
    return null
  }
  render(
    <MemoryRouter initialEntries={[`/surveillance/${id}`]}>
      <LanguageProvider>
        <FeedbackProvider>
          <TenantProvider>
            <NotificationProvider>
              <Capture />
              <Routes>
                <Route path="/surveillance/:caseId" element={<PatientClinicalRecordRoute />} />
              </Routes>
            </NotificationProvider>
          </TenantProvider>
        </FeedbackProvider>
      </LanguageProvider>
    </MemoryRouter>,
  )
  await waitFor(() => expect(api?.enterSampleDemo).toBeTypeOf('function'))
  act(() => {
    api.enterSampleDemo()
  })
  await screen.findAllByRole('tab', {}, { timeout: 5000 })
}
const t = key =>
  ({ reassessmentOverdueBanner: 'late {days}', openReassessment: 'open review' })[key] || key
const day = offset => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

beforeEach(() => {
  Element.prototype.scrollIntoView = () => {}
  localStorage.clear()
  sessionStorage.clear()
  profile = { id: 'owner-1', isPlatformOwner: true, fullName: 'Platform Owner', isDemo: false }
})
afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
})

describe('what needs attention', () => {
  it('lists an overdue review, critical results, approvals and awaited samples, most urgent first, each with its stage', () => {
    const record = {
      status: 'active',
      reviewDue: day(-2),
      therapy: [
        { antimicrobial: 'Meropenem', approvalStatus: 'pending' },
        { antimicrobial: 'Cefazolin', approvalStatus: 'approved' },
      ],
    }
    const samples = [
      { id: 'S-1', result: 'positive', critical: true },
      { id: 'S-4', result: 'positive', critical: true, communications: [{ by: 'Lab' }] },
      { id: 'S-2', result: 'negative' },
      { id: 'S-3', result: null },
    ]
    expect(
      summaryAttention(record, { t, samples }).map(item => [item.id, item.tone, item.stage]),
    ).toEqual([
      ['reassessment', 'danger', 'reassessment'],
      ['critical', 'danger', 'samples'],
      ['approval', 'warning', 'therapy'],
      ['samples', 'warning', 'samples'],
    ])
    expect(summaryAttention(record, { t, samples })[0].text).toBe('late 2')
    expect(summaryAttention(record, { t, samples })[1].text).toContain('S-1')
    expect(summaryAttention(record, { t, samples })[1].text).not.toContain('S-4')
  })

  it('is empty for a surveillance that is up to date or closed', () => {
    expect(
      summaryAttention(
        { status: 'active', reviewDue: day(3), therapy: [] },
        { t, samples: [{ result: 'negative' }] },
      ),
    ).toEqual([])
    expect(
      summaryAttention(
        { status: 'completed', reviewDue: day(-9) },
        { t, samples: [{ result: null }] },
      ),
    ).toEqual([])
  })
})

describe('the record of a patient under surveillance', () => {
  it('has one Summary with the clinical picture, and no separate Clinical data tab', async () => {
    await openRecord('SUR-260041')
    expect(screen.getAllByRole('tab').map(tab => tab.textContent.trim())).toEqual([
      'Σύνοψη',
      'Επιτήρηση & Δείγματα',
      'Φόρμες & ερωτηματολόγια',
      'Έγγραφα',
      'Ιστορικό',
    ])
    expect(await screen.findByText('Κλινική αξιολόγηση')).toBeInTheDocument()
    expect(
      screen.getByText('Πυρετός και αιμοδυναμική επιβάρυνση μετά την εισαγωγή στη ΜΕΘ.'),
    ).toBeInTheDocument()
    // The latest events (the last reassessment among them) sit under the current surveillance.
    expect(screen.getByText('Τελευταία γεγονότα')).toBeInTheDocument()
  })

  it('names each clinical scale beside its score in the header', async () => {
    await openRecord('SUR-260041')
    const flags = await screen.findByLabelText('Κλινικές επισημάνσεις', {}, { timeout: 5000 })
    expect(
      within(flags)
        .getAllByRole('button')
        .map(button => button.textContent),
    ).toEqual(['NEWS28', 'Braden10', 'GCS13'])
  })

  it('leads with the overdue review and the awaited sample, each opening its stage', async () => {
    await openRecord('SUR-260041')
    // One «Needs attention» strip; an overdue review makes it an alert.
    const strip = await screen.findByRole('alert')
    expect(within(strip).getByText(/Η επανεκτίμηση έχει λήξει/)).toBeInTheDocument()
    expect(within(strip).getByText('Δείγματα χωρίς αποτέλεσμα: LAB-260779')).toBeInTheDocument()
    fireEvent.click(within(strip).getByRole('button', { name: /Δείγματα χωρίς αποτέλεσμα/ }))
    expect(screen.getByRole('tab', { name: /Επιτήρηση & Δείγματα/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('shows a therapy awaiting approval and takes the user to the therapy', async () => {
    await openRecord('SUR-260039')
    expect(await screen.findByText('Αγωγή σε αναμονή έγκρισης: Meropenem')).toBeInTheDocument()
    expect(screen.getByText('σε αναμονή έγκρισης')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Αγωγή σε αναμονή έγκρισης/ }))
    expect(screen.getByRole('tab', { name: /Επιτήρηση & Δείγματα/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('marks an overdue review in the journey and offers a follow-up only for samples with a result', async () => {
    await openRecord('SUR-260041')
    fireEvent.click(screen.getByRole('tab', { name: /Επιτήρηση & Δείγματα/ }))
    const episode = (await screen.findByText('Λοίμωξη αιματικής ροής')).closest('.sv-episode')
    expect(within(episode).getByText(/εκπρόθεσμη \d+ ημέρ/)).toBeInTheDocument()
    const rowOf = code => screen.getByText(new RegExp(code)).closest('.sv-sample')
    expect(
      within(rowOf('LAB-260771')).getByRole('button', { name: /Επανέλεγχος/ }),
    ).toBeInTheDocument()
    expect(
      within(rowOf('LAB-260779')).queryByRole('button', { name: /Επανέλεγχος/ }),
    ).not.toBeInTheDocument()
  })
})
