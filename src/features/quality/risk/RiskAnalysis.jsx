import { LEVELS,jciLabel,levelForScore,scored,sectionLabel } from './riskModel'
import { L,LevelChip,LevelLegend,RiskHeatMap,txt } from './riskUi'

const pct=(n,total)=>total?Math.round(n/total*100):0

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
  {rows.map(g=><tr key={g.key}><td>{labelFor(g.key)}</td><td>{g.count}</td><td>{g.inherentAvg??'—'}</td><td>{g.residualAvg??'—'}</td><td><LevelChip score={g.residualMax} en={en}/></td><td>{g.highOrAbove||'—'}</td></tr>)}
 </tbody></table>
}

export function RiskList({risks,en,empty,onOpen}){
 if(!risks.length)return <p className="risk-empty-note">{empty}</p>
 return <ol className="risk-list">{risks.map(risk=>{const s=scored(risk);return <li key={risk.id||risk.lineageKey}><button type="button" onClick={()=>onOpen?.(risk)} disabled={!onOpen}>
  <LevelChip score={s.residual.score} level={s.residual.level} en={en} compact/><span><strong>{risk.lineageKey} · {txt(risk,'hazard',en)}</strong><small>{[txt(risk,'process',en),txt(risk,'scope',en),txt(risk,'owner',en)].filter(Boolean).join(' · ')}</small></span>
 </button></li>})}</ol>
}

export function RiskAnalysis({summary,en,onCell,onOpen}){
 return <div className="risk-analysis">
  <RiskKpis summary={summary} en={en}/>
  <section className="risk-panel"><header><h3>{L(en,'Χάρτες κινδύνου','Risk heat maps')}</h3><LevelLegend en={en}/></header>
   <div className="risk-heatmaps">
    <RiskHeatMap heat={summary.heat.inherent} en={en} title={L(en,'Εγγενής','Inherent')} caption={L(en,'Χωρίς μέτρα','Before controls')} onCell={c=>onCell({...c,kind:'inherent'})}/>
    <RiskHeatMap heat={summary.heat.residual} en={en} title={L(en,'Υπολειπόμενος','Residual')} caption={L(en,'Με τα υφιστάμενα μέτρα','With existing controls')} onCell={c=>onCell({...c,kind:'residual'})}/>
    <RiskHeatMap heat={summary.heat.target} en={en} title={L(en,'Στόχος','Target')} caption={L(en,'Μετά τα πρόσθετα μέτρα','After additional measures')} onCell={c=>onCell({...c,kind:'target'})}/>
   </div>
   <p className="risk-hint">{L(en,'Επιλέξτε ένα κελί για να δείτε τους κινδύνους του στο μητρώο.','Select a cell to see its risks in the register.')}</p>
  </section>
  <section className="risk-panel"><header><h3>{L(en,'Κατανομή ανά επίπεδο','Distribution by level')}</h3></header><LevelDistribution summary={summary} en={en}/></section>
  <div className="risk-two-columns">
   <section className="risk-panel"><header><h3>{L(en,'Κίνδυνοι προτεραιότητας','Priority risks')}</h3><small>{L(en,'Υψηλός ή πολύ υψηλός υπολειπόμενος κίνδυνος','High or very high residual risk')}</small></header><RiskList risks={summary.priorities.slice(0,12)} en={en} onOpen={onOpen} empty={L(en,'Κανένας υψηλός υπολειπόμενος κίνδυνος.','No high residual risk.')}/></section>
   <section className="risk-panel"><header><h3>{L(en,'Χωρίς σχέδιο δράσης','Without an action plan')}</h3><small>{L(en,'Υψηλοί υπολειπόμενοι χωρίς πρόσθετα μέτρα','High residual risks without additional measures')}</small></header><RiskList risks={summary.withoutPlan} en={en} onOpen={onOpen} empty={L(en,'Όλοι οι υψηλοί κίνδυνοι έχουν σχέδιο δράσης.','Every high risk has an action plan.')}/>
    {summary.prioritized.length>0&&<><header><h3>{L(en,'Επιλεγμένοι για FMEA','Selected for FMEA')}</h3></header><RiskList risks={summary.prioritized} en={en} onOpen={onOpen} empty=""/></>}
   </section>
  </div>
  <section className="risk-panel"><header><h3>{L(en,'Ανά διεργασία','By process')}</h3></header><div className="scroll-table"><GroupTable rows={summary.byProcess} en={en} label={L(en,'Διεργασία','Process')}/></div></section>
  <div className="risk-two-columns">
   <section className="risk-panel"><header><h3>{L(en,'Ανά πρότυπο JCI','By JCI standard')}</h3></header><div className="scroll-table"><GroupTable rows={summary.byJci} en={en} label="JCI" labelFor={id=>id==='—'?'—':`${id} · ${jciLabel(id,en)}`}/></div></section>
   <section className="risk-panel"><header><h3>{L(en,'Ανά ενότητα','By section')}</h3></header><div className="scroll-table"><GroupTable rows={summary.bySection} en={en} label={L(en,'Ενότητα','Section')} labelFor={id=>sectionLabel(id,en)||id}/></div></section>
  </div>
 </div>
}
