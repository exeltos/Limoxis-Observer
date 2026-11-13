import { supabase } from '../../core/supabase/client'
import { isOwnerPreview } from '../../core/preview/ownerPreview'
import { demoLibrarySeed, type LibraryTuple } from './managementData'
import type { DepartmentLibraryRow, ExternalReference, ExternalReferenceDraft, ExternalReferenceRow, IndicatorDefinitionRow, LibraryItemRow, LibraryMeta, ManagedIndicatorDefinition, ManagedIndicatorDefinitionDraft } from './managementTypes'
import type { Json } from '../../core/supabase/database.types'

export type { LibraryTuple }
export type LibraryMap = Record<string, LibraryTuple[]>
type LibraryRow = LibraryTuple | null | undefined
type LibraryNames = { nameEl: string, nameEn?: string, departmentType?: string|null }

const assertCloud=(organizationId: string|null|undefined)=>{
  if(!supabase) throw new Error('Supabase is not configured.')
  if(!organizationId) throw new Error('Organization is required.')
  return supabase
}

const isUuid=(value: unknown)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||''))

// The metadata column is a json object (system, locked, jobDescription…).
const metaOf=(row: LibraryItemRow)=>row.metadata as LibraryMeta|null
const toLibraryTuple=(row: LibraryItemRow): LibraryTuple=>[
  row.name_el,
  row.name_en||row.name_el,
  {id:row.id,active:row.is_active!==false,system:Boolean(metaOf(row)?.system),locked:Boolean(metaOf(row)?.locked),source:row.source_authority||'Hospital',version:row.source_version||'local',code:row.code||null,...(row.category?{category:row.category}:{}),...(metaOf(row)?.jobDescription?{jobDescription:metaOf(row)!.jobDescription}:{})},
]

// departments.department_type drives neonatal/paediatric logic (clinical scale
// recommendations, NICU/PICU context); the check constraint allows these values.
export const DEPARTMENT_TYPES=Object.freeze(['general','icu','nicu','picu'])
export const departmentTypeValue=(value: string|null|undefined)=>value&&DEPARTMENT_TYPES.includes(value)?value:'general'
const departmentTuple=(row: DepartmentLibraryRow): LibraryTuple=>[row.name,row.name,{id:row.id,system:false,locked:false,source:'Hospital',version:'local',code:row.code||null,departmentType:departmentTypeValue(row.department_type)}]

export async function loadManagementLibraries(organizationId: string): Promise<LibraryMap>{
  const supabase=assertCloud(organizationId)
  const [{data:departments,error:departmentError},{data:items,error:itemError}]=await Promise.all([
    supabase.from('departments').select('id,name,code,is_active,department_type').eq('organization_id',organizationId).eq('is_active',true).order('name'),
    supabase.from('master_library_items').select('id,library_key,code,name_el,name_en,category,metadata,source_authority,source_version,is_active').eq('organization_id',organizationId).eq('is_active',true).order('name_el'),
  ])
  if(departmentError) throw departmentError
  if(itemError) throw itemError
  const result: LibraryMap={departments:(departments||[]).map(departmentTuple)}
  for(const row of items||[]){if(!result[row.library_key])result[row.library_key]=[];result[row.library_key].push(toLibraryTuple(row))}
  return result
}

