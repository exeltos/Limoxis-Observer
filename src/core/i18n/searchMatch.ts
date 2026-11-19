// Search that finds a row by anything it shows (owner, 19/11/2026: «οι αναζητήσεις να ψάχνουν τα πάντα»), without
// minding accents or capitals: every word typed must appear somewhere in the row's texts.
export const foldSearch = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function matchesSearch(query: unknown, parts: unknown[]) {
  const words = foldSearch(query).split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const text = foldSearch(parts.filter(part => part !== null && part !== undefined && part !== '').join(' '))
  return words.every(word => text.includes(word))
}
