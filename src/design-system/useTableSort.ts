import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const collator = new Intl.Collator(['el', 'en'], { numeric: true, sensitivity: 'base' })
const isEmpty = (value: unknown) => value == null || value === ''

// Rows ordered by a value reader: ISO dates compare as text, empty values always go last, ties keep their order.
export type SortDir = 'asc' | 'desc'
export interface SortState { key: string | null; dir: SortDir }

export function sortRowsBy<T>(rows: T[], read: (row: T) => unknown, dir: SortDir | string = 'asc'): T[] {
  const factor = dir === 'desc' ? -1 : 1
  return rows.map((row, index) => ({ row, index, value: read(row) })).sort((a, b) => {
    if (isEmpty(a.value) || isEmpty(b.value)) return isEmpty(a.value) && isEmpty(b.value) ? a.index - b.index : isEmpty(a.value) ? 1 : -1
    const result = typeof a.value === 'number' && typeof b.value === 'number' ? a.value - b.value : collator.compare(String(a.value), String(b.value))
    return result ? result * factor : a.index - b.index
  }).map(item => item.row)
}

// Sorting for a registry whose rows are paged by the caller: sort the full list first, then slice the page.
// accessors maps a column key to a function returning the value to compare. Click cycles ascending → descending.
// resetKey: when it changes (another tab of the same screen) the sort goes back to `initial`.
export function useTableSort<T>(rows: T[], accessors?: Record<string, (row: T) => unknown> | null, initial: SortState = { key: null, dir: 'asc' }, resetKey: unknown = null) {
  const [sort, setSort] = useState<SortState>(initial)
  const initialRef = useRef(initial)
  initialRef.current = initial
  useEffect(() => { setSort(initialRef.current) }, [resetKey])
  const accessorsRef = useRef(accessors)
  accessorsRef.current = accessors
  const onSort = useCallback((key: string) => setSort(current => current.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }), [])
  const sorted = useMemo(() => {
    const read = sort.key == null ? undefined : accessorsRef.current?.[sort.key]
    return read ? sortRowsBy(rows, read, sort.dir) : rows
  }, [rows, sort])
  return { sorted, sort, onSort }
}
