import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ROLES=['hospital_admin','infection_control_lead','link_nurse','doctor_reviewer','department_user','laboratory','staff_user']
const cors={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:cors})
function randomSecret(length=32){const a=new Uint8Array(length);crypto.getRandomValues(a);return Array.from(a,b=>b.toString(16).padStart(2,'0')).join('')}

const GREEK_INITIALS:Record<string,string>={α:'A',ά:'A',β:'V',γ:'G',δ:'D',ε:'E',έ:'E',ζ:'Z',η:'I',ή:'I',θ:'T',ι:'I',ί:'I',ϊ:'I',ΐ:'I',κ:'K',λ:'L',μ:'M',ν:'N',ξ:'X',ο:'O',ό:'O',π:'P',ρ:'R',σ:'S',ς:'S',τ:'T',υ:'Y',ύ:'Y',ϋ:'Y',ΰ:'Y',φ:'F',χ:'C',ψ:'P',ω:'O',ώ:'O'}
function latinInitial(value=''){const ch=String(value).trim().charAt(0);if(!ch)return 'X';if(/[A-Za-z]/.test(ch))return ch.toUpperCase();return GREEK_INITIALS[ch.toLowerCase()]||'X'}
async function generateUserName(admin:any,fullName:string){
  const parts=String(fullName||'').trim().split(/\s+/).filter(Boolean);const first=parts[0]||'X';const last=parts.length>1?parts[parts.length-1]:'X';const prefix=`${latinInitial(first)}${latinInitial(last)}`
  for(let i=0;i<40;i++){const digits=String(Math.floor(10000+Math.random()*90000));const candidate=`${prefix}${digits}`;const {data}=await admin.from('profiles').select('id').eq('username',candidate).maybeSingle();if(!data)return candidate}
  throw new Error('Could not allocate a unique username')
}
async function sha256(value){const bytes=new TextEncoder().encode(value);const digest=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')}
function emailHtml({fullName,orgName,username,activationUrl}){return `<!doctype html><html><body style="margin:0;background:#eef4f7;font-family:Arial,sans-serif;color:#243b4d"><div style="max-width:620px;margin:28px auto;background:#fff;border:1px solid #d9e3e8"><div style="background:#136f79;color:#fff;padding:28px 40px"><div style="font-size:28px;font-weight:700">Limoxis Observer</div><div style="margin-top:8px;font-size:16px">Πρόληψη λοιμώξεων, επιτήρηση και ποιότητα</div></div><div style="padding:34px 40px"><p style="font-size:20px">Καλησπέρα ${fullName},</p><p style="font-size:17px;line-height:1.65">Έχετε προσκληθεί να δημιουργήσετε λογαριασμό στο Limoxis Observer για το <strong>${orgName}</strong>.</p><div style="background:#f1f7f8;border:1px solid #d6e5e8;border-radius:10px;padding:18px 20px;margin:24px 0"><strong>Όνομα χρήστη:</strong> ${username}<br/><strong>Ρόλος:</strong> Hospital Admin</div><p style="font-size:16px;line-height:1.6">Πατήστε το ασφαλές κουμπί παρακάτω για να ορίσετε τον προσωπικό σας κωδικό πρόσβασης και να ενεργοποιήσετε τον λογαριασμό σας.</p><p style="margin:28px 0"><a href="${activationUrl}" style="display:inline-block;background:#136f79;color:#fff;text-decoration:none;padding:14px 22px;border-radius:8px;font-weight:700">Αποδοχή πρόσκλησης</a></p><p style="font-size:12px;color:#6c7f8b">Ο σύνδεσμος είναι προσωπικός και λήγει σε 72 ώρες.</p></div></div></body></html>`}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='POST')return reply({error:'Method not allowed'},405)
  const supabaseUrl=Deno.env.get('SUPABASE_URL'),serviceRoleKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),anonKey=Deno.env.get('SUPABASE_ANON_KEY')
  if(!supabaseUrl||!serviceRoleKey||!anonKey)return reply({error:'Function is not configured'},500)
  const jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,''); if(!jwt)return reply({error:'Missing Authorization header'},401)
  let body;try{body=await req.json()}catch{return reply({error:'Invalid JSON body'},400)}
  const {organizationId,fullName,role,email}=body||{}
  if(!organizationId||!fullName||!role||!email)return reply({error:'organizationId, fullName, role and email are required'},400)
  if(!ALLOWED_ROLES.includes(role))return reply({error:`Unknown role: ${role}`},400)
  const caller=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:`Bearer ${jwt}`}}});const {data:callerData}=await caller.auth.getUser();if(!callerData?.user)return reply({error:'Invalid session'},401)
  const admin=createClient(supabaseUrl,serviceRoleKey)
  const {data:profile}=await admin.from('profiles').select('is_platform_owner').eq('id',callerData.user.id).maybeSingle();let authorized=Boolean(profile?.is_platform_owner)
  if(!authorized){const {data:m}=await admin.from('organization_members').select('role,status').eq('organization_id',organizationId).eq('user_id',callerData.user.id).eq('status','active').maybeSingle();authorized=m?.role==='hospital_admin'}
  if(!authorized)return reply({error:'Not authorized'},403)
  const {data:org,error:orgError}=await admin.from('organizations').select('id,name,code').eq('id',organizationId).single();if(orgError||!org)return reply({error:'Organization not found'},404)
  const username=await generateUserName(admin,fullName)
  const syntheticEmail=`${username.toLowerCase()}@users.limoxis.local`,temporaryPassword=`A!${randomSecret(18)}9z`
  const {data:created,error:createError}=await admin.auth.admin.createUser({email:syntheticEmail,password:temporaryPassword,email_confirm:true,user_metadata:{full_name:fullName,username,is_platform_owner:false}})
  if(createError||!created?.user)return reply({error:createError?.message||'Could not create user'},500)
  await admin.from('profiles').update({full_name:fullName,username}).eq('id',created.user.id)
  const {error:memberError}=await admin.from('organization_members').insert({organization_id:organizationId,user_id:created.user.id,role,status:'invited'})
  if(memberError){await admin.auth.admin.deleteUser(created.user.id);return reply({error:memberError.message},500)}
  const token=randomSecret(32),tokenHash=await sha256(token),expiresAt=new Date(Date.now()+72*3600*1000).toISOString()
  const {error:inviteError}=await admin.from('account_invitations').insert({organization_id:organizationId,user_id:created.user.id,username,delivery_email:email,role,token_hash:tokenHash,expires_at:expiresAt,created_by:callerData.user.id})
  if(inviteError){await admin.auth.admin.deleteUser(created.user.id);return reply({error:inviteError.message},500)}
  const appUrl=(Deno.env.get('APP_URL')||req.headers.get('origin')||'').replace(/\/$/,'');const activationUrl=`${appUrl}/activate?token=${encodeURIComponent(token)}`
  let emailSent=false,emailError=''
  const resendKey=Deno.env.get('RESEND_API_KEY'),from=Deno.env.get('INVITE_FROM_EMAIL')||'Limoxis Observer <noreply@limoxis.com>'
  if(resendKey&&appUrl){try{const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[email],subject:`Πρόσκληση στο Limoxis Observer — ${org.name}`,html:emailHtml({fullName,orgName:org.name,username,activationUrl})})});emailSent=r.ok;if(!r.ok)emailError=await r.text()}catch(e){emailError=String(e)}}
  return reply({username,userId:created.user.id,emailSent,emailError,activationUrl,expiresAt})
})
