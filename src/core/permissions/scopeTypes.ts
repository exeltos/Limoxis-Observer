export const DATA_SCOPES=Object.freeze({PLATFORM:'platform',ORGANIZATION:'organization',DEPARTMENT:'department',SELF:'self'})
export const CUSTOM_ROLE_CLASSES=Object.freeze({STANDARD:'standard',RESTRICTED:'restricted',SYSTEM_ONLY:'system_only'})
export const SENSITIVITY=Object.freeze({STANDARD:'standard',SENSITIVE:'sensitive',SECURITY:'security'})

import type { DataScope } from './types'

const scopeRank:Readonly<Record<string, number>>=Object.freeze({[DATA_SCOPES.SELF]:0,[DATA_SCOPES.DEPARTMENT]:1,[DATA_SCOPES.ORGANIZATION]:2,[DATA_SCOPES.PLATFORM]:3})
const isDataScope=(value:unknown):value is DataScope=>(Object.values(DATA_SCOPES) as readonly unknown[]).includes(value)
export const scopeWithin=(requested:unknown,maximum:unknown):boolean=>isDataScope(requested)&&isDataScope(maximum)&&scopeRank[requested]<=scopeRank[maximum]
