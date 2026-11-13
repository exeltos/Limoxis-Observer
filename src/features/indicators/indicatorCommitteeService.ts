import {cloudClient} from '../../core/supabase/cloudContext'
import {isDemoDataEnvironment} from '../../core/data/dataEnvironment'
import type {CommitteeObjectiveRow} from './indicatorTypes'

export async function loadCommitteeObjectivesForIndicator(organizationId: string|null|undefined,definition: {id?: string|null, key?: string}|null|undefined): Promise<CommitteeObjectiveRow[]>{
 if(!organizationId||!definition)return []
 if(isDemoDataEnvironment())return []
 const supabase=cloudClient()
 let query=supabase
  .from('committee_plan_items')
  .select('id,committee_id,title,indicator,indicator_key,indicator_definition_id,baseline,target,owner_label,due_date,status,committee:committees(code,name)')
  .eq('organization_id',organizationId)
  .order('due_date',{ascending:true,nullsFirst:false})
 if(definition.id)query=query.eq('indicator_definition_id',definition.id)
 else if(definition.key)query=query.eq('indicator_key',definition.key)
 else return []
 const {data,error}=await query
 if(error){
  // Compatibility for deployments where the linkage migration has not been applied yet.
  if(definition.key){
   const fallback=await supabase
    .from('committee_plan_items')
    .select('id,committee_id,title,indicator,baseline,target,owner_label,due_date,status,committee:committees(code,name)')
    .eq('organization_id',organizationId)
    .ilike('indicator',definition.key)
    .order('due_date',{ascending:true,nullsFirst:false})
   if(fallback.error)throw error
   return (fallback.data||[]) as unknown as CommitteeObjectiveRow[]
  }
  throw error
 }
 return (data||[]) as unknown as CommitteeObjectiveRow[]
}
