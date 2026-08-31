import { createClient } from '@supabase/supabase-js'
import { appConfig, hasSupabaseConfig } from '../config/env'

export const supabase = hasSupabaseConfig
  ? createClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null


export async function invokeAuthenticatedFunction(name, body) {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  let session = sessionData?.session || null
  if (!session?.access_token) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError) throw refreshError
    session = refreshed?.session || null
  }
  if (!session?.access_token) throw new Error('AUTH_SESSION_MISSING')
  const { data, error } = await supabase.functions.invoke(name, {
    body,
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (error) {
    let message = error.message || 'EDGE_FUNCTION_ERROR'
    try {
      const context = error.context
      if (context && typeof context.json === 'function') {
        const payload = await context.json()
        if (payload?.error) message = payload.error
      }
    } catch {}
    throw new Error(message)
  }
  if (data?.error) throw new Error(data.error)
  return data
}
