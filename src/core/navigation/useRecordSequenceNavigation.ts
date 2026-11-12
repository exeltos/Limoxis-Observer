import { useMemo } from 'react'
import { useLocation,useNavigate } from 'react-router-dom'
import { readSessionJson, writeSessionValue } from '../storage/browserStorage'
import { registryStorageKey } from './useRegistryMemory'

export function useRecordSequenceNavigation({registry,currentId,pathForId}){
 const navigate=useNavigate()
 const location=useLocation()
 const ids=useMemo(()=>{
  const parsed=readSessionJson(registryStorageKey(registry,'sequence'),[])
  return Array.isArray(parsed)?parsed:[]
 // eslint-disable-next-line react-hooks/exhaustive-deps -- 'currentId' forces re-read from sessionStorage when navigating to a different record (the stored sequence may have changed since this component last read it); not used directly in the body.
 },[registry,currentId])
 const index=ids.indexOf(currentId)
 const previousId=index>0?ids[index-1]:null
 const nextId=index>=0&&index<ids.length-1?ids[index+1]:null
 function move(id){
  if(!id)return
  writeSessionValue(registryStorageKey(registry,'selected'),id)
  navigate(pathForId(id),{replace:true,state:location.state})
 }
 return {
  position:index>=0?index+1:null,total:ids.length,
  hasPrevious:Boolean(previousId),hasNext:Boolean(nextId),
  previous:()=>move(previousId),next:()=>move(nextId),
 }
}
