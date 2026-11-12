import { useCallback,useEffect,useState } from 'react'
import { canUseRecycleBin,listRecycleBin,onRecycleBinChange,type BinEntry } from '../../core/recycleBin/recycleBinService'

// The recycle-bin entries the role may see, kept current as records are deleted or restored.
export function useRecycleBin(organizationId: string|null|undefined,role: string|null|undefined){
  const allowed=canUseRecycleBin(role)
  const [entries,setEntries]=useState<BinEntry[]>([])
  const [loading,setLoading]=useState(allowed)
  const [error,setError]=useState<unknown>(null)
  const reload=useCallback(async()=>{
    if(!allowed){setEntries([]);setLoading(false);return}
    try{setError(null);setEntries(await listRecycleBin(organizationId,role))}
    catch(cause){setError(cause)}
    finally{setLoading(false)}
  },[allowed,organizationId,role])
  useEffect(()=>{void reload();return onRecycleBinChange(()=>void reload())},[reload])
  return {allowed,entries,loading,error,reload}
}
