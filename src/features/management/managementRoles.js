export const managementRoleNames={
  platform_owner:'platformOwnerRole',
  hospital_admin:'hospitalAdminRole',
  infection_control_lead:'infectionControlLeadRole',
  infection_control_member:'infectionControlMemberRole',
  department_manager:'departmentManagerRole',
  department_user:'departmentUserRole',
  laboratory:'laboratoryRole',
  committee_secretariat:'committeeSecretariatRole',
  hr_office:'hrOfficeRole',
  pharmacy:'pharmacyRole',
  occupational_physician:'occupationalPhysicianRole',
  doctor_reviewer:'doctorReviewerRole',
  quality_manager:'qualityManagerRole',
  link_nurse:'linkNurseRole',
  staff_user:'staffUserRole',
  demo:'demoRole',
}

export const creatableManagementRoles=[
  'hospital_admin','infection_control_lead','infection_control_member','department_manager',
  'department_user','laboratory','committee_secretariat','hr_office','pharmacy',
  'occupational_physician','doctor_reviewer','quality_manager','link_nurse','staff_user',
]

export function managementMemberStatusLabel(status,language){
  if(status==='active')return language==='en'?'Active':'Ενεργός'
  if(status==='disabled')return language==='en'?'Access paused':'Πρόσβαση σε παύση'
  if(status==='invited')return language==='en'?'Invited':'Προσκλήθηκε'
  return status||'—'
}
