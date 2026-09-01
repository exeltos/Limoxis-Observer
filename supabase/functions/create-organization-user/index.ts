import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DEFAULT_APP_URL='https://limoxis-observer.netlify.app'
const ALLOWED_ROLES=['hospital_admin','infection_control_lead','infection_control_member','department_manager','department_user','laboratory','committee_secretariat','hr_office','pharmacy','occupational_physician','doctor_reviewer','quality_manager','link_nurse','staff_user']
const ROLE_LABELS:Record<string,string>={hospital_admin:'Διαχειριστής Νοσοκομείου',infection_control_lead:'Υπεύθυνος Λοιμώξεων',infection_control_member:'Μέλος Ομάδας Λοιμώξεων',department_manager:'Προϊστάμενος Τμήματος',department_user:'Χρήστης Τμήματος',laboratory:'Εργαστήριο',committee_secretariat:'Γραμματεία Επιτροπών',hr_office:'Γραφείο Προσωπικού',pharmacy:'Φαρμακείο',occupational_physician:'Ιατρός Εργασίας',doctor_reviewer:'Ιατρός Ελεγκτής',quality_manager:'Υπεύθυνος Ποιότητας',link_nurse:'Νοσηλευτής Σύνδεσμος',staff_user:'Γενικός Χρήστης'}
const cors={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const reply=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:cors})
const GREEK_INITIALS:Record<string,string>={α:'A',ά:'A',β:'V',γ:'G',δ:'D',ε:'E',έ:'E',ζ:'Z',η:'I',ή:'I',θ:'T',ι:'I',ί:'I',ϊ:'I',ΐ:'I',κ:'K',λ:'L',μ:'M',ν:'N',ξ:'X',ο:'O',ό:'O',π:'P',ρ:'R',σ:'S',ς:'S',τ:'T',υ:'Y',ύ:'Y',ϋ:'Y',ΰ:'Y',φ:'F',χ:'C',ψ:'P',ω:'O',ώ:'O'}
function latinInitial(value=''){const ch=String(value).trim().charAt(0);if(!ch)return 'X';if(/[A-Za-z]/.test(ch))return ch.toUpperCase();return GREEK_INITIALS[ch.toLowerCase()]||'X'}
async function generateUserName(admin:any,fullName:string){const parts=String(fullName||'').trim().split(/\s+/).filter(Boolean);const prefix=`${latinInitial(parts[0]||'X')}${latinInitial(parts.length>1?parts[parts.length-1]:'X')}`;for(let i=0;i<40;i++){const candidate=`${prefix}${Math.floor(10000+Math.random()*90000)}`;const {data}=await admin.from('profiles').select('id').eq('username',candidate).maybeSingle();if(!data)return candidate}throw new Error('Could not allocate a unique username')}

async function linkOrCreateEmployee(admin:any,{organizationId,userId,normalizedEmail,phone,jobTitle,employeeDbId,employee}:any){
  if(employeeDbId){
    const {data:existing,error}=await admin.from('employees').select('id,user_id,email').eq('organization_id',organizationId).eq('id',employeeDbId).maybeSingle()
    if(error)throw error
    if(!existing)throw new Error('EMPLOYEE_NOT_FOUND')
    if(existing.user_id&&existing.user_id!==userId)throw new Error('EMPLOYEE_ALREADY_LINKED_TO_ANOTHER_ACCOUNT')
    const {error:updateError}=await admin.from('employees').update({user_id:userId,email:normalizedEmail,phone:phone||null,updated_at:new Date().toISOString()}).eq('id',employeeDbId).eq('organization_id',organizationId)
    if(updateError)throw updateError
    return employeeDbId
  }
  if(!employee?.create)return null
  const firstName=String(employee.firstName||'').trim(),lastName=String(employee.lastName||'').trim(),employeeCode=String(employee.employeeCode||'').trim()
  if(!firstName||!lastName||!employeeCode)throw new Error('EMPLOYEE_REQUIRED_FIELDS_MISSING')
  const row={organization_id:organizationId,user_id:userId,employee_code:employeeCode,department_id:employee.departmentId||null,first_name:firstName,first_name_en:employee.firstNameEn||firstName,last_name:lastName,last_name_en:employee.lastNameEn||lastName,father_name:employee.fatherName||null,department_name:employee.departmentName||null,department_name_en:employee.departmentNameEn||employee.departmentName||null,profession_name:employee.professionName||jobTitle||null,profession_name_en:employee.professionNameEn||employee.professionName||jobTitle||null,employment_status:employee.employmentStatus||'active',email:normalizedEmail,phone:phone||null,hire_date:employee.hireDate||null,birth_date:employee.birthDate||null}
  const {data:created,error}=await admin.from('employees').insert(row).select('id').single()
  if(error)throw error
  return created.id
}

