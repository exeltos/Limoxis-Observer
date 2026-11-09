import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serveWithCors } from '../_shared/cors.ts'
import { clientIp, decodeSessionId, failureWindowStart, LOCK_MINUTES, MAX_ACCOUNT_FAILURES, MAX_IP_FAILURES, normalizeIdentifier } from '../_shared/loginSecurity.ts'
// Every password sign-in of the app (username or e-mail; also the unlock after inactivity):
//   - an active lock on the name or on the IP → 429 (the password is not even checked);
//   - each attempt is recorded in platform_login_attempts (who, IP, device, success);
//   - 5 failures in 15 minutes for a name, or 20 from one IP → locked for 15 minutes (platform_login_locks);
//   - on success the user's real IP and device are written on the new session (platform_login_sessions),
//     since auth.sessions sees this function's address, not the user's.
const cors={'Content-Type':'application/json','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Cache-Control':'no-store'}
const reply=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:cors})
const invalid=()=>reply({error:'Invalid credentials'},401)
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms))
serveWithCors(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return reply({error:'Method not allowed'},405)
 const started=Date.now();const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),anon=Deno.env.get('SUPABASE_ANON_KEY');if(!url||!service||!anon)return reply({error:'Service temporarily unavailable'},503)
 let b:any={};try{b=await req.json()}catch{return invalid()};const username=String(b.username||'').trim(),password=String(b.password||'');if(!username||!password||username.length>120||password.length>256)return invalid()
 const admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}})
 const identifier=normalizeIdentifier(username),ip=clientIp(req.headers),userAgent=String(req.headers.get('user-agent')||'').slice(0,400)||null
 const record=async(success:boolean,reason:string,userId:string|null=null)=>{try{await admin.from('platform_login_attempts').insert({identifier,user_id:userId,ip,user_agent:userAgent,success,reason})}catch(error){console.error('login attempt not recorded',error)}}
 try{
  const now=new Date().toISOString()
  const {data:openLocks}=await admin.from('platform_login_locks').select('id,kind,subject,locked_until').is('released_at',null).gt('locked_until',now).in('subject',ip?[identifier,ip]:[identifier]).limit(20)
  const lock=(openLocks||[]).find((row:any)=>(row.kind==='account'&&row.subject===identifier)||(row.kind==='ip'&&ip&&row.subject===ip))
  if(lock){await record(false,'locked');return reply({error:'LOGIN_LOCKED',locked_until:lock.locked_until},429)}
  let email=''
  if(identifier.includes('@'))email=identifier
  else{const {data:p}=await admin.from('profiles').select('contact_email').ilike('username',username).maybeSingle();email=String(p?.contact_email||'').toLowerCase()}
  if(email){
   const auth=createClient(url,anon,{auth:{autoRefreshToken:false,persistSession:false}});const {data,error}=await auth.auth.signInWithPassword({email,password})
   if(!error&&data?.session){
    const userId=data.session.user?.id||null
    await record(true,'ok',userId)
    const sessionId=decodeSessionId(data.session.access_token)
    if(sessionId)try{await admin.from('platform_login_sessions').upsert({session_id:sessionId,user_id:userId,ip,last_ip:ip,user_agent:userAgent},{onConflict:'session_id'})}catch(error){console.error('session ip not recorded',error)}
    return reply({access_token:data.session.access_token,refresh_token:data.session.refresh_token})
   }
  }
  await record(false,email?'wrong_password':'unknown_user')
  // Lock after repeated failures; failures before the last lock of the same name/IP do not count twice.
  const lockFor=async(kind:'account'|'ip',subject:string,limit:number)=>{
   const {data:last}=await admin.from('platform_login_locks').select('created_at,released_at,locked_until').eq('kind',kind).eq('subject',subject).order('created_at',{ascending:false}).limit(1)
   const since=failureWindowStart(new Date(),last?.[0])
   const column=kind==='account'?'identifier':'ip'
   const {count}=await admin.from('platform_login_attempts').select('id',{count:'exact',head:true}).eq(column,subject).eq('success',false).neq('reason','locked').gt('created_at',since.toISOString())
   if((count||0)>=limit){await admin.from('platform_login_locks').insert({kind,subject,failures:count,locked_until:new Date(Date.now()+LOCK_MINUTES*60000).toISOString()});return true}
   return false
  }
  const lockedAccount=await lockFor('account',identifier,MAX_ACCOUNT_FAILURES)
  const lockedIp=ip?await lockFor('ip',ip,MAX_IP_FAILURES):false
  if(lockedAccount||lockedIp){const remaining=300-(Date.now()-started);if(remaining>0)await sleep(remaining);return reply({error:'LOGIN_LOCKED'},429)}
 }catch(error){console.error('username login failed',error)}
 const remaining=300-(Date.now()-started);if(remaining>0)await sleep(remaining)
 return invalid()
})
