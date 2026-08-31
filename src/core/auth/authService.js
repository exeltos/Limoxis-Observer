import { supabase } from '../supabase/client'

export async function signInWithPassword(identifier, password) {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')
  const value = String(identifier || '').trim()
  if (value.includes('@')) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: value, password })
    if (error) throw error
    return data
  }
  const { data, error } = await supabase.functions.invoke('username-login', { body: { username: value, password } })
  if (error || !data?.access_token || !data?.refresh_token) throw new Error(data?.error || error?.message || 'INVALID_CREDENTIALS')
  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token })
  if (sessionError) throw sessionError
  return sessionData
}

export async function signOut() {
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function requestPasswordReset(email) {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')
  const redirectTo = `${window.location.origin}/reset-password`
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  if (error) throw error
}
