import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// The only way to delete organizations (one Demo, several Demo at once, or one
// real organization). Re-checks the Platform Owner's password, then for each
// organization issues a single-use ticket and calls
// platform_purge_organization_tx with the caller's JWT (so the audit triggers
// see the owner), removes the organization's files from storage and the
// accounts that belong nowhere else, and records that cleanup in the audit log.

const cors={
  'Content-Type':'application/json',
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
}
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors})

const MAX_ORGANIZATIONS=50
const MAX_FAILED_REAUTH=5
const REAUTH_WINDOW_MINUTES=15
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Several organizations: the owner types "ΔΙΑΓΡΑΦΗ <count>" (or "DELETE <count>").
export function bulkConfirmationMatches(confirmation:string,count:number){
  const value=String(confirmation||'').trim().replace(/\s+/g,' ').toLocaleUpperCase('el-GR')
  return value===`ΔΙΑΓΡΑΦΗ ${count}`||value===`DELETE ${count}`
}

function purgeErrorMessage(message:string){
  if(/child organizations/i.test(message))return 'Ο οργανισμός έχει θυγατρικούς οργανισμούς. Αφαιρέστε ή μετακινήστε τους πριν την οριστική διαγραφή.'
  if(/must be suspended/i.test(message))return 'Θέστε πρώτα τον οργανισμό σε παύση και μετά διαγράψτε τον.'
  if(/confirmation code mismatch/i.test(message))return 'Ο κωδικός επιβεβαίωσης δεν ταιριάζει.'
  if(/not found/i.test(message))return 'Ο οργανισμός δεν βρέθηκε.'
  if(/could not be removed completely/i.test(message))return 'Η διαγραφή σταμάτησε: κάποια δεδομένα δεν μπόρεσαν να αφαιρεθούν. Δεν άλλαξε τίποτα.'
  return message||'Η διαγραφή απέτυχε.'
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='POST')return reply({error:'Method not allowed'},405)

  const url=Deno.env.get('SUPABASE_URL')!
  const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anon=Deno.env.get('SUPABASE_ANON_KEY')!
  const jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'')
  if(!jwt)return reply({error:'Unauthorized'},401)

  const caller=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${jwt}`}},auth:{persistSession:false}})
  const admin=createClient(url,service,{auth:{persistSession:false}})
  const {data:cu,error:userError}=await caller.auth.getUser()
  if(userError||!cu?.user?.email)return reply({error:'Unauthorized'},401)
  const actorId=cu.user.id

  const body=await req.json().catch(()=>({}))
  const organizationIds=[...new Set((Array.isArray(body?.organizationIds)?body.organizationIds:[body?.organizationId]).filter((id:unknown)=>typeof id==='string'&&UUID.test(id)))] as string[]
  const password=String(body?.password||'')
  const confirmation=String(body?.confirmation||'')
  if(!organizationIds.length||!password||!confirmation)return reply({error:'Missing deletion verification.'},400)
  if(organizationIds.length>MAX_ORGANIZATIONS)return reply({error:`Έως ${MAX_ORGANIZATIONS} οργανισμοί ανά διαγραφή.`},400)

  const {data:owner,error:ownerError}=await admin.from('profiles').select('is_platform_owner').eq('id',actorId).maybeSingle()
  if(ownerError||!owner?.is_platform_owner)return reply({error:'Platform Owner access required.'},403)

  const since=new Date(Date.now()-REAUTH_WINDOW_MINUTES*60000).toISOString()
  const {count:recentFailures}=await admin.from('platform_reauth_failures').select('id',{count:'exact',head:true}).eq('actor_user_id',actorId).gte('created_at',since)
  if((recentFailures||0)>=MAX_FAILED_REAUTH)return reply({error:`Πολλές αποτυχημένες προσπάθειες. Δοκιμάστε ξανά σε ${REAUTH_WINDOW_MINUTES} λεπτά.`},429)

  const verifier=createClient(url,anon,{auth:{persistSession:false}})
  const {error:authError}=await verifier.auth.signInWithPassword({email:cu.user.email,password})
  if(authError){
    await admin.from('platform_reauth_failures').insert({actor_user_id:actorId})
    return reply({error:'Η επαναταυτοποίηση απέτυχε. Ελέγξτε τον κωδικό πρόσβασης.'},401)
  }
  // The check opened a session of its own; it is not needed beyond this point.
  await verifier.auth.signOut().catch(()=>{})

  const {data:organizations,error:orgError}=await admin.from('organizations').select('id,code,name,is_demo,status').in('id',organizationIds)
  if(orgError)return reply({error:orgError.message},500)
  if((organizations||[]).length!==organizationIds.length)return reply({error:'Ο οργανισμός δεν βρέθηκε.'},404)

  if(organizationIds.length>1){
    if(organizations!.some((o:any)=>!o.is_demo))return reply({error:'Μαζική διαγραφή επιτρέπεται μόνο για Demo. Οι πραγματικοί οργανισμοί διαγράφονται ένας-ένας.'},400)
    if(!bulkConfirmationMatches(confirmation,organizationIds.length))return reply({error:'Η φράση επιβεβαίωσης δεν ταιριάζει.'},400)
  }else if(confirmation.trim().toUpperCase()!==String(organizations![0].code||'').trim().toUpperCase()){
    return reply({error:'Ο κωδικός επιβεβαίωσης δεν ταιριάζει.'},400)
  }

  const results=[]
  for(const org of organizations!){
    const {data:ticket,error:ticketError}=await admin.from('platform_purge_tickets').insert({actor_user_id:actorId,organization_id:org.id}).select('id').single()
    if(ticketError){results.push({organizationId:org.id,code:org.code,name:org.name,ok:false,error:ticketError.message});continue}

    const {data:purge,error:purgeError}=await caller.rpc('platform_purge_organization_tx',{p_organization_id:org.id,p_confirmation:org.code,p_ticket:ticket.id})
    if(purgeError){results.push({organizationId:org.id,code:org.code,name:org.name,ok:false,error:purgeErrorMessage(String(purgeError.message||''))});continue}

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
      event_type:'platform.organization.purge_cleanup',
      entity_type:'organization',
      entity_id:org.id,
      metadata:{organization_name:org.name,organization_code:org.code,is_demo:org.is_demo,files_total:objects.length,files_removed:storageRemoved,accounts_deleted:accountsDeleted,accounts_kept:accountsKept,warnings},
    })

    results.push({organizationId:org.id,code:org.code,name:org.name,isDemo:org.is_demo,ok:true,records:purge?.records??0,storageRemoved,accountsDeleted,accountsKept,warnings})
  }

  const deleted=results.filter(r=>r.ok).length
  if(!deleted)return reply({error:results[0]?.error||'Η διαγραφή απέτυχε.',results},results.length===1&&/παύση/.test(String(results[0]?.error))?409:400)
  return reply({ok:deleted===results.length,deleted,failed:results.length-deleted,results})
})
