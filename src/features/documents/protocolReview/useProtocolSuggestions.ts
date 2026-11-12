import { useCallback,useEffect,useState } from 'react'
import { loadProtocolSuggestionsAsync } from './protocolReviewService'

// The organisation's open and postponed protocol suggestions. A failed load
// leaves the list empty: the documents screens work without it.
export function useProtocolSuggestions(organizationId,{enabled=true}={}){
 const [data,setData]=useState([])
 const [loading,setLoading]=useState(Boolean(enabled))
 const reload=useCallback(async()=>{
  if(!enabled){setData([]);setLoading(false);return []}
  setLoading(true)
  try{const rows=await loadProtocolSuggestionsAsync(organizationId);setData(rows);return rows}
  catch{setData([]);return []}
  finally{setLoading(false)}
 },[organizationId,enabled])
 useEffect(()=>{void reload()},[reload])
 return {data,loading,reload}
}
