// Empty-hospital preview: the help-preview frame opened with ?helpEmpty=1
// starts the sample hospital without its sample records (patients, cases,
// samples, employees, controls, quality, kitchen, …). The departments, the
// demo user and the product's reference libraries stay, so every screen can
// be checked as a newly set-up hospital sees it (tools/capture-screen-matrix.mjs).
// Only inside the help-preview iframe; real sessions and the Demo never see it.

// Decided once, from the address the app was opened with: navigating inside
// the preview drops the query string.
let emptyPreview
export function isEmptyPreview(){
 if(emptyPreview===undefined){
  if(typeof window==='undefined'||window.self===window.top)emptyPreview=false
  else{const params=new URLSearchParams(window.location.search);emptyPreview=params.get('helpPreview')==='1'&&params.get('helpEmpty')==='1'}
 }
 return emptyPreview
}

// Empties a sample-data list (or keyed map) in place in the empty preview, so
// every screen and summary that reads it starts with no records.
export function emptyInPreview(collection){
 if(!collection||!isEmptyPreview())return collection
 if(Array.isArray(collection))collection.splice(0)
 else for(const key of Object.keys(collection))delete collection[key]
 return collection
}
