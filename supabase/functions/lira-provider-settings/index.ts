import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'
const cors={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors})
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
 if(req.method!=='POST')return reply({error:'Method not allowed'},405)
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
 if(!url||!anon||!secret)return reply({error:'Provider backend configuration is incomplete'},500)
 const jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'')
 const caller=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${jwt}`}},auth:{persistSession:false,autoRefreshToken:false}})
 const {data:{user}}=await caller.auth.getUser();if(!user)return reply({error:'Invalid session'},401)
 let body:any={};try{body=await req.json()}catch{return reply({error:'Invalid request'},400)}
 const organizationId=String(body.organizationId||''),action=String(body.action||'save')
 if(!organizationId)return reply({error:'Organization is required'},400)
 const {data:profile}=await caller.from('profiles').select('is_platform_owner').eq('id',user.id).maybeSingle()
 const {data:cap}=await caller.rpc('current_user_has_capability',{p_organization_id:organizationId,p_capability:'manage_libraries'})
 if(!profile?.is_platform_owner&&!cap)return reply({error:'Not authorized'},403)
 const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}})
 const {data:existing}=await admin.from('lira_ai_provider_settings').select('secret_id').eq('organization_id',organizationId).maybeSingle()
 if(action==='disconnect'){
  if(existing?.secret_id)await admin.rpc('delete_lira_provider_secret',{p_secret_id:existing.secret_id})
  const {error}=await admin.from('lira_ai_provider_settings').upsert({organization_id:organizationId,provider:'none',enabled:false,model:null,secret_id:null,key_hint:null,configured_by:user.id,configured_at:new Date().toISOString()})
  if(error)return reply({error:'Could not disconnect provider'},500);return reply({ok:true})
 }
 const provider=String(body.provider||'none'),apiKey=String(body.apiKey||'').trim(),model=String(body.model||'').trim()||null
 if(!['none','openai'].includes(provider))return reply({error:'Unsupported provider'},400)
 let secretId=existing?.secret_id||null
 if(apiKey){
  const {data,error}=await admin.rpc('store_lira_provider_secret',{p_organization_id:organizationId,p_secret:apiKey,p_existing_secret_id:secretId})
  if(error)return reply({error:'Could not store provider credential'},500);secretId=data
 }
 if(provider!=='none'&&!secretId)return reply({error:'API key is required'},400)
 const payload={organization_id:organizationId,provider,enabled:provider!=='none',model,secret_id:secretId,key_hint:apiKey?`••••${apiKey.slice(-4)}`:undefined,allow_aggregate_data:body.allowAggregateData!==false,allow_patient_level_data:Boolean(body.allowPatientLevelData),configured_by:user.id,configured_at:new Date().toISOString(),updated_at:new Date().toISOString()}
 Object.keys(payload).forEach(k=>payload[k]===undefined&&delete payload[k])
 const {error}=await admin.from('lira_ai_provider_settings').upsert(payload)
 if(error)return reply({error:'Could not save provider settings'},500)
 return reply({ok:true,provider,enabled:provider!=='none',keyHint:payload.key_hint||null})
})
