import { useState } from 'react'
import { AlertOctagon,AlertTriangle,ClipboardList,Gauge,ShieldAlert,TrendingDown } from 'lucide-react'
import { MetricCard } from '../../../design-system/MetricCard'
import { LEVELS,jciLabel,levelForScore,scored,sectionLabel } from './riskModel'
import { L,LevelChip,LevelLegend,RiskHeatMap,returnedClass,txt } from './riskUi'
import { RiskIndicatorTable } from './RiskIndicatorsUi'

const pct=(n,total)=>total?Math.round(n/total*100):0
// Greek decimals use a comma.
export const num=(value,en)=>value==null||value===''?'—':en?String(value):String(value).replace('.',',')

// Bars of the four levels for inherent, residual and target, side by side.
export function LevelDistribution({summary,en,kinds=['inherent','residual','target']}){
 const names={inherent:L(en,'Εγγενής','Inherent'),residual:L(en,'Υπολειπόμενος','Residual'),target:L(en,'Στόχος','Target')}
 return <table className="risk-distribution"><thead><tr><th>{L(en,'Επίπεδο','Level')}</th>{kinds.map(k=><th key={k}>{names[k]}</th>)}</tr></thead><tbody>
  {[...LEVELS].reverse().map(level=><tr key={level.id}><th scope="row"><span className={`risk-swatch risk-cell-${level.id}`}/>{en?level.en:level.el}</th>{kinds.map(kind=>{const total=Object.values(summary.levels[kind]).reduce((a,b)=>a+b,0),n=summary.levels[kind][level.id]
   return <td key={kind}><div className="risk-bar"><i className={`risk-cell-${level.id}`} style={{width:`${pct(n,total)}%`}}/></div><span>{n}<small> · {pct(n,total)}%</small></span></td>})}</tr>)}
 </tbody></table>
}

export function RiskKpis({summary,en}){
 const high=summary.levels.residual.high+summary.levels.residual.very_high
 const items=[
  [L(en,'Κίνδυνοι','Risks'),summary.total,''],
  [L(en,'Πολύ υψηλοί (υπολειπόμενοι)','Very high (residual)'),summary.levels.residual.very_high,'very_high'],
  [L(en,'Υψηλοί (υπολειπόμενοι)','High (residual)'),summary.levels.residual.high,'high'],
  [L(en,'Μέσος υπολειπόμενος βαθμός','Average residual score'),summary.averages.residual??'—',summary.averages.residual?levelForScore(Math.round(summary.averages.residual)):''],
  [L(en,'Μέση μείωση από τον εγγενή','Average reduction from inherent'),summary.reduction.percent!=null?`${summary.reduction.percent}%`:'—',''],
  [L(en,'Υψηλοί χωρίς σχέδιο δράσης','High without an action plan'),summary.withoutPlan.length,summary.withoutPlan.length?'very_high':''],
 ]
 return <div className="risk-kpis">{items.map(([label,value,tone])=><div key={label} className={`risk-kpi${tone?` risk-kpi-${tone}`:''}`}><strong>{value}</strong><span>{label}</span></div>)}<p className="risk-kpi-note">{L(en,`${high} από ${summary.total} κινδύνους παραμένουν υψηλοί ή πολύ υψηλοί με τα υφιστάμενα μέτρα.`,`${high} of ${summary.total} risks stay high or very high with the existing controls.`)}</p></div>
}

function GroupTable({rows,en,label,labelFor=x=>x}){
 return <table className="data-table risk-group-table"><thead><tr><th>{label}</th><th>{L(en,'Κίνδυνοι','Risks')}</th><th>{L(en,'Μέσος εγγενής','Avg. inherent')}</th><th>{L(en,'Μέσος υπολειπόμενος','Avg. residual')}</th><th>{L(en,'Μέγιστος υπολειπόμενος','Max. residual')}</th><th>{L(en,'Υψηλοί / πολύ υψηλοί','High / very high')}</th></tr></thead><tbody>
  {rows.map(g=><tr key={g.key}><td>{labelFor(g.key)}</td><td>{g.count}</td><td>{num(g.inherentAvg,en)}</td><td>{num(g.residualAvg,en)}</td><td><LevelChip score={g.residualMax} en={en}/></td><td>{g.highOrAbove||'—'}</td></tr>)}
 </tbody></table>
}

