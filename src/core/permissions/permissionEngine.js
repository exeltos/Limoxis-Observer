import { capabilityDefinition } from './capabilityCatalogue.js'
import { addonCapabilityMap,roleCapabilities,roleCapabilityRule } from './systemRoleMatrix.js'
import { DATA_SCOPES,scopeWithin } from './scopeTypes.js'

/** @typedef {import('./types.js').AccessContext} AccessContext @typedef {import('./types.js').AccessRecord} AccessRecord */

/** @param {string|null|undefined} role @param {string[]} [addOns] @param {string[]} [customCapabilities] @returns {string[]} */
export function capabilitiesFor(role,addOns=[],customCapabilities=[]){
 const base=/** @type {Record<string, readonly string[]>} */(roleCapabilities)[String(role)]??[]
 const supplemental=addOns.flatMap(item=>/** @type {Record<string, readonly string[]>} */(addonCapabilityMap)[item]??[])
 return [...new Set([...base,...supplemental,...customCapabilities])]
}

// Capabilities the active organization's operating profile switches off
// (core/organization/operatingProfile.js). Set by TenantContext; empty outside
// an organization, so the platform workspace and tests are unaffected.
/** @type {Set<string>} */
let profileDisabled=new Set()
/** @param {Set<string>|string[]|null|undefined} disabled */
export function configureProfileAccess(disabled){profileDisabled=disabled instanceof Set?disabled:new Set(disabled||[])}
/** @param {string} capability */
export const isProfileDisabled=capability=>profileDisabled.has(capability)
/** @param {string|null|undefined} role @param {string} capability @param {string[]} [addOns] @param {string[]} [customCapabilities] */
export const can=(role,capability,addOns=[],customCapabilities=[])=>!profileDisabled.has(capability)&&capabilitiesFor(role,addOns,customCapabilities).includes(capability)
/** @param {string|null|undefined} role @param {string[]} [capabilities] @param {string[]} [addOns] @param {string[]} [customCapabilities] */
export const canAny=(role,capabilities=[],addOns=[],customCapabilities=[])=>capabilities.some(capability=>can(role,capability,addOns,customCapabilities))

/** @param {string} capability @param {AccessContext} [context] @returns {import('./types.js').DataScope|null} */
export function scopeFor(capability,{role,scopeOverrides={}}={}){
 const definition=capabilityDefinition(capability)
 if(!definition)return null
 const rule=roleCapabilityRule(role,capability)
 const maximum=rule?.maximumScope??definition.maximumScope
 const requested=/** @type {import('./types.js').DataScope} */(scopeOverrides[capability]??rule?.defaultScope??definition.defaultScope)
 return definition.allowedScopes.includes(requested)&&scopeWithin(requested,maximum)?requested:null
}

/** @param {string|null|undefined} departmentId @param {{scope?: string|null, departmentIds?: string[]}} [context] */
export function canAccessDepartment(departmentId,{scope,departmentIds=[]}={}){
 if(scope===DATA_SCOPES.ORGANIZATION)return true
 return scope===DATA_SCOPES.DEPARTMENT&&Boolean(departmentId)&&departmentIds.includes(String(departmentId))
}

/** @param {Record<string, any>} item @param {AccessRecord|null|undefined} record */
function assignmentMatchesRecord(item,record){
 const resourceType=item.resourceType??item.sourceType
 const resourceId=item.resourceId??item.sourceId??item.committeeId??item.controlId??item.recordId
 const recordId=record?.dbId??record?.id
 const inactive=item.active===false||['cancelled','completed','expired'].includes(item.status)
 return !inactive&&resourceType===record?.resourceType&&String(resourceId)===String(recordId)
}

/** @param {string} capability @param {AccessRecord|null|undefined} record @param {AccessContext} [context] */
export function canForRecord(capability,record,context={}){
 const {role,addOns=[],customCapabilities=[],organizationId,userId,employeeId,assignments=[]}=context
 if(!can(role,capability,addOns,customCapabilities))return false
 const definition=capabilityDefinition(capability)
 const scope=scopeFor(capability,context)
 if(!definition||!scope||!record)return false
 if(scope!==DATA_SCOPES.PLATFORM&&organizationId&&record.organizationId&&record.organizationId!==organizationId)return false
 if(scope===DATA_SCOPES.DEPARTMENT&&!canAccessDepartment(record.departmentId,{scope,departmentIds:context.departmentIds}))return false
 if(scope===DATA_SCOPES.SELF&&record.employeeId!==employeeId)return false
 if(definition.requiresOwnership&&record.ownerId!==userId&&record.createdBy!==userId)return false
 if((definition.requiresAssignment||roleCapabilityRule(role,capability)?.requiresAssignment)&&!assignments.some(item=>assignmentMatchesRecord(item,record)))return false
 if(record.finalized&&definition.actionType==='edit')return false
 return true
}

/** @param {string} addOnId @param {AccessContext} [context] */
export const hasAddOn=(addOnId,{addOns=[]}={})=>addOns.includes(addOnId)
/** @param {AccessRecord|null|undefined} record @param {AccessContext} [context] */
export const isSelf=(record,{employeeId}={})=>Boolean(employeeId)&&record?.employeeId===employeeId
/** @param {AccessRecord|null|undefined} record @param {AccessContext} [context] */
export const isOwner=(record,{userId}={})=>Boolean(userId)&&(record?.ownerId===userId||record?.createdBy===userId)
/** @param {AccessRecord|null|undefined} record @param {AccessContext} [context] */
export const isAssigned=(record,{assignments=[]}={})=>assignments.some(item=>assignmentMatchesRecord(item,record))
