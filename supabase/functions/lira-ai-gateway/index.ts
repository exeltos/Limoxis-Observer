import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const cors={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors})
const clean=(value:unknown,max=4000)=>String(value??'').trim().slice(0,max)

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
 if(req.method!=='POST')return reply({ok:false,code:'LIRA_METHOD_NOT_ALLOWED'},405)
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY')
 if(!url||!anon)return reply({ok:false,code:'LIRA_GATEWAY_CONFIG_MISSING'},500)
 const jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'')
 if(!jwt)return reply({ok:false,code:'LIRA_AUTH_REQUIRED'},401)
 const caller=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${jwt}`}},auth:{persistSession:false,autoRefreshToken:false}})
 const {data:{user},error:userError}=await caller.auth.getUser()
 if(userError||!user)return reply({ok:false,code:'LIRA_INVALID_SESSION'},401)
 let body:any
 try{body=await req.json()}catch{return reply({ok:false,code:'LIRA_INVALID_REQUEST'},400)}
 const organizationId=clean(body?.organizationId,80),question=clean(body?.question)
 if(!organizationId||!question)return reply({ok:false,code:'LIRA_REQUIRED_FIELDS'},400)
 const {data:member}=await caller.from('organization_members').select('id,status').eq('organization_id',organizationId).eq('user_id',user.id).eq('status','active').maybeSingle()
 const {data:profile}=await caller.from('profiles').select('is_platform_owner').eq('id',user.id).maybeSingle()
 if(!member?.id&&!profile?.is_platform_owner)return reply({ok:false,code:'LIRA_NOT_AUTHORIZED'},403)

 // Phase 3 gateway deliberately uses the caller JWT. No service-role bypass and no PHI is logged.
 // Retrieval becomes active only when approved, embedded knowledge exists.
 const {data:sources,error:sourceError}=await caller.from('lira_knowledge_sources').select('id,title,authority,source_version,source_url,effective_from,effective_to').eq('status','approved').or(`organization_id.is.null,organization_id.eq.${organizationId}`).limit(20)
 if(sourceError)return reply({ok:false,code:'LIRA_KNOWLEDGE_LOAD_FAILED'},500)

 return reply({ok:true,mode:'secure_gateway',request:{language:body?.language==='en'?'en':'el',hasConversationContext:Boolean(body?.context)},knowledge:{approvedSources:sources||[],retrievalReady:(sources||[]).length>0},safety:{deterministicClinicalCalculations:true,autonomousOutbreakDeclaration:false,missingClinicalDataInference:false},message:(sources||[]).length?'Approved knowledge is available for retrieval.':'No approved knowledge is available yet; deterministic LIRA remains authoritative.'})
})
