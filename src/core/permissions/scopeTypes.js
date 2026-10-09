export const DATA_SCOPES=Object.freeze({PLATFORM:'platform',ORGANIZATION:'organization',DEPARTMENT:'department',SELF:'self'})
export const CUSTOM_ROLE_CLASSES=Object.freeze({STANDARD:'standard',RESTRICTED:'restricted',SYSTEM_ONLY:'system_only'})
export const SENSITIVITY=Object.freeze({STANDARD:'standard',SENSITIVE:'sensitive',SECURITY:'security'})

/** @type {Readonly<Record<string, number>>} */
const scopeRank=Object.freeze({[DATA_SCOPES.SELF]:0,[DATA_SCOPES.DEPARTMENT]:1,[DATA_SCOPES.ORGANIZATION]:2,[DATA_SCOPES.PLATFORM]:3})
/** @param {unknown} value @returns {value is import('./types.js').DataScope} */
const isDataScope=value=>/** @type {readonly unknown[]} */(Object.values(DATA_SCOPES)).includes(value)
/** @param {unknown} requested @param {unknown} maximum */
export const scopeWithin=(requested,maximum)=>isDataScope(requested)&&isDataScope(maximum)&&scopeRank[requested]<=scopeRank[maximum]
