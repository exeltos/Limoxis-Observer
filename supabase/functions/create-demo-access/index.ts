import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.10.1'
import { demoAccessEmail } from '../_shared/emailTemplates.ts'

// New Demo (wizard) and new evaluators of an existing Demo. Platform Owner only.
//   * create: organization, entitlement with its data scenario, the data
//     (platform_reset_demo_organization), then the evaluators. Invitations
//     leave only after the data is in, so nobody logs into an empty hospital.
//   * add_evaluator: one more evaluator, within max_demo_users.
// Each evaluator gets a real role (department roles get a Demo department) and
// either an email invitation (the Limoxis "Demo access" email when SMTP is
// configured, otherwise the Supabase invitation) or a temporary password that
// is returned once and never stored.

const DEFAULT_APP_URL='https://www.limoxis.com'
const cors={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const reply=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:cors})
const GREEK:Record<string,string>={α:'A',ά:'A',β:'V',γ:'G',δ:'D',ε:'E',έ:'E',ζ:'Z',η:'I',ή:'I',θ:'T',ι:'I',ί:'I',κ:'K',λ:'L',μ:'M',ν:'N',ξ:'X',ο:'O',ό:'O',π:'P',ρ:'R',σ:'S',ς:'S',τ:'T',υ:'Y',ύ:'Y',φ:'F',χ:'C',ψ:'P',ω:'O',ώ:'O'}
const initial=(value='')=>{const c=String(value).trim().charAt(0);return /[A-Za-z]/.test(c)?c.toUpperCase():(GREEK[c.toLowerCase()]||'D')}
const addDays=(isoDate:string,days:number)=>{const date=new Date(`${isoDate}T00:00:00Z`);if(Number.isNaN(date.getTime()))return '';date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10)}
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ROLES=['hospital_admin','infection_control_lead','infection_control_member','department_manager','link_nurse','department_user','laboratory','pharmacy','quality_manager','occupational_physician','hr_office','committee_secretariat','doctor_reviewer']
const DEPARTMENT_ROLES=new Set(['department_manager','link_nurse','department_user','laboratory'])
const PROFILES=['full','surveillance','empty']
const fmtDay=(value:string)=>{const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return m?`${m[3]}/${m[2]}/${m[1]}`:value}

type Evaluator={fullName:string,email:string,role:string,departmentCode:string|null,access:'invite'|'password'}

async function allocateUsername(admin:any,fullName:string){
  const parts=fullName.split(/\s+/).filter(Boolean)
  const prefix=`${initial(parts[0]||'D')}${initial(parts.at(-1)||'U')}`
  for(let i=0;i<30;i++){
    const candidate=`${prefix}${Math.floor(10000+Math.random()*90000)}`
    const {data}=await admin.from('profiles').select('id').eq('username',candidate).maybeSingle()
    if(!data)return candidate
  }
  return ''
}

async function allocateDemoOrganizationCode(admin:any){
  for(let i=0;i<30;i++){
    const candidate=`DEMO-${Math.floor(100000+Math.random()*900000)}`
    const {data}=await admin.from('organizations').select('id').eq('code',candidate).maybeSingle()
    if(!data)return candidate
  }
  return ''
}

// Readable, without look-alike characters: "Lx7k-R4pW-m2qT".
function temporaryPassword(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes=crypto.getRandomValues(new Uint8Array(12))
  const text=Array.from(bytes,b=>chars[b%chars.length]).join('')
  return `${text.slice(0,4)}-${text.slice(4,8)}-${text.slice(8,12)}`
}

function cleanEvaluator(raw:any):Evaluator|null{
  const fullName=String(raw?.fullName||'').trim()
  const email=String(raw?.email||'').trim().toLowerCase()
  const role=String(raw?.role||'hospital_admin')
  if(!fullName||!EMAIL.test(email)||!ROLES.includes(role))return null
  return {fullName,email,role,departmentCode:DEPARTMENT_ROLES.has(role)?String(raw?.departmentCode||'ΜΕΘ'):null,access:raw?.access==='password'?'password':'invite'}
}