export async function createManagementLibraryItem(organizationId: string,libraryKey: string,{nameEl,nameEn,departmentType}: LibraryNames){
  const supabase=assertCloud(organizationId)
  if(libraryKey==='departments'){
    const cleanName=String(nameEl||'').trim()
    if(!cleanName)throw new Error('Department name is required.')
    const {data:existing,error:existingError}=await supabase.from('departments').select('id,name,code,is_active,department_type').eq('organization_id',organizationId).ilike('name',cleanName).maybeSingle()
    if(existingError) throw existingError
    if(existing){
      if(existing.is_active===false){
        const {data:reactivated,error:reactivateError}=await supabase.from('departments').update({is_active:true,name:cleanName,...(departmentType?{department_type:departmentTypeValue(departmentType)}:{})}).eq('organization_id',organizationId).eq('id',existing.id).select('id,name,code,department_type').single()
        if(reactivateError)throw reactivateError
        return departmentTuple(reactivated)
      }
      return departmentTuple(existing)
    }
    const {data,error}=await supabase.from('departments').insert({organization_id:organizationId,name:cleanName,department_type:departmentTypeValue(departmentType)}).select('id,name,code,department_type').single()
    if(error) throw error
    return departmentTuple(data)
  }
  const {data,error}=await supabase.from('master_library_items').insert({organization_id:organizationId,library_key:libraryKey,name_el:nameEl,name_en:nameEn||nameEl,metadata:{system:false,locked:false},source_authority:'Hospital',source_version:'local'}).select('id,library_key,code,name_el,name_en,metadata,source_authority,source_version').single()
  if(error) throw error
  return toLibraryTuple(data)
}

export async function updateManagementLibraryItem(organizationId: string,libraryKey: string,row: LibraryRow,{nameEl,nameEn,departmentType}: LibraryNames){
  const supabase=assertCloud(organizationId);const id=row?.[2]?.id;if(!id)throw new Error('Cloud library item id is missing.')
  if(libraryKey==='departments'){
    const {data,error}=await supabase.from('departments').update({name:nameEl,department_type:departmentTypeValue(departmentType??row?.[2]?.departmentType)}).eq('organization_id',organizationId).eq('id',id).select('id,name,code,department_type').single()
    if(error) throw error
    return departmentTuple(data)
  }
  const system=Boolean(row?.[2]?.system)
  const {data,error}=await supabase.from('master_library_items').update({name_el:nameEl,name_en:nameEn||nameEl,source_authority:system?'Limoxis System':(row?.[2]?.source||'Hospital'),source_version:system?(row?.[2]?.version||'current'):'local',metadata:{system,locked:system,...(row?.[2]?.jobDescription?{jobDescription:row[2].jobDescription as Json}:{})}}).eq('organization_id',organizationId).eq('id',id).select('id,library_key,code,name_el,name_en,metadata,source_authority,source_version').single()
  if(error) throw error
  return toLibraryTuple(data)
}

// Job description of a job position, kept in the library item's metadata.
export async function saveJobDescription(organizationId: string,row: LibraryRow,jobDescription: Json){
  const supabase=assertCloud(organizationId);const id=row?.[2]?.id;if(!id)throw new Error('Cloud library item id is missing.')
  const {data:current,error:loadError}=await supabase.from('master_library_items').select('metadata').eq('organization_id',organizationId).eq('id',id).single()
  if(loadError) throw loadError
  const {data,error}=await supabase.from('master_library_items').update({metadata:{...((current?.metadata||{}) as Record<string, Json>),jobDescription}}).eq('organization_id',organizationId).eq('id',id).select('id,library_key,code,name_el,name_en,metadata,source_authority,source_version').single()
  if(error) throw error
  return toLibraryTuple(data)
}

export async function removeManagementLibraryItem(organizationId: string,libraryKey: string,row: LibraryRow){
  const supabase=assertCloud(organizationId);const id=row?.[2]?.id;if(!id)throw new Error('Cloud library item id is missing.')
  const table=libraryKey==='departments'?'departments':'master_library_items'
  const {error}=await supabase.from(table).update({is_active:false}).eq('organization_id',organizationId).eq('id',id);if(error)throw error
}

const requireCloud=()=>{if(!supabase)throw new Error('Supabase is not configured.');return supabase}

