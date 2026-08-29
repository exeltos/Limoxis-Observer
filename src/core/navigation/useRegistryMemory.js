import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { readSessionJson, readSessionValue, writeSessionJson, writeSessionValue } from '../storage/browserStorage'

const keyFor=(registry,part)=>`limoxis.registry.${registry}.${part}`

export function useRegistryMemory(registry){
  const location=useLocation()
  const scrollRef=useRef(null)
  const [highlightId,setHighlightId]=useState(()=>readSessionValue(keyFor(registry,'selected'),'')||'')

  useEffect(()=>{
    const top=Number(readSessionValue(keyFor(registry,'scroll'),0))
    const frame=requestAnimationFrame(()=>{
      if(scrollRef.current) scrollRef.current.scrollTop=top
      const id=readSessionValue(keyFor(registry,'selected'),'')||''
      setHighlightId(id)
      if(id){
        const row=scrollRef.current?.querySelector(`[data-record-id="${CSS.escape(id)}"]`)
        row?.scrollIntoView({block:'nearest'})
      }
    })
    return ()=>cancelAnimationFrame(frame)
  },[registry])

  function openRecord(navigate,path,id,orderedIds=[]){
    writeSessionValue(keyFor(registry,'selected'),id)
    writeSessionValue(keyFor(registry,'scroll'),scrollRef.current?.scrollTop||0)
    if(Array.isArray(orderedIds)&&orderedIds.length)writeSessionJson(keyFor(registry,'sequence'),orderedIds)
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
    writeSessionJson(keyFor(registry,'view'),state||{})
  }
  function loadViewState(fallback={}){
    const stored=readSessionJson(keyFor(registry,'view'),{})
    return stored&&typeof stored==='object'&&!Array.isArray(stored)?{...fallback,...stored}:fallback
  }
  return {scrollRef,highlightId,openRecord,rowProps,saveViewState,loadViewState}
}

export function readRegistryViewState(registry){
  return readSessionJson(`${registry}:view`,null)
}
