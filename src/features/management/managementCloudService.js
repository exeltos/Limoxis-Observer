import { supabase } from '../../core/supabase/client'

const assertCloud=(organizationId)=>{
  if(!supabase) throw new Error('Supabase is not configured.')
  if(!organizationId) throw new Error('Organization is required.')
}

const toLibraryTuple=row=>[
  row.name_el,
  row.name_en||row.name_el,
  {
    id:row.id,
    system:Boolean(row.metadata?.system),
    locked:Boolean(row.metadata?.locked),
    source:row.source_authority||'Hospital',
    version:row.source_version||'local',
    code:row.code||null,
  },
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
  for(const row of items||[]){
    if(!result[row.library_key]) result[row.library_key]=[]
    result[row.library_key].push(toLibraryTuple(row))
  }
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
  assertCloud(organizationId)
  const id=row?.[2]?.id
  if(!id) throw new Error('Cloud library item id is missing.')
  if(libraryKey==='departments'){
    const {data,error}=await supabase.from('departments').update({name:nameEl}).eq('organization_id',organizationId).eq('id',id).select('id,name,code').single()
    if(error) throw error
    return [data.name,data.name,{id:data.id,system:false,locked:false,source:'Hospital',version:'local',code:data.code||null}]
  }
  const {data,error}=await supabase.from('master_library_items').update({name_el:nameEl,name_en:nameEn||nameEl,source_authority:row?.[2]?.system?'Hospital override':(row?.[2]?.source||'Hospital'),source_version:'local',metadata:{...(row?.[2]||{}),id:undefined,system:false,locked:false}}).eq('organization_id',organizationId).eq('id',id).select('id,library_key,code,name_el,name_en,metadata,source_authority,source_version').single()
  if(error) throw error
  return toLibraryTuple(data)
}

export async function removeManagementLibraryItem(organizationId,libraryKey,row){
  assertCloud(organizationId)
  const id=row?.[2]?.id
  if(!id) throw new Error('Cloud library item id is missing.')
  const table=libraryKey==='departments'?'departments':'master_library_items'
  const {error}=await supabase.from(table).update({is_active:false}).eq('organization_id',organizationId).eq('id',id)
  if(error) throw error
}

export async function loadCustomRoles(organizationId){
  assertCloud(organizationId)
  const {data:roles,error}=await supabase.from('custom_roles').select('id,name,description,is_active').eq('organization_id',organizationId).eq('is_active',true).order('name')
  if(error) throw error
  const ids=(roles||[]).map(row=>row.id)
  if(!ids.length) return []
  const {data:caps,error:capError}=await supabase.from('custom_role_capabilities').select('custom_role_id,capability').in('custom_role_id',ids)
  if(capError) throw capError
  return (roles||[]).map(row=>({...row,capabilities:(caps||[]).filter(cap=>cap.custom_role_id===row.id).map(cap=>cap.capability)}))
}

export async function createCustomRole(organizationId,{name,capabilities}){
  assertCloud(organizationId)
  const {data:role,error}=await supabase.from('custom_roles').insert({organization_id:organizationId,name}).select('id,name,description,is_active').single()
  if(error) throw error
  const rows=(capabilities||[]).map(capability=>({custom_role_id:role.id,capability}))
  if(rows.length){
    const {error:capError}=await supabase.from('custom_role_capabilities').insert(rows)
    if(capError){await supabase.from('custom_roles').delete().eq('id',role.id);throw capError}
  }
  return {...role,capabilities:[...(capabilities||[])]}
}
