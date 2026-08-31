import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const cors={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors})
Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='POST')return reply({error:'Method not allowed'},405)
  const url=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!
  const jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'')
  const caller=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${jwt}`}}})
  const admin=createClient(url,service)
  const {data:cu}=await caller.auth.getUser()
  if(!cu?.user?.email)return reply({error:'Unauthorized'},401)
  const body=await req.json();const {organizationId,password,confirmation}=body||{}
  if(!organizationId||!password||!confirmation)return reply({error:'Missing deletion verification.'},400)
  const {data:owner}=await admin.from('profiles').select('is_platform_owner').eq('id',cu.user.id).maybeSingle()
  if(!owner?.is_platform_owner)return reply({error:'Platform Owner access required.'},403)
  // Step-up authentication: verify the current Platform Owner password before destructive purge.
  const verifier=createClient(url,anon)
  const {error:authError}=await verifier.auth.signInWithPassword({email:cu.user.email,password})
  if(authError)return reply({error:'Η επαναταυτοποίηση απέτυχε. Ελέγξτε τον κωδικό πρόσβασης.'},401)
  const {data:org,error:orgError}=await admin.from('organizations').select('id,name,code').eq('id',organizationId).single()
  if(orgError||!org)return reply({error:'Organization not found.'},404)
  if(String(confirmation).trim().toUpperCase()!==String(org.code).toUpperCase())return reply({error:'Ο κωδικός επιβεβαίωσης δεν ταιριάζει.'},400)
  const {data:children}=await admin.from('organizations').select('id').eq('parent_id',organizationId).limit(1)
  if(children?.length)return reply({error:'Ο οργανισμός έχει θυγατρικούς οργανισμούς. Αφαιρέστε ή μετακινήστε τους πριν την οριστική διαγραφή.'},409)
  const {data:members}=await admin.from('organization_members').select('user_id').eq('organization_id',organizationId)
  const userIds=[...new Set((members||[]).map(x=>x.user_id).filter(Boolean))]
  // Most clinical/product tables use ON DELETE CASCADE from organizations; deleting the tenant is the canonical purge boundary.
  const {error:deleteError}=await admin.from('organizations').delete().eq('id',organizationId)
  if(deleteError)return reply({error:deleteError.message},500)
  let authDeleted=0
  for(const userId of userIds){
    if(userId===cu.user.id)continue
    const {data:remaining}=await admin.from('organization_members').select('id').eq('user_id',userId).limit(1)
    const {data:profile}=await admin.from('profiles').select('is_platform_owner').eq('id',userId).maybeSingle()
    if(!(remaining?.length)&&!profile?.is_platform_owner){const {error}=await admin.auth.admin.deleteUser(userId);if(!error)authDeleted++}
  }
  await admin.from('system_audit_log').insert({actor_user_id:cu.user.id,event_type:'platform.organization.purged',entity_type:'organization',entity_id:organizationId,metadata:{organization_name:org.name,organization_code:org.code,auth_users_deleted:authDeleted}})
  return reply({ok:true,authDeleted})
})
