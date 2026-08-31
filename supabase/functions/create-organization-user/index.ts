import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Self-contained email template helpers for Supabase Dashboard deployment
function esc(v:string){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] as string))}
function shell(title:string,body:string,preheader='Limoxis Observer notification'){
 return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(title)}</title></head><body style="margin:0;background:#edf3f7;font-family:Arial,Helvetica,sans-serif;color:#17324a"><div style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#edf3f7;padding:24px 12px"><tr><td align="center"><table role="presentation" width="620" cellspacing="0" cellpadding="0" style="width:100%;max-width:620px;background:#fff;border:1px solid #dbe5ec;border-radius:16px;overflow:hidden"><tr><td style="background:#123f68;padding:28px 34px;color:#fff"><div style="font-size:26px;font-weight:800;letter-spacing:-.3px">Limoxis Observer</div><div style="font-size:14px;margin-top:7px;opacity:.88">Πρόληψη λοιμώξεων · Επιτήρηση · Ποιότητα</div></td></tr><tr><td style="padding:32px 34px">${body}<div style="border-top:1px solid #e4ebf0;margin-top:30px;padding-top:18px;font-size:12px;line-height:1.55;color:#718295">Το μήνυμα δημιουργήθηκε αυτόματα από το Limoxis Observer. Μην προωθείτε προσωπικούς συνδέσμους ενεργοποίησης ή ανάκτησης πρόσβασης.</div></td></tr></table></td></tr></table></body></html>`
}
const button=(label:string,url:string)=>`<p style="margin:28px 0"><a href="${esc(url)}" style="display:inline-block;background:#0f6f7c;color:#fff;text-decoration:none;padding:13px 22px;border-radius:9px;font-weight:700">${esc(label)}</a></p>`
const info=(rows:Array<[string,string]>)=>`<div style="background:#f3f8fa;border:1px solid #dce8ed;border-radius:12px;padding:17px 19px;margin:22px 0">${rows.map(([a,b])=>`<div style="margin:5px 0"><strong>${esc(a)}:</strong> ${esc(b)}</div>`).join('')}</div>`
function invitationEmail({fullName,orgName,username,role='Hospital Admin',activationUrl,resend=false}:{fullName:string,orgName:string,username:string,role?:string,activationUrl:string,resend?:boolean}){
 const body=`<p style="font-size:20px;margin-top:0">Καλησπέρα ${esc(fullName||'')},</p><p style="font-size:16px;line-height:1.65">${resend?'Η πρόσκλησή σας επαναποστάλθηκε.':'Έχετε προσκληθεί να δημιουργήσετε λογαριασμό'} στο Limoxis Observer για το <strong>${esc(orgName)}</strong>.</p>${info([['Όνομα χρήστη',username],['Ρόλος',role]])}<p style="font-size:15px;line-height:1.6">Πατήστε το ασφαλές κουμπί για να ορίσετε τον προσωπικό σας κωδικό πρόσβασης και να ενεργοποιήσετε τον λογαριασμό σας.</p>${button('Αποδοχή πρόσκλησης',activationUrl)}<p style="font-size:12px;color:#718295">Ο σύνδεσμος είναι προσωπικός και λήγει σε 72 ώρες.${resend?' Προηγούμενοι σύνδεσμοι έχουν ακυρωθεί.':''}</p>`
 return shell('Πρόσκληση στο Limoxis Observer',body,'Πρόσκληση ενεργοποίησης λογαριασμού')
}
function passwordResetEmail({fullName,actionUrl}:{fullName?:string,actionUrl:string}){return shell('Επαναφορά κωδικού',`<p style="font-size:20px;margin-top:0">${fullName?`Καλησπέρα ${esc(fullName)},`:'Επαναφορά κωδικού πρόσβασης'}</p><p style="font-size:16px;line-height:1.65">Λάβαμε αίτημα για ορισμό νέου κωδικού πρόσβασης. Αν το ζητήσατε εσείς, συνεχίστε από το ασφαλές κουμπί.</p>${button('Ορισμός νέου κωδικού',actionUrl)}<p style="font-size:12px;color:#718295">Αν δεν ζητήσατε αλλαγή κωδικού, αγνοήστε αυτό το μήνυμα.</p>`)}
function usernameReminderEmail({fullName,username}:{fullName?:string,username:string}){return shell('Υπενθύμιση username',`<p style="font-size:20px;margin-top:0">${fullName?`Καλησπέρα ${esc(fullName)},`:'Στοιχεία λογαριασμού'}</p><p style="font-size:16px">Το username του λογαριασμού σας είναι:</p>${info([['Username',username]])}<p style="font-size:13px;color:#718295">Για λόγους ασφαλείας δεν αποστέλλουμε ποτέ τον κωδικό πρόσβασής σας μέσω email.</p>`)}
function demoAccessEmail({contactName,label,username,validFrom,validUntil,actionUrl}:{contactName?:string,label:string,username:string,validFrom:string,validUntil:string,actionUrl:string}){return shell('Demo πρόσβαση Limoxis Observer',`<p style="font-size:20px;margin-top:0">${contactName?`Καλησπέρα ${esc(contactName)},`:'Demo πρόσβαση'}</p><p style="font-size:16px;line-height:1.65">Ενεργοποιήθηκε απομονωμένο Demo περιβάλλον για <strong>${esc(label)}</strong>.</p>${info([['Username',username],['Ισχύς',`${validFrom} έως ${validUntil}`]])}<p style="font-size:15px;line-height:1.6">Τα δεδομένα του Demo είναι συνθετικά και δεν συνδέονται με πραγματικά δεδομένα νοσοκομείων.</p>${button('Ενεργοποίηση Demo',actionUrl)}`)}



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
Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='POST')return reply({error:'Method not allowed'},405)
  const supabaseUrl=Deno.env.get('SUPABASE_URL'),serviceRoleKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),anonKey=Deno.env.get('SUPABASE_ANON_KEY')
  if(!supabaseUrl||!serviceRoleKey||!anonKey)return reply({error:'Function is not configured'},500)
  const jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,''); if(!jwt)return reply({error:'Missing Authorization header'},401)
  let body;try{body=await req.json()}catch{return reply({error:'Invalid JSON body'},400)}
  const {organizationId,fullName,role,email,phone,jobTitle}=body||{}
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
  await admin.from('profiles').update({full_name:fullName,username,contact_email:email||null,phone:phone||null,job_title:jobTitle||null}).eq('id',created.user.id)
  const {error:memberError}=await admin.from('organization_members').insert({organization_id:organizationId,user_id:created.user.id,role,status:'invited'})
  if(memberError){await admin.auth.admin.deleteUser(created.user.id);return reply({error:memberError.message},500)}
  const token=randomSecret(32),tokenHash=await sha256(token),expiresAt=new Date(Date.now()+72*3600*1000).toISOString()
  const {error:inviteError}=await admin.from('account_invitations').insert({organization_id:organizationId,user_id:created.user.id,username,delivery_email:email,role,token_hash:tokenHash,expires_at:expiresAt,created_by:callerData.user.id})
  if(inviteError){await admin.auth.admin.deleteUser(created.user.id);return reply({error:inviteError.message},500)}
  const appUrl=(Deno.env.get('APP_URL')||req.headers.get('origin')||'').replace(/\/$/,'');const activationUrl=`${appUrl}/activate?token=${encodeURIComponent(token)}`
  let emailSent=false,emailError=''
  const resendKey=Deno.env.get('RESEND_API_KEY'),from=Deno.env.get('INVITE_FROM_EMAIL')||'Limoxis Observer <noreply@limoxis.com>'
  if(resendKey&&appUrl){try{const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[email],subject:`Πρόσκληση στο Limoxis Observer — ${org.name}`,html:invitationEmail({fullName,orgName:org.name,username,role:role==='hospital_admin'?'Hospital Admin':role,activationUrl})})});emailSent=r.ok;if(!r.ok)emailError=await r.text()}catch(e){emailError=String(e)}}
  return reply({username,userId:created.user.id,emailSent,emailError,activationUrl,expiresAt})
})
