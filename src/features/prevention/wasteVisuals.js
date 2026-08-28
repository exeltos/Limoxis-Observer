export function wasteCategoryTone(value=''){
 const code=String(value).trim().toUpperCase()
 if(code==='ΕΑΑΜ')return 'eaam'
 if(code==='ΜΕΑ')return 'mea'
 if(code==='ΑΕΑ')return 'aea'
 return 'other'
}
export function wasteCategoryLabel(value=''){return String(value||'—')}
