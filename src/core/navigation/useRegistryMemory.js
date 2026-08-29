import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

const keyFor=(registry,part)=>`limoxis.registry.${registry}.${part}`

export function useRegistryMemory(registry){
  const location=useLocation()
  const scrollRef=useRef(null)
  const [highlightId,setHighlightId]=useState(()=>sessionStorage.getItem(keyFor(registry,'selected'))||'')

  useEffect(()=>{
    const top=Number(sessionStorage.getItem(keyFor(registry,'scroll'))||0)
    const frame=requestAnimationFrame(()=>{
      if(scrollRef.current) scrollRef.current.scrollTop=top
      const id=sessionStorage.getItem(keyFor(registry,'selected'))||''
      setHighlightId(id)
      if(id){
        const row=scrollRef.current?.querySelector(`[data-record-id="${CSS.escape(id)}"]`)
        row?.scrollIntoView({block:'nearest'})
      }
    })
    return ()=>cancelAnimationFrame(frame)
  },[registry])

  function openRecord(navigate,path,id,orderedIds=[]){
    sessionStorage.setItem(keyFor(registry,'selected'),id)
    sessionStorage.setItem(keyFor(registry,'scroll'),String(scrollRef.current?.scrollTop||0))
    if(Array.isArray(orderedIds)&&orderedIds.length)sessionStorage.setItem(keyFor(registry,'sequence'),JSON.stringify(orderedIds))
    setHighlightId(id)
    navigate(path,{state:{limoxisFrom:{pathname:location.pathname,search:location.search,hash:location.hash,state:location.state??null,registry}}})
  }

  function rowProps(id){
    return {
      'data-record-id':id,
      className:`registry-row-clickable ${highlightId===id?'registry-row-returned':''}`.trim(),
      tabIndex:0,
    }
  }

  function saveViewState(state){
    sessionStorage.setItem(keyFor(registry,'view'),JSON.stringify(state||{}))
  }
  function loadViewState(fallback={}){
    try{return {...fallback,...JSON.parse(sessionStorage.getItem(keyFor(registry,'view'))||'{}')}}catch{return fallback}
  }
  return {scrollRef,highlightId,openRecord,rowProps,saveViewState,loadViewState}
}

export function readRegistryViewState(registry){
  if(typeof window==='undefined')return null
  try{return JSON.parse(sessionStorage.getItem(`${registry}:view`)||'null')}catch{return null}
}
