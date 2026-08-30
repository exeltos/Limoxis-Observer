export const CAPABILITIES = Object.freeze({
  VIEW_PLATFORM: 'view_platform', VIEW_DASHBOARD: 'view_dashboard', VIEW_MY_DEPARTMENT: 'view_my_department', VIEW_MY_PROFILE: 'view_my_profile',
  VIEW_SURVEILLANCE: 'view_surveillance', VIEW_LAB: 'view_lab', VIEW_PREVENTION: 'view_prevention', VIEW_RECORDS: 'view_records', VIEW_QUALITY: 'view_quality', VIEW_CONTROLS: 'view_controls', VIEW_TRAINING: 'view_training', VIEW_COMMITTEES: 'view_committees', VIEW_DOCUMENTS: 'view_documents', VIEW_PATIENTS: 'view_patients', VIEW_STAFF: 'view_staff', VIEW_LIRA: 'view_lira', VIEW_PHARMACY: 'view_pharmacy', VIEW_OCCUPATIONAL_HEALTH: 'view_occupational_health', VIEW_INDICATORS: 'view_indicators',
  REPORT_INCIDENT: 'report_incident', MANAGE_USERS: 'manage_users', MANAGE_ORGANIZATION: 'manage_organization', MANAGE_PLATFORM: 'manage_platform', MANAGE_CONTROLS: 'manage_controls', MANAGE_QUALITY: 'manage_quality', MANAGE_STAFF_ADMIN: 'manage_staff_admin', MANAGE_OCCUPATIONAL_HEALTH: 'manage_occupational_health', MANAGE_COMMITTEES: 'manage_committees', MANAGE_TRAINING: 'manage_training', MANAGE_PHARMACY: 'manage_pharmacy', MANAGE_INDICATORS: 'manage_indicators', MANAGE_BED_DAYS: 'manage_bed_days', MANAGE_ROLES: 'manage_roles', MANAGE_EXTERNAL_REFERENCES: 'manage_external_references', MANAGE_LIBRARIES: 'manage_libraries', MANAGE_ANNOUNCEMENTS: 'manage_announcements',
  REVIEW_CLINICAL: 'review_clinical', CLOSE_SURVEILLANCE: 'close_surveillance', RECORD_CLINICAL_ASSESSMENT: 'record_clinical_assessment', MANAGE_LAB_SAMPLES: 'manage_lab_samples', VALIDATE_LAB_RESULTS: 'validate_lab_results', COMMUNICATE_CRITICAL_RESULTS: 'communicate_critical_results', CLASSIFY_RESISTANCE: 'classify_resistance', REOPEN_LAB_RECORD: 'reopen_lab_record', MANAGE_ANTIMICROBIAL_THERAPY: 'manage_antimicrobial_therapy', MANAGE_ISOLATION: 'manage_isolation', REASSESS_SURVEILLANCE: 'reassess_surveillance', RECORD_SURVEILLANCE_OUTCOME: 'record_surveillance_outcome', REOPEN_SURVEILLANCE: 'reopen_surveillance',
  CREATE_RECORDS: 'create_records', EDIT_RECORDS: 'edit_records', DELETE_RECORDS: 'delete_records', COMPLETE_RECORDS: 'complete_records', APPROVE_RECORDS: 'approve_records', ATTACH_FILES: 'attach_files', PRINT_RECORDS: 'print_records', EXPORT_RECORDS: 'export_records', ASSIGN_RECORDS: 'assign_records',
  CREATE_PATIENT: 'create_patient', EDIT_PATIENT: 'edit_patient', DELETE_PATIENT: 'delete_patient', CREATE_SURVEILLANCE: 'create_surveillance', EDIT_SURVEILLANCE: 'edit_surveillance', DELETE_SURVEILLANCE: 'delete_surveillance', RECORD_HAND_HYGIENE: 'record_hand_hygiene', RECORD_WASTE: 'record_waste', RECORD_ANTISEPTIC: 'record_antiseptic', RECORD_PREVENTION_BUNDLE: 'record_prevention_bundle',
})

import { CUSTOM_ROLE_CLASSES,DATA_SCOPES,SENSITIVITY } from './scopeTypes.js'
import { capabilityLabels } from './capabilityLabels.js'

const SYSTEM_ONLY=new Set(['manage_platform','view_platform','manage_users','manage_roles','manage_organization'])
const SENSITIVE=new Set(['view_occupational_health','manage_occupational_health','review_clinical','record_clinical_assessment'])
const GOVERNANCE_ACTIONS=new Set(['validate_lab_results','reopen_lab_record','reopen_surveillance','close_surveillance','approve_records','delete_records','complete_records'])
const domainFor=id=>id.includes('occupational')?'occupational_health':id.includes('lab')||id.includes('resistance')||id.includes('critical')?'laboratory':id.includes('surveillance')||id.includes('patient')||id.includes('clinical')||id.includes('isolation')?'clinical':id.includes('quality')?'quality':id.includes('committee')?'committees':id.includes('document')?'documents':id.includes('control')?'controls':id.includes('training')?'training':id.includes('staff')?'workforce':id.includes('platform')?'platform':id.includes('organization')||id.includes('users')||id.includes('roles')?'administration':'general'
const actionFor=id=>id.split('_')[0]
const titleFor=id=>id.split('_').map(word=>word[0].toUpperCase()+word.slice(1)).join(' ')

export const capabilityCatalogue=Object.freeze(Object.fromEntries(Object.values(CAPABILITIES).map(id=>{
 const systemOnly=SYSTEM_ONLY.has(id),sensitive=SENSITIVE.has(id)
 const defaultScope=id.includes('my_')?DATA_SCOPES.SELF:id.includes('platform')?DATA_SCOPES.PLATFORM:DATA_SCOPES.ORGANIZATION
 const [descriptionEl,descriptionEn]=capabilityLabels[id]??[titleFor(id),titleFor(id)]
 return [id,Object.freeze({id,domain:domainFor(id),actionType:actionFor(id),descriptionEl,descriptionEn,allowedScopes:Object.freeze(defaultScope===DATA_SCOPES.PLATFORM?[DATA_SCOPES.PLATFORM]:[DATA_SCOPES.SELF,DATA_SCOPES.DEPARTMENT,DATA_SCOPES.ORGANIZATION]),defaultScope,maximumScope:defaultScope===DATA_SCOPES.PLATFORM?DATA_SCOPES.PLATFORM:DATA_SCOPES.ORGANIZATION,sensitivity:systemOnly?SENSITIVITY.SECURITY:sensitive?SENSITIVITY.SENSITIVE:SENSITIVITY.STANDARD,customRoleClass:systemOnly?CUSTOM_ROLE_CLASSES.SYSTEM_ONLY:sensitive?CUSTOM_ROLE_CLASSES.RESTRICTED:CUSTOM_ROLE_CLASSES.STANDARD,addOnEligible:!systemOnly&&!GOVERNANCE_ACTIONS.has(id),requiresOwnership:false,requiresAssignment:false,governanceAction:GOVERNANCE_ACTIONS.has(id),rlsMode:defaultScope})]
})))

export const capabilityDefinition=id=>capabilityCatalogue[id]??null
export const isCustomRoleEligible=id=>capabilityDefinition(id)?.customRoleClass===CUSTOM_ROLE_CLASSES.STANDARD
