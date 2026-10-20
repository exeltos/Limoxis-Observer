// Page files of the main screens, fetched before they are needed: when the
// pointer rests on (or the keyboard focuses) a sidebar entry, and in idle time
// after the shell has painted. Without this, the first visit to a screen waits
// for its file while the previous screen stays on view.
const preloads = new Map()

const keyOf = path => `/${String(path || '/').split(/[?#]/)[0].split('/').filter(Boolean)[0] || ''}`

// App.jsx registers, per first path segment ('/patients'), the lazy pages it opens.
export function registerRoutePreload(path, ...pages) {
  const key = keyOf(path)
  preloads.set(key, [...(preloads.get(key) || []), ...pages])
}

export function preloadRoute(path) {
  const pages = preloads.get(keyOf(path)) || []
  return Promise.all(pages.map(page => (page?.preload ? page.preload() : Promise.resolve(false))))
}

// One screen at a time, only while the browser is idle, so it never competes with the open page.
export function preloadRoutesWhenIdle(paths = []) {
  const queue = [...new Set(paths.map(keyOf))]
  let cancelled = false
  const idle = typeof window !== 'undefined' && window.requestIdleCallback
    ? callback => window.requestIdleCallback(callback, { timeout: 4000 })
    : callback => setTimeout(callback, 300)
  const next = () => {
    if (cancelled || !queue.length) return
    idle(() => { if (!cancelled) preloadRoute(queue.shift()).finally(next) })
  }
  const start = setTimeout(next, 1500)
  return () => { cancelled = true; clearTimeout(start) }
}
