import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { appConfig, hasSupabaseConfig } from '../config/env'
import { supabase } from '../supabase/client'
import { signInWithPassword, signOut as remoteSignOut } from './authService'
import { ROLES } from '../permissions/roles'

const AuthContext = createContext(null)
const DEMO_USER = Object.freeze({
  id: 'demo-user',
  email: 'demo@limoxis-observer.local',
  fullName: 'Demo Administrator',
  role: ROLES.DEMO,
  isDemo: true,
})

export function AuthProvider({ children }) {
  const helpPreviewMode=typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('helpPreview')==='1'&&window.self!==window.top
  const [session, setSession] = useState(()=>helpPreviewMode?{access_token:'help-preview',user:DEMO_USER}:null)
  const [profile, setProfile] = useState(()=>helpPreviewMode?DEMO_USER:null)
  const [loading, setLoading] = useState(helpPreviewMode?false:hasSupabaseConfig)

  const loadProfile = useCallback(async (user) => {
    if (!supabase || !user) return null
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, username, contact_email, phone, job_title, is_platform_owner')
      .eq('id', user.id)
      .maybeSingle()
    if (error) throw error
    return data
      ? { id: data.id, email: user.email, fullName: data.full_name, username: data.username, contactEmail: data.contact_email, phone: data.phone, jobTitle: data.job_title, isPlatformOwner: data.is_platform_owner }
      : { id: user.id, email: user.email, fullName: user.email, isPlatformOwner: false }
  }, [])

  useEffect(() => {
    if (helpPreviewMode) return undefined
    if (!supabase) {
      setLoading(false)
      return undefined
    }

    let mounted = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session)
      if (data.session?.user) {
        try { setProfile(await loadProfile(data.session.user)) } catch { setProfile(null) }
      }
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession?.user) {
        setProfile(null)
        return
      }
      loadProfile(nextSession.user).then(setProfile).catch(() => setProfile(null))
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [loadProfile, helpPreviewMode])

  const login = useCallback(async (email, password) => signInWithPassword(email, password), [])
  const loginDemo = useCallback(() => {
    if (!appConfig.allowDemo) throw new Error('DEMO_DISABLED')
    setSession({ access_token: 'demo', user: DEMO_USER })
    setProfile(DEMO_USER)
  }, [])
  const logout = useCallback(async () => {
    if (profile?.isDemo) {
      setSession(null)
      setProfile(null)
      return
    }
    await remoteSignOut()
  }, [profile])

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    profile,
    loading,
    isAuthenticated: Boolean(session?.user),
    isDemoSession: Boolean(profile?.isDemo),
    hasSupabaseConfig,
    allowDemo: appConfig.allowDemo,
    login,
    loginDemo,
    logout,
  }), [session, profile, loading, login, loginDemo, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
