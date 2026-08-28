import { strict as assert } from 'node:assert'
import { CAPABILITIES, ROLES, can } from '../src/core/permissions/roles.js'

const cases=[
  [ROLES.LABORATORY,CAPABILITIES.VIEW_LAB,true,'Laboratory sees Laboratory'],
  [ROLES.LABORATORY,CAPABILITIES.VIEW_QUALITY,false,'Laboratory does not inherit Quality'],
  [ROLES.QUALITY_MANAGER,CAPABILITIES.VIEW_QUALITY,true,'Quality Manager sees Quality'],
  [ROLES.QUALITY_MANAGER,CAPABILITIES.VIEW_CONTROLS,true,'Quality Manager sees Controls'],
  [ROLES.OCCUPATIONAL_PHYSICIAN,CAPABILITIES.VIEW_OCCUPATIONAL_HEALTH,true,'Occupational Physician sees Occupational Health'],
  [ROLES.OCCUPATIONAL_PHYSICIAN,CAPABILITIES.VIEW_STAFF,true,'Occupational Physician sees Staff'],
  [ROLES.HR_OFFICE,CAPABILITIES.VIEW_STAFF,true,'HR sees Staff'],
  [ROLES.HR_OFFICE,CAPABILITIES.VIEW_OCCUPATIONAL_HEALTH,false,'HR does not inherit Occupational Health'],
  [ROLES.DOCTOR_REVIEWER,CAPABILITIES.VIEW_SURVEILLANCE,true,'Doctor Reviewer sees Surveillance'],
  [ROLES.DOCTOR_REVIEWER,CAPABILITIES.VIEW_LAB,true,'Doctor Reviewer sees Laboratory'],
  [ROLES.DOCTOR_REVIEWER,CAPABILITIES.VIEW_PATIENTS,true,'Doctor Reviewer sees Patients'],
  [ROLES.DEPARTMENT_MANAGER,CAPABILITIES.VIEW_MY_DEPARTMENT,true,'Department Manager sees My Department'],
  [ROLES.DEPARTMENT_USER,CAPABILITIES.VIEW_MY_DEPARTMENT,true,'Department User sees My Department'],
  [ROLES.DEPARTMENT_USER,CAPABILITIES.VIEW_LAB,false,'Department User does not inherit Laboratory'],
  [ROLES.PHARMACY,CAPABILITIES.VIEW_PHARMACY,true,'Pharmacy sees Pharmacy'],
  [ROLES.PHARMACY,CAPABILITIES.VIEW_OCCUPATIONAL_HEALTH,false,'Pharmacy does not inherit Occupational Health'],
  [ROLES.COMMITTEE_SECRETARIAT,CAPABILITIES.VIEW_COMMITTEES,true,'Committee Secretariat sees Committees'],
]
for(const [role,cap,expected,label] of cases){
  assert.equal(can(role,cap),expected,label)
}
console.log(`Role/screen access checks passed: ${cases.length} assertions.`)
