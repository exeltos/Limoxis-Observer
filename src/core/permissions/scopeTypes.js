export const DATA_SCOPES=Object.freeze({PLATFORM:'platform',ORGANIZATION:'organization',DEPARTMENT:'department',SELF:'self'})
export const RECORD_RELATIONSHIPS=Object.freeze({OWNER:'owner',ASSIGNED:'assigned'})
export const CUSTOM_ROLE_CLASSES=Object.freeze({STANDARD:'standard',RESTRICTED:'restricted',SYSTEM_ONLY:'system_only'})
export const SENSITIVITY=Object.freeze({STANDARD:'standard',SENSITIVE:'sensitive',SECURITY:'security'})

const scopeRank=Object.freeze({[DATA_SCOPES.SELF]:0,[DATA_SCOPES.DEPARTMENT]:1,[DATA_SCOPES.ORGANIZATION]:2,[DATA_SCOPES.PLATFORM]:3})
export const isDataScope=value=>Object.values(DATA_SCOPES).includes(value)
export const scopeWithin=(requested,maximum)=>isDataScope(requested)&&isDataScope(maximum)&&scopeRank[requested]<=scopeRank[maximum]
