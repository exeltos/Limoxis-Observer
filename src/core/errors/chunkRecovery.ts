import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import { readSessionValue, writeSessionValue } from '../storage/browserStorage'

// After a new version is published, a tab that is still open asks for page files
// that no longer exist. Reload once to pick up the new version instead of showing
// the error screen. A second failure within 30 seconds is a real outage: show it.
const RELOAD_KEY = 'limoxis-chunk-reload'
const RELOAD_GUARD_MS = 30_000

export const isChunkLoadError = (error: unknown): boolean =>
  /dynamically imported module|Importing a module script failed|error loading dynamically|Failed to fetch|ChunkLoadError|text\/html/i.test(String((error as { message?: unknown } | null)?.message || error))

export function reloadForNewVersion(): boolean {
  const last = Number(readSessionValue(RELOAD_KEY) || 0)
  if (Date.now() - last < RELOAD_GUARD_MS) return false
  // Without a stored guard a reload could repeat forever: show the error instead.
  if (!writeSessionValue(RELOAD_KEY, Date.now())) return false
  globalThis.location?.reload?.()
  return true
}

export function installChunkRecovery(): void {
  globalThis.addEventListener?.('vite:preloadError', (event: Event) => {
    if (reloadForNewVersion()) event.preventDefault()
  })
}

// React.lazy for a named export, reloading once when the file is gone after a release.
// `preload()` fetches the page file ahead of time (sidebar hover, idle time); once it
// is in, the page renders in the same frame instead of suspending on a resolved promise.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a page takes any props
type PageModule = Record<string, ComponentType<any>>
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a page takes any props
export type LazyPage = LazyExoticComponent<ComponentType<any>> & { preload: () => Promise<boolean> }

export function lazyPage(loader: () => Promise<PageModule>, name = 'default'): LazyPage {
  let loaded: PageModule | null = null
  let pending: Promise<PageModule> | null = null
  const load = (): Promise<PageModule> => {
    if (!pending) pending = loader().then(module => { loaded = module; return module }, error => { pending = null; throw error })
    return pending
  }
  const Page = lazy(() => {
    // An already loaded file resolves synchronously, so React never shows the fallback for it.
    if (loaded) {
      const page = loaded[name]
      return { then: (resolve: (value: { default: PageModule[string] }) => void) => resolve({ default: page }) } as Promise<{ default: PageModule[string] }>
    }
    return load().then(module => ({ default: module[name] })).catch(error => {
      if (isChunkLoadError(error) && reloadForNewVersion()) return new Promise<never>(() => {})
      throw error
    })
  })
  const page = Page as LazyPage
  page.preload = () => load().then(() => true, () => false)
  return page
}
