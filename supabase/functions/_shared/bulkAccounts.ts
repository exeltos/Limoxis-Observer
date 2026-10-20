// The rules of the bulk creation of accounts from a hospital's employee roster
// (N1, Platform Owner only), without I/O so that they are unit tested:
// what a request may contain, what happens to each person, the 7-day validity
// of the «Ορισμός κωδικού» link, the limits of «Ξαναστείλε» and the error codes
// shown per person. Used by platform-bulk-create-accounts and redeem-access-token.
import { ALLOWED_ROLES } from './organizationAccount.ts'

export const ACCESS_LINK_DAYS=7
export const MAX_BATCH_ITEMS=200
// One call creates at most this many accounts; the screen sends the run in chunks
// with the same batchKey and shows the progress (see platform-bulk-create-accounts).
export const MAX_CHUNK_ITEMS=25
export const DAILY_OWNER_LIMIT=1000
export const RESEND_MAX_PER_DAY=3
export const RESEND_MIN_MINUTES=10
export const REDEEM_IP_LIMIT=10
export const REDEEM_IP_WINDOW_MINUTES=15
export const REDEEM_TOKEN_FAILURES=5
export const DEPARTMENT_ROLES=['department_manager','link_nurse','department_user']
// The Hospital Admin is given only one by one («Νέος χρήστης»), never in bulk.
export const BULK_ROLES=ALLOWED_ROLES.filter(role=>role!=='hospital_admin')
export const ACCESS_TOKEN_PATTERN=/^ACT-[0-9a-f]{64}$/
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid=(value:unknown)=>typeof value==='string'&&UUID.test(value)

export const normalizeEmail=(value:unknown)=>String(value??'').trim().toLowerCase()
// An address that can receive mail: the address form, and never the reserved
// .invalid domain of the Demo's synthetic people.
export function isDeliverableEmail(value:unknown){
  const email=normalizeEmail(value)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&!/\.invalid$/.test(email)
}

function athensParts(time:number){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Athens',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date(time))
  const get=(type:string)=>parts.find(part=>part.type===type)?.value||''
  return {day:`${get('year')}-${get('month')}-${get('day')}`,hour:Number(get('hour'))}
}
// The link is valid until 23:59 (Athens) of the 7th day after it is sent.
export function accessLinkExpiry(now=new Date()){
  const target=athensParts(now.getTime()+ACCESS_LINK_DAYS*86400000).day
  const [y,m,d]=target.split('-').map(Number)
  for(const offset of [3,2]){
    const candidate=Date.UTC(y,m-1,d,23-offset,59,59)
    const at=athensParts(candidate)
    if(at.day===target&&at.hour===23)return new Date(candidate)
  }
  return new Date(Date.UTC(y,m-1,d,21,59,59))
}

export type BulkItem={employeeId:string,role:string,departmentId:string|null}
export type BulkRequest={organizationId:string,batchKey:string|null,items:BulkItem[],dryRun:boolean,confirmExisting:string[]}

// The body of a bulk call: { organizationId, batchKey, items:[{employeeId, role, departmentId?}], dryRun?, confirmExisting? }.
export function validateBulkRequest(body:unknown):{ok:true,request:BulkRequest}|{ok:false,code:string}{
  const b=(body&&typeof body==='object'?body:{}) as Record<string,unknown>
  if(!isUuid(b.organizationId))return {ok:false,code:'ORGANIZATION_REQUIRED'}
  const dryRun=b.dryRun===true
  if(!dryRun&&!isUuid(b.batchKey))return {ok:false,code:'BATCH_KEY_REQUIRED'}
  if(!Array.isArray(b.items)||!b.items.length)return {ok:false,code:'ITEMS_REQUIRED'}
  if(b.items.length>(dryRun?MAX_BATCH_ITEMS:MAX_CHUNK_ITEMS))return {ok:false,code:'TOO_MANY_ITEMS'}
  const seen=new Set<string>()
  const items:BulkItem[]=[]
  for(const raw of b.items){
    const item=(raw&&typeof raw==='object'?raw:{}) as Record<string,unknown>
    if(!isUuid(item.employeeId))return {ok:false,code:'EMPLOYEE_REQUIRED'}
    const employeeId=String(item.employeeId).toLowerCase()
    if(seen.has(employeeId))return {ok:false,code:'DUPLICATE_EMPLOYEE'}
    seen.add(employeeId)
    if(!BULK_ROLES.includes(String(item.role)))return {ok:false,code:'ROLE_NOT_ALLOWED'}
    if(item.departmentId!=null&&item.departmentId!==''&&!isUuid(item.departmentId))return {ok:false,code:'DEPARTMENT_INVALID'}
    items.push({employeeId,role:String(item.role),departmentId:item.departmentId?String(item.departmentId):null})
  }
  const confirmExisting=Array.isArray(b.confirmExisting)?b.confirmExisting.filter(isUuid).map(id=>String(id).toLowerCase()):[]
  return {ok:true,request:{organizationId:String(b.organizationId),batchKey:dryRun?null:String(b.batchKey),items,dryRun,confirmExisting}}
}

