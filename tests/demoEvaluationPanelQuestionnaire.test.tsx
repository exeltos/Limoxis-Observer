// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

vi.mock('../src/core/supabase/client', () => ({ supabase: { from: () => ({ select: () => ({ in: async () => ({ data: [{ id: 'u-1', full_name: 'Άννα Αξιολογήτρια' }] }) }) }) } }))
vi.mock('../src/core/feedback/FeedbackContext', () => ({ useFeedback: () => ({ notifyError: vi.fn() }) }))
vi.mock('../src/core/auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner-1' } }) }))
vi.mock('../src/features/demo/demoEvaluationService', () => ({
  updateDemoApplicationRequestStatus: vi.fn(),
  loadDemoEvaluationOverview: vi.fn(async () => ({
    requests: [],
    progress: [
      { user_id: 'u-1', step_key: 'microbiology_mdro', completed_at: '2026-10-10T10:00:00Z', updated_at: '2026-10-10T10:00:00Z', rating: 4, ease: 5, clarity: 3, duration_seconds: 150, rating_comment: 'Καθαρή ροή' },
      { user_id: 'u-1', step_key: 'hand_hygiene', completed_at: '2026-10-10T11:00:00Z', updated_at: '2026-10-10T11:00:00Z', rating: 3 },
    ],
  })),
}))

const { DemoEvaluationPanel } = await import('../src/features/demo/DemoEvaluationPanel')
afterEach(() => cleanup())

describe('Platform Owner: evaluation questionnaire', () => {
  it('shows ease, clarity and time beside a scenario rating, and nothing extra for a plain rating', async () => {
    render(<DemoEvaluationPanel organizationId="demo-1" language="el"/>)
    expect(await screen.findByText('Ευκολία 5/5 · Σαφήνεια 3/5 · 3′')).toBeInTheDocument()
    expect(screen.getByText('Καθαρή ροή')).toBeInTheDocument()
    expect(document.querySelectorAll('.demo-questionnaire-details')).toHaveLength(1)
  })
})
