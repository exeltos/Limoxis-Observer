import { useCallback } from 'react'
import { useLocation, useNavigate, type NavigateOptions, type To } from 'react-router-dom'
import { readSessionJson, writeSessionJson } from '../storage/browserStorage'

const CONTEXT_KEY='limoxis.navigation.context'

// Από πού ήρθε ο χρήστης, για το «Πίσω» μιας εγγραφής.
export interface NavigationOrigin {
  pathname: string
  search?: string
  hash?: string
  state?: unknown
  tab?: string | null
  registry?: string | null
}

export interface ContextualNavigateOptions extends NavigateOptions {
  tab?: string | null
  registry?: string | null
  returnTo?: string
  returnTab?: string | null
}
export function useContextualNavigation(fallback='/'){
  const navigate=useNavigate()
  const location=useLocation()

  const goTo=useCallback((to: To,options: ContextualNavigateOptions={})=>{
    const {tab,registry,returnTo,returnTab,...rest}=options
    const from: NavigationOrigin={
      pathname:returnTo||location.pathname,
      search:returnTo?'':location.search,
      hash:returnTo?'':location.hash,
      state:returnTo?null:(location.state??null),
      tab:returnTab??tab??null,
      registry:registry??null,
    }
    writeSessionJson(CONTEXT_KEY,from)
    navigate(to,{...rest,state:{...((rest.state as object)||{}),limoxisFrom:from}})
  },[location,navigate])

  const goBack=useCallback(()=>{
    const from=(location.state?.limoxisFrom||readSessionJson(CONTEXT_KEY,null)) as NavigationOrigin | null
    if(from?.pathname){
      writeSessionJson(CONTEXT_KEY,null)
      navigate(`${from.pathname}${from.search||''}${from.hash||''}`,{
        replace:true,
        state:{...((from.state as object)||{}),limoxisRestore:{tab:from.tab??null,registry:from.registry??null}}
      })
      return
    }
    if(window.history.length>1){navigate(-1);return}
    navigate(fallback,{replace:true})
  },[fallback,location.state,navigate])

  const restored=(location.state?.limoxisRestore??null) as { tab: string | null, registry: string | null } | null
  return {goTo,goBack,restored}
}
