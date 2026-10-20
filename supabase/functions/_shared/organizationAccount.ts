// The account pieces shared by create-organization-user (one person, by a
// Platform Owner or a Hospital Admin) and platform-bulk-create-accounts (many
// employees of one hospital, Platform Owner only): the roles that can be given,
// their labels, the username (initials + 5 digits) and the link of an account
// to its employee record. Moved here unchanged from create-organization-user.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin=any

export const ALLOWED_ROLES=['hospital_admin','infection_control_lead','infection_control_member','department_manager','department_user','laboratory','committee_secretariat','hr_office','pharmacy','occupational_physician','doctor_reviewer','quality_manager','hospital_director','link_nurse','staff_user']
export const ROLE_LABELS:Record<string,string>={hospital_admin:'Διαχειριστής Νοσοκομείου',infection_control_lead:'Υπεύθυνος Λοιμώξεων',infection_control_member:'Μέλος Ομάδας Λοιμώξεων',department_manager:'Προϊστάμενος Τμήματος',department_user:'Χρήστης Τμήματος',laboratory:'Εργαστήριο',committee_secretariat:'Γραμματεία Επιτροπών',hr_office:'Γραφείο Προσωπικού (HR)',pharmacy:'Φαρμακείο',occupational_physician:'Ιατρός Εργασίας',doctor_reviewer:'Ιατρός Αξιολογητής',quality_manager:'Υπεύθυνος Ποιότητας',hospital_director:'Διοικητής / Γενικός Διευθυντής',link_nurse:'Νοσηλευτής Σύνδεσμος',staff_user:'Γενικός Χρήστης'}
const GREEK_INITIALS:Record<string,string>={α:'A',ά:'A',β:'V',γ:'G',δ:'D',ε:'E',έ:'E',ζ:'Z',η:'I',ή:'I',θ:'T',ι:'I',ί:'I',ϊ:'I',ΐ:'I',κ:'K',λ:'L',μ:'M',ν:'N',ξ:'X',ο:'O',ό:'O',π:'P',ρ:'R',σ:'S',ς:'S',τ:'T',υ:'Y',ύ:'Y',ϋ:'Y',ΰ:'Y',φ:'F',χ:'C',ψ:'P',ω:'O',ώ:'O'}
export function latinInitial(value=''){const ch=String(value).trim().charAt(0);if(!ch)return 'X';if(/[A-Za-z]/.test(ch))return ch.toUpperCase();return GREEK_INITIALS[ch.toLowerCase()]||'X'}
export async function generateUserName(admin:Admin,fullName:string){const parts=String(fullName||'').trim().split(/\s+/).filter(Boolean);const prefix=`${latinInitial(parts[0]||'X')}${latinInitial(parts.length>1?parts[parts.length-1]:'X')}`;for(let i=0;i<40;i++){const candidate=`${prefix}${Math.floor(10000+Math.random()*90000)}`;const {data}=await admin.from('profiles').select('id').eq('username',candidate).maybeSingle();if(!data)return candidate}throw new Error('Could not allocate a unique username')}

export async function linkOrCreateEmployee(admin:Admin,{organizationId,userId,normalizedEmail,phone,jobTitle,employeeDbId,employee}:Admin){
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
  const {data:duplicate,error:duplicateError}=await admin.from('employees').select('id').eq('organization_id',organizationId).ilike('employee_code',employeeCode).maybeSingle()
  if(duplicateError)throw duplicateError
  if(duplicate)throw new Error('DUPLICATE_EMPLOYEE_CODE')
  const row={organization_id:organizationId,user_id:userId,employee_code:employeeCode,department_id:employee.departmentId||null,first_name:firstName,first_name_en:employee.firstNameEn||firstName,last_name:lastName,last_name_en:employee.lastNameEn||lastName,father_name:employee.fatherName||null,department_name:employee.departmentName||null,department_name_en:employee.departmentNameEn||employee.departmentName||null,profession_name:employee.professionName||jobTitle||null,profession_name_en:employee.professionNameEn||employee.professionName||jobTitle||null,employment_status:employee.employmentStatus||'active',email:normalizedEmail,phone:phone||null,hire_date:employee.hireDate||null,birth_date:employee.birthDate||null}
  const {data:created,error}=await admin.from('employees').insert(row).select('id').single()
  if(error){if(error.code==='23505')throw new Error('DUPLICATE_EMPLOYEE_CODE');throw error}
  return created.id
}

// A random activation token (the e-mailed link) and its SHA-256, which is all the
// database keeps (account_invitations.token_hash), as the supplier link does.
export async function sha256Hex(value:string){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('')}
export function randomAccessToken(){const bytes=crypto.getRandomValues(new Uint8Array(32));return `ACT-${[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('')}`}
