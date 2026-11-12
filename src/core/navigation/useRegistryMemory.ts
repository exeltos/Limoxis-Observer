import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type SyntheticEvent } from 'react'
import { useLocation, type NavigateFunction, type NavigateOptions } from 'react-router-dom'
import { readSessionJson, readSessionValue, removeSessionValue, writeSessionJson, writeSessionValue } from '../storage/browserStorage'

export const registryStorageKey=(registry: string,part: string): string=>`limoxis.registry.${registry}.${part}`

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the filters and searches of any registry
type ViewState = Record<string, any>

export function useRegistryMemory(registry: string){
  const location=useLocation()
  const scrollRef=useRef<HTMLElement | null>(null)
  const [highlightId,setHighlightId]=useState(()=>readSessionValue(registryStorageKey(registry,'selected'),'')||'')

  useEffect(()=>{
    const top=Number(readSessionValue(registryStorageKey(registry,'scroll'),0))
    const frame=requestAnimationFrame(()=>{
      if(scrollRef.current) scrollRef.current.scrollTop=top
      const id=readSessionValue(registryStorageKey(registry,'selected'),'')||''
      setHighlightId(id)
      if(id){
        const row=scrollRef.current?.querySelector(`[data-record-id="${CSS.escape(id)}"]`)
        row?.scrollIntoView({block:'nearest'})
      }
    })
    return ()=>cancelAnimationFrame(frame)
  },[registry])

  const openRecord=useCallback((navigate: NavigateFunction,path: string,id: string,orderedIds: string[]=[],options: NavigateOptions & { returnState?: object | null }={})=>{
    const {returnState,...navigateOptions}=options
    writeSessionValue(registryStorageKey(registry,'selected'),id)
    writeSessionValue(registryStorageKey(registry,'scroll'),scrollRef.current?.scrollTop||0)
    if(Array.isArray(orderedIds)&&orderedIds.length)writeSessionJson(registryStorageKey(registry,'sequence'),orderedIds)
    setHighlightId(id)
    navigate(path,{
      ...navigateOptions,
      state:{
        ...((navigateOptions.state as object)||{}),
        limoxisFrom:{
          pathname:location.pathname,
          search:location.search,
          hash:location.hash,
          state:{...(location.state||{}),...(returnState||{})},
          registry,
        }
      }
    })
  },[registry,location.pathname,location.search,location.hash,location.state])

  const rowProps=useCallback((id: string,onOpen?: (event: SyntheticEvent) => void)=>({
    'data-record-id':id,
    className:`registry-row-clickable ${highlightId===id?'registry-row-returned':''}`.trim(),
    tabIndex:0,
    ...(onOpen?{
      onClick:onOpen,
      onKeyDown:(e: KeyboardEvent)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onOpen(e)}},
    }:null),
  }),[highlightId])

  const saveViewState=useCallback((state: ViewState | null | undefined)=>{
    writeSessionJson(registryStorageKey(registry,'view'),state||{})
  },[registry])
  const loadViewState=useCallback((fallback: ViewState={}): ViewState=>{
    const stored=readSessionJson(registryStorageKey(registry,'view'),{})
    return stored&&typeof stored==='object'&&!Array.isArray(stored)?{...fallback,...stored}:fallback
  },[registry])
  return useMemo(()=>({scrollRef,highlightId,openRecord,rowProps,saveViewState,loadViewState}),[highlightId,openRecord,rowProps,saveViewState,loadViewState])
}

export function readRegistryViewState(registry: string): ViewState | null{
  return readSessionJson(registryStorageKey(registry,'view'),null)
}

export function writeRegistryViewState(registry: string,state: ViewState | null | undefined){
  writeSessionJson(registryStorageKey(registry,'view'),state||{})
}

// Opening a section from the menu starts it clean: the searches and filters kept
// for the way back from a record are forgotten (storage may be unavailable).
export function forgetRegistryViewStates(){
  try{
    const keys: string[]=[]
    for(let index=0;index<window.sessionStorage.length;index+=1){const key=window.sessionStorage.key(index);if(key?.startsWith('limoxis.registry.')&&key.endsWith('.view'))keys.push(key)}
    keys.forEach(key=>removeSessionValue(key))
  }catch{/* nothing was kept */}
}
