// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ScreenErrorBoundary } from '../src/core/errors/AppErrorBoundary.jsx'

let broken = true
function Screen() {
  if (broken) throw new Error('render failure')
  return <p>screen content</p>
}

describe('ScreenErrorBoundary', () => {
  afterEach(() => { cleanup(); broken = true; vi.restoreAllMocks() })

  it('keeps the failure inside the screen and recovers with "Try again"', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ScreenErrorBoundary resetKey="/laboratory"><Screen/></ScreenErrorBoundary>)
    expect(screen.getByRole('alert').textContent).toContain('Η οθόνη δεν μπόρεσε να εμφανιστεί')
    broken = false
    fireEvent.click(screen.getByRole('button', { name: 'Δοκιμή ξανά' }))
    expect(screen.getByText('screen content')).toBeTruthy()
  })

  it('clears the error when the user opens another screen', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { rerender } = render(<ScreenErrorBoundary resetKey="/laboratory"><Screen/></ScreenErrorBoundary>)
    expect(screen.getByRole('alert')).toBeTruthy()
    broken = false
    rerender(<ScreenErrorBoundary resetKey="/patients"><Screen/></ScreenErrorBoundary>)
    expect(screen.getByText('screen content')).toBeTruthy()
  })
})
