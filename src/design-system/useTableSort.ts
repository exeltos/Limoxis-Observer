import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const collator = new Intl.Collator(['el', 'en'], { numeric: true, sensitivity: 'base' })
const isEmpty = value => value == null || value === ''

// Rows ordered by a value reader: ISO dates compare as text, empty values always go last, ties keep their order.
export function sortRowsBy(rows, read, dir = 'asc') {
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
export function useTableSort(rows, accessors, initial = { key: null, dir: 'asc' }, resetKey = null) {
  const [sort, setSort] = useState(initial)
  const initialRef = useRef(initial)
  initialRef.current = initial
  useEffect(() => { setSort(initialRef.current) }, [resetKey])
  const accessorsRef = useRef(accessors)
  accessorsRef.current = accessors
  const onSort = useCallback(key => setSort(current => current.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }), [])
  const sorted = useMemo(() => {
    const read = accessorsRef.current?.[sort.key]
    return read ? sortRowsBy(rows, read, sort.dir) : rows
  }, [rows, sort])
  return { sorted, sort, onSort }
}
