import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serveWithCors } from '../_shared/cors.ts'
const cors={'Content-Type':'application/json','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Cache-Control':'no-store'}
const reply=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:cors})
const strong=(p:any)=>typeof p==='string'&&p.length>=12&&p.length<=128&&/[A-Z]/.test(p)&&/[a-z]/.test(p)&&/\d/.test(p)&&/[^A-Za-z0-9]/.test(p)
serveWithCors(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return reply({error:'Method not allowed'},405)
 const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),anon=Deno.env.get('SUPABASE_ANON_KEY');if(!url||!service||!anon)return reply({error:'Service temporarily unavailable'},503)
 const jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');if(!jwt)return reply({error:'Η πρόσκληση δεν είναι πλέον έγκυρη. Ανοίξτε ξανά τον σύνδεσμο από το email.'},401)
 let body:any={};try{body=await req.json()}catch{return reply({error:'Invalid request'},400)};if(!strong(body.password))return reply({error:'Password must be 12–128 characters and include uppercase, lowercase, number and symbol.'},400)
 const caller=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${jwt}`}}});const {data:cu}=await caller.auth.getUser();if(!cu?.user)return reply({error:'Η συνεδρία ενεργοποίησης έληξε.'},401)
 const admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}})

 // Activation is allowed only for the account that actually owns a pending invitation,
 // or for an active demo profile created by the demo-access workflow. This prevents an
 // existing signed-in user (including Platform Owner) from having their password changed
 // when they open somebody else's invitation link in the same browser.
 const [{data:pendingMembership},{data:profile}]=await Promise.all([
  admin.from('organization_members').select('id,organization_id').eq('user_id',cu.user.id).eq('status','invited').limit(1).maybeSingle(),
  admin.from('profiles').select('is_demo,demo_entitlement_id').eq('id',cu.user.id).maybeSingle(),
 ])
 const today=new Date().toISOString().slice(0,10)
 const entitlementOpen=(e:any)=>Boolean(e?.status==='active'&&e.valid_from<=today&&e.valid_until>=today)
 const closedReply=()=>reply({error:'Το Demo έχει λήξει ή είναι σε παύση. Επικοινωνήστε μαζί μας για παράταση ή ενεργοποίηση.',code:'DEMO_CLOSED'},403)
 let validDemo=false
 if(profile?.is_demo&&profile?.demo_entitlement_id){
  const {data:entitlement}=await admin.from('platform_demo_entitlements').select('status,valid_from,valid_until,demo_user_id').eq('id',profile.demo_entitlement_id).maybeSingle()
  validDemo=Boolean(entitlement?.demo_user_id===cu.user.id&&entitlementOpen(entitlement))
  if(entitlement?.demo_user_id===cu.user.id&&!validDemo)return closedReply()
 }
 if(!pendingMembership&&!validDemo)return reply({error:'Η πρόσκληση δεν αντιστοιχεί στον συνδεδεμένο λογαριασμό. Αποσυνδεθείτε και ανοίξτε ξανά τον σύνδεσμο πρόσκλησης.'},403)

 // The organization of the invitation must be open: not paused, and for a Demo
 // its entitlement active and within its dates (the database applies the same rule).
 if(pendingMembership?.organization_id){
  const [{data:org},{data:orgEntitlement}]=await Promise.all([
   admin.from('organizations').select('status,is_demo').eq('id',pendingMembership.organization_id).maybeSingle(),
   admin.from('platform_demo_entitlements').select('status,valid_from,valid_until').eq('organization_id',pendingMembership.organization_id).limit(1).maybeSingle(),
  ])
  if(org?.status!=='active')return reply({error:'Ο οργανισμός είναι σε παύση. Επικοινωνήστε με τον διαχειριστή.',code:'ORGANIZATION_PAUSED'},403)
  if(org?.is_demo&&orgEntitlement&&!entitlementOpen(orgEntitlement))return closedReply()
 }

 const {error:uerr}=await admin.auth.admin.updateUserById(cu.user.id,{password:body.password});if(uerr){console.error('invitation password update failed',uerr);return reply({error:'Δεν ήταν δυνατή η ενεργοποίηση του λογαριασμού. Δοκιμάστε ξανά ή ζητήστε νέα πρόσκληση.'},500)}
 if(pendingMembership){const {error:memberError}=await admin.from('organization_members').update({status:'active'}).eq('user_id',cu.user.id).eq('status','invited');if(memberError){console.error('invitation membership activation failed',memberError);return reply({error:'Ο λογαριασμός ενεργοποιήθηκε, αλλά δεν ολοκληρώθηκε η πρόσβαση στον οργανισμό. Επικοινωνήστε με τον διαχειριστή.'},500)}}
 const {data:p}=await admin.from('profiles').select('username').eq('id',cu.user.id).maybeSingle()
 return reply({ok:true,username:p?.username||cu.user.user_metadata?.username||''})
})
