// @vitest-environment jsdom
// The first-steps card: a small dock, closable (and kept closed), shown only until every step is done.
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { FirstStepsCard } from '../src/features/dashboard/FirstStepsCard'

afterEach(() => { cleanup(); window.localStorage.clear() })
const steps = [{ id: 'departments', done: true, to: '/a' }, { id: 'users', done: false, to: '/management?tab=users' }]

describe('FirstStepsCard', () => {
  it('starts collapsed with its progress and opens to the steps still to do', () => {
    const opened = []
    render(<FirstStepsCard steps={steps} onOpen={to => opened.push(to)} />)
    expect(screen.getByText('1 από 2')).toBeInTheDocument()
    expect(screen.queryByText('Προσθέστε χρήστες και ρόλους')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Πρώτα βήματα/ }))
    fireEvent.click(screen.getByRole('button', { name: /Άνοιγμα/ }))
    expect(opened).toEqual(['/management?tab=users'])
  })

  it('can be closed, and stays closed for that hospital', () => {
    const { unmount } = render(<FirstStepsCard steps={steps} storageKey="k1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Κλείσιμο της κάρτας' }))
    expect(screen.queryByText('1 από 2')).toBeNull()
    unmount()
    render(<FirstStepsCard steps={steps} storageKey="k1" />)
    expect(screen.queryByText('1 από 2')).toBeNull()
    cleanup()
    render(<FirstStepsCard steps={steps} storageKey="k2" />)
    expect(screen.getByText('1 από 2')).toBeInTheDocument()
  })

  it('is not shown without steps or once every step is done', () => {
    const { container } = render(<FirstStepsCard steps={steps.map(step => ({ ...step, done: true }))} />)
    expect(container).toBeEmptyDOMElement()
  })
})
