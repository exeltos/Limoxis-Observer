import { describe, expect, it, vi } from 'vitest'
import { byColumn, chunkValues, selectAllPages, selectInChunks } from '../src/core/data/inChunks'

const URL_LIMIT = 8000
const uuid = index => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`

// A PostgREST-like query that records the URL it would send and fails like the
// gateway when the URL is too long.
function fakeTable(rows, requests) {
  return () => {
    const state = { column: null, values: [], from: 0, to: Infinity }
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      in(column, values) {
        state.column = column
        state.values = values
        return query
      },
      range(from, to) {
        state.from = from
        state.to = to
        return query
      },
      then(resolve, reject) {
        const url = `/rest/v1/table?select=*&${state.column}=in.(${state.values.join(',')})`
        requests.push(url.length)
        if (url.length > URL_LIMIT) return Promise.resolve({ data: null, error: { status: 400, message: 'URI too long' } }).then(resolve, reject)
        const matched = rows.filter(row => state.values.includes(row[state.column]))
        return Promise.resolve({ data: matched.slice(state.from, state.to + 1), error: null }).then(resolve, reject)
      },
    }
    return query
  }
}

describe('reads filtered on many ids', () => {
  it('splits a 5,000-id read into several requests, each under the URL limit, and returns every row', async () => {
    const ids = Array.from({ length: 5000 }, (_, index) => uuid(index))
    const rows = ids.map((id, index) => ({ sample_id: id, resulted_at: `2026-01-01T00:00:${String(index % 60).padStart(2, '0')}Z` }))
    const requests = []
    const table = fakeTable(rows, requests)
    const single = []
    const unchunked = await fakeTable(rows, single)().select('*').in('sample_id', ids)
    expect(unchunked.error?.status).toBe(400)

    const result = await selectInChunks(ids, chunk => table().select('*').in('sample_id', chunk), { order: [['resulted_at', { ascending: false }]] })
    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(5000)
    expect(requests.length).toBeGreaterThan(1)
    expect(Math.max(...requests)).toBeLessThan(URL_LIMIT)
    expect(result.data.map(row => row.resulted_at)).toEqual([...result.data.map(row => row.resulted_at)].sort().reverse())
  })

  it('makes no request for an empty list and drops duplicates and blanks', async () => {
    const build = vi.fn()
    expect(await selectInChunks([], build)).toEqual({ data: [], error: null })
    expect(build).not.toHaveBeenCalled()
    expect(chunkValues(['a', 'a', null, '', 'b', undefined, 'c'], 2)).toEqual([['a', 'b'], ['c']])
  })

  it('reads every page of a chunk that returns more rows than one response holds', async () => {
    const rows = Array.from({ length: 2500 }, (_, index) => ({ case_id: 'x', n: index }))
    const requests = []
    const table = fakeTable(rows, requests)
    const result = await selectInChunks(['x'], chunk => table().select('*').in('case_id', chunk))
    expect(result.data).toHaveLength(2500)
    expect(requests).toHaveLength(3)
  })

  it('returns the error of a failing chunk instead of throwing', async () => {
    const error = { message: 'boom' }
    const result = await selectInChunks(['a'], () => Promise.resolve({ data: null, error }))
    expect(result).toEqual({ data: null, error })
  })

  it('pages an organization-wide list until a short page', async () => {
    const rows = Array.from({ length: 2001 }, (_, index) => ({ id: index }))
    const ranges = []
    const build = () => ({ range: (from, to) => { ranges.push([from, to]); return Promise.resolve({ data: rows.slice(from, to + 1), error: null }) } })
    expect(await selectAllPages(build)).toHaveLength(2001)
    expect(ranges).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })

  it('orders like Postgres: nulls last ascending, first descending', () => {
    const rows = [{ at: 2 }, { at: null }, { at: 1 }]
    expect([...rows].sort(byColumn('at')).map(row => row.at)).toEqual([1, 2, null])
    expect([...rows].sort(byColumn('at', { ascending: false })).map(row => row.at)).toEqual([null, 2, 1])
    expect([...rows].sort(byColumn('at', { ascending: false, nullsFirst: false })).map(row => row.at)).toEqual([2, 1, null])
  })
})
