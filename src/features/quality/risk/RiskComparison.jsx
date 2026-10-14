import { useMemo,useState } from 'react'
import { AlertOctagon,AlertTriangle,ArrowDownRight,ArrowRight,ArrowUpRight,ChevronRight,ClipboardList,Gauge } from 'lucide-react'
import { MetricCard } from '../../../design-system/MetricCard'
import { compareAssessments,levelForScore,periodName,periodOf,riskTrend,scored } from './riskModel'
import { L,LevelChip,LevelLegend,RiskHeatMap,defaultFrame,fmtDate,returnedClass,txt,usePaged } from './riskUi'
import { LevelCounts,num } from './RiskAnalysis'

const STATUS={improved:['Βελτιώθηκε','Improved','active'],worsened:['Χειροτέρεψε','Worsened','danger'],unchanged:['Αμετάβλητος','Unchanged',''],new:['Νέος','New','warning'],removed:['Αφαιρέθηκε','Removed','']}
const label=(id,en)=>STATUS[id][en?1:0]
const round=value=>Math.round(value*10)/10

function Delta({value,lowerIsBetter=true,en}){
 if(value==null||Number.isNaN(value))return <span className="risk-delta">—</span>
 const good=lowerIsBetter?value<0:value>0,Icon=value===0?ArrowRight:value>0?ArrowUpRight:ArrowDownRight
 return <span className={`risk-delta${value===0?'':good?' is-better':' is-worse'}`}><Icon size={13}/>{value>0?'+':''}{num(round(value),en)}</span>
}

// What moved on a risk between the two periods: likelihood and/or consequence.
function AxisChange({row,en}){
 if(!row.previous||row.status==='new'||row.status==='removed')return <span className="risk-axis-none">—</span>
 const now=scored(row.risk).residual,then=scored(row.previous).residual
 const parts=[['L',then.l,now.l],['C',then.c,now.c]].filter(([,a,b])=>a!==b&&a!=null&&b!=null)
 if(!parts.length)return <span className="risk-axis-none">{L(en,'Καμία αλλαγή','No change')}</span>
 return <span className="risk-axis-change">{parts.map(([axis,a,b])=><span key={axis} className={b<a?'is-better':'is-worse'}><b>{axis}</b> {a} → {b}</span>)}</span>
}

// The residual average and the high / very high count over every period.
function TrendChart({trend,en,currentId}){
 const W=640,H=200,P={l:34,r:34,t:16,b:34}
 const max=Math.max(1,...trend.map(p=>p.highOrAbove))
 const x=i=>P.l+24+(trend.length===1?0:i*(W-P.l-P.r-48)/(trend.length-1))
 const yAvg=v=>P.t+(1-(v||0)/25)*(H-P.t-P.b)
 const yHigh=v=>P.t+(1-v/max)*(H-P.t-P.b)
 const line=(fn,key)=>trend.map((p,i)=>`${i?'L':'M'}${x(i)},${fn(p[key])}`).join(' ')
 return <figure className="risk-trend-chart">
  <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={L(en,'Πορεία του υπολειπόμενου κινδύνου','Course of the residual risk')}>
   {[0,5,10,15,20,25].map(v=><g key={v}><line x1={P.l} x2={W-P.r} y1={yAvg(v)} y2={yAvg(v)} className="grid"/><text x={P.l-6} y={yAvg(v)+3} textAnchor="end">{v}</text></g>)}
   <path d={line(yHigh,'highOrAbove')} className="line-high"/>
   <path d={line(yAvg,'residualAverage')} className="line-avg"/>
   {trend.map((p,i)=><g key={p.id} className={p.id===currentId?'is-current':''}>
    <circle cx={x(i)} cy={yHigh(p.highOrAbove)} r="4" className="dot-high"/>
    <circle cx={x(i)} cy={yAvg(p.residualAverage)} r="4.5" className="dot-avg"/>
    <text x={x(i)} y={yAvg(p.residualAverage)-9} textAnchor="middle" className="value">{num(p.residualAverage,en)}</text>
    <text x={x(i)} y={H-12} textAnchor="middle" className="period">{p.label}</text>
   </g>)}
   <text x={W-P.r+6} y={yHigh(max)+3} className="axis-high">{max}</text>
   <text x={W-P.r+6} y={yHigh(0)+3} className="axis-high">0</text>
  </svg>
  <figcaption><span><i className="key-avg"/>{L(en,'Μέσος υπολειπόμενος (αριστερός άξονας)','Average residual (left axis)')}</span><span><i className="key-high"/>{L(en,'Υψηλοί και πολύ υψηλοί (δεξιός άξονας)','High and very high (right axis)')}</span></figcaption>
 </figure>
}

const byDateDesc=(a,b)=>String(b.assessedOn).localeCompare(String(a.assessedOn))

