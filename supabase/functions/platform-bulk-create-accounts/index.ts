import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serveWithCors } from '../_shared/cors.ts'
import { ROLE_LABELS, generateUserName, randomAccessToken, sha256Hex } from '../_shared/organizationAccount.ts'
import { DAILY_OWNER_LIMIT, MAX_CHUNK_ITEMS, accessLinkExpiry, failureCode, isDeliverableEmail, isUuid, normalizeEmail, planItem, resendDecision, summarizeByRole, validateBulkRequest } from '../_shared/bulkAccounts.ts'
import type { BulkItem, EmployeeRow, ExistingAccount } from '../_shared/bulkAccounts.ts'
import { accountCreatedEmail } from '../_shared/accountCreatedEmail.ts'

// N1 · Bulk creation of accounts from a hospital's employee roster, by the Platform
// Owner or the hospital's own active Hospital Admin. Only the Platform Owner links an
// account another organization already uses (confirmed one by one); for the admin
// such a person is skipped as ACCOUNT_IN_USE, as in create-organization-user.
// verify_jwt = true (config.toml); the caller is checked again here.
//
// action
//   preview  (dryRun) people per role, who is skipped and why, e-mails that already
//            have an account in another hospital, the link's validity and the e-mail
//            of the first recipient. Nothing is written.
//   create   up to 25 people per call, with the run's batchKey: the screen sends a run
//            of up to 200 in chunks and shows the progress (simpler and more robust
//            than continuing in the scheduler: every call is short, a retry of a chunk
//            returns the same rows, a run stopped half-way is resumed by running the
//            remaining people again). Per person, one at a time (Auth Admin API pace):
//            Auth user (no Supabase e-mail) → profile → membership + department +
//            employees.user_id under row locks (platform_account_item_link) → own
//            7-day token (account_invitations, SHA-256) → notification_outbox
//            (account_created) → audit. Anything failing undoes that person only.
//            A person whose e-mail has an account in another hospital, confirmed one
//            by one by the owner, gets this hospital's membership on that account
//            (no second account) and an account_access_added notice.
//   finish   closes the run, writes its audit and e-mails the summary to the
//            hospital's administrators (or to the owner when there is none).
//   resend   «Ξαναστείλε»: a new link for people who have not activated, the old
//            one revoked; at most 3 per person in 24 hours, 10 minutes apart.
// Idempotency: batch_key is unique; one live item per employee (partial unique
// index); the employee row is locked and re-checked when linked.
const cors={'Content-Type':'application/json','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store'}
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors})
const fail=(code:string,status=400)=>reply({ok:false,code,error:code},status)
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms))
const AUTH_PACE_MS=200
const MAX_RESEND=50
const STALE_QUEUED_MS=15*60000
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin=any

type Org={id:string,name:string,status:string,is_demo:boolean,contact_email:string|null,contact_phone:string|null}
type Context={admin:Admin,org:Org,callerId:string,callerName:string,appUrl:string,departments:Map<string,string>,actorRole:string,canLinkExisting:boolean}

const fullName=(employee:EmployeeRow)=>[employee.first_name,employee.last_name].map(part=>String(part||'').trim()).filter(Boolean).join(' ')

async function audit(admin:Admin,row:Record<string,unknown>){
  const {error}=await admin.from('system_audit_log').insert({actor_role:'platform_owner',...row})
  if(error)throw new Error('AUDIT_FAILED')
}

