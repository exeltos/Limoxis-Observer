// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import { ReadinessState, RepositoryErrorState } from '../src/design-system/ReadinessState'

describe('shared repository states', () => {
  it('renders a role-appropriate readiness action', () => {
    const onAction = vi.fn()
    render(<ReadinessState state="not_configured" title="Configuration needed" description="Add departments." actionLabel="Configure" onAction={onAction} />)
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }))
    expect(onAction).toHaveBeenCalledOnce()
  })

  it('renders repository failures as alerts with retry', () => {
    const onRetry = vi.fn()
    render(<RepositoryErrorState title="Could not load" description="Try again." retryLabel="Retry" onRetry={onRetry} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
