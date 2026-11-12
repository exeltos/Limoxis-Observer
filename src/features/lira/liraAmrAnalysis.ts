import type { AnyRecord } from '../../types/featureTypes'
const normalize=(value: unknown)=>String(value||'').trim().toLocaleLowerCase('en-US')
const dateOnly=(value: unknown)=>value?String(value).slice(0,10):null
const inRange=(value: unknown,from: string|null,to: string|null)=>{const d=dateOnly(value);return Boolean(d)&&(!from||d!>=from)&&(!to||d!<=to)}
const patientKey=(row: AnyRecord)=>row.patientId||row.patientCode||row.patient||null
const isolateDate=(row: AnyRecord)=>dateOnly(row.collectedAt||row.resultedAt||row.signalDate)

// Επιλογές της ανάλυσης αντοχής (AMR).
export interface AmrOptions { from?: string|null; to?: string|null; department?: string|null; organism?: string|null; antimicrobial?: string|null; deduplication?: string; minimumIsolates?: number|null; specimen?: string|null }
export function buildDeterministicAmrAnalysis(rows: AnyRecord[]|null=[],{
 from=null,to=null,department='all',organism=null,antimicrobial=null,
 deduplication='first_patient_organism_period',minimumIsolates=null,specimen=null,
}: AmrOptions={}){
 const eligible=(rows||[]).filter(row=>
   row?.validationStatus!=='draft'&&
   (!department||department==='all'||row.department===department)&&
   (!organism||normalize(row.organism).includes(normalize(organism)))&&
   (!specimen||normalize(row.specimenType)===normalize(specimen))&&
   inRange(row.collectedAt||row.resultedAt||row.signalDate,from,to)
 )
 const seen=new Set<string>(),isolates: AnyRecord[]=[]
 for(const row of [...eligible].sort((a,b)=>String(isolateDate(a)||'').localeCompare(String(isolateDate(b)||'')))){
   const p=patientKey(row)
   const key=deduplication==='none'?String(row.resultId||row.id):[p||row.resultId||row.id,normalize(row.organism)].join('|')
   if(seen.has(key))continue;seen.add(key);isolates.push(row)
 }
 const byAntimicrobial=new Map<string,{antimicrobialCode: string|null; antimicrobialName: string; tested: number; resistant: number; intermediate: number; susceptible: number; breakpointVersions: Set<string>}>()
 for(const isolate of isolates)for(const ast of isolate.ast||[]){
   if(antimicrobial&&normalize(ast.antimicrobialName)!==normalize(antimicrobial)&&normalize(ast.antimicrobialCode)!==normalize(antimicrobial))continue
   if(!['S','I','R'].includes(ast.sirCategory))continue
   const key=ast.antimicrobialCode||ast.antimicrobialName
   const bucket=byAntimicrobial.get(key)||{antimicrobialCode:ast.antimicrobialCode||null,antimicrobialName:ast.antimicrobialName||key,tested:0,resistant:0,intermediate:0,susceptible:0,breakpointVersions:new Set()}
   bucket.tested++;bucket.resistant+=ast.sirCategory==='R'?1:0;bucket.intermediate+=ast.sirCategory==='I'?1:0;bucket.susceptible+=ast.sirCategory==='S'?1:0
   if(ast.breakpointStandard||ast.breakpointVersion)bucket.breakpointVersions.add([ast.breakpointStandard,ast.breakpointVersion].filter(Boolean).join(' '))
   byAntimicrobial.set(key,bucket)
 }
 const results=[...byAntimicrobial.values()].map(x=>{const suppressed=Number.isFinite(minimumIsolates)&&minimumIsolates!>0&&x.tested<minimumIsolates!;return {...x,breakpointVersions:[...x.breakpointVersions],resistancePercent:suppressed?null:(x.tested?Math.round(x.resistant/x.tested*1000)/10:null),suppressed}})
 return {method:'deterministic',from,to,department,organism,specimen,deduplication,minimumIsolates,eligibleRows:eligible.length,includedIsolates:isolates.length,results:results.sort((a,b)=>b.tested-a.tested||a.antimicrobialName.localeCompare(b.antimicrobialName)),guardrails:{recalculatesSir:false,usesRecordedSir:true,smallSampleSuppression:Number.isFinite(minimumIsolates)&&minimumIsolates!>0}}
}


export function buildHospitalAntibiogram(rows: AnyRecord[]=[],options: AmrOptions={}){
 const base=buildDeterministicAmrAnalysis(rows,options)
 const organisms=[...new Set((rows||[]).map(x=>x.organism).filter(Boolean))].sort((a,b)=>a.localeCompare(b))
 const matrix=organisms.map(organism=>({organism,...(buildDeterministicAmrAnalysis(rows,{...options,organism}) as AnyRecord)}))
 return {...base,reportType:'hospital_antibiogram',scope:{from:base.from,to:base.to,department:base.department,specimen:base.specimen||null},organisms:matrix,methodology:{deduplication:base.deduplication,minimumIsolates:base.minimumIsolates,percentage:'R / tested × 100',sirSource:'recorded laboratory interpretation',breakpointProvenance:'preserved per antimicrobial',externalSurveillanceUsed:false}}
}

export function compareAmrPeriods(rows: AnyRecord[]|null=[],current: AmrOptions|AnyRecord={},previous: AmrOptions|AnyRecord={},options: AmrOptions={}){
 const now=buildDeterministicAmrAnalysis(rows,{...options,...current})
 const before=buildDeterministicAmrAnalysis(rows,{...options,...previous})
 const prior=new Map(before.results.map(x=>[x.antimicrobialCode||x.antimicrobialName,x]))
 return {...now,comparison:{current:{from:now.from,to:now.to},previous:{from:before.from,to:before.to},results:now.results.map(x=>{const p=prior.get(x.antimicrobialCode||x.antimicrobialName);const comparable=x.resistancePercent!=null&&p?.resistancePercent!=null;return {antimicrobialCode:x.antimicrobialCode,antimicrobialName:x.antimicrobialName,currentTested:x.tested,previousTested:p?.tested||0,currentResistancePercent:x.resistancePercent,previousResistancePercent:p?.resistancePercent??null,percentagePointChange:comparable?Math.round((x.resistancePercent!-p!.resistancePercent!)*10)/10:null,comparable}})}}
}
