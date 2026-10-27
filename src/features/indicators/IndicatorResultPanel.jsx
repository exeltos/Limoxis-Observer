import { useEffect,useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DetailList } from '../../design-system/DetailList'
import { loadRiskAssessments } from '../quality/risk/riskService'
import { levelLabel,scored } from '../quality/risk/riskModel'
import { calculateCloudDefinition,collectCloudIndicatorMetrics,loadIndicatorSnapshots,loadOperationalIndicatorDefinitions } from './indicatorCloudService'

const monthStart=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`}
const today=()=>new Date().toISOString().slice(0,10)
const fmtDay=value=>{const [y,m,d]=String(value||'').slice(0,10).split('-');return y&&m&&d?`${Number(d)}/${Number(m)}/${y}`:'—'}
const fmtNumber=(value,el)=>value==null||value===''||!Number.isFinite(Number(value))?'—':new Intl.NumberFormat(el?'el-GR':'en-GB',{maximumFractionDigits:2}).format(Number(value))
const STATUS={onTarget:['Εντός στόχου','On target','active'],attention:['Χρειάζεται προσοχή','Needs attention','danger'],context:['Παρακολούθηση','Monitoring','']}
const SNAPSHOT_STATUS={approved:['Εγκρίθηκε','Approved'],reviewed:['Ελέγχθηκε','Reviewed'],calculated:['Υπολογίστηκε','Calculated'],draft:['Πρόχειρο','Draft'],retired:['Αποσύρθηκε','Retired']}

// The indicator's result for the period the user came from (the registry's
// period, or this month so far), with its target, and the approved results kept
// over time. Opening an indicator shows what it measures before how it is defined.
export function IndicatorResultPanel({organizationId,record,period,language}){
 const el=language!=='en'
 const from=period?.from||monthStart(),to=period?.to||today(),departmentId=period?.departmentId||null
 const navigate=useNavigate()
 const [state,setState]=useState({loading:true,result:null,history:[],error:false})
 // The risks of the latest assessment that name this indicator as their measure.
 const [risks,setRisks]=useState({assessment:null,list:[]})
 useEffect(()=>{
  let active=true
  if(!organizationId||!record?.id)return()=>{active=false}
  loadRiskAssessments(organizationId).then(all=>{if(!active)return;const latest=(all||[]).find(a=>a.status!=='archived')||(all||[])[0];setRisks({assessment:latest||null,list:(latest?.risks||[]).filter(r=>(r.indicatorKeys||[]).includes(record.id))})}).catch(()=>{if(active)setRisks({assessment:null,list:[]})})
  return()=>{active=false}
 },[organizationId,record?.id])
 useEffect(()=>{
  let active=true
  if(!organizationId||!record)return()=>{active=false}
  setState(current=>({...current,loading:true}))
  Promise.all([
   collectCloudIndicatorMetrics(organizationId,{from,to,departmentId}),
   loadOperationalIndicatorDefinitions(organizationId,{from,to}),
   loadIndicatorSnapshots(organizationId,{departmentId}),
  ]).then(([metrics,definitions,snapshots])=>{
   if(!active)return
   const definition=definitions.find(d=>d.definitionId===record.id)||definitions.find(d=>d.id===record.key)
   setState({loading:false,error:false,result:definition?calculateCloudDefinition(definition,metrics||{}):null,history:(snapshots||[]).filter(s=>s.indicator_key===record.key).sort((a,b)=>String(b.period_start).localeCompare(String(a.period_start)))})
  }).catch(()=>{if(active)setState({loading:false,error:true,result:null,history:[]})})
  return()=>{active=false}
 },[organizationId,record,from,to,departmentId])
 const result=state.result,unit=result?(el?result.unit:result.unitEn):''
 const status=STATUS[result?.status]||STATUS.context
 const target=result?.target==null?'—':`${result.direction==='lower'?'≤ ':result.direction==='higher'?'≥ ':''}${fmtNumber(result.target,el)}${unit?` ${unit}`:''}`
 return <div className="indicator-result">
  <section className="record-section">
   <div className="record-section-header"><div><h3>{el?'Αποτέλεσμα περιόδου':'Result for the period'}</h3><p>{fmtDay(from)} – {fmtDay(to)}{departmentId?` · ${departmentId}`:` · ${el?'Όλο το νοσοκομείο':'Whole hospital'}`}</p></div></div>
   {state.loading?<div className="inline-empty">{el?'Υπολογισμός…':'Calculating…'}</div>
    :state.error?<div className="data-access-state error" role="alert">{el?'Δεν ήταν δυνατός ο υπολογισμός του δείκτη.':'Could not calculate the indicator.'}</div>
    :!result?<div className="inline-empty">{el?'Ο δείκτης δεν είναι ενεργός για αυτή την περίοδο.':'The indicator is not active for this period.'}</div>
    :<>
     <p className="quality-summary-line"><span><b>{fmtNumber(result.value,el)}</b> {unit}</span><span className={result.status==='attention'?'is-late':undefined}>{status[el?0:1].toLowerCase()}</span><span>{el?'στόχος':'target'} <b>{target}</b></span><span><b>{state.history.filter(h=>h.status==='approved').length}</b> {el?'εγκεκριμένα αποτελέσματα':'approved results'}</span><span><b>{risks.list.length}</b> {el?'κίνδυνοι':'risks'}</span></p>
     <DetailList sections={[{title:el?'Υπολογισμός':'Calculation',items:[{label:el?'Αριθμητής / παρονομαστής':'Numerator / denominator',value:result.evidence},{label:el?'Μονάδα':'Unit',value:unit}]}]}/>
    </>}
  </section>
  {risks.list.length>0&&<section className="record-section">
   <div className="record-section-header"><div><h3>{el?'Κίνδυνοι που παρακολουθεί ο δείκτης':'Risks this indicator monitors'}</h3><p>{risks.assessment?.periodLabel||''}</p></div></div>
   <div className="scroll-table"><table className="data-table"><thead><tr><th>{el?'Κίνδυνος':'Risk'}</th><th>{el?'Υπολειπόμενος':'Residual'}</th></tr></thead><tbody>
    {risks.list.map(r=><tr key={r.lineageKey} className="is-clickable" tabIndex={0} onClick={()=>navigate(`/quality/risks/${risks.assessment.code}/${r.lineageKey}`)} onKeyDown={e=>{if(e.key==='Enter')navigate(`/quality/risks/${risks.assessment.code}/${r.lineageKey}`)}}><td><strong>{r.hazard}</strong><small>{[r.process,r.scope].filter(Boolean).join(' · ')}</small></td><td>{levelLabel(scored(r).residual.level,!el)}</td></tr>)}
   </tbody></table></div>
  </section>}
  <section className="record-section">
   <div className="record-section-header"><div><h3>{el?'Εγκεκριμένα αποτελέσματα':'Approved results'}</h3><p>{el?'Τα αποτελέσματα που αποθηκεύτηκαν και εγκρίθηκαν από τη λίστα δεικτών, ανά περίοδο.':'Results saved and approved from the indicators list, by period.'}</p></div></div>
   {state.history.length?<div className="scroll-table"><table className="data-table"><thead><tr><th>{el?'Περίοδος':'Period'}</th><th>{el?'Αποτέλεσμα':'Result'}</th><th>{el?'Αριθμητής / παρονομαστής':'Numerator / denominator'}</th><th>{el?'Στόχος':'Target'}</th><th>{el?'Κατάσταση':'Status'}</th></tr></thead><tbody>
    {state.history.map(s=><tr key={s.id}><td>{fmtDay(s.period_start)} – {fmtDay(s.period_end)}</td><td><strong>{fmtNumber(s.value,el)}</strong> {s.unit||''}</td><td>{s.denominator==null?fmtNumber(s.numerator,el):`${fmtNumber(s.numerator,el)} / ${fmtNumber(s.denominator,el)}`}</td><td>{fmtNumber(s.target_value,el)}</td><td><span className={`status-badge ${s.status==='approved'?'active':''}`}>{(SNAPSHOT_STATUS[s.status]||[s.status,s.status])[el?0:1]}</span></td></tr>)}
   </tbody></table></div>:<div className="inline-empty">{el?'Δεν υπάρχουν ακόμη αποθηκευμένα αποτελέσματα για αυτόν τον δείκτη.':'No saved results for this indicator yet.'}</div>}
  </section>
 </div>
}
