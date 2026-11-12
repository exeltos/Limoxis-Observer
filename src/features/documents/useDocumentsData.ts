import { useCallback,useEffect,useState } from 'react'
import { useTenant } from '../../core/tenant/TenantContext'
import { loadDocumentsAsync } from './documentService'

export function useDocumentsData(){
  const {tenant}=useTenant()
  const organizationId=tenant?.id??null
  const [data,setData]=useState([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState(null)
  const reload=useCallback(async()=>{
    setLoading(true);setError(null)
    try{const rows=await loadDocumentsAsync(organizationId);setData(rows);return rows}
    catch(err){setError(err);throw err}
    finally{setLoading(false)}
  },[organizationId])
  useEffect(()=>{void reload().catch(()=>{})},[reload])
  return {data,setData,loading,error,reload,organizationId}
}
