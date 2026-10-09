import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { purgeOrganization } from '../_shared/organizationPurge.ts'

// Automatic deletion of long-expired Demos (platform setting
// demo_auto_purge_after_days; 0 = never). Runs with the Platform Owner's JWT
// when the Platform Center opens, so every deletion goes through the same
// ticketed path as a manual one and the audit log names the owner. Only Demo
// organizations listed by platform_demo_purge_candidates are touched: expired
// for longer than the setting, no new "I want the application" request, never
// the Owner's own Demo.

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

  const caller=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${jwt}`}},auth:{persistSession:false}})
  const admin=createClient(url,service,{auth:{persistSession:false}})
  const {data:cu,error:userError}=await caller.auth.getUser()
  if(userError||!cu?.user)return reply({error:'Unauthorized'},401)
  const actorId=cu.user.id
  const {data:owner}=await admin.from('profiles').select('is_platform_owner').eq('id',actorId).maybeSingle()
  if(!owner?.is_platform_owner)return reply({error:'Platform Owner access required.'},403)

  const {data:candidates,error:candidateError}=await caller.rpc('platform_demo_purge_candidates')
  if(candidateError)return reply({error:candidateError.message},500)

  const purged=[],failed=[]
  for(const candidate of (candidates||[])){
    // Re-read the organization: only a Demo is ever deleted here.
    const {data:org}=await admin.from('organizations').select('id,code,name,is_demo').eq('id',candidate.organization_id).maybeSingle()
    if(!org?.is_demo)continue
    const result=await purgeOrganization({admin,caller,actorId,org,auditEvent:'platform.demo.auto_purged',auditMetadata:{valid_until:candidate.valid_until,automatic:true}})
    if(result.ok)purged.push({organizationId:org.id,code:org.code,name:org.name,validUntil:candidate.valid_until})
    else failed.push({organizationId:org.id,code:org.code,name:org.name,error:result.error})
  }
  return reply({ok:failed.length===0,purged,failed})
})