export function RiskList({risks,en,empty,onOpen,returned=''}){
 if(!risks.length)return <p className="risk-empty-note">{empty}</p>
 return <ol className="risk-list">{risks.map(risk=>{const s=scored(risk);return <li key={risk.id||risk.lineageKey}><button type="button" className={returnedClass(returned,risk.lineageKey).trim()||undefined} onClick={()=>onOpen?.(risk)} disabled={!onOpen}>
  <LevelChip score={s.residual.score} level={s.residual.level} en={en} compact/><span><strong>{risk.lineageKey} · {txt(risk,'hazard',en)}</strong><small>{[txt(risk,'process',en),txt(risk,'scope',en),txt(risk,'owner',en)].filter(Boolean).join(' · ')}</small></span>
 </button></li>})}</ol>
}

// Under each heat map: how many risks fall in each level.
export function LevelCounts({counts,en}){
 return <ul className="risk-level-counts">{[...LEVELS].reverse().map(level=><li key={level.id}><span className={`risk-swatch risk-cell-${level.id}`}/>{en?level.en:level.el}<strong>{counts?.[level.id]||0}</strong></li>)}</ul>
}

const GROUPS=[['process','Ανά διεργασία','By process'],['jci','Ανά JCI','By JCI'],['section','Ανά ενότητα','By section']]

