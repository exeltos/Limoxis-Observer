// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTableSort } from '../src/design-system/useTableSort'

const rows = [{ n: 'Β', d: '2025-02-01' }, { n: 'Α', d: '2026-01-01' }, { n: 'Γ', d: null }, { n: 'Δ', d: '2024-05-05' }]
const accessors = { n: r => r.n, d: r => r.d }

describe('useTableSort', () => {
  it('sorts by the initial key, empty values last', () => {
    const { result } = renderHook(() => useTableSort(rows, accessors, { key: 'd', dir: 'desc' }))
    expect(result.current.sorted.map(r => r.n)).toEqual(['Α', 'Β', 'Δ', 'Γ'])
  })
  it('toggles ascending then descending on the same column', () => {
    const { result } = renderHook(() => useTableSort(rows, accessors))
    act(() => result.current.onSort('n'))
    expect(result.current.sorted.map(r => r.n)).toEqual(['Α', 'Β', 'Γ', 'Δ'])
    act(() => result.current.onSort('n'))
    expect(result.current.sorted.map(r => r.n)).toEqual(['Δ', 'Γ', 'Β', 'Α'])
  })
})
