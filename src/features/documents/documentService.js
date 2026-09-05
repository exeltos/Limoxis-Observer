import { supabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { loadDocuments as loadDocumentsLocal, saveDocuments as saveDocumentsLocal, nextDocumentId, nextRevisionVersion } from './documentStore'

const COLUMNS='id,organization_id,code,title,document_type,department_id,audience,status,version,description,owner_id,revision_of_id,supersedes_id,effective_date,review_date,published_at,published_by,created_by,updated_by,created_at,updated_at'

function requireProduction(organizationId,operation){
  if(isDemoDataEnvironment())return false
  if(!hasSupabaseConfig||!supabase)throw new Error(`PRODUCTION_DOCUMENTS_SUPABASE_REQUIRED:${operation}`)
  if(!organizationId)throw new Error(`PRODUCTION_DOCUMENTS_ORGANIZATION_REQUIRED:${operation}`)
  return true
}

function fromRow(row,history=[]){
  return {
    id:row.code,
    dbId:row.id,
    organizationId:row.organization_id,
    title:row.title,
    type:row.document_type,
    departmentId:row.department_id||null,
    department:row.department_id?'Τμήμα':'Όλο το νοσοκομείο',
    audience:row.audience,
    status:row.status,
    version:row.version,
    description:row.description||'',
    ownerId:row.owner_id||null,
    owner:'',
    revisionOfDbId:row.revision_of_id||null,
    supersedesDbId:row.supersedes_id||null,
    effectiveDate:row.effective_date||'',
    reviewDate:row.review_date||'',
    publishedAt:row.published_at||null,
    publishedById:row.published_by||null,
    createdById:row.created_by||null,
    updatedById:row.updated_by||null,
    createdAt:row.created_at,
    updatedAt:row.updated_at,
    attachments:[],
    history,
  }
}

function localReplace(record,next){
  const rows=loadDocumentsLocal()
  saveDocumentsLocal(rows.map(x=>x.id===record.id?next:x))
  return next
}

function localTransition(record,status,actor,extra={}){
  const now=new Date().toISOString()
  const event={at:now,actor:actor?.name||'Demo user',actorId:actor?.id||null,action:`status:${record.status}->${status}`,reason:`${record.id} · ${record.version||'—'}`}
  return localReplace(record,{...record,...extra,status,updatedAt:now,updatedBy:actor?.name||'Demo user',updatedById:actor?.id||null,history:[event,...(record.history||[])]})
}

function historyAction(event){
  const oldStatus=event?.metadata?.old_status||null
  const newStatus=event?.metadata?.new_status||null
  if(event.event_type==='history_baseline')return `status:${newStatus||'unknown'}`
  if(event.event_type==='insert')return 'created'
  if(event.event_type==='delete')return 'deleted'
  if(oldStatus&&newStatus&&oldStatus!==newStatus)return `status:${oldStatus}->${newStatus}`
  return 'updated'
}

async function loadDocumentHistoryMap(organizationId){
  const {data:events,error}=await supabase.from('system_audit_log').select('id,actor_user_id,actor_role,event_type,entity_id,metadata,created_at').eq('organization_id',organizationId).eq('entity_type','controlled_documents').order('created_at',{ascending:false})
  if(error){
    if(error.code==='42501')return new Map()
    throw error
  }
  const actorIds=[...new Set((events||[]).map(x=>x.actor_user_id).filter(Boolean))]
  const actorNames=new Map()
  if(actorIds.length){
    const {data:profiles,error:profileError}=await supabase.from('profiles').select('id,full_name,username').in('id',actorIds)
    if(!profileError)(profiles||[]).forEach(profile=>actorNames.set(profile.id,profile.full_name||profile.username||''))
  }
  const map=new Map()
  ;(events||[]).forEach(event=>{
    const item={
      at:event.created_at,
      actor:actorNames.get(event.actor_user_id)||event.actor_role||'—',
      actorId:event.actor_user_id||null,
      action:historyAction(event),
      oldStatus:event?.metadata?.old_status||null,
      newStatus:event?.metadata?.new_status||null,
      version:event?.metadata?.version||null,
      reason:event?.metadata?.code||'',
      eventType:event.event_type,
    }
    const current=map.get(event.entity_id)||[]
    current.push(item)
    map.set(event.entity_id,current)
  })
  return map
}

export async function loadDocumentsAsync(organizationId){
  if(!requireProduction(organizationId,'load'))return loadDocumentsLocal()
  const [{data,error},historyMap]=await Promise.all([
    supabase.from('controlled_documents').select(COLUMNS).eq('organization_id',organizationId).order('updated_at',{ascending:false}),
    loadDocumentHistoryMap(organizationId),
  ])
  if(error)throw error
  return (data||[]).map(row=>fromRow(row,historyMap.get(String(row.id))||[]))
}

export async function loadDocumentOwnerProfile(ownerId){
  if(!ownerId||!supabase)return null
  const {data,error}=await supabase.from('profiles').select('id,full_name,username,job_title').eq('id',ownerId).maybeSingle()
  if(error)throw error
  return data||null
}

export async function createDocumentAsync(organizationId,draft,actor,existing=[]){
  if(!requireProduction(organizationId,'create')){
    const now=new Date().toISOString(),id=nextDocumentId(existing)
    const record={...draft,id,status:'draft',createdAt:now,createdBy:actor?.name||'Demo user',createdById:actor?.id||null,updatedAt:now,updatedBy:actor?.name||'Demo user',updatedById:actor?.id||null,history:[]}
    saveDocumentsLocal([record,...existing]);return record
  }
  const code=nextDocumentId(existing)
  const {data,error}=await supabase.from('controlled_documents').insert({organization_id:organizationId,code,title:draft.title,document_type:draft.type,department_id:draft.departmentId||null,audience:draft.audience==='all'?'organization':(draft.audience||'organization'),status:'draft',version:draft.version||'0.1',description:draft.description||null,owner_id:actor?.id||null,effective_date:draft.effectiveDate||null,review_date:draft.reviewDate||null,updated_by:actor?.id||null}).select(COLUMNS).single()
  if(error)throw error
  return fromRow(data)
}

export async function updateDocumentAsync(organizationId,record,patch,actor){
  if(!requireProduction(organizationId,'update')){
    const next={...record,...patch,updatedAt:new Date().toISOString(),updatedBy:actor?.name||'Demo user',updatedById:actor?.id||null}
    return localReplace(record,next)
  }
  if(!record?.dbId)throw new Error('PRODUCTION_DOCUMENT_DB_ID_REQUIRED')
  const payload={updated_by:actor?.id||null,updated_at:new Date().toISOString()}
  if('title'in patch)payload.title=patch.title
  if('type'in patch)payload.document_type=patch.type
  if('departmentId'in patch)payload.department_id=patch.departmentId||null
  if('audience'in patch)payload.audience=patch.audience==='all'?'organization':patch.audience
  if('version'in patch)payload.version=patch.version
  if('description'in patch)payload.description=patch.description||null
  if('effectiveDate'in patch)payload.effective_date=patch.effectiveDate||null
  if('reviewDate'in patch)payload.review_date=patch.reviewDate||null
  const {data,error}=await supabase.from('controlled_documents').update(payload).eq('organization_id',organizationId).eq('id',record.dbId).select(COLUMNS).single()
  if(error)throw error
  return fromRow(data)
}

async function transitionProduction(organizationId,record,status,actor,extra={}){
  if(!record?.dbId)throw new Error('PRODUCTION_DOCUMENT_DB_ID_REQUIRED')
  const payload={status,updated_by:actor?.id||null,updated_at:new Date().toISOString(),...extra}
  const {data,error}=await supabase.from('controlled_documents').update(payload).eq('organization_id',organizationId).eq('id',record.dbId).select(COLUMNS).single()
  if(error)throw error
  return fromRow(data)
}

export async function submitDocumentReviewAsync(organizationId,record,actor){
  if(record.status!=='draft')throw new Error('DOCUMENT_INVALID_TRANSITION')
  if(!requireProduction(organizationId,'submit_review'))return localTransition(record,'review',actor)
  return transitionProduction(organizationId,record,'review',actor)
}

export async function approveDocumentAsync(organizationId,record,actor){
  if(record.status!=='review')throw new Error('DOCUMENT_INVALID_TRANSITION')
  if(!requireProduction(organizationId,'approve'))return localTransition(record,'approved',actor)
  return transitionProduction(organizationId,record,'approved',actor)
}

export async function publishDocumentAsync(organizationId,record,actor){
  if(record.status!=='approved')throw new Error('DOCUMENT_INVALID_TRANSITION')
  const now=new Date().toISOString()
  if(!requireProduction(organizationId,'publish')){
    let rows=loadDocumentsLocal()
    const published={...record,status:'published',publishedAt:now,publishedBy:actor?.name||'Demo user',publishedById:actor?.id||null,updatedAt:now,updatedBy:actor?.name||'Demo user',updatedById:actor?.id||null}
    rows=rows.map(x=>x.id===record.id?published:x)
    if(record.supersedesId)rows=rows.map(x=>x.id===record.supersedesId?{...x,status:'superseded',supersededById:record.id,updatedAt:now}:x)
    saveDocumentsLocal(rows)
    return published
  }
  const published=await transitionProduction(organizationId,record,'published',actor,{published_at:now,published_by:actor?.id||null})
  if(record.supersedesDbId){
    const {error}=await supabase.from('controlled_documents').update({status:'superseded',updated_by:actor?.id||null,updated_at:now}).eq('organization_id',organizationId).eq('id',record.supersedesDbId)
    if(error)throw error
  }
  return published
}

export async function archiveDocumentAsync(organizationId,record,actor){
  if(record.status!=='published')throw new Error('DOCUMENT_INVALID_TRANSITION')
  if(!requireProduction(organizationId,'archive'))return localTransition(record,'archived',actor)
  return transitionProduction(organizationId,record,'archived',actor)
}

export async function createDocumentRevisionAsync(organizationId,record,actor,existing=[]){
  if(record.status!=='published')throw new Error('DOCUMENT_REVISION_REQUIRES_PUBLISHED_SOURCE')
  const version=nextRevisionVersion(record.version)
  if(!requireProduction(organizationId,'revision')){
    const now=new Date().toISOString(),next={...record,id:nextDocumentId(existing),status:'draft',version,revisionOfId:record.id,supersedesId:record.id,supersededById:null,publishedAt:null,publishedBy:null,publishedById:null,createdAt:now,createdBy:actor?.name||'Demo user',createdById:actor?.id||null,updatedAt:now,updatedBy:actor?.name||'Demo user',updatedById:actor?.id||null,history:[]}
    saveDocumentsLocal([next,...loadDocumentsLocal()]);return next
  }
  if(!record.dbId)throw new Error('PRODUCTION_DOCUMENT_DB_ID_REQUIRED')
  const code=nextDocumentId(existing)
  const {data,error}=await supabase.from('controlled_documents').insert({organization_id:organizationId,code,title:record.title,document_type:record.type,department_id:record.departmentId||null,audience:record.audience||'organization',status:'draft',version,description:record.description||null,owner_id:record.ownerId||actor?.id||null,revision_of_id:record.dbId,supersedes_id:record.dbId,effective_date:record.effectiveDate||null,review_date:record.reviewDate||null,updated_by:actor?.id||null}).select(COLUMNS).single()
  if(error)throw error
  return fromRow(data)
}

export async function deleteDocumentDraftAsync(organizationId,record){
  if(record.status!=='draft')throw new Error('DOCUMENT_DELETE_REQUIRES_DRAFT')
  if(!requireProduction(organizationId,'delete')){const rows=loadDocumentsLocal();saveDocumentsLocal(rows.filter(x=>x.id!==record.id));return}
  if(!record?.dbId)throw new Error('PRODUCTION_DOCUMENT_DB_ID_REQUIRED')
  const {error}=await supabase.from('controlled_documents').delete().eq('organization_id',organizationId).eq('id',record.dbId)
  if(error)throw error
}
