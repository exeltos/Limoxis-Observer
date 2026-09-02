import { supabase } from '../../core/supabase/client'

function requireCloud(){if(!supabase) throw new Error('Supabase is not configured')}
function requireOrganization(organizationId){if(!organizationId) throw new Error('Organization is required')}

const mapRow=row=>({
 id:row.id,
 bundleKey:row.bundle_key,
 name:row.name,
 titleEl:row.title_el,
 titleEn:row.title_en,
 version:row.version,
 status:row.status,
 scope:row.scope,
 source:row.source,
 sourceVersion:row.source_version,
 departments:Array.isArray(row.departments)?row.departments:[],
 elements:Array.isArray(row.elements)?row.elements:[],
 basedOn:row.based_on||null,
 system:Boolean(row.is_system),
 hidden:Boolean(row.hidden),
 publishedAt:row.published_at||null,
 retiredAt:row.retired_at||null,
 createdAt:row.created_at,
 updatedAt:row.updated_at,
})

async function actorId(){
 requireCloud()
 const {data,error}=await supabase.auth.getUser()
 if(error) throw error
 return data?.user?.id||null
}

export async function loadBundleTemplates(organizationId){
 requireCloud();requireOrganization(organizationId)
 const {data,error}=await supabase.from('prevention_bundle_templates')
  .select('*')
  .or(`organization_id.eq.${organizationId},organization_id.is.null`)
  .eq('hidden',false)
  .order('is_system',{ascending:false})
  .order('name',{ascending:true})
  .order('created_at',{ascending:false})
 if(error) throw error
 return (data||[]).map(mapRow)
}

function payload(item,organizationId,userId){return {
 organization_id:item.system?null:organizationId,
 bundle_key:item.bundleKey||item.name,
 name:item.name,
 title_el:item.titleEl||'',
 title_en:item.titleEn||'',
 version:item.version||'1.0',
 status:item.status||'draft',
 scope:item.scope||'',
 source:item.source||'',
 source_version:item.sourceVersion||'',
 departments:item.departments||[],
 elements:item.elements||[],
 based_on:item.basedOn||null,
 is_system:Boolean(item.system),
 hidden:Boolean(item.hidden),
 updated_by:userId,
 updated_at:new Date().toISOString(),
}}

export async function createBundleTemplate(organizationId,item){
 requireCloud();requireOrganization(organizationId)
 const userId=await actorId()
 const row={...payload(item,organizationId,userId),created_by:userId}
 const {data,error}=await supabase.from('prevention_bundle_templates').insert(row).select('*').single()
 if(error) throw error
 return mapRow(data)
}

export async function updateBundleTemplate(organizationId,item){
 requireCloud();requireOrganization(organizationId)
 if(!item?.id) throw new Error('Bundle template id is required')
 const userId=await actorId()
 let query=supabase.from('prevention_bundle_templates').update(payload(item,organizationId,userId)).eq('id',item.id)
 query=item.system?query.is('organization_id',null):query.eq('organization_id',organizationId)
 const {data,error}=await query.select('*').single()
 if(error) throw error
 return mapRow(data)
}

export async function publishBundleTemplate(organizationId,item){
 requireCloud();requireOrganization(organizationId)
 const userId=await actorId()
 let query=supabase.from('prevention_bundle_templates').update({status:'published',published_by:userId,published_at:new Date().toISOString(),updated_by:userId,updated_at:new Date().toISOString()}).eq('id',item.id)
 query=item.system?query.is('organization_id',null):query.eq('organization_id',organizationId)
 const {data,error}=await query.select('*').single()
 if(error) throw error
 return mapRow(data)
}

export async function retireBundleTemplate(organizationId,item){
 requireCloud();requireOrganization(organizationId)
 const userId=await actorId()
 let query=supabase.from('prevention_bundle_templates').update({status:'retired',retired_by:userId,retired_at:new Date().toISOString(),updated_by:userId,updated_at:new Date().toISOString()}).eq('id',item.id)
 query=item.system?query.is('organization_id',null):query.eq('organization_id',organizationId)
 const {data,error}=await query.select('*').single()
 if(error) throw error
 return mapRow(data)
}

export async function removeBundleTemplate(organizationId,item){
 requireCloud();requireOrganization(organizationId)
 let query=supabase.from('prevention_bundle_templates').delete().eq('id',item.id)
 query=item.system?query.is('organization_id',null):query.eq('organization_id',organizationId)
 const {error}=await query
 if(error) throw error
 return true
}
