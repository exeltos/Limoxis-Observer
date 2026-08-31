import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors={
  'Content-Type':'application/json',
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
}
const reply=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:cors})
function randomSecret(length=32){const a=new Uint8Array(length);crypto.getRandomValues(a);return Array.from(a,b=>b.toString(16).padStart(2,'0')).join('')}
async function sha256(value:string){const bytes=new TextEncoder().encode(value);const digest=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')}
function invitationHtml({fullName,orgName,username,activationUrl}:{fullName:string,orgName:string,username:string,activationUrl:string}){
  return `<!doctype html><html><body style="margin:0;background:#eef4f7;font-family:Arial,sans-serif;color:#243b4d"><div style="max-width:620px;margin:28px auto;background:#fff;border:1px solid #d9e3e8"><div style="background:#136f79;color:#fff;padding:28px 40px"><div style="font-size:28px;font-weight:700">Limoxis Observer</div><div style="margin-top:8px;font-size:16px">Πρόληψη λοιμώξεων, επιτήρηση και ποιότητα</div></div><div style="padding:34px 40px"><p style="font-size:20px">Καλησπέρα ${fullName||''},</p><p style="font-size:17px;line-height:1.65">Η πρόσκλησή σας για το <strong>${orgName}</strong> επαναπροωθήθηκε.</p><div style="background:#f1f7f8;border:1px solid #d6e5e8;border-radius:10px;padding:18px 20px;margin:24px 0"><strong>Όνομα χρήστη:</strong> ${username}<br/><strong>Ρόλος:</strong> Hospital Admin</div><p style="font-size:16px;line-height:1.6">Πατήστε το ασφαλές κουμπί για να ορίσετε τον προσωπικό σας κωδικό πρόσβασης και να ενεργοποιήσετε τον λογαριασμό.</p><p style="margin:28px 0"><a href="${activationUrl}" style="display:inline-block;background:#136f79;color:#fff;text-decoration:none;padding:14px 22px;border-radius:8px;font-weight:700">Αποδοχή πρόσκλησης</a></p><p style="font-size:12px;color:#6c7f8b">Ο νέος σύνδεσμος είναι προσωπικός και λήγει σε 72 ώρες. Προηγούμενοι σύνδεσμοι πρόσκλησης ακυρώνονται.</p></div></div></body></html>`
}

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
    const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resend}`,'Content-Type':'application/json'},body:JSON.stringify({from:Deno.env.get('INVITE_FROM_EMAIL')||'Limoxis Observer <noreply@limoxis.com>',to:[p.contact_email],subject:'Επαναφορά κωδικού — Limoxis Observer',html:`<p><a href="${actionLink}">Επαναφορά κωδικού</a></p>`})})
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
    const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resend}`,'Content-Type':'application/json'},body:JSON.stringify({from:Deno.env.get('INVITE_FROM_EMAIL')||'Limoxis Observer <noreply@limoxis.com>',to:[p.contact_email],subject:`Πρόσκληση στο Limoxis Observer — ${org?.name||''}`,html:invitationHtml({fullName:p.full_name||'',orgName:org?.name||'',username:p.username,activationUrl})})})
    if(!r.ok)return reply({error:`Η πρόσκληση ανανεώθηκε, αλλά η αποστολή email απέτυχε: ${await r.text()}`,invitationCreated:true,activationUrl},502)
    return reply({ok:true,emailSent:true,expiresAt})
  }
  return reply({error:'Unknown action'},400)
})
