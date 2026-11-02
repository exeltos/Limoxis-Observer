import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.10.1'
import { lifecycleReminderEmail } from '../_shared/lifecycleReminderEmail.ts'
import { legislationDigestEmail, legislationUpdateEmail } from '../_shared/legislationEmail.ts'
import { newCandidates, parseFeed, parsePage } from '../_shared/legislationWatch.ts'
import { supplierCertificateRenewalEmail, supplierCertificateSubmittedEmail } from '../_shared/supplierCertificateEmail.ts'
import { runTranslations } from '../_shared/translateContent.ts'
import { accountAccessAddedEmail, accountBatchSummaryEmail, accountCreatedEmail } from '../_shared/accountCreatedEmail.ts'

// Called by pg_cron (private.platform_dispatch_scheduled_tasks / platform_dispatch_task)
// with the shared secret from Vault, never by a browser. Tasks:
//   lifecycle_reminders, send   send what is waiting in notification_outbox;
//   legislation_watch           check the legislation sources, then send;
//   legislation_digest          check, write the Platform Owner's morning digest, then send;
//   translate_content           translate the queued institutional texts (docs/TRANSLATION_DESIGN.md).

const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}})
// Supplier certificate links are also sent here, so an approved request goes out even
// when no browser drains the outbox (process-notification-outbox claims rows the same way).
// So are the account e-mails of the bulk creation from the employee roster (N1).
const MAILED=['platform_lifecycle_reminder','legislation_update','legislation_digest','supplier_certificate_renewal','supplier_certificate_submitted','account_created','account_access_added','account_batch_summary']
const DIGEST_ENTITY='00000000-0000-0000-0000-00000000a11e'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin=any

async function fetchText(url:string){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000)
  try{
    const response=await fetch(url,{signal:controller.signal,headers:{'user-agent':'Mozilla/5.0 (compatible; Limoxis-Observer legislation check)','accept':'application/rss+xml, application/xml, text/html;q=0.9, */*;q=0.8'}})
    return {status:response.status,ok:response.ok,body:response.ok?await response.text():''}
  }finally{clearTimeout(timer)}
}

// Each active source once: new items that match its keywords become candidates.
async function watchSources(admin:Admin){
  const {data:sources,error}=await admin.from('legislation_sources').select('*').eq('active',true)
  if(error)throw error
  let found=0
  for(const source of sources||[]){
    const now=new Date().toISOString()
    try{
      const page=await fetchText(source.url)
      if(!page.ok)throw new Error(`HTTP ${page.status}`)
      const items=source.kind==='page'?parsePage(page.body,source.url):parseFeed(page.body)
      if(!items.length)throw new Error('NO_ITEMS')
      const result=newCandidates(items,source.seen_keys||[],source.keywords||[],!source.last_checked_at||!(source.seen_keys||[]).length)
      if(result.candidates.length){
        await admin.from('legislation_candidates').upsert(result.candidates.map(item=>({source_id:source.id,item_key:item.key.slice(0,1000),title:item.title.slice(0,500),url:item.url||null,excerpt:item.excerpt||null,published_hint:item.published||null,matched_keywords:item.matched})),{onConflict:'source_id,item_key',ignoreDuplicates:true})
        found+=result.candidates.length
      }
      await admin.from('legislation_sources').update({last_checked_at:now,last_status:page.status,last_error:null,consecutive_failures:0,failure_notified:false,seen_keys:result.keys}).eq('id',source.id)
    }catch(error){
      const message=(error as Error)?.name==='AbortError'?'TIMEOUT':String((error as Error)?.message||error).slice(0,300)
      await admin.from('legislation_sources').update({last_checked_at:now,last_error:message,consecutive_failures:Number(source.consecutive_failures||0)+1}).eq('id',source.id)
    }
  }
  return found
}

