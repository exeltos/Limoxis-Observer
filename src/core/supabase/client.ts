import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { appConfig, hasSupabaseConfig } from '../config/env'
import type { Database } from './database.types'

// Ο client με τους τύπους της βάσης (src/core/supabase/database.types.ts).
export type Cloud = SupabaseClient<Database>

// The Help Center embeds live screens in an iframe on the same origin
// (?helpPreview=1). That iframe must never reuse the signed-in user's stored
// session: it gets an isolated, anonymous, non-persisted client so row-level
// security returns no production data and every screen runs on the demo dataset.
const isHelpPreviewFrame = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('helpPreview') === '1'
  && window.self !== window.top

export const supabase: Cloud | null = hasSupabaseConfig
  ? createClient<Database>(appConfig.supabaseUrl, appConfig.supabaseAnonKey, {
      auth: isHelpPreviewFrame
        ? {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
            storageKey: 'limoxis-help-preview',
          }
        : {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
    })
  : null


// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each edge function answers its own shape
export async function invokeAuthenticatedFunction(name: string, body?: unknown): Promise<any> {
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
    body: body as Record<string, unknown> | undefined,
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
    } catch { /* fall back to error.message below */ }
    throw new Error(message)
  }
  if (data?.error) throw new Error(data.error)
  return data
}
