import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors={
  'Content-Type':'application/json',
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
}
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors})

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='POST')return reply({error:'Method not allowed'},405)

  const url=Deno.env.get('SUPABASE_URL')!
  const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anon=Deno.env.get('SUPABASE_ANON_KEY')!
  const jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'')
  if(!jwt)return reply({error:'Unauthorized'},401)

  const caller=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${jwt}`}}})
  const admin=createClient(url,service)
  const {data:cu,error:userError}=await caller.auth.getUser()
  if(userError||!cu?.user?.email)return reply({error:'Unauthorized'},401)

  const body=await req.json().catch(()=>({}))
  const {organizationId,password,confirmation}=body||{}
  if(!organizationId||!password||!confirmation)return reply({error:'Missing deletion verification.'},400)

  const {data:owner,error:ownerError}=await admin.from('profiles').select('is_platform_owner').eq('id',cu.user.id).maybeSingle()
  if(ownerError||!owner?.is_platform_owner)return reply({error:'Platform Owner access required.'},403)

  const verifier=createClient(url,anon)
  const {error:authError}=await verifier.auth.signInWithPassword({email:cu.user.email,password})
  if(authError)return reply({error:'Η επαναταυτοποίηση απέτυχε. Ελέγξτε τον κωδικό πρόσβασης.'},401)

  const {data:purgeResult,error:purgeError}=await caller.rpc('platform_purge_organization_tx',{
    p_organization_id:organizationId,
    p_confirmation:confirmation,
  })
  if(purgeError){
    const message=String(purgeError.message||'')
    if(/child organizations/i.test(message))return reply({error:'Ο οργανισμός έχει θυγατρικούς οργανισμούς. Αφαιρέστε ή μετακινήστε τους πριν την οριστική διαγραφή.'},409)
    if(/confirmation code mismatch/i.test(message))return reply({error:'Ο κωδικός επιβεβαίωσης δεν ταιριάζει.'},400)
    if(/not found/i.test(message))return reply({error:'Organization not found.'},404)
    return reply({error:message||'Organization purge failed.'},500)
  }

  const userIds=Array.isArray(purgeResult?.userIds)?purgeResult.userIds:[]
  let authDeleted=0
  const authWarnings:string[]=[]
  for(const userId of userIds){
    if(!userId||userId===cu.user.id)continue
    const {data:remaining}=await admin.from('organization_members').select('id').eq('user_id',userId).limit(1)
    const {data:profile}=await admin.from('profiles').select('is_platform_owner').eq('id',userId).maybeSingle()
    if(remaining?.length||profile?.is_platform_owner)continue
    const {error}=await admin.auth.admin.deleteUser(userId)
    if(error)authWarnings.push(`${userId}:${error.message}`)
    else authDeleted++
  }

  return reply({
    ok:true,
    organizationId,
    organizationCode:purgeResult?.organizationCode||confirmation,
    isDemo:Boolean(purgeResult?.isDemo),
    authDeleted,
    authWarnings,
  })
})
