// Root cause analysis of a CAPA: the problem, a 5 Whys chain, and an Ishikawa
// (fishbone) diagram with the categories used in healthcare. The conclusion
// is the root cause the corrective action has to remove.

export const ISHIKAWA_CATEGORIES=[
 ['people','Προσωπικό','People'],
 ['methods','Διαδικασίες / πρωτόκολλα','Methods / protocols'],
 ['equipment','Εξοπλισμός','Equipment'],
 ['materials','Υλικά / φάρμακα','Materials / medicines'],
 ['environment','Περιβάλλον / χώρος','Environment'],
 ['communication','Επικοινωνία / οργάνωση','Communication / organisation'],
]
export const WHY_COUNT=5

export function emptyAnalysis(){
 return {problem:'',whys:Array(WHY_COUNT).fill(''),causes:Object.fromEntries(ISHIKAWA_CATEGORIES.map(([key])=>[key,[]])),rootCause:'',updatedAt:'',updatedBy:''}
}

// Fills gaps of a stored (or missing) analysis, so the form always has every field.
export function normalizeAnalysis(value){
 const base=emptyAnalysis()
 if(!value||typeof value!=='object')return base
 const whys=Array.isArray(value.whys)?value.whys.map(String):[]
 return {
  ...base,...value,
  whys:Array.from({length:WHY_COUNT},(_,i)=>whys[i]||''),
  causes:Object.fromEntries(ISHIKAWA_CATEGORIES.map(([key])=>[key,Array.isArray(value.causes?.[key])?value.causes[key].map(String).filter(Boolean):[]])),
 }
}

export function analysisProgress(value){
 const analysis=normalizeAnalysis(value)
 const whys=analysis.whys.filter(w=>w.trim()).length
 const causes=ISHIKAWA_CATEGORIES.reduce((sum,[key])=>sum+analysis.causes[key].length,0)
 return {whys,causes,concluded:Boolean(analysis.rootCause.trim()),started:Boolean(analysis.problem.trim()||whys||causes||analysis.rootCause.trim())}
}

// Trims what was typed; empty answers after the last filled one are dropped.
export function cleanAnalysis(value,{actorName='',now=new Date().toISOString()}={}){
 const analysis=normalizeAnalysis(value)
 return {
  ...analysis,
  problem:analysis.problem.trim(),
  whys:analysis.whys.map(w=>w.trim()),
  causes:Object.fromEntries(Object.entries(analysis.causes).map(([key,list])=>[key,list.map(c=>c.trim()).filter(Boolean)])),
  rootCause:analysis.rootCause.trim(),
  updatedAt:now,
  updatedBy:actorName,
 }
}
