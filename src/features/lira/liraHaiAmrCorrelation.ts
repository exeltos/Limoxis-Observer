import type { LiraData, LiraDeviceRow, LiraHaiRow, LiraIsolationRow, LiraLabRow } from './liraTypes'
const day=(value: unknown)=>value?String(value).slice(0,10):null
const between=(value: unknown,from: string|null,to: string|null)=>{const d=day(value);return Boolean(d)&&(!from||d!>=from)&&(!to||d!<=to)}
const overlaps=(start: unknown,end: unknown,point: unknown)=>{const d=day(point)!,a=day(start),b=day(end);return Boolean(d)&&(!a||a<=d)&&(!b||b>=d)}
const same=(a: unknown,b: unknown)=>a&&b&&String(a)===String(b)

export function buildHaiAmrCorrelations(data: LiraData={}, {from=null,to=null,department='all',organism=null}: {from?: string|null; to?: string|null; department?: string|null; organism?: string|null}={}){
 const labs: LiraLabRow[]=(data.laboratory||[]).filter((x: LiraLabRow)=>between(x.collectedAt||x.resultedAt,from,to)&&(!department||department==='all'||x.department===department)&&(!organism||String(x.organism||'').toLowerCase().includes(String(organism).toLowerCase())))
 const hai: LiraHaiRow[]=(data.haiClassifications||[]).filter((x: LiraHaiRow)=>between(x.classifiedAt||x.signalDate,from,to)&&(!department||department==='all'||x.department===department))
 const devices: LiraDeviceRow[]=data.devices||[],isolations: LiraIsolationRow[]=data.isolations||[]
 const correlations=[]
 for(const lab of labs){
  const patientHai=hai.filter(x=>same(x.patientId,lab.patientId))
  for(const event of patientHai){
   const deviceExposure=devices.filter(x=>same(x.patientId,lab.patientId)&&same(x.department,lab.department)&&overlaps(x.insertedAt,x.removedAt,lab.collectedAt||lab.resultedAt)).map(x=>({id:x.id,deviceType:x.deviceType,insertedAt:x.insertedAt,removedAt:x.removedAt}))
   const isolation=isolations.filter(x=>same(x.patientId,lab.patientId)&&overlaps(x.startedAt,x.endedAt,lab.collectedAt||lab.resultedAt)).map(x=>({id:x.id,status:x.status,startedAt:x.startedAt,endedAt:x.endedAt}))
   correlations.push({patientId:lab.patientId,department:lab.department,organism:lab.organism,labResultId:lab.resultId||lab.id,labDate:day(lab.collectedAt||lab.resultedAt),haiId:event.id,haiType:event.haiType,haiDate:day(event.classifiedAt||event.signalDate),sameDepartment:same(event.department,lab.department),deviceExposure,isolation,interpretation:'record_linkage',causality:false,transmission:false})
  }
 }
 return {method:'deterministic_record_linkage',from,to,department,organism,correlations,guardrails:{causality:false,transmissionInference:false,outbreakDeclaration:false,diagnosisInference:false,note:'Shared patient, time, department, device or isolation context is correlation evidence only and requires epidemiological/clinical review.'}}
}
