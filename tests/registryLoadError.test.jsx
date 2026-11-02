// @vitest-environment jsdom
// A list that could not be read says so (with «Try again») instead of looking empty.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { LanguageProvider } from '../src/core/i18n/LanguageContext'
import { RegistryTable } from '../src/design-system/RegistryTable'
import { KpiFigures } from '../src/design-system/KpiCard'

afterEach(cleanup)

describe('load errors are not empty lists', () => {
  it('RegistryTable shows the error and retries, never the empty state', () => {
    const retry = vi.fn()
    render(<LanguageProvider><RegistryTable rows={[]} columns={[{ key: 'a', label: 'A' }]} empty emptyTitle="Δεν υπάρχουν εγγραφές" error onRetry={retry} /></LanguageProvider>)
    expect(screen.getByRole('alert')).toHaveTextContent('Δεν φορτώθηκε η λίστα')
    expect(screen.queryByText('Δεν υπάρχουν εγγραφές')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Ξαναδοκιμάστε/ }))
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('keeps showing the rows it has and the empty state when nothing failed', () => {
    render(<LanguageProvider><RegistryTable rows={[{ id: 1 }]} columns={[{ key: 'a', label: 'A' }]} renderRow={() => <td>riga</td>} error onRetry={() => {}} /></LanguageProvider>)
    expect(screen.getByText('riga')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('KpiFigures shows «Δεν φορτώθηκε» on every card instead of «—»', () => {
    render(<LanguageProvider><KpiFigures label="Test" error figures={[{ key: 'a', value: null, label: 'Α' }, { key: 'b', value: 0, label: 'Β' }]} /></LanguageProvider>)
    expect(screen.getAllByText('Δεν φορτώθηκε')).toHaveLength(2)
    expect(screen.queryByText('—')).toBeNull()
  })
})
