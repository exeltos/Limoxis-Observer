import { useEffect, useState, useSyncExternalStore } from 'react'

// Loading look of every screen (owner, 8/11/2026): while anything on the screen is still loading, the screen stays as it
// is, frozen and faded, with one round spinner over it; when the last part has loaded everything shows at once, never
// piece by piece. Each loading placeholder (LoadingSkeleton.jsx) marks itself here while it is on the screen.
let count = 0
const listeners = new Set()
const emit = () => { for (const listener of listeners) listener() }
const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener) }

export function useLoadingMark(active = true) {
  useEffect(() => {
    if (!active) return undefined
    count += 1
    emit()
    return () => { count -= 1; emit() }
  }, [active])
}

// True while something is loading. A load that never ends does not freeze the screen for good: after `limit` ms the
// spinner goes and the screen shows what it has.
export function useLoadingActive(limit = 20000) {
  const loading = useSyncExternalStore(subscribe, () => count > 0, () => false)
  const [expired, setExpired] = useState(false)
  useEffect(() => {
    if (!loading) { setExpired(false); return undefined }
    const timer = setTimeout(() => setExpired(true), limit)
    return () => clearTimeout(timer)
  }, [loading, limit])
  return loading && !expired
}
