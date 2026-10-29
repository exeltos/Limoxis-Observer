import { useCallback, useMemo, useRef, useState } from 'react'

const collator = new Intl.Collator(['el', 'en'], { numeric: true, sensitivity: 'base' })

// Sorting for a registry whose rows are paged by the caller: sort the full list first, then slice the page.
// accessors maps a column key to a function returning the value to compare (ISO dates compare as text);
// empty values always go last. Click cycles ascending → descending.
export function useTableSort(rows, accessors, initial = { key: null, dir: 'asc' }) {
  const [sort, setSort] = useState(initial)
  const accessorsRef = useRef(accessors)
  accessorsRef.current = accessors
  const onSort = useCallback(key => setSort(current => current.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }), [])
  const sorted = useMemo(() => {
    const read = accessorsRef.current?.[sort.key]
    if (!read) return rows
    const factor = sort.dir === 'desc' ? -1 : 1
    const empty = value => value == null || value === ''
    return rows.map((row, index) => ({ row, index, value: read(row) })).sort((a, b) => {
      if (empty(a.value) || empty(b.value)) return empty(a.value) && empty(b.value) ? a.index - b.index : empty(a.value) ? 1 : -1
      const result = typeof a.value === 'number' && typeof b.value === 'number' ? a.value - b.value : collator.compare(String(a.value), String(b.value))
      return result ? result * factor : a.index - b.index
    }).map(item => item.row)
  }, [rows, sort])
  return { sorted, sort, onSort }
}
