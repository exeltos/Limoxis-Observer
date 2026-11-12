import { useCallback,useEffect,useState } from 'react'
import { useTenant } from '../../core/tenant/TenantContext'
import { loadSnapshot } from '../../core/data/repository'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { loadManagementLibraries } from './managementCloudService'
import { demoLibrarySeed } from './managementData'

// One way for every screen to read the central libraries (Management >
// Libraries): the organization's rows in the cloud, or the demo seed plus the
// demo's own edits. Items come back as {id,value,code,el,en,system}; value is the
// Greek name, which is what records store. Departments come as {id,name,nameEn,
// departmentType}; in the demo a department's id is its name.

const CACHE_MS=30_000
const cache=new Map()

const toItem=row=>({id:row?.[2]?.id||null,value:String(row?.[0]||''),code:row?.[2]?.code||null,el:String(row?.[0]||''),en:String(row?.[1]||row?.[0]||''),system:Boolean(row?.[2]?.system),meta:row?.[2]||{}})
const toDepartment=(row,demo)=>({id:demo?String(row?.[0]||''):(row?.[2]?.id||''),name:String(row?.[0]||''),nameEn:String(row?.[1]||row?.[0]||''),departmentType:row?.[2]?.departmentType||'general'})

function demoLibraries(){
 const stored=loadSnapshot('management_libraries',{})
 return {...structuredClone(demoLibrarySeed),...(stored&&typeof stored==='object'?stored:{})}
}

function shape(raw,demo){
 const libraries={}
 for(const [key,rows] of Object.entries(raw||{})){
  if(!Array.isArray(rows)||key==='departments')continue
  libraries[key]=rows.filter(Array.isArray).filter(row=>row?.[2]?.active!==false).map(toItem).filter(item=>item.value)
 }
 const departments=(raw?.departments||[]).filter(Array.isArray).filter(row=>row?.[2]?.active!==false).map(row=>toDepartment(row,demo)).filter(dep=>dep.name)
 return {libraries,departments}
}

export async function loadLibraries(organizationId,{fresh=false}={}){
 if(isDemoDataEnvironment())return shape(demoLibraries(),true)
 if(!organizationId)return {libraries:{},departments:[]}
 const hit=cache.get(organizationId)
 if(!fresh&&hit&&Date.now()-hit.at<CACHE_MS)return hit.promise
 const promise=loadManagementLibraries(organizationId).then(raw=>shape(raw,false))
 cache.set(organizationId,{at:Date.now(),promise})
 promise.catch(()=>cache.delete(organizationId))
 return promise
}

export function invalidateLibraries(organizationId){if(organizationId)cache.delete(organizationId);else cache.clear()}

export function useLibraries(){
 const {tenant,isDemo}=useTenant()
 const organizationId=tenant?.id||''
 const [state,setState]=useState({libraries:{},departments:[],loading:true,error:''})
 const reload=useCallback(async({fresh=true}={})=>{
  setState(current=>({...current,loading:true,error:''}))
  try{const data=await loadLibraries(organizationId,{fresh});setState({...data,loading:false,error:''});return data}
  catch(error){setState({libraries:{},departments:[],loading:false,error:error?.message||'load_failed'});return null}
 },[organizationId])
 useEffect(()=>{
  let active=true
  loadLibraries(organizationId).then(data=>{if(active)setState({...data,loading:false,error:''})}).catch(error=>{if(active)setState({libraries:{},departments:[],loading:false,error:error?.message||'load_failed'})})
  return()=>{active=false}
 },[organizationId,isDemo])
 return {...state,reload}
}

// The active departments of the organization, in one shape for every screen.
export function useDepartments(){
 const {departments,loading,error,reload}=useLibraries()
 return {departments,loading,error,reload}
}

export const libraryLabel=(item,language='el')=>item?(language==='en'?item.en||item.el:item.el):''

// SearchableSelect / MultiSelect options from a library: the label in the
// screen's language, the other language as the description, both searchable.
export function libraryOptions(items=[],language='el',{getValue=item=>item.value}={}){
 return items.map(item=>{const label=libraryLabel(item,language),other=language==='en'?item.el:item.en;return {value:getValue(item),label,description:other&&other!==label?other:undefined,keywords:`${item.el} ${item.en} ${item.code||''}`}})
}

export function findLibraryItem(items=[],value){
 const text=String(value??'').trim().toLocaleLowerCase('el')
 if(!text)return null
 return items.find(item=>[item.id,item.value,item.code,item.el,item.en].some(x=>String(x||'').trim().toLocaleLowerCase('el')===text))||null
}
