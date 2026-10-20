// The «Νέα» tab of the Library: which sources are due for a check, and what is
// kept of what a feed or page lists. Pure functions, so the same rules are
// tested in the app's test suite. The feed and page parsers are the
// legislation watcher's (legislationWatch.ts).
import { matchedKeywords, type WatchItem } from './legislationWatch.ts'

export type LibrarySource = { id: string, kind: 'rss' | 'page', interval_hours?: number | null, last_checked_at?: string | null, active?: boolean | null, keywords?: string[] | null }

// At most this many items are kept from one check, and only title, link, date
// and a short excerpt: the article stays at its source.
export const MAX_ITEMS_PER_CHECK = 20
export const EXCERPT_LIMIT = 300

// A source is due when it was never checked or its interval has passed.
export function dueSources<T extends LibrarySource>(sources: T[], now = Date.now()): T[] {
  return (sources || []).filter(source => {
    if (source.active === false) return false
    if (!source.last_checked_at) return true
    const last = Date.parse(source.last_checked_at)
    if (!Number.isFinite(last)) return true
    const hours = Math.max(1, Number(source.interval_hours || 2))
    // A few minutes' slack, so a check scheduled every 2 hours is not skipped by seconds.
    return now - last >= hours * 3600000 - 5 * 60000
  })
}

const clip = (text: string, limit: number) => {
  const value = String(text || '').replace(/\s+/g, ' ').trim()
  return value.length > limit ? `${value.slice(0, limit - 1).trimEnd()}…` : value
}
const toIso = (value: string) => { const time = Date.parse(value || ''); return Number.isFinite(time) ? new Date(time).toISOString() : null }
const httpUrl = (value: string) => (/^https?:\/\//i.test(String(value || '')) ? String(value).slice(0, 2000) : null)

// The rows written to library_news for one check: the newest items (with a
// title and a key), filtered by the source's keywords when it has any.
export function newsRows(sourceId: string, items: WatchItem[], keywords: string[] = []) {
  const kept = (items || []).filter(item => item.title && item.key && (!keywords.length || matchedKeywords(item, keywords).length))
  return kept.slice(0, MAX_ITEMS_PER_CHECK).map(item => ({
    source_id: sourceId,
    item_key: String(item.key).slice(0, 1000),
    title: clip(item.title, 500),
    url: httpUrl(item.url),
    excerpt: item.excerpt ? clip(item.excerpt, EXCERPT_LIMIT) : null,
    published_at: toIso(item.published),
  }))
}