// The employees of the request, the hospital's departments and the accounts that
// already use their addresses (here or in another organization).
async function loadContext(admin:Admin,organizationId:string,items:BulkItem[]){
  const ids=items.map(item=>item.employeeId)
  const [{data:employees,error:employeeError},{data:departments}]=await Promise.all([
    admin.from('employees').select('id,user_id,email,department_id,employment_status,first_name,last_name').eq('organization_id',organizationId).in('id',ids),
    admin.from('departments').select('id,name').eq('organization_id',organizationId),
  ])
  if(employeeError)throw employeeError
  const byId=new Map<string,EmployeeRow>((employees||[]).map((row:EmployeeRow)=>[row.id,row]))
  const emails=[...new Set((employees||[]).map((row:EmployeeRow)=>normalizeEmail(row.email)).filter(Boolean))]
  // The same address on another active employee of this hospital locks the person.
  const {data:sameEmail}=emails.length?await admin.from('employees').select('id,email').eq('organization_id',organizationId).eq('employment_status','active').not('email','is',null):{data:[]}
  const emailCount=new Map<string,number>()
  for(const row of sameEmail||[]){const email=normalizeEmail(row.email);if(email)emailCount.set(email,(emailCount.get(email)||0)+1)}
  const {data:profiles}=emails.length?await admin.from('profiles').select('id,full_name,username,contact_email,is_demo').in('contact_email',emails):{data:[]}
  const profileIds=(profiles||[]).map((row:Admin)=>row.id)
  const {data:memberships}=profileIds.length?await admin.from('organization_members').select('user_id,organization_id,organization:organizations(name)').in('user_id',profileIds):{data:[]}
  const existingByEmail=new Map<string,ExistingAccount>()
  for(const profile of profiles||[]){
    const mine=(memberships||[]).filter((m:Admin)=>m.user_id===profile.id)
    existingByEmail.set(normalizeEmail(profile.contact_email),{userId:profile.id,fullName:profile.full_name||'',username:profile.username||'',isDemo:Boolean(profile.is_demo),memberHere:mine.some((m:Admin)=>m.organization_id===organizationId),organizations:mine.filter((m:Admin)=>m.organization_id!==organizationId).map((m:Admin)=>m.organization?.name).filter(Boolean)})
  }
  return {byId,existingByEmail,emailCount,departments:new Map<string,string>((departments||[]).map((d:Admin)=>[d.id,d.name]))}
}

function planWithDuplicates(item:BulkItem,ctx:Awaited<ReturnType<typeof loadContext>>,confirmed:boolean,allowLink:boolean){
  const employee=ctx.byId.get(item.employeeId)
  const email=normalizeEmail(employee?.email)
  if(employee&&!employee.user_id&&email&&(ctx.emailCount.get(email)||0)>1)return {action:'skip' as const,code:'DUPLICATE_EMAIL',departmentId:null,email}
  return planItem(item,employee,email?ctx.existingByEmail.get(email):null,confirmed,allowLink)
}

function accountEmail(ctx:Context,{name,username,role,departmentId,expiresAt,token,kind='send'}:{name:string,username:string,role:string,departmentId:string|null,expiresAt:string,token:string,kind?:string}){
  const payload={organizationName:ctx.org.name,organizationEmail:ctx.org.contact_email||'',organizationPhone:ctx.org.contact_phone||'',recipientName:name,username,roleLabel:ROLE_LABELS[role]||role,departmentName:departmentId?ctx.departments.get(departmentId)||'':'',expiresAt,path:`/activate?access=${token}`,kind}
  return {payload,message:accountCreatedEmail({...payload,actionUrl:`${ctx.appUrl}${payload.path}`})}
}

async function preview(ctx:Context,request:ReturnType<typeof validateBulkRequest>&{ok:true}){
  const {request:r}=request
  const loaded=await loadContext(ctx.admin,ctx.org.id,r.items)
  const expiresAt=accessLinkExpiry().toISOString()
  const create:Admin[]=[],existing:Admin[]=[],skipped:Admin[]=[],counted:{role:string,departmentName:string|null}[]=[]
  for(const item of r.items){
    const employee=loaded.byId.get(item.employeeId)
    const plan=planWithDuplicates(item,loaded,true,ctx.canLinkExisting)
    const name=employee?fullName(employee):''
    const departmentName=plan.departmentId?loaded.departments.get(plan.departmentId)||null:null
    if(plan.action==='skip'){skipped.push({employeeId:item.employeeId,name,code:plan.code});continue}
    counted.push({role:item.role,departmentName})
    if(plan.action==='link_existing'){const account=loaded.existingByEmail.get(plan.email)!;existing.push({employeeId:item.employeeId,name,email:plan.email,role:item.role,existingName:account.fullName,username:account.username,organizations:account.organizations});continue}
    create.push({employeeId:item.employeeId,name,email:plan.email,role:item.role,departmentId:plan.departmentId})
  }
  const first=create[0]
  const email=first?accountEmail({...ctx,departments:loaded.departments},{name:first.name,username:'AB12345',role:first.role,departmentId:first.departmentId,expiresAt,token:'ACT-preview'}).message:null
  return reply({ok:true,expiresAt,total:counted.length,roles:summarizeByRole(counted).map(row=>({...row,label:ROLE_LABELS[row.role]||row.role})),create:create.length,existing,skipped,emailPreview:email&&{to:first.email,name:first.name,subject:email.subject,html:email.html,replyTo:email.replyTo||null}})
}

