import { useCallback,useEffect,useState } from 'react'
import { loadProtocolSuggestionsAsync } from './protocolReviewService'
import type { ProtocolSuggestion } from './protocolReviewModel'

// The organisation's open and postponed protocol suggestions. A failed load
// leaves the list empty: the documents screens work without it.
export function useProtocolSuggestions(organizationId: string|null|undefined,{enabled=true}={}){
 const [data,setData]=useState<ProtocolSuggestion[]>([])
 const [loading,setLoading]=useState(Boolean(enabled))
 const reload=useCallback(async(): Promise<ProtocolSuggestion[]>=>{
  if(!enabled){setData([]);setLoading(false);return []}
  setLoading(true)
  try{const rows=await loadProtocolSuggestionsAsync(organizationId);setData(rows);return rows}
  catch{setData([]);return []}
  finally{setLoading(false)}
 },[organizationId,enabled])
 useEffect(()=>{void reload()},[reload])
 return {data,loading,reload}
}
