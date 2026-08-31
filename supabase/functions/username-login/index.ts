import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const cors={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const reply=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:cors})
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return reply({error:'Method not allowed'},405)
 const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),anon=Deno.env.get('SUPABASE_ANON_KEY');if(!url||!service||!anon)return reply({error:'Function is not configured'},500)
 let b:any={};try{b=await req.json()}catch{};const username=String(b.username||'').trim(),password=String(b.password||'');if(!username||!password)return reply({error:'Invalid credentials'},400)
 const admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}});const {data:p}=await admin.from('profiles').select('contact_email').ilike('username',username).maybeSingle();if(!p?.contact_email)return reply({error:'Invalid credentials'},401)
 const auth=createClient(url,anon,{auth:{autoRefreshToken:false,persistSession:false}});const {data,error}=await auth.auth.signInWithPassword({email:String(p.contact_email).toLowerCase(),password});if(error||!data?.session)return reply({error:'Invalid credentials'},401)
 return reply({access_token:data.session.access_token,refresh_token:data.session.refresh_token})
})
