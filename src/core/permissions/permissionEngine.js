import { capabilityDefinition } from './capabilityCatalogue.js'
import { addonCapabilityMap,roleCapabilities,roleCapabilityRule } from './systemRoleMatrix.js'
import { DATA_SCOPES,scopeWithin } from './scopeTypes.js'

export function capabilitiesFor(role,addOns=[],customCapabilities=[]){
 const base=roleCapabilities[role]??[]
 const supplemental=addOns.flatMap(item=>addonCapabilityMap[item]??[])
 return [...new Set([...base,...supplemental,...customCapabilities])]
}

export const can=(role,capability,addOns=[],customCapabilities=[])=>capabilitiesFor(role,addOns,customCapabilities).includes(capability)
export const canAny=(role,capabilities=[],addOns=[],customCapabilities=[])=>capabilities.some(capability=>can(role,capability,addOns,customCapabilities))

export function scopeFor(capability,{role,scopeOverrides={}}={}){
 const definition=capabilityDefinition(capability)
 if(!definition)return null
 const rule=roleCapabilityRule(role,capability)
 const maximum=rule?.maximumScope??definition.maximumScope
 const requested=scopeOverrides[capability]??rule?.defaultScope??definition.defaultScope
 return definition.allowedScopes.includes(requested)&&scopeWithin(requested,maximum)?requested:null
}

export function canAccessDepartment(departmentId,{scope,departmentIds=[]}={}){
 if(scope===DATA_SCOPES.ORGANIZATION)return true
 return scope===DATA_SCOPES.DEPARTMENT&&Boolean(departmentId)&&departmentIds.includes(departmentId)
}

function assignmentMatchesRecord(item,record){
 const resourceType=item.resourceType??item.sourceType
 const resourceId=item.resourceId??item.sourceId??item.committeeId??item.controlId??item.recordId
 const recordId=record?.dbId??record?.id
 const inactive=item.active===false||['cancelled','completed','expired'].includes(item.status)
 return !inactive&&resourceType===record?.resourceType&&String(resourceId)===String(recordId)
}

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

export const hasAddOn=(addOnId,{addOns=[]}={})=>addOns.includes(addOnId)
export const isSelf=(record,{employeeId}={})=>Boolean(employeeId)&&record?.employeeId===employeeId
export const isOwner=(record,{userId}={})=>Boolean(userId)&&(record?.ownerId===userId||record?.createdBy===userId)
export const isAssigned=(record,{assignments=[]}={})=>assignments.some(item=>assignmentMatchesRecord(item,record))