// Any two assessments side by side, ticked freely in the course table (2026
// with 2024, a half-year with another), and the course over every period.
export function RiskComparison({assessment,assessments,en,locale,onOpen,actions=null,returned='',frame=defaultFrame}){
 const all=useMemo(()=>[...(assessments.some(a=>a.id===assessment.id)?assessments:[assessment,...assessments])].sort(byDateDesc),[assessments,assessment])
 const fallback=all.find(a=>a.id===assessment.sourceAssessmentId)||all.find(a=>a.id!==assessment.id&&String(a.assessedOn)<String(assessment.assessedOn))||all.find(a=>a.id!==assessment.id)
 // The two periods ticked in the course table, last ticked last: the newer one
 // is compared with the older. Ticking a third drops the one ticked first.
 const [picked,setPicked]=useState(()=>[fallback?.id,assessment.id].filter(Boolean))
 const [show,setShow]=useState('all')
 const pair=picked.map(id=>all.find(a=>a.id===id)).filter(Boolean).sort((a,b)=>String(a.assessedOn).localeCompare(String(b.assessedOn)))
 const current=pair[1]||pair[0]||assessment
 const other=pair.length>1?pair[0]:all.find(a=>a.id!==current.id)
 const pick=id=>setPicked(list=>list.includes(id)?list:[list[list.length-1],id].filter(Boolean))
 const result=useMemo(()=>other?compareAssessments(current.risks||[],other.risks||[]):null,[current,other])
 const trend=useMemo(()=>riskTrend(all),[all])
 const nameOf=a=>a.periodLabel||periodName(periodOf(a),en)
 const rows=result?result.rows.filter(r=>show==='all'||r.status===show):[]
 const {items:pageRows,pager}=usePaged(rows,{en,resetOn:`${current.id}|${other?.id}|${show}`,startIndex:current.id===assessment.id?rows.findIndex(r=>r.risk.lineageKey===returned):-1})
 if(!result)return frame(null,<div className="risk-comparison">
  {actions&&<div className="risk-page-bar">{actions}</div>}
  <div className="inline-empty" role="status"><strong>{L(en,'Δεν υπάρχει άλλη περίοδος για σύγκριση','No other period to compare')}</strong><span>{L(en,'Η σύγκριση εμφανίζεται μόλις υπάρξει δεύτερη εκτίμηση (π.χ. άλλης χρονιάς ή εξαμήνου). Δημιουργήστε την από «Νέα εκτίμηση» με μεταφορά των κινδύνων αυτής.','The comparison appears once there is a second assessment (e.g. another year or half-year). Create it with “New assessment”, carrying these risks forward.')}</span></div>
 </div>)
 const cur=result.current,prev=result.previous
 const kpi=(icon,value,name,delta,lower=true)=><MetricCard icon={icon} label={name} value={<span className="risk-kpi-value">{value}<Delta value={delta} lowerIsBetter={lower} en={en}/></span>}/>
 const avgDelta=cur.averages.residual!=null&&prev.averages.residual!=null?cur.averages.residual-prev.averages.residual:null
 const map=(a,summary)=><div className="risk-heatmap-cell">
  <RiskHeatMap heat={summary.heat.residual} en={en} title={nameOf(a)} caption={fmtDate(a.assessedOn,locale)}/>
  <LevelCounts counts={summary.levels.residual} en={en}/>
 </div>
 const kpis=<div className="risk-compare-head">
  <div className="module-summary-strip risk-kpi-strip">
   {kpi(ClipboardList,cur.total,L(en,'Κίνδυνοι','Risks'),cur.total-prev.total,false)}
   {kpi(AlertOctagon,cur.levels.residual.very_high,L(en,'Πολύ υψηλοί (υπολ.)','Very high (residual)'),cur.levels.residual.very_high-prev.levels.residual.very_high)}
   {kpi(AlertTriangle,cur.levels.residual.high,L(en,'Υψηλοί (υπολ.)','High (residual)'),cur.levels.residual.high-prev.levels.residual.high)}
   {kpi(Gauge,num(cur.averages.residual,en),L(en,'Μέσος υπολειπόμενος','Average residual'),avgDelta)}
  </div>
  {actions}
 </div>
 return frame(kpis,<div className="risk-comparison">
  <p className="risk-hint"><strong>{nameOf(current)} {L(en,'έναντι','vs')} {nameOf(other)}</strong> · {L(en,`${result.counts.improved} βελτιώθηκαν, ${result.counts.worsened} χειροτέρεψαν, ${result.counts.new} νέοι, ${result.counts.removed} αφαιρέθηκαν.`,`${result.counts.improved} improved, ${result.counts.worsened} worsened, ${result.counts.new} new, ${result.counts.removed} removed.`)}</p>
  <div className="risk-compare-row">
  <section className="risk-panel risk-trend-panel"><header><h3>{L(en,'Πορεία σε όλες τις περιόδους','Course over all periods')}</h3><small>{L(en,'Επιλέξτε δύο περιόδους για σύγκριση','Tick two periods to compare')}</small></header>
   {trend.length>=3&&<TrendChart trend={trend} en={en} currentId={current.id}/>}
   <div className="scroll-table"><table className="data-table risk-trend"><thead><tr><th aria-label={L(en,'Επιλογή','Pick')}/><th>{L(en,'Περίοδος','Period')}</th><th>{L(en,'Κίνδυνοι','Risks')}</th><th>{L(en,'Μέσος υπολ.','Avg. residual')}</th><th>{L(en,'Πολύ υψ.','Very high')}</th><th>{L(en,'Υψηλοί','High')}</th><th>{L(en,'Μέτριοι','Moderate')}</th><th>{L(en,'Χαμηλοί','Low')}</th></tr></thead><tbody>
    {trend.map(p=>{const on=p.id===current.id||p.id===other.id
     return <tr key={p.id} className={`is-openable${on?' is-current':''}`} onClick={()=>pick(p.id)}><td><input type="checkbox" checked={on} onChange={()=>pick(p.id)} onClick={e=>e.stopPropagation()} aria-label={L(en,`Επιλογή ${p.label}`,`Pick ${p.label}`)}/></td><td><strong>{p.label}</strong><small>{fmtDate(p.assessedOn,locale)}</small></td><td>{p.total}</td><td><LevelChip score={Math.round(p.residualAverage||0)||null} level={levelForScore(Math.round(p.residualAverage||0))} en={en} compact title={num(p.residualAverage,en)}/> {num(p.residualAverage,en)}</td><td>{p.levels.very_high}</td><td>{p.levels.high}</td><td>{p.levels.moderate}</td><td>{p.levels.low}</td></tr>})}
   </tbody></table></div>
  </section>
  <section className="risk-panel"><header><h3>{L(en,'Υπολειπόμενος κίνδυνος ανά περίοδο','Residual risk by period')}</h3><LevelLegend en={en}/></header>
   <div className="risk-heatmaps risk-heatmaps-two risk-heatmaps-compact">{map(other,prev)}{map(current,cur)}</div>
  </section>
  </div>
  <section className="risk-panel"><header><h3>{L(en,'Μεταβολή ανά κίνδυνο','Change per risk')}</h3>
   <div className="risk-status-chips">{['all','improved','worsened','unchanged','new','removed'].map(id=><button key={id} type="button" className={show===id?'active':''} onClick={()=>setShow(id)}>{id==='all'?L(en,'Όλοι','All'):label(id,en)} <b>{id==='all'?result.rows.length:result.counts[id]}</b></button>)}</div></header>
   <div className="risk-registry-frame">
   <div className="scroll-table"><table className="data-table risk-table risk-compare-table"><thead><tr><th>{L(en,'Κωδ.','Code')}</th><th>{L(en,'Κίνδυνος','Risk')}</th><th>{nameOf(other)}</th><th>{nameOf(current)}</th><th>{L(en,'Μεταβολή','Change')}</th><th>{L(en,'Τι άλλαξε','What changed')}</th><th>{L(en,'Κατάσταση','Status')}</th><th aria-hidden="true"/></tr></thead><tbody>
    {pageRows.map(r=>{const openable=r.status!=='removed'&&onOpen
     return <tr key={r.key} className={`${openable?'is-openable':''}${current.id===assessment.id?returnedClass(returned,r.risk.lineageKey):''}`} onClick={()=>openable&&onOpen(r.risk,current)} title={openable?L(en,'Άνοιγμα του κινδύνου','Open the risk'):undefined}>
      <td><strong>{r.risk.lineageKey}</strong></td>
      <td className="risk-hazard"><span>{txt(r.risk,'hazard',en)}</span><small>{[txt(r.risk,'process',en),txt(r.risk,'scope',en)].filter(Boolean).join(' · ')}</small></td>
      <td><LevelChip score={r.before} en={en} compact/></td><td><LevelChip score={r.current} en={en} compact/></td>
      <td><Delta value={r.delta} en={en}/></td><td><AxisChange row={r} en={en}/></td>
      <td><span className={`status-badge ${STATUS[r.status][2]}`}>{label(r.status,en)}</span></td>
      <td className="risk-open-cell">{openable&&<ChevronRight size={15}/>}</td>
     </tr>})}
    {!rows.length&&<tr><td colSpan={8} className="risk-empty-note">{L(en,'Κανένας κίνδυνος σε αυτή την κατάσταση.','No risk in this state.')}</td></tr>}
   </tbody></table></div>
   {rows.length>0&&pager}
   </div>
  </section>
 </div>)
}
