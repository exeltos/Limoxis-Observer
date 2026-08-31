import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const cors={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const reply=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:cors})
const strong=(p:any)=>typeof p==='string'&&p.length>=12&&/[A-Z]/.test(p)&&/[a-z]/.test(p)&&/\d/.test(p)&&/[^A-Za-z0-9]/.test(p)
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return reply({error:'Method not allowed'},405)
 const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),anon=Deno.env.get('SUPABASE_ANON_KEY');if(!url||!service||!anon)return reply({error:'Function is not configured'},500)
 const jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');if(!jwt)return reply({error:'Η πρόσκληση δεν είναι πλέον έγκυρη. Ανοίξτε ξανά τον σύνδεσμο από το email.'},401)
 let body:any={};try{body=await req.json()}catch{};if(!strong(body.password))return reply({error:'Password must be at least 12 characters and include uppercase, lowercase, number and symbol.'},400)
 const caller=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${jwt}`}}});const {data:cu}=await caller.auth.getUser();if(!cu?.user)return reply({error:'Η συνεδρία ενεργοποίησης έληξε.'},401)
 const admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}})
 const {error:uerr}=await admin.auth.admin.updateUserById(cu.user.id,{password:body.password});if(uerr)return reply({error:uerr.message},500)
 await admin.from('organization_members').update({status:'active'}).eq('user_id',cu.user.id).eq('status','invited')
 const {data:p}=await admin.from('profiles').select('username').eq('id',cu.user.id).maybeSingle()
 return reply({ok:true,username:p?.username||cu.user.user_metadata?.username||''})
})
