import { capabilityDefinition } from './capabilityCatalogue.js'
import { addonCapabilityMap,roleCapabilities,roleCapabilityRule } from './systemRoleMatrix.js'
import { DATA_SCOPES,scopeWithin } from './scopeTypes.js'
import type { AccessContext, AccessRecord, DataScope } from './types'

export function capabilitiesFor(role:string|null|undefined,addOns:readonly string[]=[],customCapabilities:readonly string[]=[]):string[]{
 const base=(roleCapabilities as Record<string, readonly string[]>)[String(role)]??[]
 const supplemental=addOns.flatMap(item=>(addonCapabilityMap as Record<string, readonly string[]>)[item]??[])
 return [...new Set([...base,...supplemental,...customCapabilities])]
}

// Capabilities the active organization's operating profile switches off
// (core/organization/operatingProfile.js). Set by TenantContext; empty outside
// an organization, so the platform workspace and tests are unaffected.
let profileDisabled:Set<string>=new Set()
export function configureProfileAccess(disabled:Set<string>|readonly string[]|null|undefined):void{profileDisabled=disabled instanceof Set?disabled:new Set(disabled||[])}
export const isProfileDisabled=(capability:string):boolean=>profileDisabled.has(capability)
export const can=(role:string|null|undefined,capability:string,addOns:readonly string[]=[],customCapabilities:readonly string[]=[]):boolean=>!profileDisabled.has(capability)&&capabilitiesFor(role,addOns,customCapabilities).includes(capability)
export const canAny=(role:string|null|undefined,capabilities:readonly string[]=[],addOns:readonly string[]=[],customCapabilities:readonly string[]=[]):boolean=>capabilities.some(capability=>can(role,capability,addOns,customCapabilities))

export function scopeFor(capability:string,{role,scopeOverrides={}}:AccessContext={}):DataScope|null{
 const definition=capabilityDefinition(capability)
 if(!definition)return null
 const rule=roleCapabilityRule(role,capability)
 const maximum=rule?.maximumScope??definition.maximumScope
 const requested=(scopeOverrides[capability]??rule?.defaultScope??definition.defaultScope) as DataScope
 return definition.allowedScopes.includes(requested)&&scopeWithin(requested,maximum)?requested:null
}

export function canAccessDepartment(departmentId:string|null|undefined,{scope,departmentIds=[]}:{scope?: string|null, departmentIds?: string[]}={}):boolean{
 if(scope===DATA_SCOPES.ORGANIZATION)return true
 return scope===DATA_SCOPES.DEPARTMENT&&Boolean(departmentId)&&departmentIds.includes(String(departmentId))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- assignment rows of several tables
function assignmentMatchesRecord(item:Record<string, any>,record:AccessRecord|null|undefined){
 const resourceType=item.resourceType??item.sourceType
 const resourceId=item.resourceId??item.sourceId??item.committeeId??item.controlId??item.recordId
 const recordId=record?.dbId??record?.id
 const inactive=item.active===false||['cancelled','completed','expired'].includes(item.status)
 return !inactive&&resourceType===record?.resourceType&&String(resourceId)===String(recordId)
}

export function canForRecord(capability:string,record:AccessRecord|null|undefined,context:AccessContext={}):boolean{
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

export const hasAddOn=(addOnId:string,{addOns=[]}:AccessContext={}):boolean=>addOns.includes(addOnId)
export const isSelf=(record:AccessRecord|null|undefined,{employeeId}:AccessContext={}):boolean=>Boolean(employeeId)&&record?.employeeId===employeeId
export const isOwner=(record:AccessRecord|null|undefined,{userId}:AccessContext={}):boolean=>Boolean(userId)&&(record?.ownerId===userId||record?.createdBy===userId)
export const isAssigned=(record:AccessRecord|null|undefined,{assignments=[]}:AccessContext={}):boolean=>assignments.some(item=>assignmentMatchesRecord(item,record))
