import { updateMetadata } from '../../core/audit/actor'
import { loadSnapshot, saveSnapshot } from '../../core/data/repository'
export function loadCustomIndicators(){const rows=loadSnapshot('indicator_custom',[]);return Array.isArray(rows)?rows:[]}
export function saveCustomIndicators(rows){return saveSnapshot('indicator_custom',rows)}
export function nextCustomIndicatorId(rows=[]){
 const max=rows.reduce((m,x)=>Math.max(m,Number(String(x.id||'').match(/CUSTOM-(\d+)/)?.[1]||0)),0)
 return `CUSTOM-${String(max+1).padStart(3,'0')}`
}

export function loadIndicatorOverrides(){const rows=loadSnapshot('indicator_overrides',{});return rows&&typeof rows==='object'&&!Array.isArray(rows)?rows:{}}
export function saveIndicatorOverride(id,definition,{actor}={}){
 const current=loadIndicatorOverrides()
 current[id]={...definition,id,...updateMetadata(actor)}
 return saveSnapshot('indicator_overrides',current)
}
export function deleteIndicatorOverride(id){
 const current=loadIndicatorOverrides();delete current[id];return saveSnapshot('indicator_overrides',current)
}
export function loadDeletedIndicatorIds(){const rows=loadSnapshot('indicator_deleted',[]);return Array.isArray(rows)?rows:[]}
export function markIndicatorDeleted(id,{actor}={}){
 const ids=[...new Set([...loadDeletedIndicatorIds(),id])]
 saveSnapshot('indicator_deleted_audit',{id,...updateMetadata(actor)})
 return saveSnapshot('indicator_deleted',ids)
}
export function restoreIndicator(id){return saveSnapshot('indicator_deleted',loadDeletedIndicatorIds().filter(x=>x!==id))}
