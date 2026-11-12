import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase/client'
import { isDemoDataEnvironment } from '../data/dataEnvironment'
import type { Json } from '../supabase/database.types'

// A user's own view choices per hospital (user_view_preferences, own rows only), e.g. the departments someone hides
// from «Controls». They follow the account on every computer; the demo keeps them in the browser.
const localKey = (organizationId: string, key: string) => `lo-view:${organizationId}:${key}`

export async function loadViewPreference(organizationId: string | null | undefined, userId: string | null | undefined, key: string): Promise<unknown> {
  if (!organizationId || !key) return null
  if (!supabase || !userId || isDemoDataEnvironment()) {
    try { const raw = window.localStorage.getItem(localKey(organizationId, key)); return raw ? JSON.parse(raw) : null } catch { return null }
  }
  const { data, error } = await supabase.from('user_view_preferences').select('value').eq('user_id', userId).eq('organization_id', organizationId).eq('view_key', key).maybeSingle()
  if (error) throw error
  return data?.value ?? null
}

export async function saveViewPreference(organizationId: string | null | undefined, userId: string | null | undefined, key: string, value: unknown): Promise<void> {
  if (!organizationId || !key) return
  if (!supabase || !userId || isDemoDataEnvironment()) {
    try { window.localStorage.setItem(localKey(organizationId, key), JSON.stringify(value)) } catch { /* the choice lasts this visit */ }
    return
  }
  const { error } = await supabase.from('user_view_preferences').upsert({ user_id: userId, organization_id: organizationId, view_key: key, value: value as Json, updated_at: new Date().toISOString() }, { onConflict: 'user_id,organization_id,view_key' })
  if (error) throw error
}

// [value, setValue]: read once per hospital and user, saved on every change (a failed save keeps the choice on screen).
export function useViewPreference<T>(organizationId: string | null | undefined, userId: string | null | undefined, key: string, fallback: T): [T, (value: T) => void] {
  const [state, setState] = useState<{ id: string, value: T }>({ id: '', value: fallback })
  const id = `${organizationId || ''}|${userId || ''}|${key}`
  useEffect(() => {
    let active = true
    loadViewPreference(organizationId, userId, key)
      .then((value) => { if (active) setState({ id, value: (value ?? fallback) as T }) })
      .catch(() => { if (active) setState({ id, value: fallback }) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])
  const set = useCallback((value: T) => {
    setState({ id, value })
    saveViewPreference(organizationId, userId, key, value).catch(() => {})
  }, [id, organizationId, userId, key])
  return [state.id === id ? state.value : fallback, set]
}
