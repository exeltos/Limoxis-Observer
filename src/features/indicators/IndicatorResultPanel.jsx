import { useEffect,useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDownRight,ArrowUpRight,Minus } from 'lucide-react'
import { Sparkline } from '../../design-system/MiniCharts'
import { indicatorMetricLabel } from './IndicatorDefinitionForm'
import { loadRiskAssessments } from '../quality/risk/riskService'
import { levelLabel,scored } from '../quality/risk/riskModel'
import { calculateCloudDefinition,collectCloudIndicatorMetrics,loadIndicatorSnapshots,loadOperationalIndicatorDefinitions } from './indicatorCloudService'

const monthStart=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`}
const today=()=>new Date().toISOString().slice(0,10)
const fmtDay=value=>{const [y,m,d]=String(value||'').slice(0,10).split('-');return y&&m&&d?`${Number(d)}/${Number(m)}/${y}`:'—'}
const fmtNumber=(value,el)=>value==null||value===''||!Number.isFinite(Number(value))?'—':new Intl.NumberFormat(el?'el-GR':'en-GB',{maximumFractionDigits:2}).format(Number(value))
const STATUS={onTarget:['Εντός στόχου','On target','active'],attention:['Χρειάζεται προσοχή','Needs attention','danger'],context:['Παρακολούθηση','Monitoring','']}
// Calendar days of a period, the equal period before it, the same period a year earlier, the last twelve months.
const parseDay=value=>new Date(`${String(value).slice(0,10)}T00:00:00Z`)
const isoDay=date=>date.toISOString().slice(0,10)
const addDays=(value,days)=>{const date=parseDay(value);date.setUTCDate(date.getUTCDate()+days);return isoDay(date)}
const shiftYear=(value,years)=>{const date=parseDay(value);date.setUTCFullYear(date.getUTCFullYear()+years);return isoDay(date)}
const previousPeriod=(from,to)=>{const length=Math.round((parseDay(to)-parseDay(from))/86400000)+1;return {from:addDays(from,-length),to:addDays(from,-1)}}
function lastMonths(to,count=12){const end=parseDay(to),list=[];for(let back=count-1;back>=0;back-=1){const first=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()-back,1)),last=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()-back+1,0));list.push({from:isoDay(first),to:isoDay(back===0&&parseDay(to)<last?parseDay(to):last)})}return list}
const SNAPSHOT_STATUS={approved:['Εγκρίθηκε','Approved'],reviewed:['Ελέγχθηκε','Reviewed'],calculated:['Υπολογίστηκε','Calculated'],draft:['Πρόχειρο','Draft'],retired:['Αποσύρθηκε','Retired']}

// The indicator's result for the period the user came from (the registry's
// period, or this month so far), with its target, and the approved results kept
// over time. Opening an indicator shows what it measures before how it is defined.
export function IndicatorResultPanel({organizationId,record,period,language}){
 const el=language!=='en'
 const from=period?.from||monthStart(),to=period?.to||today(),departmentId=period?.departmentId||null
 const navigate=useNavigate()
 const [state,setState]=useState({loading:true,result:null,previous:null,lastYear:null,series:[],definition:null,history:[],error:false})
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
  const before=previousPeriod(from,to),yearAgo={from:shiftYear(from,-1),to:shiftYear(to,-1)},months=lastMonths(to)
  const metricsFor=range=>collectCloudIndicatorMetrics(organizationId,{from:range.from,to:range.to,departmentId}).catch(()=>null)
  Promise.all([
   collectCloudIndicatorMetrics(organizationId,{from,to,departmentId}),
   loadOperationalIndicatorDefinitions(organizationId,{from,to}),
   loadIndicatorSnapshots(organizationId,{departmentId}),
   metricsFor(before),metricsFor(yearAgo),Promise.all(months.map(metricsFor)),
  ]).then(([metrics,definitions,snapshots,beforeMetrics,yearAgoMetrics,monthMetrics])=>{
   if(!active)return
   const definition=definitions.find(d=>d.definitionId===record.id)||definitions.find(d=>d.id===record.key)
   const valueOf=data=>(definition&&data?calculateCloudDefinition(definition,data).value:null)
   setState({loading:false,error:false,definition,result:definition?calculateCloudDefinition(definition,metrics||{}):null,previous:valueOf(beforeMetrics),lastYear:valueOf(yearAgoMetrics),series:monthMetrics.map(valueOf),history:(snapshots||[]).filter(s=>s.indicator_key===record.key).sort((a,b)=>String(b.period_start).localeCompare(String(a.period_start)))})
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
     <div className="indicator-result-hero">
      <div className="indicator-result-value"><strong>{result.value==null?(el?'Χωρίς δεδομένα':'No data'):fmtNumber(result.value,el)}</strong>{result.value!=null&&unit&&<span>{unit}</span>}</div>
      <div className="indicator-result-facts">
       <span><small>{el?'Στόχος':'Target'}</small><b>{target}</b></span>
       <span><small>{el?'Κατάσταση':'Status'}</small><b className={result.status==='attention'?'is-late':result.status==='onTarget'?'is-good':undefined}>{result.target==null?(el?'Χωρίς στόχο':'No target'):status[el?0:1]}</b></span>
       <span><small>{el?'Έναντι προηγούμενης περιόδου':'Against the previous period'}</small><Change now={result.value} then={state.previous} direction={result.direction} el={el}/></span>
       <span><small>{el?'Έναντι ίδιας περιόδου πέρσι':'Against the same period last year'}</small><Change now={result.value} then={state.lastYear} direction={result.direction} el={el}/></span>
      </div>
     </div>
     <div className="indicator-result-trend"><small>{el?'Τελευταίοι 12 μήνες':'The last 12 months'}</small>{state.series.filter(value=>value!=null).length>1?<Sparkline width={560} height={92} points={state.series} target={result.target==null?null:Number(result.target)} label={el?'Τάση 12 μηνών':'12-month trend'}/>:<span className="indicator-result-empty">{el?'Δεν υπάρχουν αρκετά δεδομένα για τάση.':'Not enough data for a trend.'}</span>}</div>
     <p className="indicator-result-formula"><small>{el?'Πώς υπολογίζεται':'How it is calculated'}</small>{formulaText(state.definition,result,el)}</p>
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

// «+1,2» or «−0,4» against an earlier period, green when it is better for the indicator, red when worse.
function Change({now,then,direction,el}){
 if(now==null||then==null)return <b>—</b>
 const delta=Number((Number(now)-Number(then)).toFixed(2))
 if(delta===0)return <b className="indicator-change"><Minus size={13}/>0</b>
 const better=direction==='lower'?delta<0:direction==='higher'?delta>0:null
 const Icon=delta>0?ArrowUpRight:ArrowDownRight
 return <b className={`indicator-change${better===true?' is-better':better===false?' is-worse':''}`}><Icon size={13}/>{delta>0?'+':'−'}{fmtNumber(Math.abs(delta),el)}</b>
}
// «84 patients with an infection ÷ 1,245 study patients × 100 = 6,7 %»: the calculation in words, then with the numbers.
function formulaText(definition,result,el){
 if(!definition)return ''
 if(definition.calculation==='manual')return el?'Η τιμή καταχωρίζεται χειροκίνητα από τον υπεύθυνο.':'The value is entered by hand by the person responsible.'
 const words=[indicatorMetricLabel(definition.numerator,el?'el':'en'),definition.denominator?`÷ ${indicatorMetricLabel(definition.denominator,el?'el':'en')}`:'',definition.denominator&&Number(definition.multiplier||1)!==1?`× ${fmtNumber(definition.multiplier,el)}`:''].filter(Boolean).join(' ')
 const numbers=[fmtNumber(result.numerator,el),definition.denominator?`÷ ${fmtNumber(result.denominator,el)}`:'',definition.denominator&&Number(definition.multiplier||1)!==1?`× ${fmtNumber(definition.multiplier,el)}`:''].filter(Boolean).join(' ')
 return `${words} (${numbers})`
}
