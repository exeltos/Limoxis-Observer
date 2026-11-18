// The rules of «Ενεργοί χρήστες» (Platform Owner only): accounts created active,
// one by one or from a file, with a temporary password the owner hands over and the
// user must change at the first sign-in (profiles.must_change_password).
// Without I/O so that they are unit tested; used by platform-create-active-users.
import { ALLOWED_ROLES, DEPARTMENT_ROLES, ROLE_LABELS } from './organizationAccount.ts'

export const MAX_ACTIVE_USERS_PER_CALL=25
export const TEMPORARY_PASSWORD_LENGTH=14
// A temporary password that nobody signs in with expires: the account is locked until the owner gives a new one.
export const TEMPORARY_PASSWORD_DAYS=7
export const temporaryPasswordExpiry=(now:Date=new Date())=>new Date(now.getTime()+TEMPORARY_PASSWORD_DAYS*86400000).toISOString()
// The roles that see the departments of a division, chosen one by one (not a single department).
export const DIVISION_ROLES=['division_director']
export type PasswordMode='random'|'phone'
// A person with a username only gets an Auth address that never receives mail
// (the reserved .invalid domain): no e-mail is ever sent to it.
export const SYNTHETIC_EMAIL_DOMAIN='users.limoxis.invalid'

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid=(value:unknown)=>typeof value==='string'&&UUID.test(value)
export const normalizeEmail=(value:unknown)=>String(value??'').trim().toLowerCase()
export const isEmail=(value:unknown)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value))
export const isDeliverable=(value:unknown)=>isEmail(value)&&!/\.invalid$/.test(normalizeEmail(value))
// Letters, digits, dot, dash, underscore; 3–40 characters, starting with a letter or digit.
export const USERNAME_PATTERN=/^[A-Za-z0-9][A-Za-z0-9._-]{2,39}$/
export const isValidUsername=(value:unknown)=>USERNAME_PATTERN.test(String(value??'').trim())
export const syntheticEmail=(username:string)=>`${String(username).trim().toLowerCase()}@${SYNTHETIC_EMAIL_DOMAIN}`

// Lower case, without accents or extra spaces: «Προϊστάμενος  τμήματος» = «προισταμενος τμηματος».
export const fold=(value:unknown)=>String(value??'').trim().toLocaleLowerCase('el').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ')

// The role from its code (department_user) or its Greek name (Χρήστης Τμήματος).
export function resolveRole(value:unknown):string|null{
  const text=String(value??'').trim()
  if(!text)return null
  if(ALLOWED_ROLES.includes(text))return text
  const folded=fold(text)
  return ALLOWED_ROLES.find(role=>fold(role)===folded||fold(ROLE_LABELS[role])===folded)||null
}

// The temporary password: no characters that are confused when read aloud or
// copied from paper (0/O/o, 1/l/I, 5/S, 2/Z), at least one upper, lower, digit
// and symbol, positions shuffled. Unbiased (rejection sampling).
const UPPER='ABCDEFGHJKLMNPQRTUVWXY'
const LOWER='abcdefghijkmnpqrstuvwxyz'
const DIGITS='346789'
const SYMBOLS='!@#$%*?+='
const ALL=UPPER+LOWER+DIGITS+SYMBOLS
type RandomFill=(array:Uint8Array)=>Uint8Array
const defaultFill:RandomFill=array=>crypto.getRandomValues(array)
// A uniform index in 0..n-1 (n ≤ 256).
function randomIndex(n:number,fill:RandomFill){
  const limit=256-(256%n)
  for(;;){const [byte]=fill(new Uint8Array(1));if(byte<limit)return byte%n}
}
const pick=(set:string,fill:RandomFill)=>set[randomIndex(set.length,fill)]
export function generateTemporaryPassword(length=TEMPORARY_PASSWORD_LENGTH,fill:RandomFill=defaultFill){
  const size=Math.max(12,Math.min(64,Math.floor(length)||TEMPORARY_PASSWORD_LENGTH))
  const chars=[pick(UPPER,fill),pick(LOWER,fill),pick(DIGITS,fill),pick(SYMBOLS,fill)]
  while(chars.length<size)chars.push(pick(ALL,fill))
  for(let i=chars.length-1;i>0;i--){const j=randomIndex(i+1,fill);[chars[i],chars[j]]=[chars[j],chars[i]]}
  return chars.join('')
}
export const TEMPORARY_PASSWORD_ALPHABET=ALL

