import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
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
  const initial=helpPreviewMode
    ? {session:{access_token:'help-preview',user:DEMO_USER},profile:DEMO_USER,loading:false}
    : {session:null,profile:null,loading:hasSupabaseConfig}
  const [authState,setAuthState]=useState(initial)
  const stateRef=useRef(initial)
  const transitionRef=useRef(0)
  const listenerTimerRef=useRef(null)

  useEffect(()=>{stateRef.current=authState},[authState])

  const loadProfile = useCallback(async (user) => {
    if (!supabase || !user) return null
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, username, contact_email, phone, job_title, is_platform_owner, is_demo, demo_entitlement_id')
      .eq('id', user.id)
      .maybeSingle()
    if (error) throw error
    let demoActive=false
    if(data?.is_demo&&data?.demo_entitlement_id){
      const today=new Date().toISOString().slice(0,10)
      const {data:demo}=await supabase.from('platform_demo_entitlements').select('status,valid_from,valid_until').eq('id',data.demo_entitlement_id).maybeSingle()
      demoActive=Boolean(demo?.status==='active'&&demo.valid_from<=today&&demo.valid_until>=today)
    }
    return data
      ? { id: data.id, email: user.email, fullName: data.full_name, username: data.username, contactEmail: data.contact_email, phone: data.phone, jobTitle: data.job_title, isPlatformOwner: data.is_platform_owner, isDemo: demoActive, demoEntitlementId:data.demo_entitlement_id||null }
      : { id: user.id, email: user.email, fullName: user.email, isPlatformOwner: false, isDemo:false }
  }, [])

  const hydrateSession=useCallback(async(nextSession,{force=false}={})=>{
    const transition=++transitionRef.current
    if(!nextSession?.user){
      if(transition===transitionRef.current)setAuthState({session:null,profile:null,loading:false})
      return null
    }
    const current=stateRef.current
    if(!force&&current.session?.access_token===nextSession.access_token&&current.profile?.id===nextSession.user.id){
      if(current.loading)setAuthState({...current,loading:false})
      return current.profile
    }
    try{
      const nextProfile=await loadProfile(nextSession.user)
      if(transition!==transitionRef.current)return nextProfile
      setAuthState({session:nextSession,profile:nextProfile,loading:false})
      return nextProfile
    }catch(error){
      if(transition===transitionRef.current)setAuthState({session:nextSession,profile:null,loading:false})
      throw error
    }
  },[loadProfile])

  useEffect(() => {
    if (helpPreviewMode) return undefined
    if (!supabase) {
      setAuthState({session:null,profile:null,loading:false})
      return undefined
    }

    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      hydrateSession(data.session,{force:true}).catch(()=>{})
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if(!mounted)return
      if(listenerTimerRef.current)clearTimeout(listenerTimerRef.current)
      listenerTimerRef.current=setTimeout(()=>{
        listenerTimerRef.current=null
        if(!mounted)return
        hydrateSession(nextSession).catch(()=>{})
      },0)
    })

    return () => {
      mounted = false
      transitionRef.current+=1
      if(listenerTimerRef.current){clearTimeout(listenerTimerRef.current);listenerTimerRef.current=null}
      listener.subscription.unsubscribe()
    }
  }, [hydrateSession, helpPreviewMode])

  const login = useCallback(async (identifier, password) => {
    const data = await signInWithPassword(identifier, password)
    const nextSession = data?.session ?? data ?? null
    if(nextSession?.user)await hydrateSession(nextSession,{force:true})
    return data
  }, [hydrateSession])
  const loginDemo = useCallback(() => {
    if (!appConfig.allowDemo) throw new Error('DEMO_DISABLED')
    transitionRef.current+=1
    setAuthState({session:{ access_token: 'demo', user: DEMO_USER },profile:DEMO_USER,loading:false})
  }, [])
  const logout = useCallback(async () => {
    if(listenerTimerRef.current){clearTimeout(listenerTimerRef.current);listenerTimerRef.current=null}
    if (authState.profile?.isDemo) {
      transitionRef.current+=1
      setAuthState({session:null,profile:null,loading:false})
      return
    }
    await remoteSignOut()
    await hydrateSession(null)
  }, [authState.profile?.isDemo,hydrateSession])

  const value = useMemo(() => ({
    session:authState.session,
    user: authState.session?.user ?? null,
    profile:authState.profile,
    loading:authState.loading,
    isAuthenticated: Boolean(authState.session?.user),
    isDemoSession: Boolean(authState.profile?.isDemo),
    hasSupabaseConfig,
    allowDemo: appConfig.allowDemo,
    login,
    loginDemo,
    logout,
  }), [authState, login, loginDemo, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
