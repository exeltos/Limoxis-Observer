import { supabase } from '../supabase/client'

// Every password sign-in (username or e-mail, and the unlock after inactivity) goes through the
// username-login Edge Function: it records each attempt (who, IP, success), locks a name or an IP
// after repeated failures and writes the user's real IP on the new session for the Platform Owner.
export async function signInWithPassword(identifier: string, password: string) {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')
  const value = String(identifier || '').trim()
  const { data, error } = await supabase.functions.invoke('username-login', { body: { username: value, password } })
  const status = (error as { context?: { status?: number } } | null)?.context?.status
  if (status === 429) throw new Error('LOGIN_LOCKED')
  if (status === 401) throw new Error('Invalid credentials')
  if (error || !data?.access_token || !data?.refresh_token) throw new Error(data?.error || error?.message || 'INVALID_CREDENTIALS')
  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token })
  if (sessionError) throw sessionError
  return sessionData
}

// While the app is open: "this session is alive". false = the Platform Owner ended it (or it expired).
export async function touchLoginSession(): Promise<boolean> {
  if (!supabase) return true
  const { data, error } = await supabase.rpc('touch_login_session')
  if (error) return true
  return data !== false
}

export async function signOut(): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
