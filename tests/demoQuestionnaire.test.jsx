// @vitest-environment jsdom
// Demo guide phase 2: the per-scenario questionnaire (usefulness, ease,
// clarity, time taken), stored by demo_submit_scenario_feedback, and its
// fallback to the plain rating while that migration is not yet applied.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import fs from 'node:fs'

const rpc = vi.fn()
const selects = []
let missingColumns = false
let storedRows = []
vi.mock('../src/core/supabase/client', () => ({
  supabase: {
    rpc: (...args) => rpc(...args),
    from: () => {
      const query = { columns: '', filters: [] }
      const chain = {
        select(columns) { query.columns = columns; return chain },
        eq(column, value) { query.filters.push([column, value]); return chain },
        order() { return chain },
        then(resolve) {
          selects.push(query.columns)
          const missing = missingColumns && query.columns.includes('duration_seconds')
          return Promise.resolve(missing ? { data: null, error: { code: '42703' } } : { data: storedRows, error: null }).then(resolve)
        },
      }
      return chain
    },
    functions: { invoke: vi.fn(async () => ({})) },
  },
}))

const service = await import('../src/features/demo/demoEvaluationService')

beforeEach(() => { rpc.mockReset(); selects.length = 0; missingColumns = false; storedRows = []; sessionStorage.clear() })
afterEach(() => { cleanup(); vi.restoreAllMocks(); sessionStorage.clear() })

describe('questionnaire storage', () => {
  it('sends usefulness, ease, clarity, time and comment to the new RPC', async () => {
    rpc.mockResolvedValue({ data: { microbiology_mdro: { rating: 4 } }, error: null })
    await service.submitDemoScenarioFeedback('demo-1', 'microbiology_mdro', { rating: 4, ease: 5, clarity: 3, durationSeconds: 92.4, comment: 'Γρήγορο' })
    expect(rpc).toHaveBeenCalledWith('demo_submit_scenario_feedback', { p_organization_id: 'demo-1', p_step: 'microbiology_mdro', p_rating: 4, p_ease: 5, p_clarity: 3, p_duration_seconds: 92, p_comment: 'Γρήγορο' })
  })

  it('falls back to the plain rating while the migration is not applied', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202' } }).mockResolvedValueOnce({ data: { microbiology_mdro: { rating: 4 } }, error: null })
    const result = await service.submitDemoScenarioFeedback('demo-1', 'microbiology_mdro', { rating: 4, ease: 5, comment: 'x' })
    expect(rpc.mock.calls[1]).toEqual(['demo_rate_evaluation_step', { p_organization_id: 'demo-1', p_step: 'microbiology_mdro', p_rating: 4, p_comment: 'x' }])
    expect(result).toEqual({ microbiology_mdro: { rating: 4 } })
  })

  it('does not hide a real error behind the fallback', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'Not a member of this Demo' } })
    await expect(service.submitDemoScenarioFeedback('demo-1', 'microbiology_mdro', { rating: 4 })).rejects.toMatchObject({ code: '42501' })
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('reads the questionnaire columns, or only the rating before the migration', async () => {
    storedRows = [{ step_key: 'microbiology_mdro', rating: 4, rating_comment: 'ok', ease: 5 }]
    expect(await service.loadMyDemoRatings('demo-1', 'user-1')).toEqual({ microbiology_mdro: { rating: 4, comment: 'ok', ease: 5, clarity: null, durationSeconds: null } })
    missingColumns = true
    expect((await service.loadMyDemoRatings('demo-1', 'user-1')).microbiology_mdro.rating).toBe(4)
    expect(selects.at(-1)).toBe('step_key,rating,rating_comment')
  })

  it('widens the scenario keys and keeps the RPC for active Demo members only', () => {
    const sql = fs.readFileSync('supabase/migrations/20261028120000_demo_role_guidance.sql', 'utf8')
    expect(sql).toContain('drop constraint if exists demo_evaluation_progress_step_key_check')
    expect(sql).toContain("om.status = 'active' and o.is_demo")
    expect(sql).toContain('from public, anon')
    const manifest = JSON.parse(fs.readFileSync('supabase/security-definer-manifest.json', 'utf8'))
    expect(JSON.stringify(manifest)).toContain('demo_submit_scenario_feedback')
  })
})

describe('questionnaire in the guide', () => {
  it('asks ease and clarity for a scenario, and sends them with the time it took', async () => {
    const { LanguageProvider } = await import('../src/core/i18n/LanguageContext')
    const { useDemoEvaluation } = await import('../src/features/demo/useDemoEvaluation')
    const marked = {}
    rpc.mockImplementation(async (name, args) => {
      if (name === 'demo_set_evaluation_step') marked[args.p_step] = 'now'
      return { data: name === 'demo_set_evaluation_step' ? { ...marked } : {}, error: null }
    })
    let api
    function Harness() {
      const navigate = useNavigate()
      api = useDemoEvaluation({ enabled: true, organizationId: 'demo-1', organizationName: 'Demo', userId: 'user-1', profile: {}, isPlatformOwner: false, role: 'laboratory', language: 'el', navigate })
      return api.dialogs
    }
    let now = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    render(<MemoryRouter><LanguageProvider><Harness/></LanguageProvider></MemoryRouter>)
    // The first visit opens the welcome; its tour starts the role's first scenario.
    fireEvent.click(await screen.findByRole('button', { name: /^Ξενάγηση/ }))
    // The scenario's tour runs over the screen; ended, the scenario card is back.
    const endTour = screen.queryByRole('button', { name: 'Τέλος ξενάγησης' })
    if (endTour) fireEvent.click(endTour)
    now += 95_000
    fireEvent.click(await screen.findByRole('button', { name: 'Ολοκλήρωσα' }))
    const ease = await screen.findByRole('radiogroup', { name: 'Ευκολία' })
    fireEvent.click(screen.getAllByRole('radio')[4])
    fireEvent.click(within(ease).getByRole('radio', { name: /^4/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Αποστολή' }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('demo_submit_scenario_feedback', expect.objectContaining({ p_step: 'microbiology_mdro', p_rating: 5, p_ease: 4, p_clarity: null, p_duration_seconds: 95 })))
    act(() => {})
  })
})
