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

function mapTemplate(row){
 const elements=Array.isArray(row.elements)?row.elements:[]
 return {
  dbId:row.id,
  id:row.bundle_key,
  bundleKey:row.bundle_key,
  name:row.name,
  title:row.title_el,
  titleEl:row.title_el,
  titleEn:row.title_en,
  version:row.version,
  status:row.status,
  scope:row.scope,
  source:row.source,
  sourceVersion:row.source_version,
  system:Boolean(row.is_system),
  departments:Array.isArray(row.departments)?row.departments:[],
  elements:elements.map(item=>[item.id,item.labelEl||item.label_el||item.label||item.id]),
  rawElements:elements,
 }
}

function mapAssessment(row,templates=[]){
 const criteria=row.criteria&&typeof row.criteria==='object'?row.criteria:{}
 const evidence=Array.isArray(row.evidence)?row.evidence:[]
 const template=templates.find(x=>x.bundleKey===row.bundle_key)||criteria.templateSnapshot||null
 const answers=criteria.answers||{}
 const answerNotes=criteria.answerNotes||{}
 const applicableCount=Object.values(answers).filter(x=>x==='yes'||x==='no').length
 const failedCount=Object.values(answers).filter(x=>x==='no').length
 const allOrNone=applicableCount>0&&failedCount===0
 return {
  id:row.id,
  bundle:row.bundle_key,
  templateId:row.bundle_key,
  templateName:template?.name||row.bundle_key,
  templateTitle:template?.titleEl||template?.title||'',
  templateVersion:template?.version||'1.0',
  templateSource:template?.source||'',
  templateSnapshot:template,
  departmentEl:row.department?.name||'',
  departmentEn:row.department?.name||'',
  date:row.assessment_date,
  period:row.period_label||row.assessment_date,
  score:row.score==null?null:Number(row.score),
  answers,
  answerNotes,
  shift:criteria.shift||'',
  context:criteria.context||'',
  patientRef:criteria.patientRef||'',
  deviceRef:criteria.deviceRef||'',
  generalNotes:criteria.generalNotes||'',
  applicableCount,
  failedCount,
  allOrNone,
  findings:evidence,
  owner:criteria.owner||'',
  status:row.status,
  lifecycleStatus:row.status==='cancelled'?'voided':'active',
  createdAt:row.created_at,
  createdById:row.created_by,
  updatedAt:row.updated_at,
  updatedById:row.updated_by,
 }
}

export async function loadBundleSupportData(organizationId){
 assertCloud(organizationId)
 const [departmentsResult,templatesResult]=await Promise.all([
  supabase.from('departments').select('id,name').eq('organization_id',organizationId).eq('is_active',true).order('name'),
  supabase.from('prevention_bundle_templates').select('*').eq('status','published').eq('hidden',false).or(`is_system.eq.true,organization_id.eq.${organizationId}`).order('is_system',{ascending:false}).order('name'),
 ])
 if(departmentsResult.error)throw departmentsResult.error
 if(templatesResult.error)throw templatesResult.error
 return {
  departments:(departmentsResult.data||[]).map(x=>({id:x.id,el:x.name,en:x.name})),
  templates:(templatesResult.data||[]).map(mapTemplate),
 }
}

export async function loadBundleAssessments(organizationId){
 assertCloud(organizationId)
 const support=await loadBundleSupportData(organizationId)
 const {data,error}=await supabase.from('prevention_bundle_assessments')
  .select('*,department:departments(id,name)')
  .eq('organization_id',organizationId)
  .order('assessment_date',{ascending:false})
  .order('created_at',{ascending:false})
 if(error)throw error
 return (data||[]).map(row=>mapAssessment(row,support.templates))
}

export async function saveBundleAssessment(organizationId,record,{existingId=null}={}){
 assertCloud(organizationId)
 const userId=await currentUserId()
 const support=await loadBundleSupportData(organizationId)
 const department=support.departments.find(x=>x.el===record.departmentEl)
 if(!department)throw new Error('Selected department is not available for this organization.')
 const template=support.templates.find(x=>x.bundleKey===record.templateId||x.id===record.templateId||x.bundleKey===record.bundle)
 if(!template)throw new Error('Selected bundle template is not available.')
 const answers=record.answers||{}
 const answerNotes=record.answerNotes||{}
 const applicable=Object.values(answers).filter(x=>x==='yes'||x==='no')
 if(!applicable.length)throw new Error('At least one applicable bundle element is required.')
 const yes=applicable.filter(x=>x==='yes').length
 const score=Math.round((yes/applicable.length)*100)
 const findings=(template.rawElements||[]).filter(item=>answers[item.id]==='no').map(item=>({id:item.id,label:item.labelEl||item.labelEn||item.id,note:answerNotes[item.id]||''}))
 const criteria={
  answers,
  answerNotes,
  shift:record.shift||'',
  context:record.context||'',
  patientRef:record.patientRef||'',
  deviceRef:record.deviceRef||'',
  generalNotes:record.generalNotes||'',
  owner:record.owner||'',
  templateSnapshot:template,
 }
 const payload={
  organization_id:organizationId,
  department_id:department.id,
  bundle_key:template.bundleKey,
  assessment_date:record.date,
  period_label:record.period||record.date||null,
  score,
  criteria,
  evidence:findings,
  status:'completed',
  updated_by:userId,
  updated_at:new Date().toISOString(),
 }
 let saved
 if(existingId){
  const {data,error}=await supabase.from('prevention_bundle_assessments').update(payload).eq('organization_id',organizationId).eq('id',existingId).select('*').single()
  if(error)throw error
  saved=data
 }else{
  const {data,error}=await supabase.from('prevention_bundle_assessments').insert({...payload,created_by:userId}).select('*').single()
  if(error)throw error
  saved=data
 }
 const rows=await loadBundleAssessments(organizationId)
 return rows.find(x=>x.id===saved.id)||null
}
