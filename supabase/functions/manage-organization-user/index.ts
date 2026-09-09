import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const reply=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:cors})
const DEFAULT_APP_URL='https://limoxis-observer.netlify.app'
const ROLE_LABELS:Record<string,string>={hospital_admin:'Διαχειριστής Νοσοκομείου',infection_control_lead:'Υπεύθυνος Λοιμώξεων',infection_control_member:'Μέλος Ομάδας Λοιμώξεων',department_manager:'Προϊστάμενος Τμήματος',department_user:'Χρήστης Τμήματος',laboratory:'Εργαστήριο',committee_secretariat:'Γραμματεία Επιτροπών',hr_office:'Γραφείο Προσωπικού',pharmacy:'Φαρμακείο',occupational_physician:'Ιατρός Εργασίας',doctor_reviewer:'Ιατρός Ελεγκτής',quality_manager:'Υπεύθυνος Ποιότητας',link_nurse:'Νοσηλευτής Σύνδεσμος',staff_user:'Γενικός Χρήστης'}
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return reply({error:'Method not allowed'},405)
 const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),anon=Deno.env.get('SUPABASE_ANON_KEY');if(!url||!service||!anon)return reply({error:'Function is not configured'},500)
 const jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');if(!jwt)return reply({error:'Unauthorized'},401)
 const caller=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${jwt}`}}});const {data:cu}=await caller.auth.getUser();if(!cu?.user)return reply({error:'Unauthorized'},401)
 const b=await req.json(),{organizationId,userId,action}=b,admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}})
 const {data:owner}=await admin.from('profiles').select('is_platform_owner,full_name').eq('id',cu.user.id).maybeSingle();const isOwner=Boolean(owner?.is_platform_owner);let allowed=isOwner
 if(!allowed){const {data:m}=await admin.from('organization_members').select('role,status').eq('organization_id',organizationId).eq('user_id',cu.user.id).maybeSingle();allowed=m?.role==='hospital_admin'&&m?.status==='active'}
 if(!allowed)return reply({error:'Forbidden'},403)
 const isSelf=userId===cu.user.id
 if(isSelf&&!isOwner){
  if(action==='update'&&b.role)return reply({error:'Δεν μπορείτε να αλλάξετε τον δικό σας ρόλο ή τα δικαιώματα πρόσβασης.'},403)
  if(['suspend','reactivate','delete','resend_invitation'].includes(action))return reply({error:'Δεν μπορείτε να αλλάξετε την κατάσταση πρόσβασης ή να διαγράψετε τον δικό σας λογαριασμό.'},403)
 }
 if(action==='update'){const profilePatch:any={};if(b.fullName!==undefined)profilePatch.full_name=String(b.fullName||'').trim();if(b.email!==undefined)profilePatch.contact_email=String(b.email||'').trim().toLowerCase()||null;if(b.phone!==undefined)profilePatch.phone=b.phone||null;if(b.jobTitle!==undefined)profilePatch.job_title=b.jobTitle||null;if(Object.keys(profilePatch).length){const {error}=await admin.from('profiles').update(profilePatch).eq('id',userId);if(error)return reply({error:error.message},500)}if(b.email!==undefined){const email=String(b.email||'').trim().toLowerCase();if(email){const {error}=await admin.auth.admin.updateUserById(userId,{email});if(error)return reply({error:error.message},500)}}if(b.role){const {error}=await admin.from('organization_members').update({role:b.role}).eq('organization_id',organizationId).eq('user_id',userId);if(error)return reply({error:'MEMBERSHIP_UPDATE_FAILED'},500)}return reply({ok:true})}
 if(action==='link_employee'){const employeeDbId=String(b.employeeDbId||'').trim();if(!employeeDbId)return reply({error:'employeeDbId is required'},400);const {data:employee,error:employeeError}=await admin.from('employees').select('id,user_id').eq('organization_id',organizationId).eq('id',employeeDbId).maybeSingle();if(employeeError)return reply({error:employeeError.message},500);if(!employee)return reply({error:'EMPLOYEE_NOT_FOUND'},404);if(employee.user_id&&employee.user_id!==userId)return reply({error:'EMPLOYEE_ALREADY_LINKED_TO_ANOTHER_ACCOUNT'},409);const {error:unlinkError}=await admin.from('employees').update({user_id:null,updated_at:new Date().toISOString()}).eq('organization_id',organizationId).eq('user_id',userId).neq('id',employeeDbId);if(unlinkError)return reply({error:unlinkError.message},500);const {error:linkError}=await admin.from('employees').update({user_id:userId,updated_at:new Date().toISOString()}).eq('organization_id',organizationId).eq('id',employeeDbId);if(linkError)return reply({error:linkError.message},500);return reply({ok:true,employeeId:employeeDbId})}
 if(action==='suspend'||action==='reactivate'){const status=action==='suspend'?'disabled':'active';const {data:prevMember,error:fetchError}=await admin.from('organization_members').select('status').eq('organization_id',organizationId).eq('user_id',userId).maybeSingle();if(fetchError)return reply({error:'MEMBERSHIP_UPDATE_FAILED'},500);if(!prevMember)return reply({error:'MEMBERSHIP_NOT_FOUND'},404);const {error:memberError}=await admin.from('organization_members').update({status}).eq('organization_id',organizationId).eq('user_id',userId);if(memberError)return reply({error:'MEMBERSHIP_UPDATE_FAILED'},500);const {error}=await admin.auth.admin.updateUserById(userId,{ban_duration:action==='suspend'?'876000h':'none'});if(error){await admin.from('organization_members').update({status:prevMember.status}).eq('organization_id',organizationId).eq('user_id',userId);return reply({error:error.message},500)}return reply({ok:true,status})}
 if(action==='delete'){const {error:memberError}=await admin.from('organization_members').delete().eq('organization_id',organizationId).eq('user_id',userId);if(memberError)return reply({error:'MEMBERSHIP_DELETE_FAILED'},500);const {count,error:otherError}=await admin.from('organization_members').select('id',{count:'exact',head:true}).eq('user_id',userId).neq('organization_id',organizationId);if(otherError)return reply({error:'MEMBERSHIP_LOOKUP_FAILED'},500);if(count&&count>0)return reply({ok:true,accountDeleted:false});const {error}=await admin.auth.admin.deleteUser(userId);if(error)return reply({error:error.message},500);return reply({ok:true,accountDeleted:true})}
 if(action==='reset_password'){const {data:p}=await admin.from('profiles').select('contact_email').eq('id',userId).single();if(!p?.contact_email)return reply({error:'Ο χρήστης δεν έχει email ανάκτησης.'},400);const app=(Deno.env.get('APP_URL')||Deno.env.get('APP_BASE_URL')||req.headers.get('origin')||DEFAULT_APP_URL).replace(/\/$/,'');const {error}=await admin.auth.resetPasswordForEmail(String(p.contact_email).toLowerCase(),{redirectTo:`${app}/reset-password`});if(error)return reply({error:error.message},500);return reply({ok:true,emailSent:true,provider:'supabase_auth'})}
 if(action==='resend_invitation'){
  const {data:member}=await admin.from('organization_members').select('role,status').eq('organization_id',organizationId).eq('user_id',userId).maybeSingle()
  if(!member)return reply({error:'Ο χρήστης δεν ανήκει στον οργανισμό.'},404)
  if(member.status==='active')return reply({error:'Ο λογαριασμός είναι ήδη ενεργός. Χρησιμοποίησε επαναφορά κωδικού αν χρειάζεται.'},400)
  const {data:p}=await admin.from('profiles').select('full_name,username,contact_email,phone,job_title').eq('id',userId).single()
  if(!p?.contact_email)return reply({error:'Λείπει email πρόσκλησης.'},400)
  const {data:orgRow}=await admin.from('organizations').select('name').eq('id',organizationId).maybeSingle()
  const app=(Deno.env.get('APP_URL')||Deno.env.get('APP_BASE_URL')||req.headers.get('origin')||DEFAULT_APP_URL).replace(/\/$/,'')
  const email=String(p.contact_email).toLowerCase()
  // Free the email from the stale account without destroying it yet, so a failed invite
  // never leaves the admin with neither the old nor the new account.
  const placeholderEmail=`stale+${userId}@invalid.limoxis-observer.local`
  const {error:freeEmailError}=await admin.auth.admin.updateUserById(userId,{email:placeholderEmail})
  if(freeEmailError)return reply({error:'RESEND_INVITE_PREP_FAILED'},500)
  const {data:invited,error}=await admin.auth.admin.inviteUserByEmail(email,{redirectTo:`${app}/activate`,data:{full_name:p.full_name,username:p.username,role:member.role,role_label:ROLE_LABELS[member.role]||member.role,organization_id:organizationId,organization_name:orgRow?.name||'',invited_by:owner?.full_name||''}})
  if(error||!invited?.user){await admin.auth.admin.updateUserById(userId,{email});return reply({error:error?.message||'Could not invite user'},500)}
  const newUserId=invited.user.id
  const {error:profileError}=await admin.from('profiles').update({full_name:p.full_name,username:p.username,contact_email:email,phone:p.phone||null,job_title:p.job_title||null}).eq('id',newUserId)
  if(profileError){await admin.auth.admin.deleteUser(newUserId);await admin.auth.admin.updateUserById(userId,{email});return reply({error:'RESEND_INVITE_PROFILE_SYNC_FAILED'},500)}
  const {error:memberError}=await admin.from('organization_members').insert({organization_id:organizationId,user_id:newUserId,role:member.role,status:'invited'})
  if(memberError){await admin.auth.admin.deleteUser(newUserId);await admin.auth.admin.updateUserById(userId,{email});return reply({error:'RESEND_INVITE_MEMBERSHIP_FAILED'},500)}
  // The new account is fully functional now; only clean up the stale one after this point.
  const {error:oldMemberError}=await admin.from('organization_members').delete().eq('organization_id',organizationId).eq('user_id',userId)
  if(oldMemberError)console.error('resend_invitation: failed to remove stale membership',oldMemberError.message)
  const {error:oldUserError}=await admin.auth.admin.deleteUser(userId)
  if(oldUserError)console.error('resend_invitation: failed to delete stale auth user',oldUserError.message)
  return reply({ok:true,emailSent:true,provider:'supabase_auth',userId:newUserId})
 }
 return reply({error:'Unknown action'},400)
})