async function createOne(ctx:Context,batchId:string,item:BulkItem,loaded:Awaited<ReturnType<typeof loadContext>>,confirmed:boolean){
  const {admin,org,callerId}=ctx
  const employee=loaded.byId.get(item.employeeId)
  const name=employee?fullName(employee):''
  const plan=planWithDuplicates(item,loaded,confirmed&&ctx.canLinkExisting,ctx.canLinkExisting)
  const base={organization_id:org.id,actor_user_id:callerId,actor_role:ctx.actorRole,entity_type:'employee',entity_id:item.employeeId}
  // One row per person of the run; a retry of the same chunk finds it again.
  const row={batch_id:batchId,organization_id:org.id,employee_id:item.employeeId,role:item.role,department_id:plan.departmentId,status:plan.action==='skip'?'failed':'queued',error_code:plan.code}
  let {data:inserted,error:insertError}=await admin.from('account_creation_items').insert(row).select('id').maybeSingle()
  if(insertError?.code==='23505'&&employee&&!employee.user_id){
    // A live item of an older run whose account no longer exists (deleted since), or
    // left queued by a run that stopped: it no longer holds the employee.
    const {data:live}=await admin.from('account_creation_items').select('id,batch_id,status,created_at').eq('employee_id',item.employeeId).in('status',['queued','created','linked_existing']).maybeSingle()
    const stale=live&&live.batch_id!==batchId&&(live.status!=='queued'||Date.now()-new Date(live.created_at).getTime()>STALE_QUEUED_MS)
    if(stale){
      await admin.from('account_creation_items').update({status:'failed',error_code:live.status==='queued'?'INTERRUPTED':'ACCOUNT_REMOVED',updated_at:new Date().toISOString()}).eq('id',live.id).eq('status',live.status)
      ;({data:inserted,error:insertError}=await admin.from('account_creation_items').insert(row).select('id').maybeSingle())
    }
  }
  if(insertError){
    if(insertError.code!=='23505')return {employeeId:item.employeeId,status:'failed',code:'ITEM_FAILED'}
    const {data:again}=await admin.from('account_creation_items').select('id,status,error_code,username').eq('batch_id',batchId).eq('employee_id',item.employeeId).maybeSingle()
    if(again)return {employeeId:item.employeeId,status:again.status,code:again.error_code,username:again.username,repeated:true}
    // Another run holds this employee: never a second account.
    await admin.from('account_creation_items').insert({batch_id:batchId,organization_id:org.id,employee_id:item.employeeId,role:item.role,department_id:plan.departmentId,status:'failed',error_code:'ALREADY_IN_PROGRESS'})
    return {employeeId:item.employeeId,status:'failed',code:'ALREADY_IN_PROGRESS'}
  }
  const itemId=inserted.id
  const failed=async(code:string)=>{
    await admin.from('account_creation_items').update({status:'failed',error_code:code,updated_at:new Date().toISOString()}).eq('id',itemId)
    await admin.from('system_audit_log').insert({...base,event_type:'organization.user.creation_failed',metadata:{batch_id:batchId,role:item.role,error_code:code}})
    return {employeeId:item.employeeId,status:'failed',code}
  }
  if(plan.action==='skip')return failed(plan.code||'SKIPPED')

  if(plan.action==='link_existing'){
    const account=loaded.existingByEmail.get(plan.email)!
    const {data:membershipId,error:linkError}=await admin.rpc('platform_account_item_link',{p_item_id:itemId,p_user_id:account.userId,p_member_status:'active'})
    if(linkError)return failed(failureCode(linkError))
    try{
      await audit(admin,{...base,event_type:'organization.user.linked_existing_account',entity_type:'user',entity_id:account.userId,metadata:{batch_id:batchId,employee_id:item.employeeId,role:item.role,department_id:plan.departmentId,other_organizations:account.organizations.length}})
    }catch{
      await admin.from('organization_members').delete().eq('id',membershipId)
      await admin.from('employees').update({user_id:null}).eq('id',item.employeeId).eq('user_id',account.userId)
      return failed('AUDIT_FAILED')
    }
    const departmentName=plan.departmentId?loaded.departments.get(plan.departmentId)||'':''
    await admin.from('notification_outbox').insert({organization_id:org.id,recipient_user_id:account.userId,recipient_email:plan.email,notification_type:'account_access_added',entity_type:'account_access',entity_id:membershipId,subject:`${org.name} · Αποκτήσατε πρόσβαση και στο ${org.name}`,payload:{organizationName:org.name,organizationEmail:org.contact_email||'',organizationPhone:org.contact_phone||'',recipientName:account.fullName||name,username:account.username,roleLabel:ROLE_LABELS[item.role]||item.role,departmentName,path:'/login'},status:'pending'})
    await admin.from('account_creation_items').update({status:'linked_existing',user_id:account.userId,username:account.username,updated_at:new Date().toISOString()}).eq('id',itemId)
    return {employeeId:item.employeeId,status:'linked_existing',username:account.username}
  }

  // A new account: the Auth user without any Supabase e-mail (our own link instead).
  const username=await generateUserName(admin,name)
  const {data:created,error:createError}=await admin.auth.admin.createUser({email:plan.email,email_confirm:false,user_metadata:{full_name:name,username,role:item.role,role_label:ROLE_LABELS[item.role]||item.role,organization_id:org.id,organization_name:org.name,invited_by:ctx.callerName,is_platform_owner:false}})
  if(createError||!created?.user){
    const code=failureCode(createError)
    // Registered meanwhile (or without a profile e-mail): the owner decides, never a second account.
    return failed(code==='EMAIL_ALREADY_REGISTERED'?(ctx.canLinkExisting?'EXISTING_ACCOUNT_NEEDS_CONFIRMATION':'ACCOUNT_IN_USE'):code)
  }
  const userId=created.user.id
  let membershipLinked=false,invitationId:string|null=null,outboxId:string|null=null
  const undo=async()=>{
    if(outboxId)await admin.from('notification_outbox').delete().eq('id',outboxId)
    if(invitationId)await admin.from('account_invitations').delete().eq('id',invitationId)
    if(membershipLinked){
      await admin.from('organization_members').delete().eq('organization_id',org.id).eq('user_id',userId)
      await admin.from('employees').update({user_id:null}).eq('id',item.employeeId).eq('user_id',userId)
    }
    await admin.auth.admin.deleteUser(userId)
  }
  try{
    let demoEntitlementId:string|null=null
    if(org.is_demo){const {data:entitlement}=await admin.from('platform_demo_entitlements').select('id').eq('organization_id',org.id).order('created_at',{ascending:false}).limit(1).maybeSingle();demoEntitlementId=entitlement?.id||null}
    const {error:profileError}=await admin.from('profiles').update({full_name:name,username,contact_email:plan.email,...(org.is_demo?{is_demo:true,demo_entitlement_id:demoEntitlementId}:{})}).eq('id',userId)
    if(profileError)throw new Error('PROFILE_FAILED')
    const {error:linkError}=await admin.rpc('platform_account_item_link',{p_item_id:itemId,p_user_id:userId,p_member_status:'invited'})
    if(linkError)throw new Error(failureCode(linkError))
    membershipLinked=true
    const token=randomAccessToken(),expiresAt=accessLinkExpiry().toISOString()
    const {data:invitation,error:invitationError}=await admin.from('account_invitations').insert({organization_id:org.id,user_id:userId,username,delivery_email:plan.email,role:item.role,token_hash:await sha256Hex(token),expires_at:expiresAt,created_by:callerId}).select('id').single()
    if(invitationError||!invitation)throw new Error('INVITATION_FAILED')
    invitationId=invitation.id
    const {payload,message}=accountEmail({...ctx,departments:loaded.departments},{name,username,role:item.role,departmentId:plan.departmentId,expiresAt,token})
    const {data:outbox,error:outboxError}=await admin.from('notification_outbox').insert({organization_id:org.id,recipient_user_id:userId,recipient_email:plan.email,notification_type:'account_created',entity_type:'account_invitation',entity_id:invitationId,subject:message.subject,payload,status:'pending'}).select('id').single()
    if(outboxError||!outbox)throw new Error('OUTBOX_FAILED')
    outboxId=outbox.id
    await audit(admin,{...base,event_type:'organization.user.created_from_employee',entity_type:'user',entity_id:userId,metadata:{batch_id:batchId,employee_id:item.employeeId,role:item.role,department_id:plan.departmentId,invitation_id:invitationId}})
    const now=new Date().toISOString()
    await admin.from('account_creation_items').update({status:'created',user_id:userId,invitation_id:invitationId,username,send_count:1,last_sent_at:now,updated_at:now}).eq('id',itemId)
    return {employeeId:item.employeeId,status:'created',username}
  }catch(error){
    await undo()
    return failed(failureCode(error))
  }
}

