// Deletes one organization the one safe way: a single-use ticket, then
// platform_purge_organization_tx with the Platform Owner's JWT (so the audit
// triggers see the owner), then its files in storage and the accounts that
// belong nowhere else, and an audit row for that cleanup. Shared by
// platform-delete-organizations (password re-checked) and platform-housekeeping
// (automatic deletion of long-expired Demos).

export type PurgeTarget={id:string,code:string,name:string,is_demo:boolean}

export async function purgeOrganization({admin,caller,actorId,org,auditEvent='platform.organization.purge_cleanup',auditMetadata={}}:{admin:any,caller:any,actorId:string,org:PurgeTarget,auditEvent?:string,auditMetadata?:Record<string,unknown>}){
  const {data:ticket,error:ticketError}=await admin.from('platform_purge_tickets').insert({actor_user_id:actorId,organization_id:org.id}).select('id').single()
  if(ticketError)return {ok:false as const,error:String(ticketError.message||'')}

  const {data:purge,error:purgeError}=await caller.rpc('platform_purge_organization_tx',{p_organization_id:org.id,p_confirmation:org.code,p_ticket:ticket.id})
  if(purgeError)return {ok:false as const,error:String(purgeError.message||'')}

  // Files: everything under "<organization id>/" in both buckets.
  const warnings:string[]=[]
  let storageRemoved=0
  const objects=Array.isArray(purge?.storageObjects)?purge.storageObjects:[]
  const byBucket=new Map<string,string[]>()
  for(const o of objects){if(o?.bucket&&o?.name){const list=byBucket.get(o.bucket)||[];list.push(o.name);byBucket.set(o.bucket,list)}}
  for(const [bucket,names] of byBucket){
    for(let i=0;i<names.length;i+=100){
      const chunk=names.slice(i,i+100)
      const {data:removed,error}=await admin.storage.from(bucket).remove(chunk)
      if(error)warnings.push(`storage:${bucket}:${error.message}`)
      else storageRemoved+=Array.isArray(removed)?removed.length:chunk.length
    }
  }

  // Accounts: removed only when they belong to no other organization and are not a Platform Owner.
  let accountsDeleted=0,accountsKept=0
  for(const userId of (Array.isArray(purge?.userIds)?purge.userIds:[])){
    if(!userId||userId===actorId){accountsKept++;continue}
    const {data:remaining}=await admin.from('organization_members').select('id').eq('user_id',userId).limit(1)
    const {data:profile}=await admin.from('profiles').select('is_platform_owner').eq('id',userId).maybeSingle()
    if(remaining?.length||profile?.is_platform_owner){accountsKept++;continue}
    const {error}=await admin.auth.admin.deleteUser(userId)
    if(error)warnings.push(`account:${userId}:${error.message}`)
    else accountsDeleted++
  }

  await admin.from('system_audit_log').insert({
    actor_user_id:actorId,
    actor_role:'platform_owner',
    event_type:auditEvent,
    entity_type:'organization',
    entity_id:org.id,
    metadata:{organization_name:org.name,organization_code:org.code,is_demo:org.is_demo,files_total:objects.length,files_removed:storageRemoved,accounts_deleted:accountsDeleted,accounts_kept:accountsKept,warnings,...auditMetadata},
  })

  return {ok:true as const,records:purge?.records??0,storageRemoved,accountsDeleted,accountsKept,warnings}
}
