function storageFor(kind) {
  if (typeof window === 'undefined') return null

  try {
    return window[kind]
  } catch {
    return null
  }
}

export function readSessionValue(key, fallback = null) {
  try {
    return storageFor('sessionStorage')?.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

export function writeSessionValue(key, value) {
  try {
    const storage = storageFor('sessionStorage')
    if (!storage) return false
    storage.setItem(key, String(value))
    return true
  } catch {
    return false
  }
}

export function readSessionJson(key, fallback = null) {
  const raw = readSessionValue(key)
  if (raw == null) return fallback

  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function writeSessionJson(key, value) {
  try {
    return writeSessionValue(key, JSON.stringify(value))
  } catch {
    return false
  }
}
