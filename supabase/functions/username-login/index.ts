import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const cors={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Cache-Control':'no-store'}
const reply=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:cors})
const invalid=()=>reply({error:'Invalid credentials'},401)
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms))
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return reply({error:'Method not allowed'},405)
 const started=Date.now();const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),anon=Deno.env.get('SUPABASE_ANON_KEY');if(!url||!service||!anon)return reply({error:'Service temporarily unavailable'},503)
 let b:any={};try{b=await req.json()}catch{return invalid()};const username=String(b.username||'').trim(),password=String(b.password||'');if(!username||!password||username.length>80||password.length>256)return invalid()
 try{
  const admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}});const {data:p}=await admin.from('profiles').select('contact_email').ilike('username',username).maybeSingle()
  if(p?.contact_email){const auth=createClient(url,anon,{auth:{autoRefreshToken:false,persistSession:false}});const {data,error}=await auth.auth.signInWithPassword({email:String(p.contact_email).toLowerCase(),password});if(!error&&data?.session)return reply({access_token:data.session.access_token,refresh_token:data.session.refresh_token})}
 }catch(error){console.error('username login failed',error)}
 const remaining=300-(Date.now()-started);if(remaining>0)await sleep(remaining)
 return invalid()
})
