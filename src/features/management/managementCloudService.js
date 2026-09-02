import { supabase } from '../../core/supabase/client'

const assertCloud=(organizationId)=>{
  if(!supabase) throw new Error('Supabase is not configured.')
  if(!organizationId) throw new Error('Organization is required.')
}

const isUuid=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||''))

const toLibraryTuple=row=>[
  row.name_el,
  row.name_en||row.name_el,
  {id:row.id,system:Boolean(row.metadata?.system),locked:Boolean(row.metadata?.locked),source:row.source_authority||'Hospital',version:row.source_version||'local',code:row.code||null},
]

export async function loadManagementLibraries(organizationId){
  assertCloud(organizationId)
  const [{data:departments,error:departmentError},{data:items,error:itemError}]=await Promise.all([
    supabase.from('departments').select('id,name,code,is_active').eq('organization_id',organizationId).eq('is_active',true).order('name'),
    supabase.from('master_library_items').select('id,library_key,code,name_el,name_en,metadata,source_authority,source_version,is_active').eq('organization_id',organizationId).eq('is_active',true).order('name_el'),
  ])
  if(departmentError) throw departmentError
  if(itemError) throw itemError
  const result={departments:(departments||[]).map(row=>[row.name,row.name,{id:row.id,system:false,locked:false,source:'Hospital',version:'local',code:row.code||null}])}
  for(const row of items||[]){if(!result[row.library_key])result[row.library_key]=[];result[row.library_key].push(toLibraryTuple(row))}
  return result
}

export async function createManagementLibraryItem(organizationId,libraryKey,{nameEl,nameEn}){
  assertCloud(organizationId)
  if(libraryKey==='departments'){
    const {data,error}=await supabase.from('departments').insert({organization_id:organizationId,name:nameEl}).select('id,name,code').single()
    if(error) throw error
    return [data.name,data.name,{id:data.id,system:false,locked:false,source:'Hospital',version:'local',code:data.code||null}]
  }
  const {data,error}=await supabase.from('master_library_items').insert({organization_id:organizationId,library_key:libraryKey,name_el:nameEl,name_en:nameEn||nameEl,metadata:{system:false,locked:false},source_authority:'Hospital',source_version:'local'}).select('id,library_key,code,name_el,name_en,metadata,source_authority,source_version').single()
  if(error) throw error
  return toLibraryTuple(data)
}

export async function updateManagementLibraryItem(organizationId,libraryKey,row,{nameEl,nameEn}){
  assertCloud(organizationId);const id=row?.[2]?.id;if(!id)throw new Error('Cloud library item id is missing.')
  if(libraryKey==='departments'){
    const {data,error}=await supabase.from('departments').update({name:nameEl}).eq('organization_id',organizationId).eq('id',id).select('id,name,code').single()
    if(error) throw error
    return [data.name,data.name,{id:data.id,system:false,locked:false,source:'Hospital',version:'local',code:data.code||null}]
  }
  const system=Boolean(row?.[2]?.system)
  const {data,error}=await supabase.from('master_library_items').update({name_el:nameEl,name_en:nameEn||nameEl,source_authority:system?'Limoxis System':(row?.[2]?.source||'Hospital'),source_version:system?(row?.[2]?.version||'current'):'local',metadata:{system,locked:system}}).eq('organization_id',organizationId).eq('id',id).select('id,library_key,code,name_el,name_en,metadata,source_authority,source_version').single()
  if(error) throw error
  return toLibraryTuple(data)
}

export async function removeManagementLibraryItem(organizationId,libraryKey,row){
  assertCloud(organizationId);const id=row?.[2]?.id;if(!id)throw new Error('Cloud library item id is missing.')
  const table=libraryKey==='departments'?'departments':'master_library_items'
  const {error}=await supabase.from(table).update({is_active:false}).eq('organization_id',organizationId).eq('id',id);if(error)throw error
}

export async function loadCustomRoles(organizationId){
  assertCloud(organizationId)
  const {data:roles,error}=await supabase.from('custom_roles').select('id,name,description,is_active').eq('organization_id',organizationId).eq('is_active',true).order('name');if(error)throw error
  const ids=(roles||[]).map(row=>row.id);if(!ids.length)return []
  const {data:caps,error:capError}=await supabase.from('custom_role_capabilities').select('custom_role_id,capability').in('custom_role_id',ids);if(capError)throw capError
  return (roles||[]).map(row=>({...row,capabilities:(caps||[]).filter(cap=>cap.custom_role_id===row.id).map(cap=>cap.capability)}))
}

async function saveCustomRoleRpc(organizationId,{id=null,name,description='',capabilities}){
  assertCloud(organizationId)
  const cleanCapabilities=[...new Set((capabilities||[]).filter(Boolean))]
  const {data,error}=await supabase.rpc('save_custom_role',{p_organization_id:organizationId,p_role_id:id||null,p_name:name,p_description:description||null,p_capabilities:cleanCapabilities})
  if(error)throw error
  return data
}

export async function createCustomRole(organizationId,{name,description='',capabilities}){
  return saveCustomRoleRpc(organizationId,{name,description,capabilities})
}

export async function updateCustomRole(organizationId,roleId,{name,description='',capabilities}){
  if(!roleId)throw new Error('Custom role id is required.')
  return saveCustomRoleRpc(organizationId,{id:roleId,name,description,capabilities})
}

