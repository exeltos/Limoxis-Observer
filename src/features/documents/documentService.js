import { supabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { loadDocuments as loadDocumentsLocal, saveDocuments as saveDocumentsLocal, nextDocumentId } from './documentStore'

const COLUMNS='id,organization_id,code,title,document_type,department_id,audience,status,version,description,owner_id,revision_of_id,supersedes_id,effective_date,review_date,published_at,published_by,created_by,updated_by,created_at,updated_at'

function requireProduction(organizationId,operation){
  if(isDemoDataEnvironment())return false
  if(!hasSupabaseConfig||!supabase)throw new Error(`PRODUCTION_DOCUMENTS_SUPABASE_REQUIRED:${operation}`)
  if(!organizationId)throw new Error(`PRODUCTION_DOCUMENTS_ORGANIZATION_REQUIRED:${operation}`)
  return true
}

function fromRow(row){
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
    owner:row.owner_id||'',
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
    history:[],
  }
}

export async function loadDocumentsAsync(organizationId){
  if(!requireProduction(organizationId,'load'))return loadDocumentsLocal()
  const {data,error}=await supabase.from('controlled_documents').select(COLUMNS).eq('organization_id',organizationId).order('updated_at',{ascending:false})
  if(error)throw error
  return (data||[]).map(fromRow)
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
    const rows=loadDocumentsLocal();const next={...record,...patch,updatedAt:new Date().toISOString(),updatedBy:actor?.name||'Demo user',updatedById:actor?.id||null};saveDocumentsLocal(rows.map(x=>x.id===record.id?next:x));return next
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
  if('status'in patch)payload.status=patch.status
  if('publishedAt'in patch)payload.published_at=patch.publishedAt||null
  if('publishedById'in patch)payload.published_by=patch.publishedById||null
  const {data,error}=await supabase.from('controlled_documents').update(payload).eq('organization_id',organizationId).eq('id',record.dbId).select(COLUMNS).single()
  if(error)throw error
  return fromRow(data)
}

export async function deleteDocumentDraftAsync(organizationId,record){
  if(!requireProduction(organizationId,'delete')){const rows=loadDocumentsLocal();saveDocumentsLocal(rows.filter(x=>x.id!==record.id));return}
  if(!record?.dbId)throw new Error('PRODUCTION_DOCUMENT_DB_ID_REQUIRED')
  const {error}=await supabase.from('controlled_documents').delete().eq('organization_id',organizationId).eq('id',record.dbId)
  if(error)throw error
}
