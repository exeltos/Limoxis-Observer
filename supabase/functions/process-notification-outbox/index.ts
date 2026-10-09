import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.10.1'
import { committeeMinutesApprovalEmail,committeeMinutesExternalApprovalEmail } from '../_shared/committeeApprovalEmail.ts'
import { trainingInvitationEmail } from '../_shared/trainingInvitationEmail.ts'
import { demoApplicationRequestEmail } from '../_shared/demoApplicationRequestEmail.ts'

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
  const appUrl=(Deno.env.get('APP_URL')||Deno.env.get('APP_BASE_URL')||'https://www.limoxis.com').replace(/\/$/,'')
  if(!supabaseUrl||!serviceRoleKey||!anonKey)return reply({ok:false,code:'EMAIL_BACKEND_CONFIG_MISSING',error:'Supabase email backend configuration is incomplete'},500)

  const jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'')
  if(!jwt)return reply({ok:false,code:'EMAIL_AUTH_REQUIRED',error:'Missing authorization'},401)
  let body:any={}
  try{body=await req.json()}catch{return reply({ok:false,code:'EMAIL_INVALID_REQUEST',error:'Invalid request'},400)}
  const organizationId=String(body?.organizationId||'').trim()
  if(!organizationId)return reply({ok:false,code:'EMAIL_ORGANIZATION_REQUIRED',error:'Organization is required'},400)

  const caller=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:`Bearer ${jwt}`}}})
  const {data:callerData}=await caller.auth.getUser()
  if(!callerData?.user)return reply({ok:false,code:'EMAIL_INVALID_SESSION',error:'Invalid session'},401)

  const admin=createClient(supabaseUrl,serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false}})
  const [{data:profile},{data:membership}]=await Promise.all([
    admin.from('profiles').select('is_platform_owner').eq('id',callerData.user.id).maybeSingle(),
    admin.from('organization_members').select('id,status').eq('organization_id',organizationId).eq('user_id',callerData.user.id).eq('status','active').maybeSingle()
  ])
  if(!profile?.is_platform_owner&&!membership?.id)return reply({ok:false,code:'EMAIL_NOT_AUTHORIZED',error:'Not authorized'},403)

  const {data:rows,error:listError}=await admin.from('notification_outbox').select('id,recipient_email,subject,payload,attempts,notification_type').eq('organization_id',organizationId).in('notification_type',['committee_minutes_approval_requested','committee_minutes_external_approval','training_invitation','demo_application_request']).in('status',['pending','failed']).lte('available_at',new Date().toISOString()).order('created_at',{ascending:true}).limit(20)
  if(listError)return reply({ok:false,code:'EMAIL_OUTBOX_LOAD_FAILED',error:'Could not load notifications'},500)
  if(!rows?.length)return reply({ok:true,sent:0,failed:0,pending:0})

  // A Demo never e-mails its synthetic people (all @*.invalid): only real
  // recipients (the evaluators, the Platform Owner) get mail from a Demo.
  const {data:organization}=await admin.from('organizations').select('is_demo').eq('id',organizationId).maybeSingle()
  const syntheticIds=organization?.is_demo?rows.filter(row=>/\.invalid$/i.test(String(row.recipient_email||'').trim())).map(row=>row.id):[]
  if(syntheticIds.length)await admin.from('notification_outbox').update({status:'cancelled',last_error:'DEMO_SYNTHETIC_RECIPIENT',updated_at:new Date().toISOString()}).in('id',syntheticIds)
  const deliverable=rows.filter(row=>!syntheticIds.includes(row.id))
  if(!deliverable.length)return reply({ok:true,sent:0,failed:0,pending:0,cancelled:syntheticIds.length})

  if(!smtpUser||!smtpPass){
    const now=new Date().toISOString()
    const ids=deliverable.map(row=>row.id)
    await admin.from('notification_outbox').update({status:'failed',last_error:'EMAIL_SERVICE_NOT_CONFIGURED',updated_at:now}).in('id',ids)
    return reply({ok:false,code:'EMAIL_SERVICE_NOT_CONFIGURED',error:'SMTP credentials are not configured for process-notification-outbox',sent:0,failed:deliverable.length},200)
  }

  const transport=nodemailer.createTransport({host:smtpHost,port:smtpPort,secure:smtpPort===465,auth:{user:smtpUser,pass:smtpPass}})
  let sent=0,failed=0
  for(const row of deliverable){
    const {data:claimed,error:claimError}=await admin.from('notification_outbox').update({status:'processing',attempts:Number(row.attempts||0)+1,updated_at:new Date().toISOString()}).eq('id',row.id).in('status',['pending','failed']).select('id').maybeSingle()
    if(claimError||!claimed?.id)continue
    try{
      const payload=row.payload||{}
      const actionUrl=`${appUrl}${payload.path||'/'}`
      const message=row.notification_type==='committee_minutes_external_approval'
        ?committeeMinutesExternalApprovalEmail({memberName:payload.memberName||'',organizationName:payload.organizationName||'',committeeName:payload.committeeName||'',meetingTitle:payload.meetingTitle||'',scheduledAt:payload.scheduledAt||null,minutesNumber:payload.minutesNumber||'',topics:Array.isArray(payload.topics)?payload.topics:[],expiresAt:payload.expiresAt||null,actionUrl,language:payload.language==='en'?'en':'el'})
        :row.notification_type==='demo_application_request'
        ?demoApplicationRequestEmail({organizationName:payload.organizationName||'',contactName:payload.contactName||'',contactEmail:payload.contactEmail||'',contactPhone:payload.contactPhone||'',message:payload.message||'',actionUrl,language:payload.language==='en'?'en':'el'})
        :row.notification_type==='training_invitation'
        ?trainingInvitationEmail({programTitle:payload.programTitle||'',employeeName:payload.employeeName||'',dueDate:payload.dueDate||null,requiresAssessment:Boolean(payload.requiresAssessment),questionCount:Number(payload.questionCount||0),externalAccess:Boolean(payload.externalAccess),actionUrl,language:payload.language==='en'?'en':'el'})
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
  return reply({ok:failed===0,sent,failed,pending:Math.max(0,deliverable.length-sent-failed),cancelled:syntheticIds.length})
})