export async function deactivateCustomRole(organizationId,roleId){
  assertCloud(organizationId)
  const {error}=await supabase.from('custom_roles').update({is_active:false}).eq('organization_id',organizationId).eq('id',roleId);if(error)throw error
}

const toExternalReference=row=>({
  id:row.id,label:row.title,authority:row.authority,version:row.version_label||'',versionEn:row.metadata?.version_en||row.version_label||'',status:row.status||'approved',scope:row.metadata?.scope||'',scopeEn:row.metadata?.scope_en||row.metadata?.scope||'',sourceKey:row.source_key,url:row.source_url||'',checkedAt:row.checked_at||null,isGlobal:row.organization_id==null,organizationId:row.organization_id||null,
})

export async function loadExternalReferences(organizationId){
  assertCloud(organizationId)
  const {data,error}=await supabase.from('external_reference_versions').select('id,organization_id,source_key,authority,title,source_url,version_label,checked_at,status,metadata').or(`organization_id.eq.${organizationId},organization_id.is.null`).order('authority');if(error)throw error
  return (data||[]).map(toExternalReference)
}

export async function updateExternalReference(organizationId,item){
  assertCloud(organizationId)
  const targetOrganization=item.isGlobal?null:organizationId
  const payload={organization_id:targetOrganization,source_key:item.sourceKey||item.id,authority:item.authority,title:item.label||item.authority,source_url:item.url||null,version_label:item.version||null,checked_at:new Date().toISOString(),status:item.status||'approved',metadata:{scope:item.scope||'',scope_en:item.scopeEn||item.scope||'',version_en:item.versionEn||item.version||''}}
  const existingId=isUuid(item.id)?item.id:null
  let query
  if(existingId){query=supabase.from('external_reference_versions').update(payload).eq('id',existingId);query=item.isGlobal?query.is('organization_id',null):query.eq('organization_id',organizationId)}
  else query=supabase.from('external_reference_versions').insert(payload)
  const {data,error}=await query.select('id,organization_id,source_key,authority,title,source_url,version_label,checked_at,status,metadata').single();if(error)throw error
  return toExternalReference(data)
}

export async function removeExternalReference(organizationId,item){
  assertCloud(organizationId)
  if(!isUuid(item?.id))return
  let query=supabase.from('external_reference_versions').delete().eq('id',item.id)
  query=item.isGlobal?query.is('organization_id',null):query.eq('organization_id',organizationId)
  const {error}=await query;if(error)throw error
}

const toIndicatorDefinition=row=>({id:row.id,organizationId:row.organization_id||null,system:row.organization_id==null,key:row.indicator_key,version:row.version,titleEl:row.title_el,titleEn:row.title_en,category:row.category,numeratorDefinition:row.numerator_definition||{},denominatorDefinition:row.denominator_definition||{},multiplier:Number(row.multiplier||1),unit:row.unit||'',sourceAuthority:row.source_authority||'',effectiveFrom:row.effective_from||'',effectiveTo:row.effective_to||'',status:row.status||'draft'})

export async function loadIndicatorDefinitions(organizationId){
  assertCloud(organizationId)
  const {data,error}=await supabase.from('indicator_definitions').select('id,organization_id,indicator_key,version,title_el,title_en,category,numerator_definition,denominator_definition,multiplier,unit,source_authority,effective_from,effective_to,status').or(`organization_id.eq.${organizationId},organization_id.is.null`).order('category').order('title_el');if(error)throw error
  return (data||[]).map(toIndicatorDefinition)
}

export async function saveIndicatorDefinition(organizationId,item){
  assertCloud(organizationId)
  const {data:userData}=await supabase.auth.getUser();const actor=userData?.user?.id||null
  const payload={organization_id:item.system?null:organizationId,indicator_key:String(item.key||'').trim(),version:String(item.version||'1.0').trim(),title_el:String(item.titleEl||'').trim(),title_en:String(item.titleEn||item.titleEl||'').trim(),category:String(item.category||'general').trim(),numerator_definition:item.numeratorDefinition||{},denominator_definition:item.denominatorDefinition||{},multiplier:Number(item.multiplier||1),unit:item.unit||null,source_authority:item.sourceAuthority||null,effective_from:item.effectiveFrom||null,effective_to:item.effectiveTo||null,status:item.status||'draft',created_by:actor}
  let query=isUuid(item.id)?supabase.from('indicator_definitions').update(payload).eq('id',item.id):supabase.from('indicator_definitions').insert(payload)
  query=item.system&&isUuid(item.id)?query.is('organization_id',null):query
  const {data,error}=await query.select('id,organization_id,indicator_key,version,title_el,title_en,category,numerator_definition,denominator_definition,multiplier,unit,source_authority,effective_from,effective_to,status').single();if(error)throw error
  return toIndicatorDefinition(data)
}

export async function removeIndicatorDefinition(organizationId,item){
  assertCloud(organizationId);if(!isUuid(item?.id))return
  let query=supabase.from('indicator_definitions').delete().eq('id',item.id)
  query=item.system?query.is('organization_id',null):query.eq('organization_id',organizationId)
  const {error}=await query;if(error)throw error
}
