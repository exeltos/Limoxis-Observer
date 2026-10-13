// Shared pieces of the risk assessment screens: level chips, the 5×5 heat map,
// the L/C pickers and the legend. Colours are the NHS bands (see riskAssessment.css).
import { useState } from 'react'
import { readSessionValue,writeSessionValue } from '../../../core/storage/browserStorage'
import { CONSEQUENCE,LEVELS,LIKELIHOOD,levelForScore,levelLabel } from './riskModel'

// The row last opened in a list, kept for the session, so it is highlighted
// on the way back (the registries' registry-row-returned).
export const rememberRow=(key,id)=>writeSessionValue(key,String(id))
export function useReturnedRow(key){
 const [returned,setReturned]=useState(()=>readSessionValue(key,'')||'')
 return {returned,remember:id=>{rememberRow(key,id);setReturned(String(id))}}
}
export const returnedClass=(returned,id)=>returned&&String(id)===returned?' registry-row-returned':''

// Demo records carry English wording in `<field>En`; user records have one language.
export const txt=(item,field,en)=>(en&&item?.[`${field}En`])||item?.[field]||''
export const L=(en,el,enText)=>en?enText:el

export function LevelChip({score,level,en,compact=false,title}){
 const id=level||levelForScore(score)
 if(!score||!id)return <span className="risk-level risk-level-none">—</span>
 return <span className={`risk-level risk-level-${id}`} title={title||`${score} · ${levelLabel(id,en)}`}><strong>{score}</strong>{!compact&&<span>{levelLabel(id,en)}</span>}</span>
}

// Rows: consequence 5 (top) to 1; columns: likelihood 1 to 5. A cell shows how
// many risks sit there; its colour is the band of L×C.
export function RiskHeatMap({heat,en,title,caption,onCell,active,emptyNote=''}){
 const empty=!(heat||[]).some(row=>row.some(Boolean))
 return <figure className={`risk-heatmap${empty&&emptyNote?' is-empty':''}`}>
  {title&&<figcaption><strong>{title}</strong>{caption&&<span>{caption}</span>}</figcaption>}
  <div className="risk-heatmap-body">
   <span className="risk-heatmap-axis risk-heatmap-axis-c">{L(en,'Συνέπεια (C)','Consequence (C)')}</span>
   <table><tbody>
    {[5,4,3,2,1].map(c=><tr key={c}><th scope="row" title={CONSEQUENCE[c-1][en?'en':'el']}>{c}</th>{[1,2,3,4,5].map(l=>{const score=l*c,count=heat?.[c-1]?.[l-1]||0,isActive=active&&active.l===l&&active.c===c
     return <td key={l} className={`risk-cell risk-cell-${levelForScore(score)}${count?' has-risks':''}${isActive?' is-active':''}`} title={`L${l} × C${c} = ${score} · ${count}`}>{onCell&&count?<button type="button" onClick={()=>onCell({l,c})}>{count}</button>:<span>{count||''}</span>}<small>{score}</small></td>})}</tr>)}
    <tr><th aria-hidden="true"/>{[1,2,3,4,5].map(l=><th key={l} scope="col" title={LIKELIHOOD[l-1][en?'en':'el']}>{l}</th>)}</tr>
   </tbody></table>
   <span className="risk-heatmap-axis risk-heatmap-axis-l">{L(en,'Πιθανότητα (L)','Likelihood (L)')}</span>
   {empty&&emptyNote&&<p className="risk-heatmap-empty">{emptyNote}</p>}
  </div>
 </figure>
}

export function LevelLegend({en,showResponse=false}){
 return <ul className={`risk-legend${showResponse?' risk-legend-full':''}`}>{LEVELS.map(x=><li key={x.id}><span className={`risk-swatch risk-cell-${x.id}`}/><strong>{en?x.en:x.el}</strong><small>{x.range}</small>{showResponse&&<em>{en?x.responseEn:x.responseEl}</em>}</li>)}</ul>
}

export function AxisSelect({label,value,onChange,scale,en,disabled=false}){
 return <label className="risk-axis-select"><span>{label}</span><select value={value??''} disabled={disabled} onChange={e=>onChange(e.target.value?Number(e.target.value):null)}><option value="">—</option>{scale.map(x=><option key={x.value} value={x.value}>{x.value} · {en?x.en:x.el}</option>)}</select></label>
}

export const STATUS_LABELS={draft:['Πρόχειρο','Draft'],under_review:['Σε έλεγχο','Under review'],approved:['Εγκεκριμένη','Approved'],archived:['Αρχειοθετημένη','Archived']}
export const statusLabel=(id,en)=>STATUS_LABELS[id]?.[en?1:0]||id
export const statusTone=id=>id==='approved'?'active':id==='under_review'?'warning':''
export const PERIOD_KINDS={annual:['Ετήσια','Annual'],semester:['Εξαμηνιαία','Six-monthly'],quarter:['Τριμηνιαία','Quarterly'],other:['Άλλη','Other']}
export const fmtDate=(value,locale)=>value?new Intl.DateTimeFormat(locale).format(new Date(`${String(value).slice(0,10)}T12:00:00`)):'—'
