import { useEffect, useRef, useState } from 'react'

// How often the bell and the home tiles read their counts again. They used to
// follow the one-minute clock: about thirty requests a minute for every open
// tab, enough to slow the database for every screen.
export const DATA_REFRESH_MS = 5 * 60 * 1000

const pageVisible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden'

// A counter that moves on every `intervalMs` while the page is in view, and
// when a page left in the background comes back after at least that long.
// A hidden tab reads nothing.
export function useDataRefreshTick(intervalMs = DATA_REFRESH_MS) {
  const [tick, setTick] = useState(0)
  const last = useRef(Date.now())
  useEffect(() => {
    const bump = () => { last.current = Date.now(); setTick(value => value + 1) }
    const timer = setInterval(() => { if (pageVisible()) bump() }, intervalMs)
    const onVisible = () => { if (pageVisible() && Date.now() - last.current >= intervalMs) bump() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [intervalMs])
  return tick
}
