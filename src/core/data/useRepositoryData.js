import { useCallback,useEffect,useState } from 'react'
import { load,save } from './repository'
import { useTenant } from '../tenant/TenantContext'

export function useRepositoryData(table,{fallback=null}={}){
  const {tenant}=useTenant()
  const organizationId=tenant?.id??null
  const [data,setData]=useState(fallback)
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState(null)

  const reload=useCallback(async()=>{
    setLoading(true);setError(null)
    try{
      const next=await load(table,{fallback,organizationId})
      setData(next)
      return next
    }catch(err){
      setError(err)
      throw err
    }finally{
      setLoading(false)
    }
  },[table,organizationId,fallback])

  useEffect(()=>{void reload().catch(()=>{})},[reload])

  const saveData=useCallback(async next=>{
    const previous=data
    setData(next)
    setSaving(true)
    setError(null)
    try{
      const saved=await save(table,next,{organizationId})
      setData(saved)
      return saved
    }catch(err){
      setData(previous)
      setError(err)
      throw err
    }finally{
      setSaving(false)
    }
  },[table,organizationId,data])

  return {data,loading,saving,error,reload,saveData,setData}
}
