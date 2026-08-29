import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const CONTEXT_KEY='limoxis.navigation.context'
export function useContextualNavigation(fallback='/'){
  const navigate=useNavigate()
  const location=useLocation()

  const goTo=useCallback((to,options={})=>{
    const {tab,registry,...rest}=options
    const from={
      pathname:location.pathname,
      search:location.search,
      hash:location.hash,
      state:location.state??null,
      tab:tab??null,
      registry:registry??null,
    }
    sessionStorage.setItem(CONTEXT_KEY,JSON.stringify(from))
    navigate(to,{...rest,state:{...(rest.state||{}),limoxisFrom:from}})
  },[location,navigate])

  const goBack=useCallback(()=>{
    const from=location.state?.limoxisFrom
    if(from?.pathname){
      navigate(`${from.pathname}${from.search||''}${from.hash||''}`,{
        replace:true,
        state:{...(from.state||{}),limoxisRestore:{tab:from.tab??null,registry:from.registry??null}}
      })
      return
    }
    if(window.history.length>1){navigate(-1);return}
    navigate(fallback,{replace:true})
  },[fallback,location.state,navigate])

  const restored=location.state?.limoxisRestore??null
  return {goTo,goBack,restored}
}
