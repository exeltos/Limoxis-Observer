type StorageKind = 'sessionStorage' | 'localStorage'

function storageFor(kind: StorageKind): Storage | null {
  if (typeof window === 'undefined') return null

  try {
    return window[kind]
  } catch {
    return null
  }
}

export function readSessionValue<F extends string | number | null = null>(key: string, fallback: F = null as F): string | F {
  try {
    return storageFor('sessionStorage')?.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

export function writeSessionValue(key: string, value: unknown): boolean {
  try {
    const storage = storageFor('sessionStorage')
    if (!storage) return false
    storage.setItem(key, String(value))
    return true
  } catch {
    return false
  }
}

export function removeSessionValue(key: string): boolean {
  try {
    storageFor('sessionStorage')?.removeItem(key)
    return true
  } catch {
    return false
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- stored JSON: the caller knows its shape
export function readSessionJson(key: string, fallback: unknown = null): any {
  const raw = readSessionValue(key)
  if (raw == null) return fallback

  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function writeSessionJson(key: string, value: unknown): boolean {
  try {
    return writeSessionValue(key, JSON.stringify(value))
  } catch {
    return false
  }
}

export function readLocalValue<F extends string | number | null = null>(key: string, fallback: F = null as F): string | F {
  try {
    return storageFor('localStorage')?.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

export function writeLocalValue(key: string, value: unknown): boolean {
  try {
    const storage = storageFor('localStorage')
    if (!storage) return false
    storage.setItem(key, String(value))
    return true
  } catch {
    return false
  }
}
