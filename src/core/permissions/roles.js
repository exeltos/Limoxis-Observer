// Compatibility facade. New authorization code should import the catalogue,
// matrix, scopes or permission engine directly.
export { CAPABILITIES,capabilityCatalogue,capabilityDefinition,isCustomRoleEligible } from './capabilityCatalogue.js'
export { ADD_ON_CAPABILITIES,MANAGEMENT_CAPABILITIES,PREVIEWABLE_ROLES,ROLES,addonCapabilityMap,isPreviewableRole,roleCapabilities,roleCapabilityRule,systemRoleMatrix } from './systemRoleMatrix.js'
export { can,canAny,canForRecord,capabilitiesFor,canAccessDepartment,hasAddOn,isAssigned,isOwner,isSelf,scopeFor } from './permissionEngine.js'