// Global (organization_id is null) master library rows: edits here fan out to
// every organization's linked copy via the master_library_items_propagate trigger.
// The three pre-catalogue rows that still sit in the platform library until the owner deactivates them.
const PREVIEW_LEGACY_NOTIFIABLE=[['Ιογενής ηπατίτιδα Α','Viral hepatitis A','ND-HEPA'],['Λεγιονέλλωση','Legionellosis','ND-LEGIONELLA'],['Λοίμωξη από ιό Δυτικού Νείλου','West Nile virus infection','ND-WNV']].map(([el,en,code]): LibraryTuple=>[el,en,{id:`preview-${code}`,active:true,system:true,locked:true,source:'ΕΟΔΥ · υποχρεωτική δήλωση',version:'current',code}])
export async function loadGlobalLibraryItems(){
  // Platform Owner preview (help screenshots): the shipped catalogues stand in for the global rows.
  if(isOwnerPreview()){const {departments,...shared}=structuredClone(demoLibrarySeed);void departments;shared.notifiableDiseases=[...(shared.notifiableDiseases||[]),...PREVIEW_LEGACY_NOTIFIABLE];return shared}
  const supabase=requireCloud()
  const {data,error}=await supabase.from('master_library_items').select('id,library_key,code,name_el,name_en,metadata,source_authority,source_version,is_active').is('organization_id',null).order('name_el')
  if(error) throw error
  const result: LibraryMap={}
  for(const row of data||[]){if(!result[row.library_key])result[row.library_key]=[];result[row.library_key].push(toLibraryTuple(row))}
  return result
}

export async function createGlobalLibraryItem(libraryKey: string,{nameEl,nameEn}: LibraryNames){
  const supabase=requireCloud()
  const {data,error}=await supabase.from('master_library_items').insert({organization_id:null,library_key:libraryKey,name_el:nameEl,name_en:nameEn||nameEl,metadata:{system:true,locked:true},source_authority:'Limoxis System',source_version:'current'}).select('id,library_key,code,name_el,name_en,metadata,source_authority,source_version').single()
  if(error) throw error
  return toLibraryTuple(data)
}

// isActive (optional) switches the row on or off for every hospital's linked copy; the audit trigger records the actor.
export async function updateGlobalLibraryItem(row: LibraryRow,{nameEl,nameEn,isActive}: {nameEl: string,nameEn?: string,isActive?: boolean}): Promise<LibraryTuple>{
  if(isOwnerPreview()){const meta=row?.[2]||{};return [nameEl,nameEn||nameEl,{...meta,...(typeof isActive==='boolean'?{active:isActive}:{})}]}
  const supabase=requireCloud();const id=row?.[2]?.id;if(!id)throw new Error('Cloud library item id is missing.')
  const {data,error}=await supabase.from('master_library_items').update({name_el:nameEl,name_en:nameEn||nameEl,...(typeof isActive==='boolean'?{is_active:isActive}:{})}).is('organization_id',null).eq('id',id).select('id,library_key,code,name_el,name_en,metadata,source_authority,source_version,is_active').single()
  if(error) throw error
  return toLibraryTuple(data)
}

export async function removeGlobalLibraryItem(row: LibraryRow){
  const supabase=requireCloud();const id=row?.[2]?.id;if(!id)throw new Error('Cloud library item id is missing.')
  const {error}=await supabase.from('master_library_items').update({is_active:false}).is('organization_id',null).eq('id',id)
  if(error) throw error
}

export async function loadGlobalExternalReferences(){
  const supabase=requireCloud()
  const {data,error}=await supabase.from('external_reference_versions').select('id,organization_id,source_key,authority,title,source_url,version_label,checked_at,status,metadata').is('organization_id',null).order('authority')
  if(error) throw error
  return (data||[]).map(toExternalReference)
}

export async function saveGlobalExternalReference(item: ExternalReferenceDraft){
  const supabase=requireCloud()
  const payload={organization_id:null,source_key:(item.sourceKey||item.id) as string,authority:item.authority as string,title:(item.label||item.authority) as string,source_url:item.url||null,version_label:item.version||null,checked_at:new Date().toISOString(),status:item.status||'approved',metadata:{scope:item.scope||'',scope_en:item.scopeEn||item.scope||'',version_en:item.versionEn||item.version||''}}
  const existingId=isUuid(item.id)?item.id:null
  const query=existingId?supabase.from('external_reference_versions').update(payload).is('organization_id',null).eq('id',existingId):supabase.from('external_reference_versions').insert(payload)
  const {data,error}=await query.select('id,organization_id,source_key,authority,title,source_url,version_label,checked_at,status,metadata').single()
  if(error) throw error
  return toExternalReference(data)
}