Deno.serve(async(req)=>{
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
  const {data:org}=await admin.from('organizations').select('id,name').eq('id',organizationId).maybeSingle();if(!org)return reply({error:'Organization not found'},404)
  const normalizedEmail=String(email).trim().toLowerCase();const username=await generateUserName(admin,fullName);const appUrl=(Deno.env.get('APP_URL')||Deno.env.get('APP_BASE_URL')||req.headers.get('origin')||DEFAULT_APP_URL).replace(/\/$/,'');const redirectTo=`${appUrl}/activate`
  const {data:invited,error:inviteError}=await admin.auth.admin.inviteUserByEmail(normalizedEmail,{redirectTo,data:{full_name:fullName,username,role,role_label:ROLE_LABELS[role]||role,organization_id:organizationId,organization_name:org.name,invited_by:profile?.full_name||'',is_platform_owner:false}})
  let userId:string;let createdMembership=false
  if(inviteError||!invited?.user){
    if(!/already been registered|already registered|already exists/i.test(inviteError?.message||''))return reply({error:inviteError?.message||'Could not invite user'},500)
    const {data:existingProfile}=await admin.from('profiles').select('id,username').ilike('contact_email',normalizedEmail).maybeSingle();if(!existingProfile)return reply({error:'Αυτό το email χρησιμοποιείται ήδη από λογαριασμό χωρίς αντίστοιχο προφίλ. Επικοινώνησε με τον Platform Owner.'},409)
    userId=existingProfile.id
    const {data:existingMembership}=await admin.from('organization_members').select('id').eq('organization_id',organizationId).eq('user_id',userId).maybeSingle()
    if(!existingMembership){const {error:reuseMemberError}=await admin.from('organization_members').insert({organization_id:organizationId,user_id:userId,role,status:'active'});if(reuseMemberError)return reply({error:reuseMemberError.message},500);createdMembership=true}
    try{const linkedEmployeeId=await linkOrCreateEmployee(admin,{organizationId,userId,normalizedEmail,phone,jobTitle,employeeDbId,employee});return reply({ok:true,username:existingProfile.username,userId,emailSent:false,reused:true,employeeId:linkedEmployeeId})}catch(error){if(createdMembership)await admin.from('organization_members').delete().eq('organization_id',organizationId).eq('user_id',userId);return reply({error:String(error?.message||error)},409)}
  }
  userId=invited.user.id
  const {error:profileError}=await admin.from('profiles').update({full_name:fullName,username,contact_email:normalizedEmail,phone:phone||null,job_title:jobTitle||null}).eq('id',userId);if(profileError){await admin.auth.admin.deleteUser(userId);return reply({error:profileError.message},500)}
  const {error:memberError}=await admin.from('organization_members').insert({organization_id:organizationId,user_id:userId,role,status:'invited'});if(memberError){await admin.auth.admin.deleteUser(userId);return reply({error:memberError.message},500)}
  try{const linkedEmployeeId=await linkOrCreateEmployee(admin,{organizationId,userId,normalizedEmail,phone,jobTitle,employeeDbId,employee});return reply({ok:true,username,userId,emailSent:true,provider:'supabase_auth',employeeId:linkedEmployeeId})}catch(error){await admin.from('organization_members').delete().eq('organization_id',organizationId).eq('user_id',userId);await admin.auth.admin.deleteUser(userId);return reply({error:String(error?.message||error)},409)}
})