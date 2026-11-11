import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serveWithCors } from '../_shared/cors.ts'
import { ROLE_LABELS, generateUserName, setMemberDepartment, setMemberDepartments } from '../_shared/organizationAccount.ts'
import { MAX_ACTIVE_USERS_PER_CALL, activeUserFailureCode, fold, TEMPORARY_PASSWORD_DAYS,generateTemporaryPassword,temporaryPasswordExpiry,DIVISION_ROLES, isDeliverable, planActiveUser, syntheticEmail, validateActiveUsersRequest } from '../_shared/activeUsers.ts'
import type { ActiveUserInput, DepartmentRow, EmployeeRow, PlanContext } from '../_shared/activeUsers.ts'

// «Νέος ενεργός χρήστης» / «Εισαγωγή χρηστών από αρχείο» (Platform Owner only).
// Accounts are created ACTIVE with a temporary password that the owner hands over;
// profiles.must_change_password makes the app ask for a new password at the first
// sign-in. A person without e-mail gets a username and an Auth address that never
// receives mail (@users.limoxis.invalid); username-login finds it by the username.
// verify_jwt = true (config.toml); the caller is checked again here.
//
// POST { organizationId, users:[{fullName, email?, username?, role, departmentId?|departmentName?, employeeCode?, line?}], dryRun? }
//   dryRun   per person: ok, or the error code (nothing is written);
//   create   up to 25 per call (the screen sends the file in chunks). Per person:
//            Auth user (confirmed, temporary password) → profile (must_change_password)
//            → active membership → department → employees.user_id → welcome e-mail
//            WITHOUT the password (notification_outbox account_ready, real e-mail only)
//            → audit. Anything failing undoes that person only.
// Every row comes back as {line, status:'ok'|'created'|'failed', code, username, temporaryPassword?};
// the temporary password is returned once, only on create, and never stored or logged.
const cors={'Content-Type':'application/json','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store'}
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors})
const fail=(code:string,status=400)=>reply({ok:false,code,error:code},status)
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms))
const AUTH_PACE_MS=200
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin=any
type Org={id:string,name:string,status:string,is_demo:boolean,contact_email:string|null,contact_phone:string|null}
type Row={user:ActiveUserInput,errors:string[]}

// What the plan needs from the database: departments, accounts that already use the
// e-mails, usernames already taken (case-insensitive, as username-login) and the
// employees by their code.
async function loadContext(admin:Admin,organizationId:string,rows:Row[]):Promise<PlanContext>{
  const emails=[...new Set(rows.map(row=>row.user.email).filter(Boolean))]
  const usernames=[...new Set(rows.map(row=>row.user.username).filter(Boolean))]
  const codes=[...new Set(rows.map(row=>row.user.employeeCode).filter(Boolean))]
  const [{data:departments,error:departmentError},{data:profiles,error:profileError},{data:divisions,error:divisionError}]=await Promise.all([
    admin.from('departments').select('id,name,name_en,is_active').eq('organization_id',organizationId),
    emails.length?admin.from('profiles').select('id,contact_email').in('contact_email',emails):Promise.resolve({data:[],error:null}),
    admin.from('hr_divisions').select('id,name').eq('organization_id',organizationId),
  ])
  if(departmentError||profileError||divisionError)throw new Error('CONTEXT_FAILED')
  const takenUsernames=new Set<string>()
  for(const username of usernames){
    const {data}=await admin.from('profiles').select('id').ilike('username',username.replace(/[\\%_]/g,ch=>`\\${ch}`)).limit(1)
    if(data?.length)takenUsernames.add(username.toLowerCase())
  }
  const employeesByCode=new Map<string,EmployeeRow>()
  if(codes.length){
    const {data:employees,error}=await admin.from('employees').select('id,employee_code,user_id,department_id,employment_status').eq('organization_id',organizationId).in('employee_code',codes)
    if(error)throw new Error('CONTEXT_FAILED')
    for(const row of employees||[])employeesByCode.set(fold(row.employee_code),row)
  }
  return {departments:(departments||[]) as DepartmentRow[],existingEmails:new Set((profiles||[]).map((row:Admin)=>String(row.contact_email||'').toLowerCase())),takenUsernames,employeesByCode,divisions:(divisions||[]) as {id:string,name:string}[]}
}

