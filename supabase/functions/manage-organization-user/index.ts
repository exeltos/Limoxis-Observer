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



const cors={
  'Content-Type':'application/json',
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
}
const reply=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:cors})
function randomSecret(length=32){const a=new Uint8Array(length);crypto.getRandomValues(a);return Array.from(a,b=>b.toString(16).padStart(2,'0')).join('')}
async function sha256(value:string){const bytes=new TextEncoder().encode(value);const digest=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')}
Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='POST')return reply({error:'Method not allowed'},405)
  const url=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!
  const jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'')
  const caller=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${jwt}`}}})
  const {data:cu}=await caller.auth.getUser();if(!cu?.user)return reply({error:'Unauthorized'},401)
  const b=await req.json(),{organizationId,userId,action}=b,admin=createClient(url,service)
  const {data:owner}=await admin.from('profiles').select('is_platform_owner').eq('id',cu.user.id).maybeSingle()
  let ok=Boolean(owner?.is_platform_owner)
  if(!ok){const {data:m}=await admin.from('organization_members').select('role,status').eq('organization_id',organizationId).eq('user_id',cu.user.id).maybeSingle();ok=m?.role==='hospital_admin'&&m?.status==='active'}
  if(!ok)return reply({error:'Forbidden'},403)
  if(userId===cu.user.id&&['delete','suspend'].includes(action))return reply({error:'Δεν μπορείτε να παύσετε ή να διαγράψετε τον δικό σας λογαριασμό.'},400)

  if(action==='update'){
    if(b.jobTitle!==undefined)await admin.from('profiles').update({job_title:b.jobTitle||null}).eq('id',userId)
    if(b.role)await admin.from('organization_members').update({role:b.role}).eq('organization_id',organizationId).eq('user_id',userId)
    return reply({ok:true})
  }
  if(action==='suspend'||action==='reactivate'){
    const status=action==='suspend'?'disabled':'active'
    await admin.from('organization_members').update({status}).eq('organization_id',organizationId).eq('user_id',userId)
    return reply({ok:true,status})
  }
  if(action==='delete'){
    await admin.from('organization_members').delete().eq('organization_id',organizationId).eq('user_id',userId)
    const {error}=await admin.auth.admin.deleteUser(userId);if(error)return reply({error:error.message},500)
    return reply({ok:true})
  }
  if(action==='reset_password'){
    const {data:p}=await admin.from('profiles').select('username,contact_email').eq('id',userId).single()
    if(!p?.username||!p?.contact_email)return reply({error:'Ο χρήστης δεν έχει email ανάκτησης.'},400)
    const app=(Deno.env.get('APP_URL')||req.headers.get('origin')||'').replace(/\/$/,'')
    const {data:link}=await admin.auth.admin.generateLink({type:'recovery',email:`${String(p.username).toLowerCase()}@users.limoxis.local`,options:{redirectTo:`${app}/reset-password`}})
    const actionLink=(link as any)?.properties?.action_link||'',resend=Deno.env.get('RESEND_API_KEY')
    if(!resend)return reply({error:'Δεν έχει ρυθμιστεί RESEND_API_KEY.'},500)
    const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resend}`,'Content-Type':'application/json'},body:JSON.stringify({from:Deno.env.get('INVITE_FROM_EMAIL')||'Limoxis Observer <noreply@limoxis.com>',to:[p.contact_email],subject:'Επαναφορά κωδικού — Limoxis Observer',html:passwordResetEmail({actionUrl:actionLink})})})
    if(!r.ok)return reply({error:`Η αποστολή email απέτυχε: ${await r.text()}`},502)
    return reply({ok:true,emailSent:true})
  }
  if(action==='resend_invitation'){
    const {data:member}=await admin.from('organization_members').select('role,status').eq('organization_id',organizationId).eq('user_id',userId).maybeSingle()
    if(!member)return reply({error:'Ο χρήστης δεν ανήκει στον οργανισμό.'},404)
    if(member.status==='active')return reply({error:'Ο λογαριασμός είναι ήδη ενεργός. Χρησιμοποίησε επαναφορά κωδικού αν χρειάζεται.'},400)
    const [{data:p},{data:org}]=await Promise.all([
      admin.from('profiles').select('full_name,username,contact_email').eq('id',userId).single(),
      admin.from('organizations').select('name').eq('id',organizationId).single(),
    ])
    if(!p?.username||!p?.contact_email)return reply({error:'Λείπει username ή email πρόσκλησης.'},400)
    const token=randomSecret(32),tokenHash=await sha256(token),expiresAt=new Date(Date.now()+72*3600*1000).toISOString()
    await admin.from('account_invitations').update({revoked_at:new Date().toISOString()}).eq('organization_id',organizationId).eq('user_id',userId).is('accepted_at',null).is('revoked_at',null)
    const {error:inviteError}=await admin.from('account_invitations').insert({organization_id:organizationId,user_id:userId,username:p.username,delivery_email:p.contact_email,role:member.role,token_hash:tokenHash,expires_at:expiresAt,created_by:cu.user.id})
    if(inviteError)return reply({error:inviteError.message},500)
    const app=(Deno.env.get('APP_URL')||req.headers.get('origin')||'').replace(/\/$/,'')
    const activationUrl=`${app}/activate?token=${encodeURIComponent(token)}`
    const resend=Deno.env.get('RESEND_API_KEY')
    if(!resend)return reply({error:'Η πρόσκληση ανανεώθηκε, αλλά δεν έχει ρυθμιστεί RESEND_API_KEY.',invitationCreated:true,activationUrl},500)
    if(!app)return reply({error:'Η πρόσκληση ανανεώθηκε, αλλά δεν έχει ρυθμιστεί APP_URL.',invitationCreated:true},500)
    const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resend}`,'Content-Type':'application/json'},body:JSON.stringify({from:Deno.env.get('INVITE_FROM_EMAIL')||'Limoxis Observer <noreply@limoxis.com>',to:[p.contact_email],subject:`Πρόσκληση στο Limoxis Observer — ${org?.name||''}`,html:invitationEmail({fullName:p.full_name||'',orgName:org?.name||'',username:p.username,role:member.role==='hospital_admin'?'Hospital Admin':member.role,activationUrl,resend:true})})})
    if(!r.ok)return reply({error:`Η πρόσκληση ανανεώθηκε, αλλά η αποστολή email απέτυχε: ${await r.text()}`,invitationCreated:true,activationUrl},502)
    return reply({ok:true,emailSent:true,expiresAt})
  }
  return reply({error:'Unknown action'},400)
})
