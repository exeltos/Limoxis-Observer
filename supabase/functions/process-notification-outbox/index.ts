import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.10.1'
import { committeeMinutesApprovalEmail } from '../_shared/committeeApprovalEmail.ts'
import { trainingInvitationEmail } from '../_shared/trainingInvitationEmail.ts'

const cors={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors})

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='POST')return reply({error:'Method not allowed'},405)

  const supabaseUrl=Deno.env.get('SUPABASE_URL')
  const serviceRoleKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey=Deno.env.get('SUPABASE_ANON_KEY')
  const smtpHost=Deno.env.get('SMTP_HOST')||'smtp.gmail.com'
  const smtpPort=Number(Deno.env.get('SMTP_PORT')||465)
  const smtpUser=Deno.env.get('SMTP_USER')||Deno.env.get('GMAIL_SMTP_USER')
  const smtpPass=Deno.env.get('SMTP_PASS')||Deno.env.get('GMAIL_SMTP_PASS')
  const appUrl=(Deno.env.get('APP_URL')||Deno.env.get('APP_BASE_URL')||'https://limoxis-observer.netlify.app').replace(/\/$/,'')
  if(!supabaseUrl||!serviceRoleKey||!anonKey||!smtpUser||!smtpPass)return reply({error:'Email service is not configured'},500)

  const jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'')
  if(!jwt)return reply({error:'Missing authorization'},401)
  let body:any={}
  try{body=await req.json()}catch{return reply({error:'Invalid request'},400)}
  const organizationId=String(body?.organizationId||'').trim()
  if(!organizationId)return reply({error:'Organization is required'},400)

  const caller=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:`Bearer ${jwt}`}}})
  const {data:callerData}=await caller.auth.getUser()
  if(!callerData?.user)return reply({error:'Invalid session'},401)

  const admin=createClient(supabaseUrl,serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false}})
  const [{data:profile},{data:membership}]=await Promise.all([
    admin.from('profiles').select('is_platform_owner').eq('id',callerData.user.id).maybeSingle(),
    admin.from('organization_members').select('id,status').eq('organization_id',organizationId).eq('user_id',callerData.user.id).eq('status','active').maybeSingle()
  ])
  if(!profile?.is_platform_owner&&!membership?.id)return reply({error:'Not authorized'},403)

  const transport=nodemailer.createTransport({host:smtpHost,port:smtpPort,secure:smtpPort===465,auth:{user:smtpUser,pass:smtpPass}})
  const {data:rows,error:listError}=await admin.from('notification_outbox').select('id,recipient_email,subject,payload,attempts,notification_type').eq('organization_id',organizationId).in('notification_type',['committee_minutes_approval_requested','training_invitation']).in('status',['pending','failed']).lte('available_at',new Date().toISOString()).order('created_at',{ascending:true}).limit(20)
  if(listError)return reply({error:'Could not load notifications'},500)

  let sent=0,failed=0
  for(const row of rows||[]){
    const {data:claimed,error:claimError}=await admin.from('notification_outbox').update({status:'processing',attempts:Number(row.attempts||0)+1,updated_at:new Date().toISOString()}).eq('id',row.id).in('status',['pending','failed']).select('id').maybeSingle()
    if(claimError||!claimed?.id)continue
    try{
      const payload=row.payload||{}
      const actionUrl=`${appUrl}${payload.path||'/'}`
      const message=row.notification_type==='training_invitation'
        ?trainingInvitationEmail({programTitle:payload.programTitle||'',employeeName:payload.employeeName||'',dueDate:payload.dueDate||null,requiresAssessment:Boolean(payload.requiresAssessment),actionUrl,language:payload.language==='en'?'en':'el'})
        :committeeMinutesApprovalEmail({committeeName:payload.committeeName||'',meetingTitle:payload.meetingTitle||'',scheduledAt:payload.scheduledAt||null,actionUrl,language:payload.language==='en'?'en':'el'})
      await transport.sendMail({from:`Limoxis Observer <${smtpUser}>`,to:row.recipient_email,subject:message.subject||row.subject,html:message.html,text:message.text})
      await admin.from('notification_outbox').update({status:'sent',sent_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()}).eq('id',row.id)
      sent++
    }catch(error){
      const attempts=Number(row.attempts||0)+1
      const retryMinutes=Math.min(60,Math.max(5,attempts*5))
      await admin.from('notification_outbox').update({status:'failed',last_error:String(error?.message||error).slice(0,500),available_at:new Date(Date.now()+retryMinutes*60000).toISOString(),updated_at:new Date().toISOString()}).eq('id',row.id)
      failed++
    }
  }
  return reply({ok:true,sent,failed})
})