// The morning digest to every Platform Owner: candidates not yet reported, and
// sources that failed twice in a row (reported once, until they answer again).
async function writeDigest(admin:Admin){
  const [{data:candidates},{data:failing},{data:owners}]=await Promise.all([
    admin.from('legislation_candidates').select('id,title,url,matched_keywords,legislation_sources(name)').eq('status','pending').is('notified_at',null).order('detected_at',{ascending:false}).limit(100),
    admin.from('legislation_sources').select('id,name,last_error').eq('active',true).gte('consecutive_failures',2).eq('failure_notified',false),
    admin.from('profiles').select('id,full_name,contact_email').eq('is_platform_owner',true),
  ])
  if(!candidates?.length&&!failing?.length)return 0
  const day=new Date().toISOString().slice(0,10)
  const payload={kind:'digest',items:(candidates||[]).map((c:Admin)=>({title:c.title,url:c.url,source:c.legislation_sources?.name||'',matched:c.matched_keywords||[]})),failing:(failing||[]).map((s:Admin)=>({name:s.name,error:s.last_error||''})),path:'/legislation?tab=review',language:'el'}
  let written=0
  for(const owner of owners||[]){
    let email=String(owner.contact_email||'').trim()
    if(!email){const {data}=await admin.auth.admin.getUserById(owner.id);email=data?.user?.email||''}
    if(!email)continue
    const {error}=await admin.from('notification_outbox').upsert({recipient_user_id:owner.id,recipient_email:email,notification_type:'legislation_digest',entity_type:`legislation_digest:${day}`,entity_id:DIGEST_ENTITY,subject:'Νομοθεσία: αποτελέσματα αυτόματου ελέγχου',payload:{...payload,recipientName:owner.full_name||''},status:'pending',attempts:0,available_at:new Date().toISOString()},{onConflict:'notification_type,entity_type,entity_id,recipient_user_id',ignoreDuplicates:true})
    if(!error)written++
  }
  if(written){
    if(candidates?.length)await admin.from('legislation_candidates').update({notified_at:new Date().toISOString()}).in('id',candidates.map((c:Admin)=>c.id))
    if(failing?.length)await admin.from('legislation_sources').update({failure_notified:true}).in('id',failing.map((s:Admin)=>s.id))
  }
  return written
}

function messageFor(type:string,p:Record<string,unknown>,actionUrl:string){
  if(type==='supplier_certificate_renewal')return supplierCertificateRenewalEmail({organizationName:String(p.organizationName||''),organizationEmail:String(p.organizationEmail||''),organizationPhone:String(p.organizationPhone||''),supplierName:String(p.supplierName||''),certificates:Array.isArray(p.certificates)?p.certificates:[],kind:p.kind==='reminder'?'reminder':'send',expiresAt:typeof p.expiresAt==='string'?p.expiresAt:null,firstSentAt:typeof p.firstSentAt==='string'?p.firstSentAt:null,actionUrl})
  if(type==='supplier_certificate_submitted')return supplierCertificateSubmittedEmail({organizationName:String(p.organizationName||''),certificates:Array.isArray(p.certificates)?p.certificates:[],actionUrl:actionUrl.replace('/quality/resources/suppliers/renewals','/quality/suppliers/renewals')})
  if(type==='account_created')return accountCreatedEmail({organizationName:String(p.organizationName||''),organizationEmail:String(p.organizationEmail||''),organizationPhone:String(p.organizationPhone||''),recipientName:String(p.recipientName||''),username:String(p.username||''),roleLabel:String(p.roleLabel||''),departmentName:String(p.departmentName||''),expiresAt:typeof p.expiresAt==='string'?p.expiresAt:null,kind:p.kind==='resend'?'resend':'send',actionUrl})
  if(type==='account_access_added')return accountAccessAddedEmail({organizationName:String(p.organizationName||''),organizationEmail:String(p.organizationEmail||''),organizationPhone:String(p.organizationPhone||''),recipientName:String(p.recipientName||''),username:String(p.username||''),roleLabel:String(p.roleLabel||''),departmentName:String(p.departmentName||''),actionUrl})
  if(type==='account_batch_summary')return accountBatchSummaryEmail({organizationName:String(p.organizationName||''),recipientName:String(p.recipientName||''),createdAt:typeof p.createdAt==='string'?p.createdAt:null,people:Array.isArray(p.people)?p.people:[],actionUrl})
  if(type==='legislation_update')return legislationUpdateEmail(p,actionUrl)
  if(type==='legislation_digest')return legislationDigestEmail(p as Parameters<typeof legislationDigestEmail>[0],actionUrl)
  return lifecycleReminderEmail({kind:String(p.kind||''),audience:String(p.audience||''),days:Number(p.days),name:String(p.name||''),code:String(p.code||''),date:String(p.date||''),recipientName:String(p.recipientName||''),actionUrl,language:p.language==='en'?'en':'el'})
}