// Analysis of one assessment: what needs a decision first, then the maps,
// the indicators and the breakdowns.
export function RiskAnalysis({summary,en,onCell,onOpen,risks=[],indicatorValues=null,actions=null,returned='',mark=''}){
 const [group,setGroup]=useState('process')
 // The heat-map cell the user came back from stays marked.
 const [mk,ml,mc]=String(mark).split(':'),marked=mk&&ml&&mc&&['inherent','residual','target'].includes(mk)?{kind:mk,l:Number(ml),c:Number(mc)}:null
 const high=summary.levels.residual.high+summary.levels.residual.very_high
 const map=(kind,title,caption,extra={})=><div className="risk-heatmap-cell">
  <RiskHeatMap heat={summary.heat[kind]} en={en} title={title} caption={caption} onCell={c=>onCell({...c,kind})} active={marked?.kind===kind?marked:null} {...extra}/>
  <LevelCounts counts={summary.levels[kind]} en={en}/>
 </div>
 return <div className="risk-analysis">
  <div className="risk-analysis-head">
   <div className="module-summary-strip risk-kpi-strip risk-analysis-kpis">
    <MetricCard icon={ClipboardList} value={summary.total} label={L(en,'Κίνδυνοι','Risks')}/>
    <MetricCard icon={AlertOctagon} value={summary.levels.residual.very_high} label={L(en,'Πολύ υψηλοί (υπολ.)','Very high (residual)')}/>
    <MetricCard icon={AlertTriangle} value={summary.levels.residual.high} label={L(en,'Υψηλοί (υπολ.)','High (residual)')}/>
    <MetricCard icon={Gauge} value={num(summary.averages.residual,en)} label={L(en,'Μέσος υπολειπόμενος','Average residual')}/>
    <MetricCard icon={TrendingDown} value={summary.reduction.percent!=null?`${summary.reduction.percent}%`:'—'} label={L(en,'Μέση μείωση από τον εγγενή','Average reduction')}/>
    <MetricCard icon={ShieldAlert} value={summary.withoutPlan.length} label={L(en,'Υψηλοί χωρίς σχέδιο δράσης','High without a plan')}/>
   </div>
   {actions}
  </div>
  <p className="risk-hint">{L(en,`${high} από ${summary.total} κινδύνους παραμένουν υψηλοί ή πολύ υψηλοί με τα υφιστάμενα μέτρα.`,`${high} of ${summary.total} risks stay high or very high with the existing controls.`)}</p>
  <div className="risk-two-columns risk-analysis-decide">
   <section className="risk-panel"><header><h3>{L(en,'Κίνδυνοι προτεραιότητας','Priority risks')}</h3><small>{L(en,'Υψηλός ή πολύ υψηλός υπολειπόμενος κίνδυνος','High or very high residual risk')}</small></header><RiskList risks={summary.priorities.slice(0,12)} en={en} onOpen={onOpen} returned={returned} empty={L(en,'Κανένας υψηλός υπολειπόμενος κίνδυνος.','No high residual risk.')}/></section>
   <div className="risk-analysis-side">
    <section className="risk-panel"><header><h3>{L(en,'Χωρίς σχέδιο δράσης','Without an action plan')}</h3><small>{L(en,'Υψηλοί υπολειπόμενοι χωρίς πρόσθετα μέτρα','High residual risks without additional measures')}</small></header><RiskList risks={summary.withoutPlan} en={en} onOpen={onOpen} returned={returned} empty={L(en,'Όλοι οι υψηλοί κίνδυνοι έχουν σχέδιο δράσης.','Every high risk has an action plan.')}/></section>
    <section className="risk-panel"><header><h3>{L(en,'Επιλεγμένοι για FMEA','Selected for FMEA')}</h3><small>{L(en,'Προληπτική ανάλυση της περιόδου','This period’s proactive analysis')}</small></header><RiskList risks={summary.prioritized} en={en} onOpen={onOpen} returned={returned} empty={L(en,'Δεν έχει επιλεγεί κίνδυνος. Επιλέξτε τον μέσα στον κίνδυνο (Παρακολούθηση → FMEA).','No risk selected yet. Select it in the risk (Monitoring → FMEA).')}/></section>
   </div>
  </div>
  <section className="risk-panel"><header><h3>{L(en,'Χάρτες κινδύνου','Risk heat maps')}</h3><LevelLegend en={en}/></header>
   <div className="risk-heatmaps">
    {map('inherent',L(en,'Εγγενής','Inherent'),L(en,'Χωρίς μέτρα','Before controls'))}
    {map('residual',L(en,'Υπολειπόμενος','Residual'),L(en,'Με τα υφιστάμενα μέτρα','With existing controls'))}
    {map('target',L(en,'Στόχος','Target'),L(en,'Μετά τα πρόσθετα μέτρα','After additional measures'),{emptyNote:L(en,'Δεν έχει οριστεί κίνδυνος-στόχος. Ορίστε τον στο μητρώο (L και C μετά τα πρόσθετα μέτρα) και ο χάρτης θα γεμίσει.','No target risk set yet. Set it in the register (L and C after the additional measures) and the map fills in.')})}
   </div>
   <p className="risk-hint">{L(en,'Επιλέξτε ένα κελί για να δείτε τους κινδύνους του στο μητρώο.','Select a cell to see its risks in the register.')}</p>
  </section>
  <RiskIndicatorTable risks={risks} values={indicatorValues} en={en} onOpen={onOpen}/>
  <section className="risk-panel">
   <header><h3>{L(en,'Ανάλυση ανά ομάδα','Breakdown')}</h3>
    <div className="risk-segmented" role="tablist" aria-label={L(en,'Ομαδοποίηση','Group by')}>{GROUPS.map(([id,el,enLabel])=><button key={id} type="button" role="tab" aria-selected={group===id} className={group===id?'active':''} onClick={()=>setGroup(id)}>{en?enLabel:el}</button>)}</div>
   </header>
   <div className="scroll-table">
    {group==='process'&&<GroupTable rows={summary.byProcess} en={en} label={L(en,'Διεργασία','Process')}/>}
    {group==='jci'&&<GroupTable rows={summary.byJci} en={en} label="JCI" labelFor={id=>id==='—'?'—':`${id} · ${jciLabel(id,en)}`}/>}
    {group==='section'&&<GroupTable rows={summary.bySection} en={en} label={L(en,'Ενότητα','Section')} labelFor={id=>sectionLabel(id,en)||id}/>}
   </div>
  </section>
 </div>
}