// A Greek mobile number as digits only: +30 / 0030 / spaces / dashes are dropped; 10 digits starting with 69.
export function normalizeMobile(value:unknown):string{
  let digits=String(value??'').replace(/[^\d+]/g,'')
  digits=digits.replace(/^\+?30(?=69)/,'').replace(/^0030(?=69)/,'').replace(/\D/g,'')
  return digits
}
export const isValidMobile=(value:unknown)=>/^69\d{8}$/.test(normalizeMobile(value))

export type ActiveUserInput={line:number,fullName:string,email:string,username:string,role:string|null,roleText:string,departmentId:string|null,departmentName:string,employeeCode:string,phone:string,passwordMode:PasswordMode,divisionId:string|null,divisionName:string,departmentIds:string[],departmentNames:string[],employeeId:string|null,sendInvite:boolean}

// One person of the request, with the errors that need no database.
export function normalizeUserRow(raw:unknown,index:number):{user:ActiveUserInput,errors:string[]}{
  const r=(raw&&typeof raw==='object'?raw:{}) as Record<string,unknown>
  const text=(key:string,max=200)=>String(r[key]??'').trim().slice(0,max)
  const user:ActiveUserInput={
    line:Number.isFinite(Number(r.line))&&Number(r.line)>0?Math.floor(Number(r.line)):index+1,
    fullName:text('fullName').replace(/\s+/g,' '),
    email:normalizeEmail(text('email',254)),
    username:text('username',40),
    roleText:text('role',80),
    role:resolveRole(r.role),
    departmentId:isUuid(r.departmentId)?String(r.departmentId).toLowerCase():null,
    departmentName:text('departmentName'),
    employeeCode:text('employeeCode',60),
    phone:normalizeMobile(text('phone',40)),
    passwordMode:r.passwordMode==='phone'?'phone':'random',
    divisionId:isUuid(r.divisionId)?String(r.divisionId).toLowerCase():null,
    divisionName:text('divisionName',120).replace(/\s+/g,' '),
    departmentIds:Array.isArray(r.departmentIds)?[...new Set(r.departmentIds.filter(isUuid).map(id=>String(id).toLowerCase()))].slice(0,200):[],
    departmentNames:Array.isArray(r.departmentNames)?[...new Set(r.departmentNames.map(name=>String(name??'').trim().slice(0,200)).filter(Boolean))].slice(0,200):[],
    // «Από τη λίστα εργαζομένων»: the employee the account is for.
    employeeId:isUuid(r.employeeId)?String(r.employeeId).toLowerCase():null,
    // «Αποστολή πρόσκλησης με email»: on unless the owner turned it off.
    sendInvite:r.sendInvite!==false,
  }
  const errors:string[]=[]
  if(!user.fullName)errors.push('FULL_NAME_REQUIRED')
  // An employee of the list without e-mail gets a username made from the name.
  if(!user.email&&!user.username&&!user.employeeId)errors.push('EMAIL_OR_USERNAME_REQUIRED')
  if(user.email&&!isDeliverable(user.email))errors.push('INVALID_EMAIL')
  if(user.username&&!isValidUsername(user.username))errors.push('INVALID_USERNAME')
  if(!user.roleText)errors.push('ROLE_REQUIRED')
  else if(!user.role)errors.push('ROLE_NOT_ALLOWED')
  if(r.departmentId!=null&&r.departmentId!==''&&!user.departmentId)errors.push('DEPARTMENT_INVALID')
  const phoneText=text('phone',40)
  if(user.passwordMode==='phone'&&!phoneText)errors.push('PHONE_REQUIRED')
  else if(phoneText&&!isValidMobile(phoneText))errors.push('PHONE_INVALID')
  return {user,errors}
}

