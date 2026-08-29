const CUSTOM_KEY='limoxis.customIndicators.v1'
const OVERRIDE_KEY='limoxis.indicatorOverrides.v1'
const DELETED_KEY='limoxis.deletedIndicators.v1'

function read(key,fallback){
 try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch{return fallback}
}
function write(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{/* ignore: best-effort, falls back to defaults */}return value}

export function loadCustomIndicators(){const rows=read(CUSTOM_KEY,[]);return Array.isArray(rows)?rows:[]}
export function saveCustomIndicators(rows){return write(CUSTOM_KEY,rows)}
export function nextCustomIndicatorId(rows=[]){
 const max=rows.reduce((m,x)=>Math.max(m,Number(String(x.id||'').match(/CUSTOM-(\d+)/)?.[1]||0)),0)
 return `CUSTOM-${String(max+1).padStart(3,'0')}`
}

export function loadIndicatorOverrides(){const rows=read(OVERRIDE_KEY,{});return rows&&typeof rows==='object'&&!Array.isArray(rows)?rows:{}}
export function saveIndicatorOverride(id,definition){
 const current=loadIndicatorOverrides()
 current[id]={...definition,id,updatedAt:new Date().toISOString()}
 return write(OVERRIDE_KEY,current)
}
export function deleteIndicatorOverride(id){
 const current=loadIndicatorOverrides();delete current[id];return write(OVERRIDE_KEY,current)
}
export function loadDeletedIndicatorIds(){const rows=read(DELETED_KEY,[]);return Array.isArray(rows)?rows:[]}
export function markIndicatorDeleted(id){return write(DELETED_KEY,[...new Set([...loadDeletedIndicatorIds(),id])])}
export function restoreIndicator(id){return write(DELETED_KEY,loadDeletedIndicatorIds().filter(x=>x!==id))}
