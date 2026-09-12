import { supabase } from '../../core/supabase/client'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { preventionDepartments, wasteTypeLibrary } from './preventionDemoData'
import { loadWasteLocal, saveWasteLocal } from './preventionStore'

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

function mapRow(row){
 const typeEl=row.waste_type?.name_el||''
 const typeEn=row.waste_type?.name_en||typeEl
 const patientDays=Number(row.patient_days)||0
 const weight=Number(row.weight_kg)||0
 const periodStart=row.period_start||row.record_date
 const periodEnd=row.period_end||row.record_date
 return {id:row.id,date:row.record_date,periodStart,periodEnd,period:periodStart===periodEnd?periodStart:`${periodStart} – ${periodEnd}`,departmentEl:row.department?.name||'',departmentEn:row.department?.name||'',wasteType:typeEl,type:typeEl,typeEn,wasteTypeId:row.waste_type_id,weight,containers:Number(row.containers)||0,patientDays:patientDays||null,patientDaysSource:row.patient_days_source||'',indicator:patientDays>0?Number((weight/patientDays*1000).toFixed(2)):null,responsible:row.responsible_name||'',documentNumber:row.document_number||'',collectionCompany:row.collection_company||'',notes:row.notes||'',status:row.status,lifecycleStatus:row.status==='cancelled'?'voided':'active',createdAt:row.created_at,createdById:row.created_by,updatedAt:row.updated_at,updatedById:row.updated_by}
}

export async function loadWasteSupportData(organizationId){
 if(isDemoDataEnvironment())return {departments:preventionDepartments.map(({id,el,en})=>({id,el,en})),wasteTypes:wasteTypeLibrary}
 assertCloud(organizationId)
 const [departmentsResult,typesResult]=await Promise.all([
  supabase.from('departments').select('id,name').eq('organization_id',organizationId).eq('is_active',true).order('name'),
  supabase.from('master_library_items').select('id,code,name_el,name_en').eq('organization_id',organizationId).eq('library_key','wasteTypes').eq('is_active',true).order('name_el'),
 ])
 if(departmentsResult.error)throw departmentsResult.error
 if(typesResult.error)throw typesResult.error
 return {departments:(departmentsResult.data||[]).map(x=>({id:x.id,el:x.name,en:x.name})),wasteTypes:(typesResult.data||[]).map(x=>({id:x.id,code:x.code,el:x.name_el,en:x.name_en||x.name_el}))}
}

export async function findWastePatientDays(organizationId,departmentId,periodStartOrRange,periodEndArg){
 if(isDemoDataEnvironment())return null
 assertCloud(organizationId)
 const periodStart=typeof periodStartOrRange==='object'?periodStartOrRange?.periodStart:periodStartOrRange
 const periodEnd=typeof periodStartOrRange==='object'?periodStartOrRange?.periodEnd:periodEndArg
 if(!departmentId||!periodStart||!periodEnd)return null
 const {data,error}=await supabase.from('patient_day_periods').select('patient_days,period_start,period_end,source,review_status').eq('organization_id',organizationId).eq('department_id',departmentId).eq('period_start',periodStart).eq('period_end',periodEnd).eq('review_status','approved').order('updated_at',{ascending:false}).limit(1).maybeSingle()
 if(error)throw error
 return data?{patientDays:Number(data.patient_days)||0,periodStart:data.period_start,periodEnd:data.period_end,source:data.source||'library'}:null
}

export async function loadWasteMeasurements(organizationId){
 if(isDemoDataEnvironment())return loadWasteLocal()
 assertCloud(organizationId)
 const {data,error}=await supabase.from('waste_measurements').select('*,department:departments(id,name),waste_type:master_library_items(id,code,name_el,name_en)').eq('organization_id',organizationId).order('period_end',{ascending:false}).order('created_at',{ascending:false})
 if(error)throw error
 return (data||[]).map(mapRow)
}

export async function saveWasteMeasurement(organizationId,record,{existingId=null}={}){
 if(isDemoDataEnvironment()){
  const rows=loadWasteLocal()
  const id=existingId||`WST-${Date.now()}`
  const saved={...record,id,lifecycleStatus:'active'}
  const next=existingId?rows.map(row=>row.id===existingId?saved:row):[saved,...rows]
  saveWasteLocal(next)
  return saved
 }
 assertCloud(organizationId)
 const userId=await currentUserId()
 const support=await loadWasteSupportData(organizationId)
 const department=support.departments.find(x=>x.el===record.departmentEl)
 if(!department)throw new Error('Selected department is not available for this organization.')
 const type=support.wasteTypes.find(x=>x.id===record.wasteTypeId||x.el===record.wasteType||x.el===record.type)
 if(!type)throw new Error('Selected waste category is not available in the central library.')
 const periodStart=record.periodStart||record.date
 const periodEnd=record.periodEnd||record.date
 if(!periodStart||!periodEnd||periodEnd<periodStart)throw new Error('A valid reporting period is required.')
 const payload={organization_id:organizationId,department_id:department.id,record_date:periodEnd,period_start:periodStart,period_end:periodEnd,waste_type_id:type.id,weight_kg:Number(record.weight)||0,containers:record.containers===''||record.containers==null?null:Number(record.containers),patient_days:record.patientDays===''||record.patientDays==null?null:Number(record.patientDays),patient_days_source:record.patientDaysSource||null,responsible_name:record.responsible||null,document_number:record.documentNumber||null,collection_company:record.collectionCompany||null,status:'completed',notes:record.notes||null,updated_by:userId,updated_at:new Date().toISOString()}
 let saved
 if(existingId){const {data,error}=await supabase.from('waste_measurements').update(payload).eq('organization_id',organizationId).eq('id',existingId).select('*').single();if(error)throw error;saved=data}
 else{const {data,error}=await supabase.from('waste_measurements').insert({...payload,created_by:userId}).select('*').single();if(error)throw error;saved=data}
 const rows=await loadWasteMeasurements(organizationId)
 return rows.find(x=>x.id===saved.id)||null
}

export async function deleteWasteMeasurement(organizationId,id){
 if(isDemoDataEnvironment()){
  if(!id)return
  saveWasteLocal(loadWasteLocal().filter(row=>row.id!==id))
  return
 }
 assertCloud(organizationId)
 if(!id)return
 const {error}=await supabase.from('waste_measurements').delete().eq('organization_id',organizationId).eq('id',id)
 if(error)throw error
}
