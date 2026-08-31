import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const reply=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:cors})

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='POST')return reply({error:'Method not allowed'},405)
  let body:any={};try{body=await req.json()}catch{}
  const email=String(body.email||'').trim().toLowerCase(),mode=body.mode==='username'?'username':'password'
  if(!email)return reply({ok:true})
  const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if(!url||!service)return reply({error:'Function is not configured'},500)
  const admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}})
  const {data:p}=await admin.from('profiles').select('id,username,contact_email').ilike('contact_email',email).maybeSingle()
  if(!p)return reply({ok:true})
  if(mode==='username')return reply({ok:true,username:p.username||null})
  const app=(Deno.env.get('APP_URL')||Deno.env.get('APP_BASE_URL')||req.headers.get('origin')||'').replace(/\/$/,'')
  const {error}=await admin.auth.resetPasswordForEmail(email,{redirectTo:`${app}/reset-password`})
  if(error)return reply({error:error.message},500)
  return reply({ok:true,emailSent:true,provider:'supabase_auth'})
})