export async function removeGlobalExternalReference(item: ExternalReferenceDraft){
  const supabase=requireCloud()
  if(!isUuid(item?.id))return
  const {error}=await supabase.from('external_reference_versions').delete().is('organization_id',null).eq('id',item.id as string)
  if(error) throw error
}

export async function loadCustomRoles(organizationId: string){
  const supabase=assertCloud(organizationId)
  const {data:roles,error}=await supabase.from('custom_roles').select('id,name,description,is_active').eq('organization_id',organizationId).eq('is_active',true).order('name');if(error)throw error
  const ids=(roles||[]).map(row=>row.id);if(!ids.length)return []
  const {data:caps,error:capError}=await supabase.from('custom_role_capabilities').select('custom_role_id,capability').in('custom_role_id',ids);if(capError)throw capError
  return (roles||[]).map(row=>({...row,capabilities:(caps||[]).filter(cap=>cap.custom_role_id===row.id).map(cap=>cap.capability)}))
}

type CustomRoleInput = {id?: string|null,name: string,description?: string,capabilities?: (string|null|undefined)[]}
async function saveCustomRoleRpc(organizationId: string,{id=null,name,description='',capabilities}: CustomRoleInput){
  const supabase=assertCloud(organizationId)
  const cleanCapabilities=[...new Set((capabilities||[]).filter(Boolean))] as string[]
  const {data,error}=await supabase.rpc('save_custom_role',{p_organization_id:organizationId,p_role_id:(id||null) as string,p_name:name,p_description:(description||null) as string|undefined,p_capabilities:cleanCapabilities})
  if(error)throw error
  return data
}

export async function createCustomRole(organizationId: string,{name,description='',capabilities}: CustomRoleInput){
  return saveCustomRoleRpc(organizationId,{name,description,capabilities})
}

export async function updateCustomRole(organizationId: string,roleId: string,{name,description='',capabilities}: CustomRoleInput){
  if(!roleId)throw new Error('Custom role id is required.')
  return saveCustomRoleRpc(organizationId,{id:roleId,name,description,capabilities})
}

export async function deactivateCustomRole(organizationId: string,roleId: string){
  const supabase=assertCloud(organizationId)
  const {error}=await supabase.from('custom_roles').update({is_active:false}).eq('organization_id',organizationId).eq('id',roleId);if(error)throw error
}

const referenceMeta=(row: ExternalReferenceRow)=>row.metadata as {scope?: string,scope_en?: string,version_en?: string}|null
const toExternalReference=(row: ExternalReferenceRow): ExternalReference=>({
  id:row.id,label:row.title,authority:row.authority,version:row.version_label||'',versionEn:referenceMeta(row)?.version_en||row.version_label||'',status:row.status||'approved',scope:referenceMeta(row)?.scope||'',scopeEn:referenceMeta(row)?.scope_en||referenceMeta(row)?.scope||'',sourceKey:row.source_key,url:row.source_url||'',checkedAt:row.checked_at||null,isGlobal:row.organization_id==null,organizationId:row.organization_id||null,
})

export async function loadExternalReferences(organizationId: string|null|undefined){
  const supabase=assertCloud(organizationId)
  const {data,error}=await supabase.from('external_reference_versions').select('id,organization_id,source_key,authority,title,source_url,version_label,checked_at,status,metadata').or(`organization_id.eq.${organizationId},organization_id.is.null`).order('authority');if(error)throw error
  return (data||[]).map(toExternalReference)
}

