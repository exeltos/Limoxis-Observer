// Reads that filter on a list of ids (`column=in.(…)`) put every id in the
// request URL. Past a few hundred uuids the URL is longer than the gateway
// accepts and the request fails with HTTP 400, so such reads go out in chunks.
// A single response is also capped (PostgREST max rows), so each chunk and each
// organization-wide list is read page by page until a short page comes back.

export const IN_CHUNK_SIZE = 150
export const PAGE_SIZE = 1000
const CONCURRENCY = 6

export function chunkValues(values, size = IN_CHUNK_SIZE) {
  const unique = [...new Set((values || []).filter(value => value !== null && value !== undefined && value !== ''))]
  const chunks = []
  for (let index = 0; index < unique.length; index += size) chunks.push(unique.slice(index, index + size))
  return chunks
}

// build() returns a fresh query each call; it is read with .range() pages when
// the query supports it. Resolves to every row, or throws the first error.
export async function selectAllPages(build, { pageSize = PAGE_SIZE } = {}) {
  const first = build()
  if (typeof first?.range !== 'function') {
    const { data, error } = await first
    if (error) throw error
    return data || []
  }
  const rows = []
  for (let from = 0, query = first; ; from += pageSize, query = build()) {
    const { data, error } = await query.range(from, from + pageSize - 1)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < pageSize) return rows
  }
}

// Rows grouped by the value of `column`, so a lookup per record stays cheap.
export function groupByColumn(rows, column) {
  const groups = new Map()
  for (const row of rows || []) {
    const key = row?.[column]
    const group = groups.get(key)
    if (group) group.push(row)
    else groups.set(key, [row])
  }
  return groups
}

// Postgres order semantics: nulls come last ascending, first descending,
// unless nullsFirst says otherwise.
export function byColumn(column, { ascending = true, nullsFirst = !ascending } = {}) {
  return (left, right) => {
    const a = left?.[column] ?? null
    const b = right?.[column] ?? null
    if (a === b) return 0
    if (a === null) return nullsFirst ? -1 : 1
    if (b === null) return nullsFirst ? 1 : -1
    return (a < b ? -1 : 1) * (ascending ? 1 : -1)
  }
}

// Past this many chunks, a read that offers `whole` reads the whole list instead.
export const WHOLE_LIST_CHUNKS = 3

// build(chunk) returns a fresh query already filtered with .in(column, chunk).
// The chunks run a few at a time; the rows are concatenated and, when `order`
// is given, sorted again across chunks. Never throws: returns { data, error }
// so it can stand in for a single Supabase query.
// With many ids, `whole` (a fresh query for the organization-wide list, in the
// same order) and `column` read every row in a few pages and keep the rows
// whose `column` is one of the values: the same rows, in far fewer requests.
export async function selectInChunks(values, build, { size = IN_CHUNK_SIZE, pageSize = PAGE_SIZE, order, whole, column } = {}) {
  const chunks = chunkValues(values, size)
  if (whole && column && chunks.length > WHOLE_LIST_CHUNKS) {
    try {
      const wanted = new Set(chunks.flat())
      const rows = await selectAllPages(whole, { pageSize })
      return { data: rows.filter(row => wanted.has(row?.[column])), error: null }
    } catch (error) {
      return { data: null, error }
    }
  }
  const parts = new Array(chunks.length)
  try {
    let next = 0
    const worker = async () => {
      while (next < chunks.length) {
        const index = next++
        parts[index] = await selectAllPages(() => build(chunks[index]), { pageSize })
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, worker))
  } catch (error) {
    return { data: null, error }
  }
  const data = parts.flat()
  if (order && chunks.length > 1) {
    const comparators = (Array.isArray(order) ? order : [order]).map(item => (typeof item === 'function' ? item : byColumn(...item)))
    data.sort((left, right) => {
      for (const compare of comparators) {
        const result = compare(left, right)
        if (result) return result
      }
      return 0
    })
  }
  return { data, error: null }
}