async function sendOutbox(admin:Admin){
  const smtpUser=Deno.env.get('SMTP_USER')||Deno.env.get('GMAIL_SMTP_USER')
  const smtpPass=Deno.env.get('SMTP_PASS')||Deno.env.get('GMAIL_SMTP_PASS')
  const smtpPort=Number(Deno.env.get('SMTP_PORT')||465)
  const appUrl=(Deno.env.get('APP_URL')||Deno.env.get('APP_BASE_URL')||'https://www.limoxis.com').replace(/\/$/,'')
  const {data:rows,error:listError}=await admin.from('notification_outbox').select('id,notification_type,recipient_email,subject,payload,attempts')
    .in('notification_type',MAILED).in('status',['pending','failed']).lte('available_at',new Date().toISOString()).lt('attempts',6)
    .order('created_at',{ascending:true}).limit(200)
  if(listError)throw new Error('Could not load the outbox')
  if(!rows?.length)return {sent:0,failed:0}
  if(!smtpUser||!smtpPass){
    await admin.from('notification_outbox').update({status:'failed',last_error:'EMAIL_SERVICE_NOT_CONFIGURED',updated_at:new Date().toISOString()}).in('id',rows.map((r:Admin)=>r.id))
    return {sent:0,failed:rows.length,code:'EMAIL_SERVICE_NOT_CONFIGURED'}
  }
  const transport=nodemailer.createTransport({host:Deno.env.get('SMTP_HOST')||'smtp.gmail.com',port:smtpPort,secure:smtpPort===465,auth:{user:smtpUser,pass:smtpPass}})
  let sent=0,failed=0
  for(const row of rows){
    const {data:claimed}=await admin.from('notification_outbox').update({status:'processing',attempts:Number(row.attempts||0)+1,updated_at:new Date().toISOString()}).eq('id',row.id).in('status',['pending','failed']).select('id').maybeSingle()
    if(!claimed?.id)continue
    try{
      const p=row.payload||{}
      const message=messageFor(row.notification_type,p,`${appUrl}${p.path||'/'}`)
      await transport.sendMail({from:`Limoxis Observer <${smtpUser}>`,to:row.recipient_email,subject:message.subject||row.subject,html:message.html,text:message.text,...('replyTo' in message&&message.replyTo?{replyTo:message.replyTo}:{})})
      // The account link's raw token is kept only until its e-mail is sent.
      await admin.from('notification_outbox').update({status:'sent',sent_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString(),...(row.notification_type==='account_created'?{payload:{...p,path:'/activate'}}:{})}).eq('id',row.id)
      sent++
    }catch(error){
      const attempts=Number(row.attempts||0)+1
      await admin.from('notification_outbox').update({status:'failed',last_error:String((error as Error)?.message||error).slice(0,500),available_at:new Date(Date.now()+Math.min(60,attempts*10)*60000).toISOString(),updated_at:new Date().toISOString()}).eq('id',row.id)
      failed++
    }
  }
  return {sent,failed}
}

Deno.serve(async(req)=>{
  if(req.method!=='POST')return reply({error:'Method not allowed'},405)
  const url=Deno.env.get('SUPABASE_URL')
  const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if(!url||!service)return reply({error:'Function is not configured'},500)
  const admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}})

  const secret=req.headers.get('x-limoxis-scheduler')||''
  const {data:valid,error:secretError}=await admin.rpc('platform_scheduler_secret_valid',{p_secret:secret})
  if(secretError||valid!==true)return reply({error:'Unauthorized'},401)

  const {task='lifecycle_reminders'}=await req.json().catch(()=>({}))
  try{
    const result:Record<string,unknown>={task}
    if(task==='translate_content')return reply({ok:true,...result,...await runTranslations(admin)})
    if(task==='legislation_watch'||task==='legislation_digest')result.found=await watchSources(admin)
    if(task==='legislation_digest')result.digests=await writeDigest(admin)
    Object.assign(result,await sendOutbox(admin))
    return reply({ok:!result.failed,...result})
  }catch(error){
    return reply({ok:false,task,error:String((error as Error)?.message||error).slice(0,300)},500)
  }
})
