export const SYSTEM_ROLE_KEYS=Object.freeze([
  'hospital_admin','infection_control_lead','infection_control_member','department_manager','department_user','laboratory','committee_secretariat','hr_office','pharmacy','occupational_physician','doctor_reviewer','quality_manager','hospital_director','link_nurse','staff_user',
])

// The one source of every role's name (menus, user button, management screens,
// role preview). The dictionary keys t('hospitalDirectorRole') etc. resolve here
// (LanguageContext), and the e-mail Edge Functions copy the Greek names
// (create-organization-user, manage-organization-user: ROLE_LABELS).
export const ROLE_LABELS=Object.freeze({
  platform_owner:{el:'Ιδιοκτήτης πλατφόρμας',en:'Platform Owner'},
  hospital_admin:{el:'Διαχειριστής Νοσοκομείου',en:'Hospital Admin'},
  infection_control_lead:{el:'Υπεύθυνος Λοιμώξεων',en:'Infection Control Lead'},
  infection_control_member:{el:'Μέλος Ομάδας Λοιμώξεων',en:'Infection Control Member'},
  department_manager:{el:'Προϊστάμενος Τμήματος',en:'Department Manager'},
  department_user:{el:'Χρήστης Τμήματος',en:'Department User'},
  laboratory:{el:'Εργαστήριο',en:'Laboratory'},
  committee_secretariat:{el:'Γραμματεία Επιτροπών',en:'Committee Secretariat'},
  hr_office:{el:'Γραφείο Προσωπικού (HR)',en:'HR Office'},
  pharmacy:{el:'Φαρμακείο',en:'Pharmacy'},
  occupational_physician:{el:'Ιατρός Εργασίας',en:'Occupational Physician'},
  doctor_reviewer:{el:'Ιατρός Αξιολογητής',en:'Doctor Reviewer'},
  quality_manager:{el:'Υπεύθυνος Ποιότητας',en:'Quality Manager'},
  hospital_director:{el:'Διοικητής / Γενικός Διευθυντής',en:'Hospital Director (CEO)'},
  link_nurse:{el:'Νοσηλευτής Σύνδεσμος',en:'Link Nurse'},
  staff_user:{el:'Γενικός Χρήστης',en:'Staff User'},
  demo:{el:'Demo',en:'Demo'},
})

// Dictionary key → role, for the screens that name a role by t(key).
export const ROLE_LABEL_KEYS=Object.freeze({
  platformOwnerRole:'platform_owner',hospitalAdminRole:'hospital_admin',infectionControlLeadRole:'infection_control_lead',infectionControlMemberRole:'infection_control_member',
  departmentManagerRole:'department_manager',departmentUserRole:'department_user',laboratoryRole:'laboratory',committeeSecretariatRole:'committee_secretariat',hrOfficeRole:'hr_office',
  pharmacyRole:'pharmacy',occupationalPhysicianRole:'occupational_physician',doctorReviewerRole:'doctor_reviewer',qualityManagerRole:'quality_manager',hospitalDirectorRole:'hospital_director',
  linkNurseRole:'link_nurse',staffUserRole:'staff_user',demoRole:'demo',
})

/** @param {string|null|undefined} role @param {string} [language] */
export function roleLabel(role,language='el'){
  const key=String(role||'').trim()
  if(!key)return '—'
  return /** @type {Record<string, {el:string, en:string}>} */(ROLE_LABELS)[key]?.[language==='en'?'en':'el']||key.replaceAll('_',' ')
}

/** The name behind a dictionary key such as 'hospitalDirectorRole', or null. @param {string} key @param {string} [language] */
export function roleLabelForKey(key,language='el'){
  const role=/** @type {Record<string,string>} */(ROLE_LABEL_KEYS)[key]
  return role?roleLabel(role,language):null
}
