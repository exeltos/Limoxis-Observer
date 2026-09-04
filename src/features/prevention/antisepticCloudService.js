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

const monthLabel=(from,to)=>{
 if(!from)return ''
 const start=String(from).slice(0,7)
 const end=String(to||from).slice(0,7)
 return start===end?start:`${start} – ${end}`
}

const isAbhrName=(value='')=>{
 const normalized=String(value).toLowerCase()
 return normalized.includes('αλκοολ')||normalized.includes('alcohol')
}

function mapRow(row){
 const productEl=row.antiseptic_item?.name_el||''
 const productEn=row.antiseptic_item?.name_en||productEl
 const patientDays=Number(row.patient_days)||0
 const litres=Number(row.litres)||0
 const eligible=isAbhrName(`${productEl} ${productEn}`)
 return {
  id:row.id,
  period:monthLabel(row.period_start,row.period_end),
  periodStart:row.period_start,
  periodEnd:row.period_end,
  departmentEl:row.department?.name||'',
  departmentEn:row.department?.name||'',
  product:productEl,
  productEn,
  antisepticItemId:row.antiseptic_item_id,
  litres,
  patientDays:patientDays||null,
  patientDaysSource:row.patient_days_source||'',
  indicator:eligible&&patientDays>0?Number((litres/patientDays*1000).toFixed(2)):null,
  indicatorEligible:eligible,
  method:row.source||'manual',
  referenceNumber:row.source_reference||'',
  responsible:row.responsible_name||'',
  notes:row.notes||'',
  lifecycleStatus:'active',
  createdAt:row.created_at,
  createdById:row.created_by,
  updatedAt:row.updated_at,
  updatedById:row.updated_by,
 }
}

export async function loadAntisepticSupportData(organizationId){
 assertCloud(organizationId)
 const [departmentsResult,productsResult]=await Promise.all([
  supabase.from('departments').select('id,name').eq('organization_id',organizationId).eq('is_active',true).order('name'),
  supabase.from('master_library_items').select('id,name_el,name_en,code').eq('organization_id',organizationId).eq('library_key','antiseptics').eq('is_active',true).order('name_el'),
 ])
 if(departmentsResult.error)throw departmentsResult.error
 if(productsResult.error)throw productsResult.error
 return {
  departments:(departmentsResult.data||[]).map(x=>({id:x.id,el:x.name,en:x.name})),
  products:(productsResult.data||[]).map(x=>({id:x.id,el:x.name_el,en:x.name_en||x.name_el,code:x.code})),
 }
}

export async function findPatientDaysForPeriod(organizationId,departmentId,from,to){
 assertCloud(organizationId)
 if(!departmentId||!from||!to)return null
 const {data,error}=await supabase.from('patient_day_periods')
  .select('patient_days,period_start,period_end')
  .eq('organization_id',organizationId)
  .eq('department_id',departmentId)
  .lte('period_start',from)
  .gte('period_end',to)
  .order('period_start',{ascending:false})
  .limit(1)
  .maybeSingle()
 if(error)throw error
 return data?Number(data.patient_days)||0:null
}

export async function loadAntisepticRecords(organizationId){
 assertCloud(organizationId)
 const {data,error}=await supabase.from('antiseptic_consumption_periods')
  .select('*,department:departments(id,name),antiseptic_item:master_library_items(id,name_el,name_en,code)')
  .eq('organization_id',organizationId)
  .order('period_start',{ascending:false})
  .order('created_at',{ascending:false})
 if(error)throw error
 return (data||[]).map(mapRow)
}

export async function saveAntisepticRecord(organizationId,record,{existingId=null}={}){
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
 const payload={
  organization_id:organizationId,
  department_id:department.id,
  period_start:periodStart,
  period_end:periodEnd,
  antiseptic_item_id:product.id,
  litres:Number(record.litres)||0,
  source:record.method||'manual',
  source_reference:record.referenceNumber||null,
  patient_days:record.patientDays===''||record.patientDays==null?null:Number(record.patientDays),
  patient_days_source:record.patientDaysSource||null,
  responsible_name:record.responsible||null,
  notes:record.notes||null,
  updated_by:userId,
  updated_at:new Date().toISOString(),
 }
 let saved
 if(existingId){
  const {data,error}=await supabase.from('antiseptic_consumption_periods').update(payload).eq('organization_id',organizationId).eq('id',existingId).select('*').single()
  if(error)throw error
  saved=data
 }else{
  const {data,error}=await supabase.from('antiseptic_consumption_periods').insert({...payload,created_by:userId}).select('*').single()
  if(error)throw error
  saved=data
 }
 const rows=await loadAntisepticRecords(organizationId)
 return rows.find(x=>x.id===saved.id)||null
}
