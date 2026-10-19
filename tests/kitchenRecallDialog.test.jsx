// @vitest-environment jsdom
// The recall drill on screen (demo mode): the list, a completed drill and a new one.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'
import { LanguageProvider } from '../src/core/i18n/LanguageContext'

const feedback = { notify: vi.fn(), notifyError: vi.fn(), confirm: vi.fn(async () => true) }
vi.mock('../src/core/supabase/client', () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }))
vi.mock('../src/core/tenant/TenantContext', () => ({ useTenant: () => ({ tenant: { id: 'org-1' }, membership: { employeeId: '' }, role: 'hospital_admin' }) }))
vi.mock('../src/core/feedback/FeedbackContext', () => ({ useFeedback: () => feedback, useOptionalFeedback: () => feedback }))
vi.mock('../src/core/audit/useAuditActor', () => ({ useAuditActor: () => ({ id: 'u-actor', name: 'Ελένη Γεωργίου' }) }))

const { RecallDialog, RecallPanel, RecallOverviewCard } = await import('../src/features/kitchen/KitchenRecall')
const { kitchenDemoState } = await import('../src/features/kitchen/kitchenDemoData')
const { newRecallDrill } = await import('../src/features/kitchen/kitchenRecallModel')

const state = kitchenDemoState()
const access = { canView: true, canRecord: true, canManage: true }
const wrap = node => render(<MemoryRouter><LanguageProvider>{node}</LanguageProvider></MemoryRouter>)
afterEach(cleanup)

describe('Kitchen recall drill screens', () => {
  it('lists the drills and opens one', () => {
    const onRecall = vi.fn()
    wrap(<RecallPanel state={state} access={access} filters={{ query: '', result: 'all', scenario: 'all' }} setFilters={vi.fn()} onRecall={onRecall} />)
    expect(screen.getByText('ANK-0002')).toBeInTheDocument()
    expect(screen.getByText('ANK-0001')).toBeInTheDocument()
    fireEvent.click(screen.getByText('ANK-0002'))
    expect(onRecall).toHaveBeenCalledWith(expect.objectContaining({ code: 'ANK-0002' }))
  })

  it('shows a completed drill as it was found, read only', () => {
    wrap(<RecallDialog state={state} organizationId={null} access={access} initial={state.recallDrills.find(row => row.code === 'ANK-0002')} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByText('Ισοζύγιο μάζας')).toBeInTheDocument()
    expect(screen.getAllByText('100 %').length).toBeGreaterThan(0)
    expect(screen.getByText('01:35:00')).toBeInTheDocument()
    expect(screen.queryByText('Ολοκλήρωση άσκησης')).toBeNull()
    expect(screen.getByText('Πραγματική ανάκληση (όχι άσκηση)')).toBeInTheDocument()
  })

  it('starts a new drill with the clock running and asks for the subject', () => {
    wrap(<RecallDialog state={state} organizationId={null} access={access} initial={newRecallDrill()} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByText('Νέα άσκηση ανάκλησης')).toBeInTheDocument()
    expect(screen.getByRole('timer')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Ολοκλήρωση άσκησης'))
    expect(feedback.notify).toHaveBeenCalledWith(expect.stringContaining('η παρτίδα'), 'error')
  })

  it('warns on the overview when no drill was done', () => {
    wrap(<RecallOverviewCard state={{ ...state, recallDrills: [] }} access={access} onTab={vi.fn()} onRecall={vi.fn()} />)
    expect(screen.getByText(/Καμία άσκηση ανάκλησης τους τελευταίους 12 μήνες/)).toBeInTheDocument()
  })
})
