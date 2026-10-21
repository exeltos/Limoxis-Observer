import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serveWithCors } from '../_shared/cors.ts'
import { ALLOWED_ROLES, ROLE_LABELS, generateUserName, linkOrCreateEmployee } from '../_shared/organizationAccount.ts'

const DEFAULT_APP_URL='https://www.limoxis.com'
const cors={'Content-Type':'application/json','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const reply=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:cors})

serveWithCors(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='POST')return reply({error:'Method not allowed'},405)
  const supabaseUrl=Deno.env.get('SUPABASE_URL'),serviceRoleKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),anonKey=Deno.env.get('SUPABASE_ANON_KEY')
  if(!supabaseUrl||!serviceRoleKey||!anonKey)return reply({error:'Function is not configured'},500)
  const jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');if(!jwt)return reply({error:'Missing Authorization header'},401)
  let body:any;try{body=await req.json()}catch{return reply({error:'Invalid JSON body'},400)}
  const {organizationId,fullName,role,email,phone,jobTitle,employeeDbId,employee}=body||{}
  if(!organizationId||!fullName||!role||!email)return reply({error:'organizationId, fullName, role and email are required'},400)
  if(!ALLOWED_ROLES.includes(role))return reply({error:`Unknown role: ${role}`},400)
  const caller=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:`Bearer ${jwt}`}}});const {data:callerData}=await caller.auth.getUser();if(!callerData?.user)return reply({error:'Invalid session'},401)
  const admin=createClient(supabaseUrl,serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false}})
  const {data:profile}=await admin.from('profiles').select('is_platform_owner,full_name').eq('id',callerData.user.id).maybeSingle();let authorized=Boolean(profile?.is_platform_owner)
  if(!authorized){const {data:m}=await admin.from('organization_members').select('role,status').eq('organization_id',organizationId).eq('user_id',callerData.user.id).maybeSingle();authorized=m?.role==='hospital_admin'&&m?.status==='active'}
  if(!authorized)return reply({error:'Not authorized'},403)
  const {data:org}=await admin.from('organizations').select('id,name,is_demo').eq('id',organizationId).maybeSingle();if(!org)return reply({error:'Organization not found'},404)
  // A Demo's own Hospital Admin adds the evaluators, up to the platform limit (max_demo_users).
  let demoEntitlementId:string|null=null
  if(org.is_demo){
    const [{data:settings},{count:memberCount},{data:entitlement}]=await Promise.all([
      admin.from('platform_settings').select('max_demo_users').eq('id','global').maybeSingle(),
      admin.from('organization_members').select('id',{count:'exact',head:true}).eq('organization_id',organizationId),
      admin.from('platform_demo_entitlements').select('id').eq('organization_id',organizationId).order('created_at',{ascending:false}).limit(1).maybeSingle(),
    ])
    const maxUsers=Math.min(20,Math.max(1,Number(settings?.max_demo_users)||5))
    // The same limit for everyone (the database enforces it too); the Owner raises it in the Platform settings.
    if((memberCount||0)>=maxUsers)return reply({error:`Το Demo επιτρέπει έως ${maxUsers} χρήστες.`,code:'DEMO_USER_LIMIT',maxUsers},403)
    demoEntitlementId=entitlement?.id||null
  }
  const normalizedEmail=String(email).trim().toLowerCase();const username=await generateUserName(admin,fullName);const appUrl=(Deno.env.get('APP_URL')||Deno.env.get('APP_BASE_URL')||req.headers.get('origin')||DEFAULT_APP_URL).replace(/\/$/,'');const redirectTo=`${appUrl}/activate`
  const {data:invited,error:inviteError}=await admin.auth.admin.inviteUserByEmail(normalizedEmail,{redirectTo,data:{full_name:fullName,username,role,role_label:ROLE_LABELS[role]||role,organization_id:organizationId,organization_name:org.name,invited_by:profile?.full_name||'',is_platform_owner:false}})
  let userId:string;let createdMembership=false
  if(inviteError||!invited?.user){
    if(!/already been registered|already registered|already exists/i.test(inviteError?.message||''))return reply({error:inviteError?.message||'Could not invite user'},500)
    const {data:existingProfile}=await admin.from('profiles').select('id,username,is_platform_owner').ilike('contact_email',normalizedEmail).maybeSingle();if(!existingProfile)return reply({error:'Αυτό το email χρησιμοποιείται ήδη από λογαριασμό χωρίς αντίστοιχο προφίλ. Επικοινώνησε με τον Platform Owner.'},409)
    userId=existingProfile.id
    // A Hospital Admin never attaches an account another hospital (or the platform) uses:
    // that would grant access without the user's consent and reveal the account's username.
    if(!profile?.is_platform_owner){
      const {count:elsewhere,error:elsewhereError}=await admin.from('organization_members').select('id',{count:'exact',head:true}).eq('user_id',userId).neq('organization_id',organizationId)
      if(elsewhereError)return reply({error:'MEMBERSHIP_LOOKUP_FAILED'},500)
      if(existingProfile.is_platform_owner||(elsewhere||0)>0)return reply({error:'Αυτό το email ανήκει σε λογαριασμό που χρησιμοποιείται ήδη αλλού. Για να προστεθεί και εδώ, επικοινώνησε με τον Platform Owner.',code:'ACCOUNT_IN_USE'},409)
    }
    const {data:existingMembership}=await admin.from('organization_members').select('id').eq('organization_id',organizationId).eq('user_id',userId).maybeSingle()
    if(!existingMembership){const {error:reuseMemberError}=await admin.from('organization_members').insert({organization_id:organizationId,user_id:userId,role,status:'active'});if(reuseMemberError)return reply({error:reuseMemberError.message},500);createdMembership=true}
    try{const linkedEmployeeId=await linkOrCreateEmployee(admin,{organizationId,userId,normalizedEmail,phone,jobTitle,employeeDbId,employee});return reply({ok:true,username:existingProfile.username,userId,emailSent:false,reused:true,employeeId:linkedEmployeeId})}catch(error){if(createdMembership)await admin.from('organization_members').delete().eq('organization_id',organizationId).eq('user_id',userId);return reply({error:String(error?.message||error)},409)}
  }
  userId=invited.user.id
  const {error:profileError}=await admin.from('profiles').update({full_name:fullName,username,contact_email:normalizedEmail,phone:phone||null,job_title:jobTitle||null,...(org.is_demo?{is_demo:true,demo_entitlement_id:demoEntitlementId}:{})}).eq('id',userId);if(profileError){await admin.auth.admin.deleteUser(userId);return reply({error:profileError.message},500)}
  const {error:memberError}=await admin.from('organization_members').insert({organization_id:organizationId,user_id:userId,role,status:'invited'});if(memberError){await admin.auth.admin.deleteUser(userId);return reply({error:memberError.message},500)}
  try{const linkedEmployeeId=await linkOrCreateEmployee(admin,{organizationId,userId,normalizedEmail,phone,jobTitle,employeeDbId,employee});return reply({ok:true,username,userId,emailSent:true,provider:'supabase_auth',employeeId:linkedEmployeeId})}catch(error){await admin.from('organization_members').delete().eq('organization_id',organizationId).eq('user_id',userId);await admin.auth.admin.deleteUser(userId);return reply({error:String(error?.message||error)},409)}
})