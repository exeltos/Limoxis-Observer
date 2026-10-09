import { lazy } from 'react'
import { readSessionValue, writeSessionValue } from '../storage/browserStorage'

// After a new version is published, a tab that is still open asks for page files
// that no longer exist. Reload once to pick up the new version instead of showing
// the error screen. A second failure within 30 seconds is a real outage: show it.
const RELOAD_KEY = 'limoxis-chunk-reload'
const RELOAD_GUARD_MS = 30_000

export const isChunkLoadError = error =>
  /dynamically imported module|Importing a module script failed|error loading dynamically|Failed to fetch|ChunkLoadError|text\/html/i.test(String(error?.message || error))

export function reloadForNewVersion() {
  const last = Number(readSessionValue(RELOAD_KEY) || 0)
  if (Date.now() - last < RELOAD_GUARD_MS) return false
  // Without a stored guard a reload could repeat forever: show the error instead.
  if (!writeSessionValue(RELOAD_KEY, Date.now())) return false
  globalThis.location?.reload?.()
  return true
}

export function installChunkRecovery() {
  globalThis.addEventListener?.('vite:preloadError', event => {
    if (reloadForNewVersion()) event.preventDefault()
  })
}

// React.lazy for a named export, reloading once when the file is gone after a release.
export function lazyPage(loader, name = 'default') {
  return lazy(() => loader().then(module => ({ default: module[name] })).catch(error => {
    if (isChunkLoadError(error) && reloadForNewVersion()) return new Promise(() => {})
    throw error
  }))
}