async function createOne(admin:Admin,org:Org,ctx:PlanContext,row:Row,caller:{id:string,name:string}){
  const {user}=row
  const plan=planActiveUser(row,ctx)
  const base={organization_id:org.id,actor_user_id:caller.id,actor_role:'platform_owner'}
  if(plan.code)return {line:user.line,status:'failed',code:plan.code}
  const role=String(user.role)
  let username=user.username
  if(!username)username=await generateUserName(admin,user.fullName)
  const realEmail=user.email&&isDeliverable(user.email)?user.email:''
  const authEmail=realEmail||syntheticEmail(username)
  // The owner's choice: the person's mobile number (changed at the first sign-in) or a random one.
  const temporaryPassword=user.passwordMode==='phone'?user.phone:generateTemporaryPassword()
  const expiresAt=temporaryPasswordExpiry()
  const {data:created,error:createError}=await admin.auth.admin.createUser({email:authEmail,password:temporaryPassword,email_confirm:true,user_metadata:{full_name:user.fullName,username,role,role_label:ROLE_LABELS[role]||role,organization_id:org.id,organization_name:org.name,invited_by:caller.name,is_platform_owner:false,created_active:true}})
  if(createError||!created?.user)return {line:user.line,status:'failed',code:activeUserFailureCode(createError)}
  const userId=created.user.id
  let membershipCreated=false,employeeLinked=false,divisionMemberAdded=false,createdDivisionId:string|null=null,outboxId:string|null=null
  const undo=async()=>{
    if(outboxId)await admin.from('notification_outbox').delete().eq('id',outboxId)
    if(employeeLinked&&plan.employeeId)await admin.from('employees').update({user_id:null}).eq('id',plan.employeeId).eq('user_id',userId)
    if(divisionMemberAdded)await admin.from('hr_division_members').delete().eq('organization_id',org.id).eq('user_id',userId)
    if(createdDivisionId)await admin.from('hr_divisions').delete().eq('id',createdDivisionId)
    if(membershipCreated)await admin.from('organization_members').delete().eq('organization_id',org.id).eq('user_id',userId)
    await admin.auth.admin.deleteUser(userId)
  }
  try{
    let demoEntitlementId:string|null=null
    if(org.is_demo){const {data:entitlement}=await admin.from('platform_demo_entitlements').select('id').eq('organization_id',org.id).order('created_at',{ascending:false}).limit(1).maybeSingle();demoEntitlementId=entitlement?.id||null}
    const {error:profileError}=await admin.from('profiles').update({full_name:user.fullName,username,contact_email:authEmail,must_change_password:true,temporary_password_expires_at:expiresAt,temporary_password_locked_at:null,...(user.phone?{phone:user.phone}:{}),...(org.is_demo?{is_demo:true,demo_entitlement_id:demoEntitlementId}:{})}).eq('id',userId)
    if(profileError)throw new Error(profileError.code==='23505'?'USERNAME_TAKEN':'PROFILE_FAILED')
    const {error:memberError}=await admin.from('organization_members').insert({organization_id:org.id,user_id:userId,role,status:'active'})
    if(memberError)throw new Error('MEMBERSHIP_FAILED')
    membershipCreated=true
    if(DIVISION_ROLES.includes(role)){
      // A division director: the division (created by its name when it does not exist yet), then the departments chosen for this person.
      let divisionId=plan.divisionId
      if(!divisionId&&plan.newDivisionName){
        const {data:division,error:divisionError}=await admin.from('hr_divisions').insert({organization_id:org.id,name:plan.newDivisionName}).select('id,name').single()
        if(divisionError||!division)throw new Error('DIVISION_SAVE_FAILED')
        divisionId=division.id;createdDivisionId=division.id
        ctx.divisions=[...(ctx.divisions||[]),{id:division.id,name:division.name}]
      }
      if(!divisionId)throw new Error('DIVISION_SAVE_FAILED')
      const {error:divisionMemberError}=await admin.from('hr_division_members').insert({organization_id:org.id,division_id:divisionId,user_id:userId})
      if(divisionMemberError)throw new Error('DIVISION_SAVE_FAILED')
      divisionMemberAdded=true
      await setMemberDepartments(admin,{organizationId:org.id,userId,departmentIds:plan.departmentIds})
    }else await setMemberDepartment(admin,{organizationId:org.id,userId,departmentId:plan.departmentId})
    if(plan.employeeId){
      // Only an employee that is still without an account (checked again at the write).
      const {data:linked,error:linkError}=await admin.from('employees').update({user_id:userId,updated_at:new Date().toISOString()}).eq('id',plan.employeeId).eq('organization_id',org.id).is('user_id',null).select('id')
      if(linkError||!linked?.length)throw new Error('EMPLOYEE_ALREADY_LINKED')
      employeeLinked=true
    }
    if(realEmail){
      const departmentName=plan.departmentId?ctx.departments.find(row=>row.id===plan.departmentId)?.name||'':''
      const payload={organizationName:org.name,organizationEmail:org.contact_email||'',organizationPhone:org.contact_phone||'',recipientName:user.fullName,username,roleLabel:ROLE_LABELS[role]||role,departmentName,path:'/login'}
      const {data:outbox,error:outboxError}=await admin.from('notification_outbox').insert({organization_id:org.id,recipient_user_id:userId,recipient_email:realEmail,notification_type:'account_ready',entity_type:'user',entity_id:userId,subject:`${org.name} · Ο λογαριασμός σας στο Limoxis Observer είναι έτοιμος`,payload,status:'pending'}).select('id').single()
      if(outboxError||!outbox)throw new Error('OUTBOX_FAILED')
      outboxId=outbox.id
    }
    const {error:auditError}=await admin.from('system_audit_log').insert({...base,event_type:'organization.user.created_active',entity_type:'user',entity_id:userId,metadata:{role,department_id:plan.departmentId,division_id:plan.divisionId||createdDivisionId,department_ids:plan.departmentIds,employee_id:plan.employeeId,username,welcome_email:Boolean(realEmail),must_change_password:true,password_mode:user.passwordMode,temporary_password_expires_at:expiresAt,temporary_password_days:TEMPORARY_PASSWORD_DAYS}})
    if(auditError)throw new Error('AUDIT_FAILED')
    ctx.takenUsernames.add(username.toLowerCase())
    if(realEmail)ctx.existingEmails.add(realEmail)
    return {line:user.line,status:'created',code:null,userId,username,email:realEmail,welcomeEmail:Boolean(realEmail),temporaryPassword,temporaryPasswordExpiresAt:expiresAt,passwordMode:user.passwordMode,divisionName:plan.newDivisionName||(ctx.divisions||[]).find(row=>row.id===plan.divisionId)?.name||null}
  }catch(error){
    await undo()
    return {line:user.line,status:'failed',code:activeUserFailureCode(error)}
  }
}

