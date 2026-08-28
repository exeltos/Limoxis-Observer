const KEY='limoxis.customIndicators.v1'
export function loadCustomIndicators(){
 try{const raw=localStorage.getItem(KEY);const rows=raw?JSON.parse(raw):[];return Array.isArray(rows)?rows:[]}catch{return []}
}
export function saveCustomIndicators(rows){try{localStorage.setItem(KEY,JSON.stringify(rows))}catch{}return rows}
export function nextCustomIndicatorId(rows=[]){
 const max=rows.reduce((m,x)=>Math.max(m,Number(String(x.id||'').match(/CUSTOM-(\d+)/)?.[1]||0)),0)
 return `CUSTOM-${String(max+1).padStart(3,'0')}`
}
