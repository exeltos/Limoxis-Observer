export const SYSTEM_ROLE_KEYS=Object.freeze([
  'hospital_admin','infection_control_lead','infection_control_member','department_manager','department_user','laboratory','committee_secretariat','hr_office','pharmacy','occupational_physician','doctor_reviewer','quality_manager','link_nurse','staff_user',
])

const labels=Object.freeze({
  platform_owner:{el:'Platform Owner',en:'Platform Owner'},
  hospital_admin:{el:'Διαχειριστής Νοσοκομείου',en:'Hospital Admin'},
  infection_control_lead:{el:'Υπεύθυνος Ελέγχου Λοιμώξεων',en:'Infection Control Lead'},
  infection_control_member:{el:'Μέλος Ελέγχου Λοιμώξεων',en:'Infection Control Member'},
  department_manager:{el:'Προϊστάμενος Τμήματος',en:'Department Manager'},
  department_user:{el:'Χρήστης Τμήματος',en:'Department User'},
  laboratory:{el:'Εργαστήριο',en:'Laboratory'},
  committee_secretariat:{el:'Γραμματεία Επιτροπής',en:'Committee Secretariat'},
  hr_office:{el:'Ανθρώπινο Δυναμικό (HR)',en:'HR Office'},
  pharmacy:{el:'Φαρμακείο',en:'Pharmacy'},
  occupational_physician:{el:'Ιατρός Εργασίας',en:'Occupational Physician'},
  doctor_reviewer:{el:'Ιατρός Αξιολογητής',en:'Doctor Reviewer'},
  quality_manager:{el:'Υπεύθυνος Ποιότητας',en:'Quality Manager'},
  link_nurse:{el:'Link Nurse',en:'Link Nurse'},
  staff_user:{el:'Εργαζόμενος',en:'Staff User'},
  demo:{el:'Demo',en:'Demo'},
})

export function roleLabel(role,language='el'){
  const key=String(role||'').trim()
  if(!key)return '—'
  return labels[key]?.[language==='en'?'en':'el']||key.replaceAll('_',' ')
}