// The body: { organizationId, users:[{fullName, email?, username?, role, departmentId? | departmentName?, employeeCode?}], dryRun? }.
export function validateActiveUsersRequest(body:unknown):{ok:true,organizationId:string,dryRun:boolean,rows:{user:ActiveUserInput,errors:string[]}[]}|{ok:false,code:string}{
  const b=(body&&typeof body==='object'?body:{}) as Record<string,unknown>
  if(!isUuid(b.organizationId))return {ok:false,code:'ORGANIZATION_REQUIRED'}
  if(!Array.isArray(b.users)||!b.users.length)return {ok:false,code:'USERS_REQUIRED'}
  if(b.users.length>MAX_ACTIVE_USERS_PER_CALL)return {ok:false,code:'TOO_MANY_USERS'}
  const requestMode=b.passwordMode==='phone'?'phone':'random'
  const rows=b.users.map((raw,index)=>normalizeUserRow(raw&&typeof raw==='object'&&(raw as Record<string,unknown>).passwordMode==null?{...(raw as object),passwordMode:requestMode}:raw,index))
  // The same e-mail, username, employee, or the same name without a different employee code, twice in one request: both rows are refused.
  const count=new Map<string,number>()
  const keys=(user:ActiveUserInput)=>[user.email&&`e:${user.email}`,user.username&&`u:${user.username.toLowerCase()}`,user.employeeId&&`i:${user.employeeId}`,user.fullName&&`n:${fold(user.fullName)}|${user.employeeId||fold(user.employeeCode)}`].filter(Boolean) as string[]
  for(const {user} of rows)for(const key of keys(user))count.set(key,(count.get(key)||0)+1)
  for(const row of rows)if(keys(row.user).some(key=>(count.get(key)||0)>1))row.errors.push('DUPLICATE_IN_FILE')
  return {ok:true,organizationId:String(b.organizationId),dryRun:b.dryRun===true,rows}
}

export type DepartmentRow={id:string,name:string,name_en?:string|null,is_active?:boolean|null}
export type EmployeeRow={id:string,employee_code:string|null,user_id:string|null,department_id:string|null,employment_status?:string|null,first_name?:string|null,last_name?:string|null}
export type DivisionRow={id:string,name:string}
// employeesById / employeesByName / memberNames: optional, so that older callers keep working.
export type PlanContext={departments:DepartmentRow[],existingEmails:Set<string>,takenUsernames:Set<string>,employeesByCode:Map<string,EmployeeRow>,divisions?:DivisionRow[],employeesById?:Map<string,EmployeeRow>,employeesByName?:Map<string,EmployeeRow[]>,memberNames?:Set<string>}

// The keys an employee is found by from a full name: «Όνομα Επώνυμο» and «Επώνυμο Όνομα».
export function employeeNameKeys(row:{first_name?:string|null,last_name?:string|null}){
  const first=fold(row.first_name),last=fold(row.last_name)
  if(!first||!last)return [] as string[]
  return [...new Set([`${first} ${last}`,`${last} ${first}`])]
}
// The employees by id and by name, for the plan.
export function indexEmployees(rows:EmployeeRow[]){
  const byId=new Map<string,EmployeeRow>(),byCode=new Map<string,EmployeeRow>(),byName=new Map<string,EmployeeRow[]>()
  for(const row of rows){
    byId.set(row.id,row)
    if(row.employee_code)byCode.set(fold(row.employee_code),row)
    for(const key of employeeNameKeys(row))byName.set(key,[...(byName.get(key)||[]),row])
  }
  return {byId,byCode,byName}
}

// The department by id, else by its Greek or English name (any case or accents); active only.
export function matchDepartment(departments:DepartmentRow[],{departmentId,departmentName}:{departmentId?:string|null,departmentName?:string|null}){
  const active=departments.filter(row=>row.is_active!==false)
  if(departmentId)return active.find(row=>row.id===departmentId)||null
  const name=fold(departmentName)
  if(!name)return null
  return active.find(row=>fold(row.name)===name||fold(row.name_en)===name)||null
}

