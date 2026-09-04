import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DEFAULT_APP_URL='https://limoxis-observer.netlify.app'
const cors={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const reply=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:cors})
const GREEK:Record<string,string>={α:'A',ά:'A',β:'V',γ:'G',δ:'D',ε:'E',έ:'E',ζ:'Z',η:'I',ή:'I',θ:'T',ι:'I',ί:'I',κ:'K',λ:'L',μ:'M',ν:'N',ξ:'X',ο:'O',ό:'O',π:'P',ρ:'R',σ:'S',ς:'S',τ:'T',υ:'Y',ύ:'Y',φ:'F',χ:'C',ψ:'P',ω:'O',ώ:'O'}
const initial=(value='')=>{const c=String(value).trim().charAt(0);return /[A-Za-z]/.test(c)?c.toUpperCase():(GREEK[c.toLowerCase()]||'D')}
const addDays=(isoDate:string,days:number)=>{const date=new Date(`${isoDate}T00:00:00Z`);if(Number.isNaN(date.getTime()))return '';date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10)}

async function allocateUsername(admin:any,contactName:string){
  const parts=contactName.split(/\s+/).filter(Boolean)
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
  const label=String(body.label||'').trim()
  const contactName=String(body.contactName||'').trim()
  const contactEmail=String(body.contactEmail||'').trim().toLowerCase()
  const validFrom=String(body.validFrom||'')
  let validUntil=String(body.validUntil||'')
  const organizationType=String(body.type||'hospital')
  const region=String(body.region||'').trim()||null
  const healthRegion=String(body.healthRegion||'').trim()||null
  const city=String(body.city||'').trim()||null
  const country=String(body.country||'').trim()||null
  const contactPhone=String(body.contactPhone||'').trim()||null
  const bedCapacity=body.bedCapacity===''||body.bedCapacity==null?null:Number(body.bedCapacity)
  if(!label||!contactEmail||!validFrom)return reply({error:'Missing demo fields.'},400)

  if(!validUntil){
    const {data:settings}=await admin.from('platform_settings').select('default_demo_duration_days').eq('id','global').maybeSingle()
    const duration=Math.min(365,Math.max(1,Number(settings?.default_demo_duration_days)||30))
    validUntil=addDays(validFrom,duration)
  }
  if(!validUntil)return reply({error:'Invalid demo dates.'},400)

  const username=await allocateUsername(admin,contactName||label)
  const organizationCode=await allocateDemoOrganizationCode(admin)
  if(!username||!organizationCode)return reply({error:'Could not allocate demo identifiers.'},500)

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

  const app=(Deno.env.get('APP_URL')||Deno.env.get('APP_BASE_URL')||req.headers.get('origin')||DEFAULT_APP_URL).replace(/\/$/,'')
  const {data:invited,error:inviteError}=await admin.auth.admin.inviteUserByEmail(contactEmail,{
    redirectTo:`${app}/activate`,
    data:{full_name:contactName||label,username,is_demo:true,organization_id:organization.id},
  })
  if(inviteError||!invited?.user){
    await admin.from('organizations').delete().eq('id',organization.id)
    return reply({error:inviteError?.message||'Demo invitation failed'},500)
  }

  const userId=invited.user.id
  const {data:entitlement,error:entitlementError}=await admin.from('platform_demo_entitlements').insert({
    organization_id:organization.id,
    label,
    contact_name:contactName||null,
    contact_email:contactEmail,
    valid_from:validFrom,
    valid_until:validUntil,
    status:'active',
    created_by:currentUser.user.id,
    demo_user_id:userId,
  }).select().single()
  if(entitlementError||!entitlement){
    await admin.auth.admin.deleteUser(userId)
    await admin.from('organizations').delete().eq('id',organization.id)
    return reply({error:entitlementError?.message||'Demo entitlement creation failed'},500)
  }

  const {error:membershipError}=await admin.from('organization_members').insert({
    organization_id:organization.id,
    user_id:userId,
    role:'demo',
    status:'invited',
  })
  if(membershipError){
    await admin.from('platform_demo_entitlements').delete().eq('id',entitlement.id)
    await admin.auth.admin.deleteUser(userId)
    await admin.from('organizations').delete().eq('id',organization.id)
    return reply({error:membershipError.message},500)
  }

  const {error:profileError}=await admin.from('profiles').update({
    full_name:contactName||label,
    username,
    contact_email:contactEmail,
    is_demo:true,
    demo_entitlement_id:entitlement.id,
  }).eq('id',userId)
  if(profileError)return reply({error:profileError.message},500)

  return reply({
    ok:true,
    entitlement,
    organization,
    membership:{role:'demo',status:'invited'},
    username,
    emailSent:true,
    provider:'supabase_auth',
  })
})