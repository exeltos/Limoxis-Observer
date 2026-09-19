import { supabase } from '../../core/supabase/client'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { pharmacyDepartments, antibioticLibrary } from './pharmacyDemoData'
import { loadAntibioticDispensingLocal, saveAntibioticDispensingLocal } from './pharmacyStore'

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
const isHospitalRecord=record=>record?.departmentScope==='hospital'

function mapRow(row){
 const productEl=row.antibiotic_item?.name_el||''
 const productEn=row.antibiotic_item?.name_en||productEl
 const hospitalScope=!row.department_id
 return {id:row.id,period:monthLabel(row.period_start,row.period_end),periodStart:row.period_start,periodEnd:row.period_end,departmentScope:hospitalScope?'hospital':'department',departmentEl:hospitalScope?'Όλο το νοσοκομείο':(row.department?.name||''),departmentEn:hospitalScope?'Whole hospital':(row.department?.name||''),product:productEl,productEn,antibioticItemId:row.antibiotic_item_id,productCode:row.antibiotic_item?.code||'',quantityGrams:Number(row.quantity_grams)||0,method:row.source||'manual',referenceNumber:row.source_reference||'',responsible:row.responsible_name||'',notes:row.notes||'',createdAt:row.created_at,createdById:row.created_by,updatedAt:row.updated_at,updatedById:row.updated_by}
}

export async function loadPharmacySupportData(organizationId){
 if(isDemoDataEnvironment())return {departments:pharmacyDepartments.map(({id,el,en})=>({id,el,en})),products:antibioticLibrary}
 assertCloud(organizationId)
 const [departmentsResult,productsResult]=await Promise.all([
  supabase.from('departments').select('id,name').eq('organization_id',organizationId).eq('is_active',true).order('name'),
  supabase.from('master_library_items').select('id,name_el,name_en,code').eq('organization_id',organizationId).eq('library_key','antibiotics').eq('is_active',true).order('name_el'),
 ])
 if(departmentsResult.error)throw departmentsResult.error
 if(productsResult.error)throw productsResult.error
 return {departments:(departmentsResult.data||[]).map(x=>({id:x.id,el:x.name,en:x.name})),products:(productsResult.data||[]).map(x=>({id:x.id,el:x.name_el,en:x.name_en||x.name_el,code:x.code}))}
}

export async function loadAntibioticDispensingRecords(organizationId){
 if(isDemoDataEnvironment())return loadAntibioticDispensingLocal()
 assertCloud(organizationId)
 const {data,error}=await supabase.from('antibiotic_dispensing_periods').select('*,department:departments(id,name),antibiotic_item:master_library_items(id,name_el,name_en,code)').eq('organization_id',organizationId).order('period_start',{ascending:false}).order('created_at',{ascending:false})
 if(error)throw error
 return (data||[]).map(mapRow)
}

export async function saveAntibioticDispensingRecord(organizationId,record,{existingId=null}={}){
 if(isDemoDataEnvironment()){
  const rows=loadAntibioticDispensingLocal()
  const id=existingId||`ABXD-${Date.now()}`
  const saved={...record,id}
  const next=existingId?rows.map(row=>row.id===existingId?saved:row):[saved,...rows]
  saveAntibioticDispensingLocal(next)
  return saved
 }
 assertCloud(organizationId)
 const userId=await currentUserId()
 const support=await loadPharmacySupportData(organizationId)
 const hospitalScope=isHospitalRecord(record)
 const department=hospitalScope?null:support.departments.find(x=>x.el===record.departmentEl)
 if(!hospitalScope&&!department)throw new Error('Selected department is not available for this organization.')
 const product=support.products.find(x=>x.id===record.antibioticItemId||x.el===record.product)
 if(!product)throw new Error('Selected antibiotic is not available in the central library.')
 const [year,month]=String(record.period||'').slice(0,7).split('-').map(Number)
 if(!year||!month)throw new Error('A valid month is required.')
 const periodStart=`${year}-${String(month).padStart(2,'0')}-01`
 const lastDay=new Date(year,month,0).getDate()
 const periodEnd=`${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`
 const payload={organization_id:organizationId,department_id:department?.id||null,period_start:periodStart,period_end:periodEnd,antibiotic_item_id:product.id,quantity_grams:Number(record.quantityGrams)||0,source:record.method||'manual',source_reference:record.referenceNumber||null,responsible_name:record.responsible||null,notes:record.notes||null,updated_by:userId,updated_at:new Date().toISOString()}
 let saved
 if(existingId){const {data,error}=await supabase.from('antibiotic_dispensing_periods').update(payload).eq('organization_id',organizationId).eq('id',existingId).select('*').single();if(error)throw error;saved=data}
 else{const {data,error}=await supabase.from('antibiotic_dispensing_periods').insert({...payload,created_by:userId}).select('*').single();if(error)throw error;saved=data}
 const rows=await loadAntibioticDispensingRecords(organizationId)
 return rows.find(x=>x.id===saved.id)||null
}

export async function deleteAntibioticDispensingRecord(organizationId,id){
 if(isDemoDataEnvironment()){
  if(!id)return
  saveAntibioticDispensingLocal(loadAntibioticDispensingLocal().filter(row=>row.id!==id))
  return
 }
 assertCloud(organizationId)
 if(!id)return
 const {error}=await supabase.from('antibiotic_dispensing_periods').delete().eq('organization_id',organizationId).eq('id',id)
 if(error)throw error
}
