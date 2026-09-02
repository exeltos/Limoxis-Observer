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
    // Bootstrap identity through a self-only SECURITY DEFINER RPC. This avoids
    // profile-loading failures caused by RLS policy recursion/ordering while
    // still deriving the user exclusively from auth.uid() on the server.
    const { data: rows, error } = await supabase.rpc('current_user_profile_bootstrap')
    if (error) throw error
    const data=Array.isArray(rows)?rows[0]:rows
    let demoActive=false
    if(data?.is_demo&&data?.demo_entitlement_id){
      const today=new Date().toISOString().slice(0,10)
      const {data:demo}=await supabase.from('platform_demo_entitlements').select('status,valid_from,valid_until').eq('id',data.demo_entitlement_id).maybeSingle()
      demoActive=Boolean(demo?.status==='active'&&demo.valid_from<=today&&demo.valid_until>=today)
    }
    return data
      ? { id: data.id, email: user.email, fullName: data.full_name, username: data.username, contactEmail: data.contact_email, phone: data.phone, jobTitle: data.job_title, isPlatformOwner: Boolean(data.is_platform_owner), isDemo: demoActive, demoEntitlementId:data.demo_entitlement_id||null }
      : { id: user.id, email: user.email, fullName: user.email, isPlatformOwner: false, isDemo:false }
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
