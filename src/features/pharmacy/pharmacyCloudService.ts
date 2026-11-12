import { supabase } from '../../core/supabase/client'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { pharmacyDepartments, antibioticLibrary, dddReferenceLibrary } from './pharmacyDemoData'
import { loadAntibioticDispensingLocal, saveAntibioticDispensingLocal } from './pharmacyStore'
import { awareCategoryFor } from './whoAwareClassification'
import { selectAllPages } from '../../core/data/inChunks'

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

// DDD per antibiotic code (WHO ATC/DDD, as the pharmacy verified it): the hospital's own value wins over the shared one.
export async function loadDddReference(organizationId){
 if(isDemoDataEnvironment())return {...dddReferenceLibrary}
 assertCloud(organizationId)
 const {data,error}=await supabase.from('who_ddd_reference').select('antibiotic_code,ddd_grams,organization_id').or(`organization_id.is.null,organization_id.eq.${organizationId}`)
 if(error)throw error
 const shared=(data||[]).filter(row=>!row.organization_id),own=(data||[]).filter(row=>row.organization_id)
 return Object.fromEntries([...shared,...own].map(row=>[row.antibiotic_code,Number(row.ddd_grams)]).filter(([,grams])=>grams>0))
}

export async function loadAntibioticDispensingRecords(organizationId){
 if(isDemoDataEnvironment())return loadAntibioticDispensingLocal()
 assertCloud(organizationId)
 // Read page by page: a single response stops at 1000 rows.
 const data=await selectAllPages(()=>supabase.from('antibiotic_dispensing_periods').select('*,department:departments(id,name),antibiotic_item:master_library_items(id,name_el,name_en,code)').eq('organization_id',organizationId).order('period_start',{ascending:false}).order('created_at',{ascending:false}).order('id',{ascending:true}))
 return data.map(mapRow)
}

// DDD of the WHO AWaRe «Access» antibiotics dispensed in the period (rows without a DDD reference are left out,
// like the total DDD of the database does): the numerator of the Access share indicator.
export async function loadAccessDddTotal(organizationId,{from,to}={}){
 const [rows,ddd]=await Promise.all([loadAntibioticDispensingRecords(organizationId),loadDddReference(organizationId)])
 const inPeriod=row=>(!to||String(row.periodStart||'')<=to)&&(!from||String(row.periodEnd||row.periodStart||'')>=from)
 return Math.round(rows.filter(inPeriod).filter(row=>awareCategoryFor(row.productEn||row.product)==='access'&&Number(ddd[row.productCode])>0).reduce((sum,row)=>sum+(Number(row.quantityGrams)||0)/Number(ddd[row.productCode]),0)*100)/100
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
 const keepRange=record.periodKind==='range'&&record.periodStart&&record.periodEnd
 const [year,month]=String(record.period||'').slice(0,7).split('-').map(Number)
 if(!keepRange&&(!year||!month))throw new Error('A valid month is required.')
 const periodStart=keepRange?record.periodStart:`${year}-${String(month).padStart(2,'0')}-01`
 const lastDay=new Date(year,month,0).getDate()
 const periodEnd=keepRange?record.periodEnd:`${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`
 const payload={organization_id:organizationId,department_id:department?.id||null,period_start:periodStart,period_end:periodEnd,antibiotic_item_id:product.id,quantity_grams:Number(record.quantityGrams)||0,source:record.method||'manual',source_reference:record.referenceNumber||null,responsible_name:record.responsible||null,notes:record.notes||null,updated_by:userId,updated_at:new Date().toISOString()}
 let saved
 if(existingId){const {data,error}=await supabase.from('antibiotic_dispensing_periods').update(payload).eq('organization_id',organizationId).eq('id',existingId).select('*').single();if(error)throw error;saved=data}
 else{const {data,error}=await supabase.from('antibiotic_dispensing_periods').insert({...payload,created_by:userId}).select('*').single();if(error)throw error;saved=data}
 const rows=await loadAntibioticDispensingRecords(organizationId)
 return rows.find(x=>x.id===saved.id)||null
}

// Antimicrobial therapies that needed stewardship approval (pending, approved,
// rejected): the same therapies the surveillance record approves, as one list.
const APPROVAL_STATES=['pending','approved','rejected']
export async function loadTherapyApprovals(organizationId){
 if(isDemoDataEnvironment()){
  const {clinicalCases}=await import('../surveillance/clinicalDemoData')
  return Object.values(clinicalCases).flatMap(record=>(record.therapy||[]).filter(item=>APPROVAL_STATES.includes(item.approvalStatus)).map(item=>({id:item.id,caseId:record.id,patientCode:record.patientId||'',department:record.department||'',departmentEn:record.departmentEn||record.department||'',antimicrobial:item.antimicrobial,dose:item.dose||'',route:item.route||'',indication:item.indication||'',startedAt:item.startedAt||null,approvalStatus:item.approvalStatus,status:item.status||'active'})))
   .sort((a,b)=>String(b.startedAt||'').localeCompare(String(a.startedAt||'')))
 }
 assertCloud(organizationId)
 const data=await selectAllPages(()=>supabase.from('antimicrobial_therapies').select('id,antimicrobial,dose,route,indication,started_at,approval_status,status,surveillance_case_id,patient:patients(patient_code),surveillance_case:surveillance_cases(department:departments(name))').eq('organization_id',organizationId).in('approval_status',APPROVAL_STATES).order('started_at',{ascending:false}).order('id',{ascending:true}))
 return data.map(row=>({id:row.id,caseId:row.surveillance_case_id||'',patientCode:row.patient?.patient_code||'',department:row.surveillance_case?.department?.name||'',departmentEn:row.surveillance_case?.department?.name||'',antimicrobial:row.antimicrobial,dose:row.dose||'',route:row.route||'',indication:row.indication||'',startedAt:row.started_at,approvalStatus:row.approval_status,status:row.status}))
}

// Approve or reject through the surveillance repository, as the surveillance record does.
export async function decideTherapyApproval(organizationId,row,approvalStatus,actor){
 const {createClinicalRepository}=await import('../surveillance/clinicalRepository')
 const repository=createClinicalRepository({isDemo:isDemoDataEnvironment(),organizationId,actor})
 return repository.updateTherapyApproval({id:row.caseId},row.id,approvalStatus)
}