serveWithCors(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='POST')return fail('METHOD_NOT_ALLOWED',405)
  const supabaseUrl=Deno.env.get('SUPABASE_URL'),serviceRoleKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),anonKey=Deno.env.get('SUPABASE_ANON_KEY')
  if(!supabaseUrl||!serviceRoleKey||!anonKey)return fail('SERVICE_UNAVAILABLE',503)
  const jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');if(!jwt)return fail('AUTH_REQUIRED',401)
  let body:Admin;try{body=await req.json()}catch{return fail('INVALID_REQUEST')}
  const caller=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:`Bearer ${jwt}`}}})
  const {data:callerData}=await caller.auth.getUser();if(!callerData?.user)return fail('INVALID_SESSION',401)
  const admin=createClient(supabaseUrl,serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false}})
  // The Platform Owner only.
  const {data:profile}=await admin.from('profiles').select('is_platform_owner,full_name').eq('id',callerData.user.id).maybeSingle()
  if(!profile?.is_platform_owner)return fail('NOT_AUTHORIZED',403)
  const validated=validateActiveUsersRequest(body)
  if(validated.ok===false)return fail(validated.code)
  if(validated.rows.length>MAX_ACTIVE_USERS_PER_CALL)return fail('TOO_MANY_USERS')
  const {data:org}=await admin.from('organizations').select('id,name,status,is_demo,contact_email,contact_phone').eq('id',validated.organizationId).maybeSingle()
  if(!org)return fail('ORGANIZATION_NOT_FOUND',404)
  if(org.status!=='active')return fail('ORGANIZATION_PAUSED',409)
  try{
    const ctx=await loadContext(admin,org.id,validated.rows)
    if(validated.dryRun){
      const results=validated.rows.map(row=>{const plan=planActiveUser(row,ctx);return {line:row.user.line,status:plan.code?'failed':'ok',code:plan.code,role:row.user.role,departmentId:plan.departmentId,employeeId:plan.employeeId,divisionId:plan.divisionId,newDivisionName:plan.newDivisionName,departmentIds:plan.departmentIds}})
      return reply({ok:true,dryRun:true,results})
    }
    const results=[]
    for(const row of validated.rows){
      results.push(await createOne(admin,org,ctx,row,{id:callerData.user.id,name:profile?.full_name||''}))
      await sleep(AUTH_PACE_MS)
    }
    if(results.some(row=>row.status==='created'&&row.welcomeEmail))await admin.rpc('platform_accounts_dispatch_send').then(()=>{},()=>{})
    return reply({ok:true,results})
  }catch(error){
    console.error('platform-create-active-users failed',String((error as Error)?.message||error).slice(0,300))
    return fail('ACTIVE_USERS_FAILED',500)
  }
})
