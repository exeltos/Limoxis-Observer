// Shared JSDoc types for the permission model (checked by `npm run typecheck:strict`).
// The capability and role ids are the values of CAPABILITIES and ROLES.

/** @typedef {typeof import('./capabilityCatalogue.js').CAPABILITIES[keyof typeof import('./capabilityCatalogue.js').CAPABILITIES]} Capability */
/** @typedef {typeof import('./systemRoleMatrix.js').ROLES[keyof typeof import('./systemRoleMatrix.js').ROLES]} Role */
/** @typedef {typeof import('./scopeTypes.js').DATA_SCOPES[keyof typeof import('./scopeTypes.js').DATA_SCOPES]} DataScope */

/**
 * One capability of the catalogue.
 * @typedef {object} CapabilityDefinition
 * @property {string} id
 * @property {string} domain
 * @property {string} actionType
 * @property {string} descriptionEl
 * @property {string} descriptionEn
 * @property {readonly DataScope[]} allowedScopes
 * @property {DataScope} defaultScope
 * @property {DataScope} maximumScope
 * @property {string} customRoleClass
 * @property {string} sensitivity
 * @property {boolean} [requiresOwnership]
 * @property {boolean} [requiresAssignment]
 */

/**
 * Who is asking: the inputs of the permission checks.
 * @typedef {object} AccessContext
 * @property {string|null} [role]
 * @property {string[]} [addOns]
 * @property {string[]} [customCapabilities]
 * @property {Record<string, string>} [scopeOverrides]
 * @property {string|null} [organizationId]
 * @property {string|null} [userId]
 * @property {string|null} [employeeId]
 * @property {string[]} [departmentIds]
 * @property {Array<Record<string, any>>} [assignments]
 */

/**
 * The parts of a record the permission checks read.
 * @typedef {Record<string, any> & {id?: string, dbId?: string, organizationId?: string|null, departmentId?: string|null, employeeId?: string|null, ownerId?: string|null, createdBy?: string|null, resourceType?: string, finalized?: boolean}} AccessRecord
 */

export {}
