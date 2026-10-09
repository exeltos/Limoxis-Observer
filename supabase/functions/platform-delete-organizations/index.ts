import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { purgeOrganization } from '../_shared/organizationPurge.ts'

// The only way to delete organizations (one Demo, several Demo at once, or one
// real organization). Re-checks the Platform Owner's password, then deletes
// each organization through _shared/organizationPurge.ts (single-use ticket,
// platform_purge_organization_tx with the owner's JWT, storage, accounts, audit).

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
    const result=await purgeOrganization({admin,caller,actorId,org})
    if(!result.ok){results.push({organizationId:org.id,code:org.code,name:org.name,ok:false,error:purgeErrorMessage(result.error)});continue}
    results.push({organizationId:org.id,code:org.code,name:org.name,isDemo:org.is_demo,ok:true,records:result.records,storageRemoved:result.storageRemoved,accountsDeleted:result.accountsDeleted,accountsKept:result.accountsKept,warnings:result.warnings})
  }

  const deleted=results.filter(r=>r.ok).length
  if(!deleted)return reply({error:results[0]?.error||'Η διαγραφή απέτυχε.',results},results.length===1&&/παύση/.test(String(results[0]?.error))?409:400)
  return reply({ok:deleted===results.length,deleted,failed:results.length-deleted,results})
})
