import { useMemo,useState } from 'react'
import { AlertOctagon,AlertTriangle,ArrowDownRight,ArrowRight,ArrowUpRight,ChevronRight,ClipboardList,Gauge } from 'lucide-react'
import { MetricCard } from '../../../design-system/MetricCard'
import { FilterBar,FilterSelect } from '../../../design-system/FilterBar'
import { SECTIONS,compareAssessments,counterpart,levelForScore,periodKey,periodKindOf,periodName,periodOf,riskTrend,scored } from './riskModel'
import { L,LevelChip,LevelLegend,RiskHeatMap,fmtDate,txt } from './riskUi'
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

const KINDS=[['annual','Έτος','Year'],['semester','Εξάμηνο','Half-year'],['quarter','Τρίμηνο','Quarter']]
const byDateDesc=(a,b)=>String(b.assessedOn).localeCompare(String(a.assessedOn))

// Periods of one kind (year, half-year or quarter) side by side: a period
// against the same one a year earlier, or against the one before it, and the
// course over every period of that kind.
export function RiskComparison({assessment,assessments,en,locale,onOpen,actions=null}){
 const all=useMemo(()=>[...(assessments.some(a=>a.id===assessment.id)?assessments:[assessment,...assessments])].sort(byDateDesc),[assessments,assessment])
 const counts=useMemo(()=>Object.fromEntries(KINDS.map(([id])=>[id,all.filter(a=>periodKindOf(a)===id).length])),[all])
 const [kind,setKind]=useState(()=>periodKindOf(assessment))
 const [mode,setMode]=useState('lastYear')
 const [show,setShow]=useState('all')
 const [section,setSection]=useState('all')
 const [query,setQuery]=useState('')
 const ofKind=useMemo(()=>all.filter(a=>periodKindOf(a)===kind),[all,kind])
 const [currentId,setCurrentId]=useState(assessment.id)
 const current=ofKind.find(a=>a.id===currentId)||ofKind[0]
 const target=current?counterpart(periodOf(current),mode):null
 const other=target?ofKind.find(a=>a.id!==current.id&&periodKey(periodOf(a))===periodKey(target)):null
 const result=useMemo(()=>current&&other?compareAssessments(current.risks||[],other.risks||[]):null,[current,other])
 const trend=useMemo(()=>riskTrend(ofKind),[ofKind])
 const pickKind=id=>{setKind(id);const first=all.find(a=>periodKindOf(a)===id);setCurrentId(periodKindOf(assessment)===id?assessment.id:first?.id)}
 const nameOf=a=>a.periodLabel||periodName(periodOf(a),en)
 const defaultKind=periodKindOf(assessment)
 const active=(kind!==defaultKind)+(current&&current.id!==assessment.id&&kind===defaultKind)+(mode!=='lastYear'&&kind!=='annual')+(show!=='all')+(section!=='all')
 const clear=()=>{setKind(defaultKind);setCurrentId(assessment.id);setMode('lastYear');setShow('all');setSection('all');setQuery('')}
 const summary=current&&<p className="risk-compare-summary"><strong>{nameOf(current)}</strong> {L(en,'έναντι','versus')} <strong className={other?'':'is-missing'}>{other?nameOf(other):periodName(target,en)}</strong>{result&&<span> · {L(en,`${result.counts.improved} βελτιώθηκαν, ${result.counts.worsened} χειροτέρεψαν, ${result.counts.new} νέοι, ${result.counts.removed} αφαιρέθηκαν`,`${result.counts.improved} improved, ${result.counts.worsened} worsened, ${result.counts.new} new, ${result.counts.removed} removed`)}</span>}</p>
 const toolbar=<div className="risk-toolbar risk-compare-toolbar">
  <FilterBar query={query} onQueryChange={setQuery} placeholder={L(en,'Αναζήτηση κινδύνου, διεργασίας, τμήματος…','Search risk, process, department…')} activeAdvancedCount={active} onClear={clear}>
   <FilterSelect label={L(en,'Είδος περιόδου','Period type')} value={kind} onChange={pickKind}>{KINDS.map(([id,el,enLabel])=><option key={id} value={id} disabled={!counts[id]}>{en?enLabel:el} ({counts[id]})</option>)}</FilterSelect>
   <FilterSelect label={L(en,'Περίοδος','Period')} value={current?.id||''} onChange={setCurrentId}>{ofKind.map(a=><option key={a.id} value={a.id}>{nameOf(a)} · {fmtDate(a.assessedOn,locale)}</option>)}</FilterSelect>
   {kind!=='annual'&&<FilterSelect label={L(en,'Σύγκριση με','Compare with')} value={mode} onChange={setMode}><option value="lastYear">{L(en,'Ίδια περίοδος πέρσι','Same period last year')}</option><option value="previous">{L(en,'Προηγούμενη περίοδος','Previous period')}</option></FilterSelect>}
   <FilterSelect label={L(en,'Μεταβολή','Change')} value={show} onChange={setShow}><option value="all">{L(en,'Όλοι','All')}</option>{['improved','worsened','unchanged','new','removed'].map(id=><option key={id} value={id}>{label(id,en)}{result?` (${result.counts[id]})`:''}</option>)}</FilterSelect>
   <FilterSelect label={L(en,'Ενότητα','Section')} value={section} onChange={setSection}><option value="all">{L(en,'Όλες','All')}</option>{SECTIONS.map(x=><option key={x.id} value={x.id}>{en?x.en:x.el}</option>)}</FilterSelect>
  </FilterBar>
  {summary}
  {actions&&<div className="risk-toolbar-actions">{actions}</div>}
 </div>
 if(!result)return <div className="risk-comparison">{toolbar}
  <div className="registry-empty-state"><strong>{current?L(en,`Δεν υπάρχει εκτίμηση για ${periodName(target,en)}`,`There is no assessment for ${periodName(target,en)}`):L(en,'Δεν υπάρχει εκτίμηση αυτού του είδους','No assessment of this type')}</strong><span>{L(en,'Η σύγκριση γίνεται μεταξύ εκτιμήσεων του ίδιου είδους (ετήσιες, εξαμηνιαίες ή τριμηνιαίες). Δημιουργήστε την από «Νέα εκτίμηση», με το είδος περιόδου και μεταφορά των κινδύνων.','Comparisons are between assessments of the same type (annual, six-monthly or quarterly). Create one with “New assessment”, choosing the period type and carrying the risks forward.')}</span></div>
 </div>
 const cur=result.current,prev=result.previous
 const q=query.trim().toLowerCase()
 const rows=result.rows.filter(r=>(show==='all'||r.status===show)&&(section==='all'||(r.risk.section||'clinical')===section)&&(!q||[r.risk.lineageKey,txt(r.risk,'hazard',en),txt(r.risk,'process',en),txt(r.risk,'scope',en)].join(' ').toLowerCase().includes(q)))
 const kpi=(icon,value,name,delta,lower=true)=><MetricCard icon={icon} label={name} value={<span className="risk-kpi-value">{value}<Delta value={delta} lowerIsBetter={lower} en={en}/></span>}/>
 const avgDelta=cur.averages.residual!=null&&prev.averages.residual!=null?cur.averages.residual-prev.averages.residual:null
 const map=(a,summary)=><div className="risk-heatmap-cell">
  <RiskHeatMap heat={summary.heat.residual} en={en} title={nameOf(a)} caption={fmtDate(a.assessedOn,locale)}/>
  <LevelCounts counts={summary.levels.residual} en={en}/>
 </div>
 return <div className="risk-comparison">
  <div className="module-summary-strip risk-kpi-strip">
   {kpi(ClipboardList,cur.total,L(en,'Κίνδυνοι','Risks'),cur.total-prev.total,false)}
   {kpi(AlertOctagon,cur.levels.residual.very_high,L(en,'Πολύ υψηλοί (υπολ.)','Very high (residual)'),cur.levels.residual.very_high-prev.levels.residual.very_high)}
   {kpi(AlertTriangle,cur.levels.residual.high,L(en,'Υψηλοί (υπολ.)','High (residual)'),cur.levels.residual.high-prev.levels.residual.high)}
   {kpi(Gauge,num(cur.averages.residual,en),L(en,'Μέσος υπολειπόμενος','Average residual'),avgDelta)}
  </div>
  {toolbar}
  <section className="risk-panel"><header><h3>{L(en,'Μεταβολή ανά κίνδυνο','Change per risk')}</h3></header>
   <div className="scroll-table"><table className="data-table risk-table risk-compare-table"><thead><tr><th>{L(en,'Κωδ.','Code')}</th><th>{L(en,'Κίνδυνος','Risk')}</th><th>{nameOf(other)}</th><th>{nameOf(current)}</th><th>{L(en,'Μεταβολή','Change')}</th><th>{L(en,'Τι άλλαξε','What changed')}</th><th>{L(en,'Κατάσταση','Status')}</th><th aria-hidden="true"/></tr></thead><tbody>
    {rows.map(r=>{const openable=r.status!=='removed'&&onOpen
     return <tr key={r.key} className={openable?'is-openable':''} onClick={()=>openable&&onOpen(r.risk,current)} title={openable?L(en,'Άνοιγμα του κινδύνου','Open the risk'):undefined}>
      <td><strong>{r.risk.lineageKey}</strong></td>
      <td className="risk-hazard"><span>{txt(r.risk,'hazard',en)}</span><small>{[txt(r.risk,'process',en),txt(r.risk,'scope',en)].filter(Boolean).join(' · ')}</small></td>
      <td><LevelChip score={r.before} en={en} compact/></td><td><LevelChip score={r.current} en={en} compact/></td>
      <td><Delta value={r.delta} en={en}/></td><td><AxisChange row={r} en={en}/></td>
      <td><span className={`status-badge ${STATUS[r.status][2]}`}>{label(r.status,en)}</span></td>
      <td className="risk-open-cell">{openable&&<ChevronRight size={15}/>}</td>
     </tr>})}
    {!rows.length&&<tr><td colSpan={8} className="risk-empty-note">{L(en,'Κανένας κίνδυνος με αυτά τα φίλτρα.','No risk matches these filters.')}</td></tr>}
   </tbody></table></div>
  </section>
  <section className="risk-panel"><header><h3>{L(en,'Υπολειπόμενος κίνδυνος ανά περίοδο','Residual risk by period')}</h3><LevelLegend en={en}/></header>
   <div className="risk-heatmaps risk-heatmaps-two risk-heatmaps-compact">{map(other,prev)}{map(current,cur)}</div>
  </section>
  {trend.length>1&&<section className="risk-panel"><header><h3>{L(en,`Πορεία · ${KINDS.find(k=>k[0]===kind)[1]}`,`Course · ${KINDS.find(k=>k[0]===kind)[2]}`)}</h3></header>
   {trend.length>=3&&<TrendChart trend={trend} en={en} currentId={current.id}/>}
   <div className="scroll-table"><table className="data-table risk-trend"><thead><tr><th>{L(en,'Περίοδος','Period')}</th><th>{L(en,'Κίνδυνοι','Risks')}</th><th>{L(en,'Μέσος υπολειπόμενος','Avg. residual')}</th><th>{L(en,'Πολύ υψηλοί','Very high')}</th><th>{L(en,'Υψηλοί','High')}</th><th>{L(en,'Μέτριοι','Moderate')}</th><th>{L(en,'Χαμηλοί','Low')}</th></tr></thead><tbody>
    {trend.map(p=><tr key={p.id} className={p.id===current.id?'is-current':''}><td><strong>{p.label}</strong><small>{fmtDate(p.assessedOn,locale)}</small></td><td>{p.total}</td><td><div className="risk-bar risk-bar-inline"><i className={`risk-cell-${levelForScore(Math.round(p.residualAverage||0))||'low'}`} style={{width:`${Math.min(100,(p.residualAverage||0)/25*100)}%`}}/></div>{num(p.residualAverage,en)}</td><td>{p.levels.very_high}</td><td>{p.levels.high}</td><td>{p.levels.moderate}</td><td>{p.levels.low}</td></tr>)}
   </tbody></table></div>
  </section>}
 </div>
}
