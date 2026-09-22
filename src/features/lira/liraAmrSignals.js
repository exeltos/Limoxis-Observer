import {compareAmrPeriods} from './liraAmrAnalysis'

const normalize=value=>String(value||'').trim().toLocaleLowerCase('en-US')
const departmentOf=row=>row?.department||'—'

export function buildAmrChangeSignals(rows=[],current={},previous={},options={}){
 const departments=options.department&&options.department!=='all'?[options.department]:[...new Set((rows||[]).map(departmentOf).filter(x=>x&&x!=='—'))]
 const signals=[]
 for(const department of departments){
  const result=compareAmrPeriods(rows,current,previous,{...options,department})
  for(const item of result.comparison.results){
   if(!item.comparable||item.percentagePointChange===0)continue
   signals.push({department,organism:options.organism||null,antimicrobialCode:item.antimicrobialCode,antimicrobialName:item.antimicrobialName,currentTested:item.currentTested,previousTested:item.previousTested,currentResistancePercent:item.currentResistancePercent,previousResistancePercent:item.previousResistancePercent,percentagePointChange:item.percentagePointChange,direction:item.percentagePointChange>0?'increase':'decrease',interpretation:'observed_change',outbreak:false})
  }
 }
 signals.sort((a,b)=>Math.abs(b.percentagePointChange)-Math.abs(a.percentagePointChange)||b.currentTested-a.currentTested)
 return {method:'deterministic_amr_change',current,previous,signals,guardrails:{outbreakDeclaration:false,clinicalCausality:false,usesRecordedSir:true,requiresEpidemiologicalReview:true,rankingMeaning:'absolute percentage-point change; not clinical severity'}}
}

export function buildAmrConcentrationSignals(rows=[],{from=null,to=null,organism=null,antimicrobial=null,minimumIsolates=null}={}){
 const relevant=(rows||[]).filter(row=>(!organism||normalize(row.organism).includes(normalize(organism)))&&(!from||String(row.collectedAt||row.resultedAt||'').slice(0,10)>=from)&&(!to||String(row.collectedAt||row.resultedAt||'').slice(0,10)<=to))
 const departments=[...new Set(relevant.map(departmentOf).filter(x=>x&&x!=='—'))]
 const distributions=departments.map(department=>{const patients=new Set(),isolates=[];for(const row of relevant.filter(x=>departmentOf(x)===department)){if(row.patientId)patients.add(row.patientId);const ast=(row.ast||[]).filter(x=>!antimicrobial||normalize(x.antimicrobialName)===normalize(antimicrobial)||normalize(x.antimicrobialCode)===normalize(antimicrobial));if(!antimicrobial||ast.some(x=>x.sirCategory==='R'))isolates.push(row)}return {department,isolateRecords:isolates.length,uniquePatients:patients.size}}).filter(x=>x.isolateRecords>0).sort((a,b)=>b.isolateRecords-a.isolateRecords)
 return {method:'descriptive_spatial_concentration',from,to,organism,antimicrobial,minimumIsolates,distributions,guardrails:{outbreakDeclaration:false,transmissionInference:false,thresholdInvented:false,note:'Descriptive concentration only; temporal/spatial epidemiology and infection-control review are required.'}}
}
