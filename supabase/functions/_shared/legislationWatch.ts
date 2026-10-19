// The automatic check of the legislation sources: what an RSS feed or a page
// lists, and which of its new items match the source's keywords. Pure
// functions, so the same rules are tested in the app's test suite.

export type WatchItem = { key: string, title: string, url: string, excerpt: string, published: string }

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
export function decodeEntities(text: string) {
  return String(text || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (all, code: string) => {
    if (code[0] === '#') { const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : all }
    return ENTITIES[code.toLowerCase()] ?? all
  })
}
const stripTags = (html: string) => decodeEntities(String(html || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()

// Lower case, without accents, final sigma as sigma: «Λοιμώξεις» and «λοιμωξεις» match.
export const normalize = (text: string) => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ς/g, 'σ')

const tag = (block: string, name: string) => { const m = block.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i')); return m ? m[1] : '' }

export function parseFeed(xml: string): WatchItem[] {
  const blocks = [...String(xml || '').matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].map(m => m[0])
  return blocks.map(block => {
    const atomLink = block.match(/<link\b[^>]*href="([^"]+)"/i)?.[1] || ''
    const url = decodeEntities(stripTags(tag(block, 'link')) || atomLink).trim()
    const title = stripTags(tag(block, 'title'))
    const guid = stripTags(tag(block, 'guid')) || stripTags(tag(block, 'id'))
    return { key: guid || url || title, title, url, excerpt: stripTags(tag(block, 'description') || tag(block, 'summary') || tag(block, 'content')).slice(0, 600), published: stripTags(tag(block, 'pubDate') || tag(block, 'published') || tag(block, 'updated')) }
  }).filter(item => item.title && item.key)
}

// A page's links with a real title (at least 20 characters), on the same site.
export function parsePage(html: string, pageUrl: string): WatchItem[] {
  let base: URL
  try { base = new URL(pageUrl) } catch { return [] }
  const seen = new Set<string>()
  const items: WatchItem[] = []
  for (const m of String(html || '').matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const title = stripTags(m[2])
    if (title.length < 20) continue
    let url: URL
    try { url = new URL(decodeEntities(m[1]), base) } catch { continue }
    if (url.hostname.replace(/^www\./, '') !== base.hostname.replace(/^www\./, '')) continue
    const key = url.href
    if (seen.has(key)) continue
    seen.add(key)
    items.push({ key, title: title.slice(0, 300), url: key, excerpt: '', published: '' })
  }
  return items
}

export function matchedKeywords(item: WatchItem, keywords: string[] = []) {
  const text = normalize(`${item.title} ${item.excerpt}`)
  return keywords.filter(keyword => keyword && text.includes(normalize(keyword)))
}

// What a check found: the items not seen before that match a keyword. The first
// check of a source only learns what is already there, so it reports nothing.
export function newCandidates(items: WatchItem[], seenKeys: string[] = [], keywords: string[] = [], firstCheck = false) {
  const seen = new Set(seenKeys)
  const fresh = items.filter(item => !seen.has(item.key))
  const candidates = firstCheck ? [] : fresh.map(item => ({ ...item, matched: matchedKeywords(item, keywords) })).filter(item => item.matched.length)
  const keys = [...new Set([...items.map(item => item.key), ...seenKeys])].slice(0, 1000)
  return { candidates, keys, fresh: fresh.length }
}