async function refreshTotals(admin:Admin,batchId:string){
  const {data:rows}=await admin.from('account_creation_items').select('status').eq('batch_id',batchId)
  const count=(status:string)=>(rows||[]).filter((row:Admin)=>row.status===status).length
  const totals={created_count:count('created'),linked_count:count('linked_existing'),failed_count:count('failed')}
  await admin.from('account_creation_batches').update(totals).eq('id',batchId)
  return totals
}

async function create(ctx:Context,request:ReturnType<typeof validateBulkRequest>&{ok:true},runTotal:number){
  const {admin,org,callerId}=ctx
  const {request:r}=request
  // Daily limit per owner: accounts created or linked in the last 24 hours.
  const since=new Date(Date.now()-86400000).toISOString()
  const {data:recentBatches}=await admin.from('account_creation_batches').select('id').eq('created_by',callerId).gte('created_at',new Date(Date.now()-2*86400000).toISOString())
  const recentIds=(recentBatches||[]).map((b:Admin)=>b.id)
  if(recentIds.length){
    const {count}=await admin.from('account_creation_items').select('id',{count:'exact',head:true}).in('batch_id',recentIds).in('status',['created','linked_existing']).gte('created_at',since)
    if((count||0)+r.items.length>DAILY_OWNER_LIMIT)return fail('DAILY_LIMIT',429)
  }
  let {data:batch}=await admin.from('account_creation_batches').select('id,organization_id,status').eq('batch_key',r.batchKey).maybeSingle()
  if(!batch){
    const {data:inserted,error}=await admin.from('account_creation_batches').insert({organization_id:org.id,batch_key:r.batchKey,created_by:callerId,total:Math.max(r.items.length,Math.min(200,runTotal||0))}).select('id,organization_id,status').single()
    if(error&&error.code!=='23505')return fail('BATCH_FAILED',500)
    if(inserted){
      batch=inserted
      const roles=Object.fromEntries(summarizeByRole(r.items).map(row=>[row.role,row.count]))
      try{await audit(admin,{organization_id:org.id,actor_user_id:callerId,actor_role:ctx.actorRole,event_type:'platform.accounts.bulk_started',entity_type:'account_creation_batch',entity_id:inserted.id,metadata:{batch_id:inserted.id,total:runTotal||r.items.length,roles}})}
      catch{await admin.from('account_creation_batches').delete().eq('id',inserted.id);return fail('AUDIT_FAILED',500)}
    }else{
      const again=await admin.from('account_creation_batches').select('id,organization_id,status').eq('batch_key',r.batchKey).maybeSingle()
      batch=again.data
    }
  }
  if(!batch||batch.organization_id!==org.id)return fail('BATCH_MISMATCH',409)
  if(batch.status==='finished')return fail('BATCH_FINISHED',409)
  const loaded=await loadContext(admin,org.id,r.items)
  const results=[]
  for(const item of r.items){
    results.push(await createOne({...ctx,departments:loaded.departments},batch.id,item,loaded,r.confirmExisting.includes(item.employeeId)))
    await sleep(AUTH_PACE_MS)
  }
  const totals=await refreshTotals(admin,batch.id)
  await admin.rpc('platform_accounts_dispatch_send').then(()=>{},()=>{})
  return reply({ok:true,batchId:batch.id,results,totals})
}

