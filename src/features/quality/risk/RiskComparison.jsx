import { useMemo,useState } from 'react'
import { ArrowDownRight,ArrowRight,ArrowUpRight } from 'lucide-react'
import { LEVELS,compareAssessments,levelForScore,riskTrend } from './riskModel'
import { L,LevelChip,RiskHeatMap,fmtDate,txt } from './riskUi'

const STATUS={improved:['Βελτιώθηκε','Improved','active'],worsened:['Χειροτέρεψε','Worsened','danger'],unchanged:['Αμετάβλητος','Unchanged',''],new:['Νέος','New','warning'],removed:['Αφαιρέθηκε','Removed','']}
const label=(id,en)=>STATUS[id][en?1:0]

function Delta({value,lowerIsBetter=true,suffix=''}){
 if(value==null||Number.isNaN(value))return <span className="risk-delta">—</span>
 const good=lowerIsBetter?value<0:value>0,Icon=value===0?ArrowRight:value>0?ArrowUpRight:ArrowDownRight
 return <span className={`risk-delta${value===0?'':good?' is-better':' is-worse'}`}><Icon size={14}/>{value>0?'+':''}{Math.round(value*10)/10}{suffix}</span>
}

// The assessment against an earlier one (a previous year or semester), and the
// course of the residual risk over every assessment.
export function RiskComparison({assessment,assessments,en,locale,onOpen}){
 const others=useMemo(()=>assessments.filter(a=>a.id!==assessment.id).sort((a,b)=>String(b.assessedOn).localeCompare(String(a.assessedOn))),[assessments,assessment.id])
 const fallback=others.find(a=>a.id===assessment.sourceAssessmentId)||others.find(a=>String(a.assessedOn)<String(assessment.assessedOn))||others[0]
 const [otherId,setOtherId]=useState(fallback?.id||'')
 const [show,setShow]=useState('all')
 const other=others.find(a=>a.id===otherId)
 const result=useMemo(()=>other?compareAssessments(assessment.risks||[],other.risks||[]):null,[assessment.risks,other])
 const trend=useMemo(()=>riskTrend([assessment,...others]),[assessment,others])
 if(!others.length)return <div className="registry-empty-state"><strong>{L(en,'Δεν υπάρχει άλλη περίοδος για σύγκριση','No other period to compare')}</strong><span>{L(en,'Η σύγκριση εμφανίζεται μόλις υπάρξει δεύτερη εκτίμηση (π.χ. της επόμενης χρονιάς ή εξαμήνου). Δημιουργήστε την από «Νέα εκτίμηση» με μεταφορά των κινδύνων αυτής.','The comparison appears once there is a second assessment (e.g. next year or semester). Create it with “New assessment”, carrying these risks forward.')}</span></div>
 const cur=result.current,prev=result.previous
 const periodName=a=>`${a.periodLabel} · ${fmtDate(a.assessedOn,locale)}`
 const rows=result.rows.filter(r=>show==='all'||r.status===show)
 return <div className="risk-comparison">
  <div className="risk-compare-picker">
   <label><span>{L(en,'Σύγκριση με','Compare with')}</span><select value={otherId} onChange={e=>setOtherId(e.target.value)}>{others.map(a=><option key={a.id} value={a.id}>{periodName(a)}</option>)}</select></label>
   <p><strong>{periodName(assessment)}</strong> {L(en,'έναντι','versus')} <strong>{periodName(other)}</strong></p>
  </div>
  <div className="risk-kpis">
   {[[L(en,'Κίνδυνοι','Risks'),cur.total,cur.total-prev.total,false],[L(en,'Πολύ υψηλοί (υπολ.)','Very high (residual)'),cur.levels.residual.very_high,cur.levels.residual.very_high-prev.levels.residual.very_high,true],[L(en,'Υψηλοί (υπολ.)','High (residual)'),cur.levels.residual.high,cur.levels.residual.high-prev.levels.residual.high,true],[L(en,'Μέσος υπολειπόμενος','Average residual'),cur.averages.residual??'—',cur.averages.residual!=null&&prev.averages.residual!=null?cur.averages.residual-prev.averages.residual:null,true]]
    .map(([name,value,delta,lower])=><div key={name} className="risk-kpi"><strong>{value}</strong><span>{name}</span><Delta value={delta} lowerIsBetter={lower}/></div>)}
  </div>
  <section className="risk-panel"><header><h3>{L(en,'Υπολειπόμενος κίνδυνος ανά περίοδο','Residual risk by period')}</h3></header>
   <div className="risk-heatmaps risk-heatmaps-two">
    <RiskHeatMap heat={prev.heat.residual} en={en} title={other.periodLabel} caption={fmtDate(other.assessedOn,locale)}/>
    <RiskHeatMap heat={cur.heat.residual} en={en} title={assessment.periodLabel} caption={fmtDate(assessment.assessedOn,locale)}/>
   </div>
   <table className="risk-distribution"><thead><tr><th>{L(en,'Επίπεδο','Level')}</th><th>{other.periodLabel}</th><th>{assessment.periodLabel}</th><th>{L(en,'Μεταβολή','Change')}</th></tr></thead><tbody>
    {[...LEVELS].reverse().map(level=><tr key={level.id}><th scope="row"><span className={`risk-swatch risk-cell-${level.id}`}/>{en?level.en:level.el}</th><td>{prev.levels.residual[level.id]}</td><td>{cur.levels.residual[level.id]}</td><td><Delta value={cur.levels.residual[level.id]-prev.levels.residual[level.id]} lowerIsBetter={level.id!=='low'}/></td></tr>)}
   </tbody></table>
  </section>
  <section className="risk-panel"><header><h3>{L(en,'Μεταβολή ανά κίνδυνο','Change per risk')}</h3>
   <div className="risk-status-chips">{['all','improved','worsened','unchanged','new','removed'].map(id=><button key={id} type="button" className={show===id?'active':''} onClick={()=>setShow(id)}>{id==='all'?L(en,'Όλοι','All'):label(id,en)} <b>{id==='all'?result.rows.length:result.counts[id]}</b></button>)}</div></header>
   <div className="scroll-table"><table className="data-table risk-table"><thead><tr><th>{L(en,'Κωδ.','Code')}</th><th>{L(en,'Κίνδυνος','Risk')}</th><th>{other.periodLabel}</th><th>{assessment.periodLabel}</th><th>{L(en,'Μεταβολή','Change')}</th><th>{L(en,'Κατάσταση','Status')}</th></tr></thead><tbody>
    {rows.map(r=><tr key={r.key} onClick={()=>r.status!=='removed'&&onOpen?.(r.risk)}><td><strong>{r.risk.lineageKey}</strong></td><td className="risk-hazard"><span>{txt(r.risk,'hazard',en)}</span><small>{[txt(r.risk,'process',en),txt(r.risk,'scope',en)].filter(Boolean).join(' · ')}</small></td><td><LevelChip score={r.before} en={en} compact/></td><td><LevelChip score={r.current} en={en} compact/></td><td><Delta value={r.delta}/></td><td><span className={`status-badge ${STATUS[r.status][2]}`}>{label(r.status,en)}</span></td></tr>)}
   </tbody></table></div>
  </section>
  {trend.length>1&&<section className="risk-panel"><header><h3>{L(en,'Πορεία σε όλες τις περιόδους','Course over all periods')}</h3></header>
   <table className="data-table risk-trend"><thead><tr><th>{L(en,'Περίοδος','Period')}</th><th>{L(en,'Κίνδυνοι','Risks')}</th><th>{L(en,'Μέσος υπολειπόμενος','Avg. residual')}</th><th>{L(en,'Πολύ υψηλοί','Very high')}</th><th>{L(en,'Υψηλοί','High')}</th><th>{L(en,'Μέτριοι','Moderate')}</th><th>{L(en,'Χαμηλοί','Low')}</th></tr></thead><tbody>
    {trend.map(p=><tr key={p.id} className={p.id===assessment.id?'is-current':''}><td><strong>{p.label}</strong><small>{fmtDate(p.assessedOn,locale)}</small></td><td>{p.total}</td><td><div className="risk-bar risk-bar-inline"><i className={`risk-cell-${levelForScore(Math.round(p.residualAverage||0))||'low'}`} style={{width:`${Math.min(100,(p.residualAverage||0)/25*100)}%`}}/></div>{p.residualAverage??'—'}</td><td>{p.levels.very_high}</td><td>{p.levels.high}</td><td>{p.levels.moderate}</td><td>{p.levels.low}</td></tr>)}
   </tbody></table>
  </section>}
 </div>
}
