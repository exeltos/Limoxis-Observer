import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { demoAccessEmail } from '../_shared/emailTemplates.ts'
const cors={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const reply=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:cors})
const ascii=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z]/g,'').toUpperCase()
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return reply({error:'Method not allowed'},405)
 const url=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'')
 const caller=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${jwt}`}}}),admin=createClient(url,service)
 const {data:cu}=await caller.auth.getUser();if(!cu?.user)return reply({error:'Unauthorized'},401)
 const {data:owner}=await admin.from('profiles').select('is_platform_owner').eq('id',cu.user.id).maybeSingle();if(!owner?.is_platform_owner)return reply({error:'Forbidden'},403)
 const b=await req.json();const label=String(b.label||'').trim(),contactName=String(b.contactName||'').trim(),contactEmail=String(b.contactEmail||'').trim().toLowerCase(),validFrom=String(b.validFrom||''),validUntil=String(b.validUntil||'')
 if(!label||!contactEmail||!validFrom||!validUntil)return reply({error:'Missing demo fields.'},400)
 const parts=contactName.split(/\s+/).filter(Boolean),prefix=((ascii(parts[0]||'D')[0]||'D')+(ascii(parts.at(-1)||'U')[0]||'U'))
 let username='';for(let i=0;i<20;i++){const candidate=`${prefix}${Math.floor(10000+Math.random()*90000)}`;const {data:exists}=await admin.from('profiles').select('id').eq('username',candidate).maybeSingle();if(!exists){username=candidate;break}}
 if(!username)return reply({error:'Could not allocate username.'},500)
 const internalEmail=`${username.toLowerCase()}@users.limoxis.local`;const temporary=crypto.randomUUID()+crypto.randomUUID()
 const {data:created,error:createError}=await admin.auth.admin.createUser({email:internalEmail,password:temporary,email_confirm:true,user_metadata:{full_name:contactName||label}});if(createError||!created.user)return reply({error:createError?.message||'User creation failed'},500)
 const {data:ent,error:entError}=await admin.from('platform_demo_entitlements').insert({label,contact_name:contactName||null,contact_email:contactEmail,valid_from:validFrom,valid_until:validUntil,status:'active',created_by:cu.user.id,demo_user_id:created.user.id}).select().single();if(entError){await admin.auth.admin.deleteUser(created.user.id);return reply({error:entError.message},500)}
 await admin.from('profiles').update({full_name:contactName||label,username,contact_email:contactEmail,is_demo:true,demo_entitlement_id:ent.id}).eq('id',created.user.id)
 const app=(Deno.env.get('APP_URL')||req.headers.get('origin')||'').replace(/\/$/,'');const {data:link}=await admin.auth.admin.generateLink({type:'recovery',email:internalEmail,options:{redirectTo:`${app}/reset-password`}});const actionLink=(link as any)?.properties?.action_link||''
 const resend=Deno.env.get('RESEND_API_KEY');let emailSent=false
 if(resend&&actionLink){const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resend}`,'Content-Type':'application/json'},body:JSON.stringify({from:Deno.env.get('INVITE_FROM_EMAIL')||'Limoxis Observer <noreply@limoxis.com>',to:[contactEmail],subject:'Πρόσβαση Demo — Limoxis Observer',html:demoAccessEmail({contactName,label,username,validFrom,validUntil,actionUrl:actionLink})})});emailSent=r.ok}
 return reply({ok:true,entitlement:ent,username,emailSent})
})
