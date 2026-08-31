import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ROLES=['hospital_admin','infection_control_lead','link_nurse','doctor_reviewer','department_user','laboratory','staff_user']
const ROLE_LABELS:Record<string,string>={hospital_admin:'Διαχειριστής Νοσοκομείου',infection_control_lead:'Υπεύθυνος Λοιμώξεων',link_nurse:'Νοσηλευτής Σύνδεσμος',doctor_reviewer:'Ιατρός Ελεγκτής',department_user:'Χρήστης Τμήματος',laboratory:'Εργαστήριο',staff_user:'Γενικός Χρήστης'}
const cors={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const reply=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:cors})

const GREEK_INITIALS:Record<string,string>={α:'A',ά:'A',β:'V',γ:'G',δ:'D',ε:'E',έ:'E',ζ:'Z',η:'I',ή:'I',θ:'T',ι:'I',ί:'I',ϊ:'I',ΐ:'I',κ:'K',λ:'L',μ:'M',ν:'N',ξ:'X',ο:'O',ό:'O',π:'P',ρ:'R',σ:'S',ς:'S',τ:'T',υ:'Y',ύ:'Y',ϋ:'Y',ΰ:'Y',φ:'F',χ:'C',ψ:'P',ω:'O',ώ:'O'}
function latinInitial(value=''){const ch=String(value).trim().charAt(0);if(!ch)return 'X';if(/[A-Za-z]/.test(ch))return ch.toUpperCase();return GREEK_INITIALS[ch.toLowerCase()]||'X'}
async function generateUserName(admin:any,fullName:string){
  const parts=String(fullName||'').trim().split(/\s+/).filter(Boolean)
  const prefix=`${latinInitial(parts[0]||'X')}${latinInitial(parts.length>1?parts[parts.length-1]:'X')}`
  for(let i=0;i<40;i++){
    const candidate=`${prefix}${Math.floor(10000+Math.random()*90000)}`
    const {data}=await admin.from('profiles').select('id').eq('username',candidate).maybeSingle()
    if(!data)return candidate
  }
  throw new Error('Could not allocate a unique username')
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='POST')return reply({error:'Method not allowed'},405)

  const supabaseUrl=Deno.env.get('SUPABASE_URL')
  const serviceRoleKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey=Deno.env.get('SUPABASE_ANON_KEY')
  if(!supabaseUrl||!serviceRoleKey||!anonKey)return reply({error:'Function is not configured'},500)

  const jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'')
  if(!jwt)return reply({error:'Missing Authorization header'},401)

  let body:any
  try{body=await req.json()}catch{return reply({error:'Invalid JSON body'},400)}
  const {organizationId,fullName,role,email,phone,jobTitle}=body||{}
  if(!organizationId||!fullName||!role||!email)return reply({error:'organizationId, fullName, role and email are required'},400)
  if(!ALLOWED_ROLES.includes(role))return reply({error:`Unknown role: ${role}`},400)

  const caller=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:`Bearer ${jwt}`}}})
  const {data:callerData}=await caller.auth.getUser()
  if(!callerData?.user)return reply({error:'Invalid session'},401)

  const admin=createClient(supabaseUrl,serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false}})
  const {data:profile}=await admin.from('profiles').select('is_platform_owner,full_name').eq('id',callerData.user.id).maybeSingle()
  let authorized=Boolean(profile?.is_platform_owner)
  if(!authorized){
    const {data:m}=await admin.from('organization_members').select('role,status').eq('organization_id',organizationId).eq('user_id',callerData.user.id).maybeSingle()
    authorized=m?.role==='hospital_admin'&&m?.status==='active'
  }
  if(!authorized)return reply({error:'Not authorized'},403)

  const {data:org}=await admin.from('organizations').select('id,name').eq('id',organizationId).maybeSingle()
  if(!org)return reply({error:'Organization not found'},404)

  const normalizedEmail=String(email).trim().toLowerCase()
  const username=await generateUserName(admin,fullName)
  const appUrl=(Deno.env.get('APP_URL')||Deno.env.get('APP_BASE_URL')||req.headers.get('origin')||'').replace(/\/$/,'')
  const redirectTo=appUrl?`${appUrl}/activate`:undefined

  const {data:invited,error:inviteError}=await admin.auth.admin.inviteUserByEmail(normalizedEmail,{
    redirectTo,
    data:{
      full_name:fullName,
      username,
      role,
      role_label:ROLE_LABELS[role]||role,
      organization_id:organizationId,
      organization_name:org.name,
      invited_by:profile?.full_name||'',
      is_platform_owner:false,
    }
  })
  if(inviteError||!invited?.user)return reply({error:inviteError?.message||'Could not invite user'},500)

  const userId=invited.user.id
  const {error:profileError}=await admin.from('profiles').update({
    full_name:fullName,
    username,
    contact_email:normalizedEmail,
    phone:phone||null,
    job_title:jobTitle||null
  }).eq('id',userId)
  if(profileError){await admin.auth.admin.deleteUser(userId);return reply({error:profileError.message},500)}

  const {error:memberError}=await admin.from('organization_members').insert({organization_id:organizationId,user_id:userId,role,status:'invited'})
  if(memberError){await admin.auth.admin.deleteUser(userId);return reply({error:memberError.message},500)}

  return reply({ok:true,username,userId,emailSent:true,provider:'supabase_auth'})
})
