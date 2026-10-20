import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serveWithCors } from '../_shared/cors.ts'
import { ROLE_LABELS, sha256Hex } from '../_shared/organizationAccount.ts'
import { ACCESS_TOKEN_PATTERN, REDEEM_IP_LIMIT, REDEEM_IP_WINDOW_MINUTES, REDEEM_TOKEN_FAILURES, strongPassword, tokenState } from '../_shared/bulkAccounts.ts'

// Public endpoint of the e-mailed «Ορισμός κωδικού» link (no session, verify_jwt =
// false): /activate?access=ACT-… . The token is checked by its SHA-256 against
// account_invitations.token_hash (as the supplier link is), single use, 7 days.
//   inspect   (POST, so that mail scanners opening the link change nothing) the
//             hospital, username, role and validity; marks the link as opened.
//   activate  the password (the same policy as accept-account-invitation), the
//             invitation spent and the membership invited → active in one
//             transaction (platform_access_token_redeem), the e-mail confirmed.
// The organization must be open (not paused; a Demo within its dates). Every
// refusal of the link is one generic code and every answer takes at least the
// same time; 10 requests per IP per 15 minutes, 5 failures per token (then revoked).
const cors={'Content-Type':'application/json','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store'}
const MIN_RESPONSE_MS=400
const respond=async(started:number,body:unknown,status=200)=>{const wait=MIN_RESPONSE_MS-(Date.now()-started);if(wait>0)await new Promise(resolve=>setTimeout(resolve,wait));return new Response(JSON.stringify(body),{status,headers:cors})}
const NOT_AVAILABLE='ACCESS_NOT_AVAILABLE'

serveWithCors(async(req)=>{
  const started=Date.now()
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='POST')return respond(started,{ok:false,code:'METHOD_NOT_ALLOWED'},405)
  const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if(!url||!service)return respond(started,{ok:false,code:'SERVICE_UNAVAILABLE'},503)
  let body:{action?:string,token?:string,password?:string}={}
  try{body=await req.json()}catch{return respond(started,{ok:false,code:'INVALID_REQUEST'},400)}
  const action=body.action==='activate'?'activate':'inspect'
  const admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}})

  const ip=(req.headers.get('x-forwarded-for')||'').split(',')[0].trim()||req.headers.get('cf-connecting-ip')||'unknown'
  const ipHash=await sha256Hex(`limoxis-access:${ip}`)
  const since=new Date(Date.now()-REDEEM_IP_WINDOW_MINUTES*60000).toISOString()
  const {count:recent}=await admin.from('access_token_attempts').select('id',{count:'exact',head:true}).eq('ip_hash',ipHash).gte('created_at',since)
  if((recent||0)>=REDEEM_IP_LIMIT)return respond(started,{ok:false,code:'TOO_MANY_ATTEMPTS'},429)
  const attempt=(invitationId:string|null,success:boolean)=>admin.from('access_token_attempts').insert({ip_hash:ipHash,invitation_id:invitationId,action,success})

  const token=String(body.token||'').trim()
  if(!ACCESS_TOKEN_PATTERN.test(token)){await attempt(null,false);return respond(started,{ok:false,code:NOT_AVAILABLE},404)}
  const {data:invite}=await admin.from('account_invitations').select('id,organization_id,user_id,username,role,expires_at,accepted_at,revoked_at').eq('token_hash',await sha256Hex(token)).maybeSingle()
  if(tokenState(invite)!=='valid'){await attempt(invite?.id||null,false);return respond(started,{ok:false,code:NOT_AVAILABLE},404)}
  const {count:failures}=await admin.from('access_token_attempts').select('id',{count:'exact',head:true}).eq('invitation_id',invite.id).eq('success',false)
  if((failures||0)>=REDEEM_TOKEN_FAILURES){await admin.from('account_invitations').update({revoked_at:new Date().toISOString()}).eq('id',invite.id).is('accepted_at',null);return respond(started,{ok:false,code:NOT_AVAILABLE},404)}

  const today=new Date().toISOString().slice(0,10)
  const [{data:org},{data:entitlement},{data:membership}]=await Promise.all([
    admin.from('organizations').select('name,status,is_demo').eq('id',invite.organization_id).maybeSingle(),
    admin.from('platform_demo_entitlements').select('status,valid_from,valid_until').eq('organization_id',invite.organization_id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
    admin.from('organization_members').select('id,role,status,scopes:organization_member_scopes(department:departments(name))').eq('organization_id',invite.organization_id).eq('user_id',invite.user_id).maybeSingle(),
  ])
  if(!org||!membership||membership.status!=='invited'){await attempt(invite.id,false);return respond(started,{ok:false,code:NOT_AVAILABLE},404)}
  if(org.status!=='active')return respond(started,{ok:false,code:'ORGANIZATION_PAUSED'},403)
  if(org.is_demo&&entitlement&&!(entitlement.status==='active'&&entitlement.valid_from<=today&&entitlement.valid_until>=today))return respond(started,{ok:false,code:'DEMO_CLOSED'},403)
  const role=membership.role||invite.role
  const departmentName=(membership.scopes||[]).map((s:{department?:unknown})=>{const d=Array.isArray(s.department)?s.department[0]:s.department;return (d as {name?:string}|null)?.name}).find(Boolean)||''
  const context={organizationName:org.name,username:invite.username,role,roleLabel:ROLE_LABELS[role]||role,departmentName,expiresAt:invite.expires_at}

  if(action==='inspect'){await attempt(invite.id,true);return respond(started,{ok:true,...context})}

  if(!strongPassword(body.password))return respond(started,{ok:false,code:'WEAK_PASSWORD'},400)
  // Spent first (once), then the password; a failed password write gives the link back.
  const {data:redeemed,error:redeemError}=await admin.rpc('platform_access_token_redeem',{p_invitation_id:invite.id})
  if(redeemError||redeemed!==true){await attempt(invite.id,false);return respond(started,{ok:false,code:NOT_AVAILABLE},404)}
  const {error:passwordError}=await admin.auth.admin.updateUserById(invite.user_id,{password:body.password,email_confirm:true})
  if(passwordError){
    console.error('access token password update failed',passwordError.message)
    await admin.from('account_invitations').update({accepted_at:null}).eq('id',invite.id)
    await admin.from('organization_members').update({status:'invited'}).eq('id',membership.id).eq('status','active')
    return respond(started,{ok:false,code:'ACTIVATION_FAILED'},500)
  }
  await attempt(invite.id,true)
  await admin.from('system_audit_log').insert({organization_id:invite.organization_id,actor_user_id:invite.user_id,actor_role:role,event_type:'organization.user.access_redeemed',entity_type:'user',entity_id:invite.user_id,metadata:{invitation_id:invite.id}})
  return respond(started,{ok:true,activated:true,username:invite.username,organizationName:org.name})
})
