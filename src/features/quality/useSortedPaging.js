import { useEffect, useState } from 'react'
import { useTableSort } from '../../design-system/useTableSort'

// A list the page cuts itself: the arrows in the headers sort the whole filtered list (accessors: column key → value),
// then the page is cut. `sorted` is the whole list in the shown order (the next / previous of an opened record follows it).
export function useSortedPaging(items, resetKey, accessors = {}, initial = { key: null, dir: 'asc' }) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const { sorted, sort, onSort } = useTableSort(items, accessors, initial)
  useEffect(() => setPage(1), [resetKey, pageSize, sort])
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize)), safePage = Math.min(page, totalPages)
  return { rows: sorted.slice((safePage - 1) * pageSize, safePage * pageSize), sorted, sort, onSort, props: { page: safePage, totalPages, totalItems: sorted.length, pageSize, onPageChange: setPage, onPageSizeChange: setPageSize } }
}

// The columns with a reader get the arrows.
export const withSort = (columns, accessors) => columns.map(column => (column.label && accessors[column.key] ? { ...column, sortable: true } : column))
