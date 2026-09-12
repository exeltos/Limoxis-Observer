import { supabase } from '../../core/supabase/client'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { preventionDepartments, antisepticLibrary } from './preventionDemoData'
import { loadAntisepticLocal, saveAntisepticLocal } from './preventionStore'

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

const monthLabel=(from,to)=>{if(!from)return '';const start=String(from).slice(0,7);const end=String(to||from).slice(0,7);return start===end?start:`${start} – ${end}`}
const isAbhrItem=item=>Boolean(item&&(item.metadata?.is_abhr===true||item.code==='ANT-ABHR'))

function mapRow(row){
 const productEl=row.antiseptic_item?.name_el||''
 const productEn=row.antiseptic_item?.name_en||productEl
 const patientDays=Number(row.patient_days)||0
 const litres=Number(row.litres)||0
 const eligible=isAbhrItem(row.antiseptic_item)
 return {id:row.id,period:monthLabel(row.period_start,row.period_end),periodStart:row.period_start,periodEnd:row.period_end,departmentEl:row.department?.name||'',departmentEn:row.department?.name||'',product:productEl,productEn,antisepticItemId:row.antiseptic_item_id,productCode:row.antiseptic_item?.code||'',litres,patientDays:patientDays||null,patientDaysSource:row.patient_days_source||'',indicator:eligible&&patientDays>0?Number((litres/patientDays*1000).toFixed(2)):null,indicatorEligible:eligible,method:row.source||'manual',referenceNumber:row.source_reference||'',responsible:row.responsible_name||'',notes:row.notes||'',lifecycleStatus:'active',createdAt:row.created_at,createdById:row.created_by,updatedAt:row.updated_at,updatedById:row.updated_by}
}

export async function loadAntisepticSupportData(organizationId){
 if(isDemoDataEnvironment())return {departments:preventionDepartments.map(({id,el,en})=>({id,el,en})),products:antisepticLibrary.map(item=>({...item,indicatorEligible:isAbhrItem(item)}))}
 assertCloud(organizationId)
 const [departmentsResult,productsResult]=await Promise.all([
  supabase.from('departments').select('id,name').eq('organization_id',organizationId).eq('is_active',true).order('name'),
  supabase.from('master_library_items').select('id,name_el,name_en,code,metadata').eq('organization_id',organizationId).eq('library_key','antiseptics').eq('is_active',true).order('name_el'),
 ])
 if(departmentsResult.error)throw departmentsResult.error
 if(productsResult.error)throw productsResult.error
 return {departments:(departmentsResult.data||[]).map(x=>({id:x.id,el:x.name,en:x.name})),products:(productsResult.data||[]).map(x=>({id:x.id,el:x.name_el,en:x.name_en||x.name_el,code:x.code,metadata:x.metadata||{},indicatorEligible:isAbhrItem(x)}))}
}

export async function findPatientDaysForPeriod(organizationId,departmentId,from,to){
 if(isDemoDataEnvironment())return null
 assertCloud(organizationId)
 if(!departmentId||!from||!to)return null
 const {data,error}=await supabase.from('patient_day_periods').select('patient_days,period_start,period_end,review_status').eq('organization_id',organizationId).eq('department_id',departmentId).eq('period_start',from).eq('period_end',to).eq('review_status','approved').limit(1).maybeSingle()
 if(error)throw error
 return data?Number(data.patient_days)||0:null
}

export async function loadAntisepticRecords(organizationId){
 if(isDemoDataEnvironment())return loadAntisepticLocal()
 assertCloud(organizationId)
 const {data,error}=await supabase.from('antiseptic_consumption_periods').select('*,department:departments(id,name),antiseptic_item:master_library_items(id,name_el,name_en,code,metadata)').eq('organization_id',organizationId).order('period_start',{ascending:false}).order('created_at',{ascending:false})
 if(error)throw error
 return (data||[]).map(mapRow)
}

export async function saveAntisepticRecord(organizationId,record,{existingId=null}={}){
 if(isDemoDataEnvironment()){
  const rows=loadAntisepticLocal()
  const id=existingId||`ANT-${Date.now()}`
  const saved={...record,id,lifecycleStatus:'active'}
  const next=existingId?rows.map(row=>row.id===existingId?saved:row):[saved,...rows]
  saveAntisepticLocal(next)
  return saved
 }
 assertCloud(organizationId)
 const userId=await currentUserId()
 const support=await loadAntisepticSupportData(organizationId)
 const department=support.departments.find(x=>x.el===record.departmentEl)
 if(!department)throw new Error('Selected department is not available for this organization.')
 const product=support.products.find(x=>x.id===record.antisepticItemId||x.el===record.product)
 if(!product)throw new Error('Selected antiseptic is not available in the central library.')
 const [year,month]=String(record.period||'').slice(0,7).split('-').map(Number)
 if(!year||!month)throw new Error('A valid month is required.')
 const periodStart=`${year}-${String(month).padStart(2,'0')}-01`
 const lastDay=new Date(year,month,0).getDate()
 const periodEnd=`${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`
 const payload={organization_id:organizationId,department_id:department.id,period_start:periodStart,period_end:periodEnd,antiseptic_item_id:product.id,litres:Number(record.litres)||0,source:record.method||'manual',source_reference:record.referenceNumber||null,patient_days:record.patientDays===''||record.patientDays==null?null:Number(record.patientDays),patient_days_source:record.patientDaysSource||null,responsible_name:record.responsible||null,notes:record.notes||null,updated_by:userId,updated_at:new Date().toISOString()}
 let saved
 if(existingId){const {data,error}=await supabase.from('antiseptic_consumption_periods').update(payload).eq('organization_id',organizationId).eq('id',existingId).select('*').single();if(error)throw error;saved=data}
 else{const {data,error}=await supabase.from('antiseptic_consumption_periods').insert({...payload,created_by:userId}).select('*').single();if(error)throw error;saved=data}
 const rows=await loadAntisepticRecords(organizationId)
 return rows.find(x=>x.id===saved.id)||null
}

export async function deleteAntisepticRecord(organizationId,id){
 if(isDemoDataEnvironment()){
  if(!id)return
  saveAntisepticLocal(loadAntisepticLocal().filter(row=>row.id!==id))
  return
 }
 assertCloud(organizationId)
 if(!id)return
 const {error}=await supabase.from('antiseptic_consumption_periods').delete().eq('organization_id',organizationId).eq('id',id)
 if(error)throw error
}
