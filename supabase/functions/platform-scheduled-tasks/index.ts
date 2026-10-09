import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.10.1'
import { lifecycleReminderEmail } from '../_shared/lifecycleReminderEmail.ts'

// Called by the nightly pg_cron job (private.platform_dispatch_scheduled_tasks)
// with the shared secret from Vault, never by a browser: sends the lifecycle
// reminders the job has just written into notification_outbox.

const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}})

Deno.serve(async(req)=>{
  if(req.method!=='POST')return reply({error:'Method not allowed'},405)
  const url=Deno.env.get('SUPABASE_URL')
  const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if(!url||!service)return reply({error:'Function is not configured'},500)
  const admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}})

  const secret=req.headers.get('x-limoxis-scheduler')||''
  const {data:valid,error:secretError}=await admin.rpc('platform_scheduler_secret_valid',{p_secret:secret})
  if(secretError||valid!==true)return reply({error:'Unauthorized'},401)

  const smtpUser=Deno.env.get('SMTP_USER')||Deno.env.get('GMAIL_SMTP_USER')
  const smtpPass=Deno.env.get('SMTP_PASS')||Deno.env.get('GMAIL_SMTP_PASS')
  const smtpPort=Number(Deno.env.get('SMTP_PORT')||465)
  const appUrl=(Deno.env.get('APP_URL')||Deno.env.get('APP_BASE_URL')||'https://www.limoxis.com').replace(/\/$/,'')

  const {data:rows,error:listError}=await admin.from('notification_outbox').select('id,recipient_email,subject,payload,attempts')
    .eq('notification_type','platform_lifecycle_reminder').in('status',['pending','failed']).lte('available_at',new Date().toISOString())
    .order('created_at',{ascending:true}).limit(100)
  if(listError)return reply({error:'Could not load reminders'},500)
  if(!rows?.length)return reply({ok:true,sent:0,failed:0})
  if(!smtpUser||!smtpPass){
    await admin.from('notification_outbox').update({status:'failed',last_error:'EMAIL_SERVICE_NOT_CONFIGURED',updated_at:new Date().toISOString()}).in('id',rows.map(r=>r.id))
    return reply({ok:false,code:'EMAIL_SERVICE_NOT_CONFIGURED',failed:rows.length})
  }

  const transport=nodemailer.createTransport({host:Deno.env.get('SMTP_HOST')||'smtp.gmail.com',port:smtpPort,secure:smtpPort===465,auth:{user:smtpUser,pass:smtpPass}})
  let sent=0,failed=0
  for(const row of rows){
    const {data:claimed}=await admin.from('notification_outbox').update({status:'processing',attempts:Number(row.attempts||0)+1,updated_at:new Date().toISOString()}).eq('id',row.id).in('status',['pending','failed']).select('id').maybeSingle()
    if(!claimed?.id)continue
    try{
      const p=row.payload||{}
      const message=lifecycleReminderEmail({kind:p.kind,audience:p.audience,days:Number(p.days),name:p.name||'',code:p.code||'',date:p.date||'',recipientName:p.recipientName||'',actionUrl:`${appUrl}${p.path||'/'}`,language:p.language==='en'?'en':'el'})
      await transport.sendMail({from:`Limoxis Observer <${smtpUser}>`,to:row.recipient_email,subject:message.subject||row.subject,html:message.html,text:message.text})
      await admin.from('notification_outbox').update({status:'sent',sent_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()}).eq('id',row.id)
      sent++
    }catch(error){
      const attempts=Number(row.attempts||0)+1
      await admin.from('notification_outbox').update({status:'failed',last_error:String((error as Error)?.message||error).slice(0,500),available_at:new Date(Date.now()+Math.min(60,attempts*10)*60000).toISOString(),updated_at:new Date().toISOString()}).eq('id',row.id)
      failed++
    }
  }
  return reply({ok:failed===0,sent,failed})
})
