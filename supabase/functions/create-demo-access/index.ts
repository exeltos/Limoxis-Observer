import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const DEFAULT_APP_URL='https://limoxis-observer.netlify.app'
const cors={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const reply=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:cors})
const GREEK:Record<string,string>={α:'A',ά:'A',β:'V',γ:'G',δ:'D',ε:'E',έ:'E',ζ:'Z',η:'I',ή:'I',θ:'T',ι:'I',ί:'I',κ:'K',λ:'L',μ:'M',ν:'N',ξ:'X',ο:'O',ό:'O',π:'P',ρ:'R',σ:'S',ς:'S',τ:'T',υ:'Y',ύ:'Y',φ:'F',χ:'C',ψ:'P',ω:'O',ώ:'O'}
const initial=(v='')=>{const c=String(v).trim().charAt(0);return /[A-Za-z]/.test(c)?c.toUpperCase():(GREEK[c.toLowerCase()]||'D')}
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return reply({error:'Method not allowed'},405)
 const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),anon=Deno.env.get('SUPABASE_ANON_KEY'),jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');if(!url||!service||!anon)return reply({error:'Function is not configured'},500)
 const caller=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${jwt}`}}}),admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}});const {data:cu}=await caller.auth.getUser();if(!cu?.user)return reply({error:'Unauthorized'},401)
 const {data:owner}=await admin.from('profiles').select('is_platform_owner').eq('id',cu.user.id).maybeSingle();if(!owner?.is_platform_owner)return reply({error:'Forbidden'},403)
 const b=await req.json(),label=String(b.label||'').trim(),contactName=String(b.contactName||'').trim(),contactEmail=String(b.contactEmail||'').trim().toLowerCase(),validFrom=String(b.validFrom||''),validUntil=String(b.validUntil||'');if(!label||!contactEmail||!validFrom||!validUntil)return reply({error:'Missing demo fields.'},400)
 const parts=contactName.split(/\s+/).filter(Boolean),prefix=`${initial(parts[0]||'D')}${initial(parts.at(-1)||'U')}`;let username='';for(let i=0;i<30;i++){const candidate=`${prefix}${Math.floor(10000+Math.random()*90000)}`;const {data:e}=await admin.from('profiles').select('id').eq('username',candidate).maybeSingle();if(!e){username=candidate;break}};if(!username)return reply({error:'Could not allocate username.'},500)
 const app=(Deno.env.get('APP_URL')||Deno.env.get('APP_BASE_URL')||req.headers.get('origin')||DEFAULT_APP_URL).replace(/\/$/,'');const {data:invited,error:inviteError}=await admin.auth.admin.inviteUserByEmail(contactEmail,{redirectTo:`${app}/activate`,data:{full_name:contactName||label,username,is_demo:true}});if(inviteError||!invited?.user)return reply({error:inviteError?.message||'Demo invitation failed'},500)
 const userId=invited.user.id;const {data:ent,error:entError}=await admin.from('platform_demo_entitlements').insert({label,contact_name:contactName||null,contact_email:contactEmail,valid_from:validFrom,valid_until:validUntil,status:'active',created_by:cu.user.id,demo_user_id:userId}).select().single();if(entError){await admin.auth.admin.deleteUser(userId);return reply({error:entError.message},500)}
 await admin.from('profiles').update({full_name:contactName||label,username,contact_email:contactEmail,is_demo:true,demo_entitlement_id:ent.id}).eq('id',userId)
 return reply({ok:true,entitlement:ent,username,emailSent:true,provider:'supabase_auth'})
})