// What happens to one person: the first error, or the department and employee to link.
export type ActiveUserPlan={code:string|null,departmentId:string|null,employeeId:string|null,divisionId:string|null,newDivisionName:string|null,departmentIds:string[]}
export function planActiveUser(row:{user:ActiveUserInput,errors:string[]},ctx:PlanContext):ActiveUserPlan{
  const {user}=row
  const none={departmentId:null,employeeId:null,divisionId:null,newDivisionName:null,departmentIds:[] as string[]}
  if(row.errors.length)return {code:row.errors[0],...none}
  if(user.email&&ctx.existingEmails.has(user.email))return {code:'ACCOUNT_EXISTS',...none}
  if(user.username&&ctx.takenUsernames.has(user.username.toLowerCase()))return {code:'USERNAME_TAKEN',...none}
  let employee:EmployeeRow|null=null
  const explicitEmployee=Boolean(user.employeeId||user.employeeCode)
  if(user.employeeId){
    employee=ctx.employeesById?.get(user.employeeId)||null
    if(!employee)return {code:'EMPLOYEE_NOT_FOUND',...none}
    if(employee.user_id)return {code:'EMPLOYEE_ALREADY_LINKED',...none}
  }else if(user.employeeCode){
    employee=ctx.employeesByCode.get(fold(user.employeeCode))||null
    if(!employee)return {code:'EMPLOYEE_NOT_FOUND',...none}
    if(employee.user_id)return {code:'EMPLOYEE_ALREADY_LINKED',...none}
  }else{
    // No code: a name that matches exactly one employee is that employee (one account per employee).
    const matches=ctx.employeesByName?.get(fold(user.fullName))||[]
    if(matches.length===1){
      if(matches[0].user_id)return {code:'EMPLOYEE_ALREADY_LINKED',...none}
      employee=matches[0]
    }
  }
  // A user of the hospital with the same name: refused, unless the owner typed the employee code and an e-mail or username of their own.
  const typedIdentity=Boolean(user.employeeCode&&!user.employeeId&&(user.email||user.username))
  if(ctx.memberNames?.has(fold(user.fullName))&&!(explicitEmployee&&typedIdentity))return {code:'NAME_TAKEN',...none}
  if(DIVISION_ROLES.includes(String(user.role))){
    // A division director: the division (existing, or a new one by its name) and the departments they will see.
    const wantsDepartments=user.departmentIds.length>0||user.departmentNames.length>0
    if(!wantsDepartments)return {code:'DEPARTMENTS_REQUIRED',...none}
    const picked:string[]=[]
    for(const id of user.departmentIds){
      const department=matchDepartment(ctx.departments,{departmentId:id})
      if(!department)return {code:'DEPARTMENT_NOT_FOUND',...none}
      picked.push(department.id)
    }
    for(const name of user.departmentNames){
      const department=matchDepartment(ctx.departments,{departmentName:name})
      if(!department)return {code:'DEPARTMENT_NOT_FOUND',...none}
      picked.push(department.id)
    }
    const divisions=ctx.divisions||[]
    let divisionId:string|null=null
    let newDivisionName:string|null=null
    if(user.divisionId){
      if(!divisions.some(row=>row.id===user.divisionId))return {code:'DIVISION_NOT_FOUND',...none}
      divisionId=user.divisionId
    }else if(user.divisionName){
      const found=divisions.find(row=>fold(row.name)===fold(user.divisionName))
      if(found)divisionId=found.id
      else newDivisionName=user.divisionName
    }else return {code:'DIVISION_REQUIRED',...none}
    return {code:null,departmentId:null,employeeId:employee?.id||null,divisionId,newDivisionName,departmentIds:[...new Set(picked)]}
  }
  const scoped=DEPARTMENT_ROLES.includes(String(user.role))
  let departmentId:string|null=null
  if(user.departmentId||user.departmentName){
    const department=matchDepartment(ctx.departments,user)
    if(!department)return {code:'DEPARTMENT_NOT_FOUND',...none}
    departmentId=department.id
  }else if(scoped&&employee?.department_id&&ctx.departments.some(row=>row.id===employee!.department_id&&row.is_active!==false)){
    departmentId=employee.department_id
  }
  if(scoped&&!departmentId)return {code:'DEPARTMENT_REQUIRED',...none}
  return {code:null,departmentId:scoped?departmentId:null,employeeId:employee?.id||null,divisionId:null,newDivisionName:null,departmentIds:[]}
}

// The error code kept per person from what failed while creating.
export function activeUserFailureCode(error:unknown){
  const message=String((error as {message?:string})?.message||error||'')
  for(const code of ['PROFILE_FAILED','MEMBERSHIP_FAILED','DEPARTMENT_SAVE_FAILED','DIVISION_SAVE_FAILED','MEMBERSHIP_NOT_FOUND','EMPLOYEE_ALREADY_LINKED','OUTBOX_FAILED','AUDIT_FAILED','USERNAME_TAKEN'])if(message.includes(code))return code
  if(/already been registered|already registered|already exists/i.test(message))return 'ACCOUNT_EXISTS'
  if(/invalid.*email|email.*invalid/i.test(message))return 'INVALID_EMAIL'
  if(/password/i.test(message))return 'PASSWORD_REJECTED'
  return 'AUTH_ERROR'
}
