import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const DEFAULT_APP_URL='https://limoxis-observer.netlify.app'
const cors={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Cache-Control':'no-store'}
const reply=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:cors})
const ok=()=>reply({ok:true})
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms))
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return reply({error:'Method not allowed'},405)
 const started=Date.now();let body:any={};try{body=await req.json()}catch{return ok()};const email=String(body.email||'').trim().toLowerCase();if(!email||email.length>254||!email.includes('@'))return ok()
 const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!url||!service)return reply({error:'Service temporarily unavailable'},503)
 try{
  const admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}});const {data:p}=await admin.from('profiles').select('id').ilike('contact_email',email).maybeSingle()
  if(p?.id){const app=(Deno.env.get('APP_URL')||Deno.env.get('APP_BASE_URL')||DEFAULT_APP_URL).replace(/\/$/,'');await admin.auth.resetPasswordForEmail(email,{redirectTo:`${app}/reset-password`})}
 }catch(error){console.error('account recovery request failed',error)}
 const remaining=350-(Date.now()-started);if(remaining>0)await sleep(remaining)
 return ok()
})