export type EmployeeRow={id:string,user_id:string|null,email:string|null,department_id:string|null,employment_status:string,first_name?:string,last_name?:string}
export type ExistingAccount={userId:string,fullName:string,username:string,isDemo:boolean,memberHere:boolean,organizations:string[]}
export type Plan={action:'create'|'link_existing'|'skip',code:string|null,departmentId:string|null,email:string}

// What happens to one person of the request.
export function planItem(item:BulkItem,employee:EmployeeRow|null|undefined,existing:ExistingAccount|null|undefined,confirmed:boolean):Plan{
  const email=normalizeEmail(employee?.email)
  const scoped=DEPARTMENT_ROLES.includes(item.role)
  const departmentId=scoped?(item.departmentId||employee?.department_id||null):null
  const skip=(code:string):Plan=>({action:'skip',code,departmentId,email})
  if(!employee)return skip('EMPLOYEE_NOT_FOUND')
  if(employee.employment_status!=='active')return skip('EMPLOYEE_INACTIVE')
  if(employee.user_id)return skip('EMPLOYEE_ALREADY_LINKED')
  if(!email)return skip('MISSING_EMAIL')
  if(!isDeliverableEmail(email))return skip('INVALID_EMAIL')
  if(scoped&&!departmentId)return skip('DEPARTMENT_REQUIRED')
  if(existing){
    if(existing.memberHere)return skip('EMAIL_IN_THIS_ORG')
    if(existing.isDemo)return skip('EXISTING_ACCOUNT_CONFLICT')
    if(!confirmed)return skip('EXISTING_ACCOUNT_NEEDS_CONFIRMATION')
    return {action:'link_existing',code:null,departmentId,email}
  }
  return {action:'create',code:null,departmentId,email}
}

// The same address on two employees of the request (or the roster) locks both.
export function duplicateEmails(rows:{email:string|null}[]){
  const counts=new Map<string,number>()
  for(const row of rows){const email=normalizeEmail(row.email);if(email)counts.set(email,(counts.get(email)||0)+1)}
  return new Set([...counts].filter(([,n])=>n>1).map(([email])=>email))
}

// The confirmation's table: people per role and the departments of the scoped roles.
export function summarizeByRole(entries:{role:string,departmentName?:string|null}[]){
  const byRole=new Map<string,{role:string,count:number,departments:string[]}>()
  for(const entry of entries){
    const row=byRole.get(entry.role)||{role:entry.role,count:0,departments:[]}
    row.count++
    if(DEPARTMENT_ROLES.includes(entry.role)&&entry.departmentName&&!row.departments.includes(entry.departmentName))row.departments.push(entry.departmentName)
    byRole.set(entry.role,row)
  }
  return [...byRole.values()].sort((a,b)=>b.count-a.count||BULK_ROLES.indexOf(a.role)-BULK_ROLES.indexOf(b.role))
}

// «Ξαναστείλε»: at most 3 new links per person in 24 hours, and at least 10
// minutes after the latest link (the first e-mail or a resend).
export function resendDecision({resentAt=[],lastSentAt=null}:{resentAt?:(string|Date)[],lastSentAt?:string|Date|null},now=new Date()){
  const dayAgo=now.getTime()-86400000
  const recent=resentAt.map(value=>new Date(value).getTime()).filter(time=>Number.isFinite(time)&&time>dayAgo)
  if(recent.length>=RESEND_MAX_PER_DAY)return {ok:false,code:'RESEND_DAILY_LIMIT'}
  const latest=lastSentAt?new Date(lastSentAt).getTime():0
  if(Number.isFinite(latest)&&latest&&now.getTime()-latest<RESEND_MIN_MINUTES*60000)return {ok:false,code:'RESEND_TOO_SOON'}
  return {ok:true,code:null}
}

// The error code kept per person from what failed.
export function failureCode(error:unknown){
  const message=String((error as {message?:string})?.message||error||'')
  for(const code of ['EMPLOYEE_ALREADY_LINKED','EMPLOYEE_NOT_FOUND','ALREADY_MEMBER','AUDIT_FAILED','INVITATION_FAILED','OUTBOX_FAILED','PROFILE_FAILED'])if(message.includes(code))return code
  if(/already been registered|already registered|already exists/i.test(message))return 'EMAIL_ALREADY_REGISTERED'
  if(/invalid.*email|email.*invalid/i.test(message))return 'INVALID_EMAIL'
  return 'AUTH_ERROR'
}

// The answer of the public redeem endpoint, from what it found for the token.
export function tokenState(invite:{accepted_at?:string|null,revoked_at?:string|null,expires_at?:string|null}|null|undefined,now=new Date()){
  if(!invite)return 'not_found'
  if(invite.accepted_at)return 'used'
  if(invite.revoked_at)return 'revoked'
  if(!invite.expires_at||new Date(invite.expires_at).getTime()<=now.getTime())return 'expired'
  return 'valid'
}
export const strongPassword=(p:unknown)=>typeof p==='string'&&p.length>=12&&p.length<=128&&/[A-Z]/.test(p)&&/[a-z]/.test(p)&&/\d/.test(p)&&/[^A-Za-z0-9]/.test(p)