async function finish(ctx:Context,batchKey:string){
  const {admin,org,callerId}=ctx
  const {data:batch}=await admin.from('account_creation_batches').select('id,organization_id,status,created_at,summary_sent_at').eq('batch_key',batchKey).maybeSingle()
  if(!batch||batch.organization_id!==org.id)return fail('BATCH_NOT_FOUND',404)
  const totals=await refreshTotals(admin,batch.id)
  if(batch.status!=='finished'){
    await admin.from('account_creation_batches').update({status:'finished',finished_at:new Date().toISOString()}).eq('id',batch.id).eq('status','running')
    await audit(admin,{organization_id:org.id,actor_user_id:callerId,actor_role:ctx.actorRole,event_type:'platform.accounts.bulk_finished',entity_type:'account_creation_batch',entity_id:batch.id,metadata:{batch_id:batch.id,...totals}}).catch(()=>{})
  }
  let summaries=0
  if(!batch.summary_sent_at){
    const [{data:items},{data:departments}]=await Promise.all([
      admin.from('account_creation_items').select('employee_id,role,department_id,status,username,employee:employees(first_name,last_name)').eq('batch_id',batch.id).order('created_at'),
      admin.from('departments').select('id,name').eq('organization_id',org.id),
    ])
    const deptName=new Map((departments||[]).map((d:Admin)=>[d.id,d.name]))
    const people=(items||[]).map((row:Admin)=>({name:[row.employee?.first_name,row.employee?.last_name].filter(Boolean).join(' '),roleLabel:ROLE_LABELS[row.role]||row.role,departmentName:row.department_id?deptName.get(row.department_id)||'':'',username:row.username||'',outcome:row.status}))
    // The hospital's active administrators; with none, the Platform Owner who ran it.
    const {data:admins}=await admin.from('organization_members').select('user_id,profile:profiles(full_name,contact_email)').eq('organization_id',org.id).eq('role','hospital_admin').eq('status','active')
    let recipients=(admins||[]).map((m:Admin)=>({id:m.user_id,name:m.profile?.full_name||'',email:normalizeEmail(m.profile?.contact_email),path:'/management'})).filter((r:Admin)=>isDeliverableEmail(r.email))
    if(!recipients.length){
      const {data:owner}=await admin.from('profiles').select('full_name,contact_email').eq('id',callerId).maybeSingle()
      let email=normalizeEmail(owner?.contact_email)
      if(!email){const {data}=await admin.auth.admin.getUserById(callerId);email=normalizeEmail(data?.user?.email)}
      if(isDeliverableEmail(email))recipients=[{id:callerId,name:owner?.full_name||'',email,path:'/platform'}]
    }
    for(const recipient of recipients){
      const {error}=await admin.from('notification_outbox').upsert({organization_id:org.id,recipient_user_id:recipient.id,recipient_email:recipient.email,notification_type:'account_batch_summary',entity_type:'account_creation_batch',entity_id:batch.id,subject:`${org.name} · Νέοι λογαριασμοί από το μητρώο εργαζομένων`,payload:{organizationName:org.name,recipientName:recipient.name,createdAt:batch.created_at,people,path:recipient.path},status:'pending'},{onConflict:'notification_type,entity_type,entity_id,recipient_user_id',ignoreDuplicates:true})
      if(!error)summaries++
    }
    await admin.from('account_creation_batches').update({summary_sent_at:new Date().toISOString()}).eq('id',batch.id)
  }
  await admin.rpc('platform_accounts_dispatch_send').then(()=>{},()=>{})
  return reply({ok:true,batchId:batch.id,totals,summaries})
}

