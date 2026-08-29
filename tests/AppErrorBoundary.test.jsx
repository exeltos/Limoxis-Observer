// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { AppErrorBoundary } from '../src/core/errors/AppErrorBoundary'

const suppressExpectedRenderError = (event) => event.preventDefault()

beforeEach(() => window.addEventListener('error', suppressExpectedRenderError))

afterEach(() => {
  window.removeEventListener('error', suppressExpectedRenderError)
  cleanup()
  document.documentElement.lang = ''
  vi.restoreAllMocks()
})

function BrokenScreen() {
  throw new Error('render failed')
}

describe('AppErrorBoundary', () => {
  it('renders children during normal operation', () => {
    render(<AppErrorBoundary><p>Application content</p></AppErrorBoundary>)
    expect(screen.getByText('Application content')).toBeInTheDocument()
  })

  it('replaces a failed screen with an English recovery action', () => {
    document.documentElement.lang = 'en'
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<AppErrorBoundary><BrokenScreen/></AppErrorBoundary>)

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
    expect(screen.getByRole('button', { name: 'Reload application' })).toBeEnabled()
  })

  it('uses the Greek recovery copy by default', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<AppErrorBoundary><BrokenScreen/></AppErrorBoundary>)

    expect(screen.getByRole('alert')).toHaveTextContent('Παρουσιάστηκε πρόβλημα')
    expect(screen.getByRole('button', { name: 'Επαναφόρτωση εφαρμογής' })).toBeEnabled()
  })
})
