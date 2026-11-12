// Executive dashboard reads: the Analysis RPCs part by part (loadAnalysisSections)
// and the committees' open decisions, kept for a short while per
// (organization, period, department) so switching filters back and forth, or
// coming back from a detail screen, does not read the database again.
import { cloudClient } from '../../core/supabase/cloudContext'
import { loadAnalysisSections } from '../platform/platformService'
import { cacheKey, type DayRange } from './executiveModel'

export const CACHE_TTL_MS=2*60*1000
const cache=new Map<string, {at: number,value: unknown}>()

function remembered<T>(key: string,load: ()=>T,now: number): T{
 const hit=cache.get(key)
 if(hit&&now-hit.at<CACHE_TTL_MS)return hit.value as T
 const value=load()
 cache.set(key,{at:now,value})
 // A failed read is not kept: the next visit tries again.
 const forget=()=>{if(cache.get(key)?.value===value)cache.delete(key)}
 const maybe=value as {then?: unknown,catch: (fail: ()=>void)=>unknown}|null
 if(maybe&&typeof maybe.then==='function')maybe.catch(forget)
 else Object.values(maybe||{}).forEach(part=>(part as {catch?: (fail: ()=>void)=>unknown}|null)?.catch?.(forget))
 return value
}

// {domains, people, qualityFood, microbiology, clusters}: one promise each.
type SectionArgs={organizationId?: string|null,from?: string,to?: string,departmentId?: string|null}
export function loadExecutiveParts(args: SectionArgs,{now=Date.now(),loader=loadAnalysisSections as (args: SectionArgs)=>Record<string, Promise<unknown>>}: {now?: number,loader?: (args: SectionArgs)=>Record<string, Promise<unknown>>}={}){
 return remembered(cacheKey(args),()=>loader(args),now)
}

// Open / overdue committee decisions now (executive_governance_status).
export function loadGovernanceStatus(organizationId: string,{now=Date.now()}: {now?: number}={}){
 return remembered(`governance|${organizationId}`,async()=>{
  const {data,error}=await cloudClient().rpc('executive_governance_status',{p_organization_id:organizationId})
  if(error)throw error
  return data||null
 },now)
}

export function clearExecutiveCache(){cache.clear()}

// The departments counted apart from the hospital's total of patient days (Παιδιατρική…) and the patients with a
// multidrug-resistant isolate in them for a period: left out of the hospital's rates per 1,000 patient days.
// The departments that keep patient days (the wards, compared in the overview) and which of them are counted apart.
export function loadPatientDayDepartments(organizationId: string,{now=Date.now()}: {now?: number}={}){
 return remembered(`wards|${organizationId}`,async()=>{
  const {data,error}=await cloudClient().from('departments').select('id,name,patient_days_separate,patient_days_tracked').eq('organization_id',organizationId).or('patient_days_tracked.eq.true,patient_days_separate.eq.true')
  if(error)throw error
  return (data||[]).map(row=>({id:row.id,name:row.name,separate:Boolean(row.patient_days_separate),tracked:Boolean(row.patient_days_tracked)}))
 },now)
}
export async function separateMdrPatients(organizationId: string,period: DayRange|null|undefined,departments: {id: string}[]|null|undefined){
 if(!period||!departments?.length)return 0
 const counts=await Promise.all(departments.map(item=>cloudClient().rpc('analysis_mdr_patients',{p_organization_id:organizationId,p_from:period.from,p_to:period.to,p_department_id:item.id}).then(({data,error})=>(error?0:Number(data)||0))))
 return counts.reduce((sum,n)=>sum+n,0)
}