function mailer(){
  const user=Deno.env.get('SMTP_USER')||Deno.env.get('GMAIL_SMTP_USER')
  const pass=Deno.env.get('SMTP_PASS')||Deno.env.get('GMAIL_SMTP_PASS')
  if(!user||!pass)return null
  const port=Number(Deno.env.get('SMTP_PORT')||465)
  return {from:user,transport:nodemailer.createTransport({host:Deno.env.get('SMTP_HOST')||'smtp.gmail.com',port,secure:port===465,auth:{user,pass}})}
}

async function createEvaluator(admin:any,{organization,entitlement,evaluator,app,smtp}:{organization:any,entitlement:any,evaluator:Evaluator,app:string,smtp:any}){
  const result:any={fullName:evaluator.fullName,email:evaluator.email,role:evaluator.role,access:evaluator.access,emailSent:false}
  const {data:existing}=await admin.from('profiles').select('id,username,is_platform_owner').ilike('contact_email',evaluator.email).maybeSingle()
  if(existing?.is_platform_owner)return {...result,error:'PLATFORM_OWNER_EMAIL'}

  let userId:string
  let username:string
  let created=false
  let status='invited'
  let actionLink=''
  if(existing){
    // Already a user elsewhere: no second account, only a membership.
    userId=existing.id;username=existing.username;status='active';actionLink=`${app}/login`
  }else{
    username=await allocateUsername(admin,evaluator.fullName)
    if(!username)return {...result,error:'USERNAME_ALLOCATION_FAILED'}
    const metadata={full_name:evaluator.fullName,username,is_demo:true,organization_id:organization.id}
    if(evaluator.access==='password'){
      const password=temporaryPassword()
      const {data,error}=await admin.auth.admin.createUser({email:evaluator.email,password,email_confirm:true,user_metadata:metadata})
      if(error||!data?.user)return {...result,error:error?.message||'USER_CREATE_FAILED'}
      userId=data.user.id;status='active';result.temporaryPassword=password
    }else if(smtp){
      const {data,error}=await admin.auth.admin.generateLink({type:'invite',email:evaluator.email,options:{redirectTo:`${app}/activate`,data:metadata}})
      if(error||!data?.user)return {...result,error:error?.message||'INVITE_FAILED'}
      userId=data.user.id;actionLink=data.properties?.action_link||''
    }else{
      const {data,error}=await admin.auth.admin.inviteUserByEmail(evaluator.email,{redirectTo:`${app}/activate`,data:metadata})
      if(error||!data?.user)return {...result,error:error?.message||'INVITE_FAILED'}
      userId=data.user.id;result.emailSent=true
    }
    created=true
  }
  const undo=async()=>{if(created)await admin.auth.admin.deleteUser(userId)}

  // The profile first: making someone Hospital Admin creates their employee
  // record from it (ensure_hospital_admin_employee).
  const profilePatch:any=existing?{}:{full_name:evaluator.fullName,username,contact_email:evaluator.email,is_demo:true,demo_entitlement_id:entitlement.id}
  if(Object.keys(profilePatch).length){
    const {error}=await admin.from('profiles').update(profilePatch).eq('id',userId)
    if(error){await undo();return {...result,error:error.message}}
  }
  const {data:membership,error:membershipError}=await admin.from('organization_members').insert({organization_id:organization.id,user_id:userId,role:evaluator.role,status}).select('id').single()
  if(membershipError||!membership){await undo();return {...result,error:membershipError?.message||'MEMBERSHIP_FAILED'}}
  if(evaluator.departmentCode){
    const {data:department}=await admin.from('departments').select('id').eq('organization_id',organization.id).eq('code',evaluator.departmentCode).maybeSingle()
    const fallback=department?null:(await admin.from('departments').select('id').eq('organization_id',organization.id).order('name').limit(1).maybeSingle()).data
    const departmentId=department?.id||fallback?.id
    if(departmentId)await admin.from('organization_member_scopes').insert({membership_id:membership.id,department_id:departmentId})
  }

  if(actionLink&&smtp){
    const html=demoAccessEmail({contactName:evaluator.fullName,label:organization.name,username,validFrom:fmtDay(entitlement.valid_from),validUntil:fmtDay(entitlement.valid_until),actionUrl:actionLink})
    try{
      await smtp.transport.sendMail({from:`Limoxis Observer <${smtp.from}>`,to:evaluator.email,subject:`Demo πρόσβαση: ${organization.name}`,html})
      result.emailSent=true
    }catch(error){result.emailError=String((error as Error)?.message||error).slice(0,300)}
  }
  return {...result,userId,username,reused:Boolean(existing)}
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='POST')return reply({error:'Method not allowed'},405)

  const url=Deno.env.get('SUPABASE_URL')
  const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anon=Deno.env.get('SUPABASE_ANON_KEY')
  const jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'')
  if(!url||!service||!anon)return reply({error:'Function is not configured'},500)

  const caller=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${jwt}`}}})
  const admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}})
  const {data:currentUser}=await caller.auth.getUser()
  if(!currentUser?.user)return reply({error:'Unauthorized'},401)

  const {data:owner}=await admin.from('profiles').select('is_platform_owner').eq('id',currentUser.user.id).maybeSingle()
  if(!owner?.is_platform_owner)return reply({error:'Forbidden'},403)

  let body:any={}
  try{body=await req.json()}catch{return reply({error:'Invalid request'},400)}
  const app=(Deno.env.get('APP_URL')||Deno.env.get('APP_BASE_URL')||req.headers.get('origin')||DEFAULT_APP_URL).replace(/\/$/,'')
  const {data:settings}=await admin.from('platform_settings').select('default_demo_duration_days,max_demo_users').eq('id','global').maybeSingle()
  const maxUsers=Math.min(20,Math.max(1,Number(settings?.max_demo_users)||5))
  const smtp=mailer()

  if(body.action==='add_evaluator'){
    const evaluator=cleanEvaluator(body.evaluator)
    if(!evaluator)return reply({error:'Ελέγξτε ονοματεπώνυμο, email και ρόλο.'},400)
    const {data:entitlement}=await admin.from('platform_demo_entitlements').select('id,organization_id,valid_from,valid_until').eq('id',String(body.entitlementId||'')).maybeSingle()
    if(!entitlement)return reply({error:'Το Demo δεν βρέθηκε.'},404)
    const {data:organization}=await admin.from('organizations').select('id,name,code,is_demo').eq('id',entitlement.organization_id).maybeSingle()
    if(!organization?.is_demo)return reply({error:'Only Demo organizations.'},400)
    const {count}=await admin.from('organization_members').select('id',{count:'exact',head:true}).eq('organization_id',organization.id)
    if((count||0)>=maxUsers)return reply({error:`Το Demo επιτρέπει έως ${maxUsers} χρήστες.`,code:'DEMO_USER_LIMIT'},400)
    const result=await createEvaluator(admin,{organization,entitlement,evaluator,app,smtp})
    if(result.error)return reply({error:result.error==='PLATFORM_OWNER_EMAIL'?'Το email ανήκει σε Platform Owner.':result.error},400)
    const {userId:_userId,...evaluatorResult}=result
    return reply({ok:true,evaluator:evaluatorResult})
  }

  const label=String(body.label||'').trim()
  const contactName=String(body.contactName||'').trim()
  const contactEmail=String(body.contactEmail||'').trim().toLowerCase()
  const validFrom=String(body.validFrom||'')
  let validUntil=String(body.validUntil||'')
  const seedProfile=PROFILES.includes(String(body.seedProfile))?String(body.seedProfile):'full'
  const organizationType=String(body.type||'hospital')
  const region=String(body.region||'').trim()||null
  const healthRegion=String(body.healthRegion||'').trim()||null
  const city=String(body.city||'').trim()||null
  // organizations.country is NOT NULL: an empty field means Greece.
  const country=String(body.country||'').trim()||'Ελλάδα'
  const contactPhone=String(body.contactPhone||'').trim()||null
  const bedCapacity=body.bedCapacity===''||body.bedCapacity==null?null:Number(body.bedCapacity)
  if(!label||!contactEmail||!validFrom)return reply({error:'Missing demo fields.'},400)

  // Older callers send only the contact person: they become the one Hospital Admin.
  const rawEvaluators=Array.isArray(body.evaluators)&&body.evaluators.length?body.evaluators:[{fullName:contactName||label,email:contactEmail,role:'hospital_admin',access:'invite'}]
  const evaluators=rawEvaluators.map(cleanEvaluator)
  if(evaluators.some((e:Evaluator|null)=>!e))return reply({error:'Ελέγξτε ονοματεπώνυμο, email και ρόλο κάθε χρήστη.'},400)
  const list=evaluators as Evaluator[]
  if(list.length>maxUsers)return reply({error:`Έως ${maxUsers} χρήστες ανά Demo.`,code:'DEMO_USER_LIMIT'},400)
  if(new Set(list.map(e=>e.email)).size!==list.length)return reply({error:'Κάθε email χρησιμοποιείται μία φορά.'},400)
  if(!list.some(e=>e.role==='hospital_admin'))return reply({error:'Τουλάχιστον ένας χρήστης πρέπει να είναι Διαχειριστής Νοσοκομείου.'},400)
  const {data:ownerEmails}=await admin.from('profiles').select('contact_email').eq('is_platform_owner',true)
  const ownerSet=new Set((ownerEmails||[]).map((p:any)=>String(p.contact_email||'').toLowerCase()))
  if(list.some(e=>ownerSet.has(e.email)))return reply({error:'Ένα από τα email ανήκει σε Platform Owner.'},400)

  if(!validUntil){
    const duration=Math.min(365,Math.max(1,Number(settings?.default_demo_duration_days)||30))
    validUntil=addDays(validFrom,duration)
  }
  if(!validUntil||validUntil<=validFrom)return reply({error:'Invalid demo dates.'},400)

  const organizationCode=await allocateDemoOrganizationCode(admin)
  if(!organizationCode)return reply({error:'Could not allocate demo identifiers.'},500)

  const {data:organization,error:organizationError}=await admin.from('organizations').insert({
    name:label,
    code:organizationCode,
    type:organizationType,
    status:'active',
    region,
    health_region:healthRegion,
    city,
    country,
    contact_email:contactEmail,
    contact_phone:contactPhone,
    bed_capacity:Number.isFinite(bedCapacity)?bedCapacity:null,
    is_demo:true,
  }).select('id,name,code,is_demo').single()
  if(organizationError||!organization)return reply({error:organizationError?.message||'Demo organization creation failed'},500)

  const {data:entitlement,error:entitlementError}=await admin.from('platform_demo_entitlements').insert({
    organization_id:organization.id,
    label,
    contact_name:contactName||null,
    contact_email:contactEmail,
    valid_from:validFrom,
    valid_until:validUntil,
    status:'active',
    created_by:currentUser.user.id,
    seed_profile:seedProfile,
  }).select().single()
  if(entitlementError||!entitlement){
    // Nothing references the new organization yet, so it can go directly.
    await admin.from('organizations').delete().eq('id',organization.id)
    return reply({error:entitlementError?.message||'Demo entitlement creation failed'},500)
  }

  // The data first, written as the Platform Owner so the audit triggers see
  // who did it. A failure leaves an empty Demo that "Reset data" can fill.
  const {data:seed,error:seedError}=await caller.rpc('platform_reset_demo_organization',{p_organization_id:organization.id})

  const results=[]
  for(const evaluator of list)results.push(await createEvaluator(admin,{organization,entitlement,evaluator,app,smtp}))

  // The contact person's account is the Demo's main user (password reset, record).
  const main=results.find(r=>r.userId&&r.email===contactEmail)||results.find(r=>r.userId)
  if(main?.userId)await admin.from('platform_demo_entitlements').update({demo_user_id:main.userId}).eq('id',entitlement.id)

  await admin.from('system_audit_log').insert({
    organization_id:organization.id,actor_user_id:currentUser.user.id,actor_role:'platform_owner',event_type:'platform.demo.created',
    entity_type:'platform_demo_entitlement',entity_id:entitlement.id,
    metadata:{name:label,code:organizationCode,seed_profile:seedProfile,valid_until:validUntil,evaluators:results.map(r=>({role:r.role,access:r.access,ok:!r.error}))},
  })

  return reply({
    ok:results.every(r=>!r.error),
    entitlement:{...entitlement,demo_user_id:main?.userId||null},
    organization,
    seed:seedError?{ok:false,error:seedError.message}:seed,
    evaluators:results.map(({userId:_userId,...rest})=>rest),
    username:main?.username||'',
    emailSent:results.some(r=>r.emailSent),
    provider:smtp?'smtp':'supabase_auth',
  })
})