async function resend(ctx:Context,employeeIds:string[]){
  const {admin,org,callerId}=ctx
  const [{data:employees},{data:departments}]=await Promise.all([
    admin.from('employees').select('id,user_id,email,first_name,last_name').eq('organization_id',org.id).in('id',employeeIds),
    admin.from('departments').select('id,name').eq('organization_id',org.id),
  ])
  const ctxWithDepartments={...ctx,departments:new Map<string,string>((departments||[]).map((d:Admin)=>[d.id,d.name]))}
  const results=[]
  for(const employeeId of employeeIds){
    const employee=(employees||[]).find((row:Admin)=>row.id===employeeId)
    const done=(status:string,code:string|null=null)=>{results.push({employeeId,status,code});return null}
    if(!employee?.user_id){done('failed','NO_ACCOUNT');continue}
    const userId=employee.user_id
    const [{data:membership},{data:profile},{data:invites},{data:resends}]=await Promise.all([
      admin.from('organization_members').select('id,role,status,scopes:organization_member_scopes(department_id)').eq('organization_id',org.id).eq('user_id',userId).maybeSingle(),
      admin.from('profiles').select('full_name,username,contact_email').eq('id',userId).maybeSingle(),
      admin.from('account_invitations').select('id,created_at').eq('organization_id',org.id).eq('user_id',userId).order('created_at',{ascending:false}).limit(1),
      admin.from('system_audit_log').select('created_at').eq('organization_id',org.id).eq('event_type','organization.user.access_resent').eq('entity_id',userId).gte('created_at',new Date(Date.now()-86400000).toISOString()),
    ])
    if(membership?.status!=='invited'){done('failed','NOT_PENDING');continue}
    if(membership.role==='hospital_admin'){done('failed','ROLE_NOT_ALLOWED');continue}
    const email=normalizeEmail(profile?.contact_email||employee.email)
    if(!isDeliverableEmail(email)){done('failed','INVALID_EMAIL');continue}
    const decision=resendDecision({resentAt:(resends||[]).map((row:Admin)=>row.created_at),lastSentAt:invites?.[0]?.created_at||null})
    if(!decision.ok){done('failed',decision.code);continue}
    const now=new Date().toISOString()
    await admin.from('account_invitations').update({revoked_at:now}).eq('organization_id',org.id).eq('user_id',userId).is('accepted_at',null).is('revoked_at',null)
    const token=randomAccessToken(),expiresAt=accessLinkExpiry().toISOString()
    const username=profile?.username||''
    const {data:invitation,error:invitationError}=await admin.from('account_invitations').insert({organization_id:org.id,user_id:userId,username,delivery_email:email,role:membership.role,token_hash:await sha256Hex(token),expires_at:expiresAt,created_by:callerId}).select('id').single()
    if(invitationError||!invitation){done('failed','INVITATION_FAILED');continue}
    const departmentId=membership.scopes?.[0]?.department_id||null
    const name=profile?.full_name||[employee.first_name,employee.last_name].filter(Boolean).join(' ')
    const {payload,message}=accountEmail(ctxWithDepartments,{name,username,role:membership.role,departmentId,expiresAt,token,kind:'resend'})
    const {error:outboxError}=await admin.from('notification_outbox').insert({organization_id:org.id,recipient_user_id:userId,recipient_email:email,notification_type:'account_created',entity_type:'account_invitation',entity_id:invitation.id,subject:message.subject,payload,status:'pending'})
    if(outboxError){await admin.from('account_invitations').delete().eq('id',invitation.id);done('failed','OUTBOX_FAILED');continue}
    try{await audit(admin,{organization_id:org.id,actor_user_id:callerId,actor_role:ctx.actorRole,event_type:'organization.user.access_resent',entity_type:'user',entity_id:userId,metadata:{employee_id:employeeId,invitation_id:invitation.id}})}
    catch{await admin.from('notification_outbox').delete().eq('entity_id',invitation.id).eq('notification_type','account_created');await admin.from('account_invitations').delete().eq('id',invitation.id);done('failed','AUDIT_FAILED');continue}
    const {data:item}=await admin.from('account_creation_items').select('id,send_count').eq('employee_id',employeeId).eq('user_id',userId).order('created_at',{ascending:false}).limit(1).maybeSingle()
    if(item)await admin.from('account_creation_items').update({send_count:Number(item.send_count||0)+1,last_sent_at:now,invitation_id:invitation.id,updated_at:now}).eq('id',item.id)
    done('sent')
  }
  await admin.rpc('platform_accounts_dispatch_send').then(()=>{},()=>{})
  return reply({ok:true,results})
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
  // The Platform Owner, or the hospital's own active Hospital Admin; anyone else is refused.
  const {data:profile}=await admin.from('profiles').select('is_platform_owner,full_name').eq('id',callerData.user.id).maybeSingle()
  if(!isUuid(body?.organizationId))return fail('ORGANIZATION_REQUIRED')
  const isOwner=Boolean(profile?.is_platform_owner)
  if(!isOwner){
    const {data:member}=await admin.from('organization_members').select('role,status').eq('organization_id',body.organizationId).eq('user_id',callerData.user.id).maybeSingle()
    if(member?.role!=='hospital_admin'||member?.status!=='active')return fail('NOT_AUTHORIZED',403)
  }
  const {data:org}=await admin.from('organizations').select('id,name,status,is_demo,contact_email,contact_phone').eq('id',body.organizationId).maybeSingle()
  if(!org)return fail('ORGANIZATION_NOT_FOUND',404)
  if(org.status!=='active')return fail('ORGANIZATION_PAUSED',409)
  const appUrl=(Deno.env.get('APP_URL')||Deno.env.get('APP_BASE_URL')||'https://www.limoxis.com').replace(/\/$/,'')
  const ctx:Context={admin,org,callerId:callerData.user.id,callerName:profile?.full_name||'',appUrl,departments:new Map(),actorRole:isOwner?'platform_owner':'hospital_admin',canLinkExisting:isOwner}
  const action=String(body.action||(body.dryRun?'preview':'create'))
  try{
    if(action==='finish')return isUuid(body.batchKey)?await finish(ctx,body.batchKey):fail('BATCH_KEY_REQUIRED')
    if(action==='resend'){
      const ids=Array.isArray(body.employeeIds)?[...new Set(body.employeeIds.filter(isUuid).map((id:string)=>id.toLowerCase()))] as string[]:[]
      if(!ids.length)return fail('ITEMS_REQUIRED')
      if(ids.length>MAX_RESEND)return fail('TOO_MANY_ITEMS')
      return await resend(ctx,ids)
    }
    const validated=validateBulkRequest({...body,dryRun:action==='preview'})
    if(validated.ok===false)return fail(validated.code)
    if(action==='preview')return await preview(ctx,validated)
    if(action==='create'){
      if(validated.request.items.length>MAX_CHUNK_ITEMS)return fail('TOO_MANY_ITEMS')
      return await create(ctx,validated,Number(body.total)||validated.request.items.length)
    }
    return fail('UNKNOWN_ACTION')
  }catch(error){
    console.error('platform-bulk-create-accounts failed',String((error as Error)?.message||error).slice(0,300))
    return fail('BULK_ACCOUNTS_FAILED',500)
  }
})
