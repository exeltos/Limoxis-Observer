// Executive dashboard reads: the Analysis RPCs part by part (loadAnalysisSections)
// and the committees' open decisions, kept for a short while per
// (organization, period, department) so switching filters back and forth, or
// coming back from a detail screen, does not read the database again.
import { supabase } from '../../core/supabase/client'
import { loadAnalysisSections } from '../platform/platformService'
import { cacheKey } from './executiveModel'

export const CACHE_TTL_MS=2*60*1000
const cache=new Map()

function remembered(key,load,now){
 const hit=cache.get(key)
 if(hit&&now-hit.at<CACHE_TTL_MS)return hit.value
 const value=load()
 cache.set(key,{at:now,value})
 // A failed read is not kept: the next visit tries again.
 const forget=()=>{if(cache.get(key)?.value===value)cache.delete(key)}
 if(value&&typeof value.then==='function')value.catch(forget)
 else Object.values(value||{}).forEach(part=>part?.catch?.(forget))
 return value
}

// {domains, people, qualityFood, microbiology, clusters}: one promise each.
export function loadExecutiveParts(args,{now=Date.now(),loader=loadAnalysisSections}={}){
 return remembered(cacheKey(args),()=>loader(args),now)
}

// Open / overdue committee decisions now (executive_governance_status).
export function loadGovernanceStatus(organizationId,{now=Date.now()}={}){
 return remembered(`governance|${organizationId}`,async()=>{
  const {data,error}=await supabase.rpc('executive_governance_status',{p_organization_id:organizationId})
  if(error)throw error
  return data||null
 },now)
}

export function clearExecutiveCache(){cache.clear()}
