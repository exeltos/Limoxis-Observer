import { useCallback, useEffect, useRef, useState } from 'react'
import { readLocalValue, writeLocalValue } from '../core/storage/browserStorage'

const PIN_KEY = 'limoxis.sidebar.pinned'
const OPEN_DELAY_MS = 160
const CLOSE_DELAY_MS = 320

function useMedia(query) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && Boolean(window.matchMedia) && window.matchMedia(query).matches)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const list = window.matchMedia(query)
    const sync = () => setMatches(list.matches)
    sync()
    list.addEventListener?.('change', sync)
    return () => list.removeEventListener?.('change', sync)
  }, [query])
  return matches
}

// The sidebar as an icon rail. Tablets (781–1100px) always show the rail (the menu button opens the full menu).
// Wide screens show it too until the pointer or the keyboard focus enters the sidebar, which then opens the full menu
// (after a short delay, so passing by does not open it) and pushes the page; «pin» keeps the full menu open.
export function useSidebarRail() {
  const tablet = useMedia('(min-width:781px) and (max-width:1100px)')
  const wide = useMedia('(min-width:1101px)')
  const [pinned, setPinned] = useState(() => readLocalValue(PIN_KEY) === '1')
  const [open, setOpen] = useState(false)
  const timer = useRef(null)
  const later = (value, delay) => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setOpen(value), delay) }
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const togglePin = useCallback(() => setPinned(current => { const next = !current; writeLocalValue(PIN_KEY, next ? '1' : '0'); return next }), [])
  const handlers = {
    onMouseEnter: () => later(true, OPEN_DELAY_MS),
    onMouseLeave: () => later(false, CLOSE_DELAY_MS),
    onFocus: () => { window.clearTimeout(timer.current); setOpen(true) },
    onBlur: event => { if (!event.currentTarget.contains(event.relatedTarget)) later(false, CLOSE_DELAY_MS) },
  }
  return { rail: tablet || (wide && !pinned && !open), wide, pinned, togglePin, handlers }
}