export async function updateExternalReference(organizationId: string,item: ExternalReferenceDraft){
  const supabase=assertCloud(organizationId)
  const targetOrganization=item.isGlobal?null:organizationId
  const payload={organization_id:targetOrganization,source_key:(item.sourceKey||item.id) as string,authority:item.authority as string,title:(item.label||item.authority) as string,source_url:item.url||null,version_label:item.version||null,checked_at:new Date().toISOString(),status:item.status||'approved',metadata:{scope:item.scope||'',scope_en:item.scopeEn||item.scope||'',version_en:item.versionEn||item.version||''}}
  const existingId=isUuid(item.id)?item.id:null
  let query
  if(existingId){query=supabase.from('external_reference_versions').update(payload).eq('id',existingId);query=item.isGlobal?query.is('organization_id',null):query.eq('organization_id',organizationId)}
  else query=supabase.from('external_reference_versions').insert(payload)
  const {data,error}=await query.select('id,organization_id,source_key,authority,title,source_url,version_label,checked_at,status,metadata').single();if(error)throw error
  return toExternalReference(data)
}

export async function removeExternalReference(organizationId: string,item: ExternalReferenceDraft){
  const supabase=assertCloud(organizationId)
  if(!isUuid(item?.id))return
  let query=supabase.from('external_reference_versions').delete().eq('id',item.id as string)
  query=item.isGlobal?query.is('organization_id',null):query.eq('organization_id',organizationId)
  const {error}=await query;if(error)throw error
}

const toIndicatorDefinition=(row: IndicatorDefinitionRow): ManagedIndicatorDefinition=>({id:row.id,organizationId:row.organization_id||null,system:row.organization_id==null,key:row.indicator_key,version:row.version,titleEl:row.title_el,titleEn:row.title_en,category:row.category,numeratorDefinition:row.numerator_definition||{},denominatorDefinition:row.denominator_definition||{},multiplier:Number(row.multiplier||1),unit:row.unit||'',sourceAuthority:row.source_authority||'',effectiveFrom:row.effective_from||'',effectiveTo:row.effective_to||'',status:row.status||'draft'})

export async function loadIndicatorDefinitions(organizationId: string){
  const supabase=assertCloud(organizationId)
  const {data,error}=await supabase.from('indicator_definitions').select('id,organization_id,indicator_key,version,title_el,title_en,category,numerator_definition,denominator_definition,multiplier,unit,source_authority,effective_from,effective_to,status').or(`organization_id.eq.${organizationId},organization_id.is.null`).order('category').order('title_el');if(error)throw error
  return (data||[]).map(toIndicatorDefinition)
}

export async function saveIndicatorDefinition(organizationId: string,item: ManagedIndicatorDefinitionDraft){
  const supabase=assertCloud(organizationId)
  const {data:userData}=await supabase.auth.getUser();const actor=userData?.user?.id||null
  const payload={organization_id:item.system?null:organizationId,indicator_key:String(item.key||'').trim(),version:String(item.version||'1.0').trim(),title_el:String(item.titleEl||'').trim(),title_en:String(item.titleEn||item.titleEl||'').trim(),category:String(item.category||'general').trim(),numerator_definition:item.numeratorDefinition||{},denominator_definition:item.denominatorDefinition||{},multiplier:Number(item.multiplier||1),unit:item.unit||null,source_authority:item.sourceAuthority||null,effective_from:item.effectiveFrom||null,effective_to:item.effectiveTo||null,status:item.status||'draft',created_by:actor}
  let query=isUuid(item.id)?supabase.from('indicator_definitions').update(payload).eq('id',item.id as string):supabase.from('indicator_definitions').insert(payload)
  query=item.system&&isUuid(item.id)?query.is('organization_id',null):query
  const {data,error}=await query.select('id,organization_id,indicator_key,version,title_el,title_en,category,numerator_definition,denominator_definition,multiplier,unit,source_authority,effective_from,effective_to,status').single();if(error)throw error
  return toIndicatorDefinition(data)
}

export async function removeIndicatorDefinition(organizationId: string,item: ManagedIndicatorDefinitionDraft){
  const supabase=assertCloud(organizationId);if(!isUuid(item?.id))return
  let query=supabase.from('indicator_definitions').delete().eq('id',item.id as string)
  query=item.system?query.is('organization_id',null):query.eq('organization_id',organizationId)
  const {error}=await query;if(error)throw error
}
