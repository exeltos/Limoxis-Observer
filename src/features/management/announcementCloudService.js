import { supabase } from '../../core/data/supabaseClient'

function requireCloud(){if(!supabase)throw new Error('Supabase is not configured')}
function requireOrganization(organizationId){if(!organizationId)throw new Error('Organization is required')}

const mapAnnouncement=row=>({
 id:row.id,title:row.title,message:row.message,priority:row.priority,
 audienceType:row.audience_type,audienceValues:Array.isArray(row.audience_values)?row.audience_values:[],
 requiresAck:Boolean(row.requires_ack),startAt:row.starts_at||'',endAt:row.ends_at||'',
 createdAt:row.created_at,createdById:row.created_by||null,updatedAt:row.updated_at,
})

async function currentUserId(){requireCloud();const {data,error}=await supabase.auth.getUser();if(error)throw error;return data?.user?.id||null}

export async function loadAnnouncements(organizationId){
 requireCloud();requireOrganization(organizationId)
 const {data,error}=await supabase.from('management_announcements').select('*').eq('organization_id',organizationId).order('created_at',{ascending:false})
 if(error)throw error
 return (data||[]).map(mapAnnouncement)
}

function toRow(item,organizationId,userId){return {
 organization_id:organizationId,title:item.title.trim(),message:item.message.trim(),priority:item.priority||'normal',
 audience_type:item.audienceType||'all',audience_values:item.audienceType==='all'?[]:(item.audienceValues||[]),
 requires_ack:Boolean(item.requiresAck),starts_at:item.startAt||null,ends_at:item.endAt||null,
 updated_by:userId,updated_at:new Date().toISOString(),
}}

export async function createAnnouncement(organizationId,item){
 requireCloud();requireOrganization(organizationId);const userId=await currentUserId()
 const {data,error}=await supabase.from('management_announcements').insert({...toRow(item,organizationId,userId),created_by:userId}).select('*').single()
 if(error)throw error;return mapAnnouncement(data)
}
export async function updateAnnouncement(organizationId,item){
 requireCloud();requireOrganization(organizationId);const userId=await currentUserId()
 const {data,error}=await supabase.from('management_announcements').update(toRow(item,organizationId,userId)).eq('organization_id',organizationId).eq('id',item.id).select('*').single()
 if(error)throw error;return mapAnnouncement(data)
}
export async function removeAnnouncement(organizationId,id){
 requireCloud();requireOrganization(organizationId)
 const {error}=await supabase.from('management_announcements').delete().eq('organization_id',organizationId).eq('id',id)
 if(error)throw error;return true
}

export async function loadMyAnnouncementAcknowledgements(organizationId,userId){
 requireCloud();requireOrganization(organizationId);if(!userId)return new Set()
 const {data,error}=await supabase.from('management_announcement_acknowledgements').select('announcement_id').eq('organization_id',organizationId).eq('user_id',userId)
 if(error)throw error;return new Set((data||[]).map(x=>x.announcement_id))
}
export async function acknowledgeAnnouncement(organizationId,announcementId,userId){
 requireCloud();requireOrganization(organizationId);if(!announcementId||!userId)throw new Error('Announcement and user are required')
 const {error}=await supabase.from('management_announcement_acknowledgements').upsert({organization_id:organizationId,announcement_id:announcementId,user_id:userId},{onConflict:'announcement_id,user_id'})
 if(error)throw error;return true
}

export async function loadAnnouncementUsers(organizationId){
 requireCloud();requireOrganization(organizationId)
 const {data:members,error:membersError}=await supabase.from('organization_members').select('user_id,role,status').eq('organization_id',organizationId).eq('status','active')
 if(membersError)throw membersError
 const ids=[...new Set((members||[]).map(x=>x.user_id).filter(Boolean))]
 if(!ids.length)return []
 const {data:profiles,error:profilesError}=await supabase.from('profiles').select('id,full_name,contact_email,username').in('id',ids)
 if(profilesError)throw profilesError
 const byId=new Map((profiles||[]).map(p=>[p.id,p]))
 return ids.map(id=>{const p=byId.get(id)||{};return {id,label:p.full_name||p.username||p.contact_email||id,secondary:p.contact_email||p.username||id}})
}
