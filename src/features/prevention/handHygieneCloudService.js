import { supabase } from '../../core/supabase/client'

const assertCloud=organizationId=>{
 if(!supabase)throw new Error('Supabase is not configured.')
 if(!organizationId)throw new Error('Organization is required.')
}

async function currentUserId(){
 const {data,error}=await supabase.auth.getUser()
 if(error)throw error
 const id=data?.user?.id
 if(!id)throw new Error('Authenticated user is required.')
 return id
}

function statsFromObservations(items=[]){
 const total=(filter)=>items.filter(filter).reduce((sum,x)=>sum+(Number(x.professionalsCount)||1),0)
 const professionals=items.reduce((sum,x)=>sum+(Number(x.professionalsCount)||1),0)
 const handRub=total(x=>x.action==='HR')
 const handWash=total(x=>x.action==='HW')
 const missed=total(x=>x.action==='MISSED')
 const compliant=handRub+handWash
 const opportunities=professionals
 return {opportunities,handRub,handWash,missed,professionals,compliant,compliance:opportunities?Number(((compliant/opportunities)*100).toFixed(1)):0}
}

function mapSession(row){
 const items=(row.observations_detail||[]).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)).map(x=>({
  id:x.id,
  professionalsCount:x.professionals_count,
  professionalCategory:x.professional_category,
  moment:x.who_moment,
  action:x.action,
  gloves:Boolean(x.gloves),
  notes:x.notes||'',
 }))
 const stats=statsFromObservations(items)
 const department=row.department?.name||''
 const professional=row.professional_category?.startsWith('Ιατ')?'medical':'nursing'
 return {
  id:row.id,
  date:row.observation_date,
  departmentEl:department,
  departmentEn:department,
  profession:professional,
  observations:Number(row.observations||stats.opportunities||0),
  compliant:Number(row.compliant_observations||stats.compliant||0),
  rate:Number(row.observations)>0?Number(((Number(row.compliant_observations||0)/Number(row.observations))*100).toFixed(1)):stats.compliance,
  observer:row.observer_name||'',
  session:{
   department,
   date:row.observation_date,
   observer:row.observer_name||'',
   startTime:row.start_time||'',
   endTime:row.end_time||'',
  },
  whoObservations:items,
  whoStats:stats,
  lifecycleStatus:row.status==='cancelled'?'voided':'active',
  createdAt:row.created_at,
  createdById:row.created_by,
  updatedAt:row.updated_at,
  updatedById:row.updated_by,
 }
}

export async function loadHandHygieneDepartments(organizationId){
 assertCloud(organizationId)
 const {data,error}=await supabase.from('departments').select('id,name').eq('organization_id',organizationId).eq('is_active',true).order('name')
 if(error)throw error
 return (data||[]).map(row=>({id:row.id,el:row.name,en:row.name}))
}

export async function loadHandHygieneSessions(organizationId){
 assertCloud(organizationId)
 const {data,error}=await supabase
  .from('hand_hygiene_sessions')
  .select('*,department:departments(id,name),observations_detail:hand_hygiene_observations(*)')
  .eq('organization_id',organizationId)
  .order('observation_date',{ascending:false})
  .order('created_at',{ascending:false})
 if(error)throw error
 return (data||[]).map(mapSession)
}

async function resolveDepartment(organizationId,name){
 const {data,error}=await supabase.from('departments').select('id,name').eq('organization_id',organizationId).eq('name',name).eq('is_active',true).maybeSingle()
 if(error)throw error
 if(!data)throw new Error('Selected department is not available for this organization.')
 return data
}

export async function saveHandHygieneSession(organizationId,record,{existingId=null}={}){
 assertCloud(organizationId)
 const userId=await currentUserId()
 const department=await resolveDepartment(organizationId,record.departmentEl||record.session?.department||'')
 const items=record.whoObservations||[]
 if(!items.length)throw new Error('At least one WHO observation is required.')
 const stats=record.whoStats||statsFromObservations(items)
 const payload={
  organization_id:organizationId,
  department_id:department.id,
  observation_date:record.date||record.session?.date,
  professional_category:items[0]?.professionalCategory||null,
  observations:stats.opportunities,
  compliant_observations:stats.compliant,
  observer_id:userId,
  observer_name:record.observer||record.session?.observer||'',
  source_standard:'WHO',
  source_version:'WHO 5 Moments',
  status:'completed',
  start_time:record.session?.startTime||null,
  end_time:record.session?.endTime||null,
  updated_by:userId,
  updated_at:new Date().toISOString(),
 }
 let session
 if(existingId){
  const {data,error}=await supabase.from('hand_hygiene_sessions').update(payload).eq('organization_id',organizationId).eq('id',existingId).select('*').single()
  if(error)throw error
  session=data
  const {error:deleteError}=await supabase.from('hand_hygiene_observations').delete().eq('organization_id',organizationId).eq('session_id',existingId)
  if(deleteError)throw deleteError
 }else{
  const {data,error}=await supabase.from('hand_hygiene_sessions').insert({...payload,created_by:userId}).select('*').single()
  if(error)throw error
  session=data
 }
 const observationRows=items.map((item,index)=>({
  session_id:session.id,
  organization_id:organizationId,
  professional_category:item.professionalCategory||'Άλλο',
  professionals_count:Math.max(1,Number(item.professionalsCount)||1),
  who_moment:item.moment,
  action:item.action,
  gloves:Boolean(item.gloves),
  notes:item.notes||null,
  sort_order:index,
 }))
 const {error:observationsError}=await supabase.from('hand_hygiene_observations').insert(observationRows)
 if(observationsError)throw observationsError
 const rows=await loadHandHygieneSessions(organizationId)
 return rows.find(x=>x.id===session.id)||null
}
