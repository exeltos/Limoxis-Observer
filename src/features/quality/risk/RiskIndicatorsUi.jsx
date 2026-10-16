import { useMemo,useState } from 'react'
import { ArrowDownRight,ArrowRight,ArrowUpRight,Gauge,Plus,X } from 'lucide-react'
import { ObserverDialog,DialogActions } from '../../../design-system/ObserverDialog'
import { ChoiceChips } from '../../../design-system/ChoiceChips'
import { RegistryTable } from '../../../design-system/RegistryTable'
import { SearchableSelect } from '../../../design-system/SearchableSelect'
import { suggestIndicators } from './riskIndicators'
import { L,usePaged } from './riskUi'

const CATEGORIES={surveillance:['Επιτήρηση','Surveillance'],laboratory:['Εργαστήριο','Laboratory'],pharmacy:['Φαρμακείο','Pharmacy'],prevention:['Πρόληψη','Prevention'],quality:['Ποιότητα','Quality'],workforce:['Προσωπικό','Workforce']}
const TREND_ICON={better:ArrowDownRight,worse:ArrowUpRight,steady:ArrowRight}
const title=(item,en)=>item?(en?item.titleEn:item.titleEl):''
const number=value=>value==null?'—':String(value).replace('.',',')

// One linked indicator: name, value of the last 90 days and its trend.
export function IndicatorChip({indicatorKey,values,en,onRemove,compact=false}){
 const item=values?.get(indicatorKey)
 const trend=item?.trend||'steady',Icon=TREND_ICON[trend]
 const name=item?title(item,en):indicatorKey
 const trendLabel=trend==='better'?L(en,'βελτιώνεται','improving'):trend==='worse'?L(en,'χειροτερεύει','worsening'):L(en,'σταθερός','steady')
 const tip=item?`${name}: ${number(item.value)}${item.unit?` ${en?item.unitEn||item.unit:item.unit}`:''}${item.target!=null?` · ${L(en,'στόχος','target')} ${number(item.target)}`:''} · ${L(en,'90 ημέρες','90 days')} · ${trendLabel}`:name
 return <span className={`risk-indicator-chip trend-${trend}${item?.status==='attention'?' attention':''}${compact?' compact':''}`} title={tip}>
  <Gauge size={12} aria-hidden="true"/><span className="risk-indicator-name">{name}</span>
  {item&&<strong>{number(item.value)}</strong>}{item&&<Icon size={12} aria-label={trendLabel}/>}
  {onRemove&&<button type="button" onClick={onRemove} aria-label={L(en,`Αφαίρεση: ${name}`,`Remove: ${name}`)}><X size={12}/></button>}
 </span>
}

// The register's column: how many indicators measure the risk; red when one is
// off target, with every name, value and trend in the tooltip.
export function IndicatorBadge({keys=[],values,en}){
 if(!keys.length)return <span className="risk-indicator-badge empty">—</span>
 const items=keys.map(key=>values?.get(key)).filter(Boolean)
 const attention=items.some(item=>item.status==='attention'),worse=items.some(item=>item.trend==='worse')
 const tip=keys.map(key=>{const item=values?.get(key);return item?`${title(item,en)}: ${number(item.value)}${item.unit?` ${en?item.unitEn||item.unit:item.unit}`:''}`:key}).join('\n')
 return <span className={`risk-indicator-badge${attention?' attention':''}`} title={tip}><Gauge size={12} aria-hidden="true"/>{keys.length}{worse&&<ArrowUpRight size={12} aria-label={L(en,'κάποιος χειροτερεύει','one is worsening')}/>}</span>
}

// The editor field: linked indicators, the ones proposed from the risk's wording, and a list to add from.
export function IndicatorPicker({risk,values,en,disabled,onChange}){
 const keys=useMemo(()=>risk.indicatorKeys||[],[risk.indicatorKeys])
 const available=useMemo(()=>[...(values?.keys()||[])],[values])
 const suggested=suggestIndicators(risk,available)
 const groups=useMemo(()=>{const map=new Map();for(const item of values?.values()||[]){if(keys.includes(item.key))continue;const list=map.get(item.category)||[];list.push(item);map.set(item.category,list)}return [...map.entries()]},[values,keys])
 const set=next=>onChange([...new Set(next)])
 return <div className="risk-field risk-field-wide risk-indicator-picker">
  <span>{L(en,'Δείκτες παρακολούθησης','Monitoring indicators')}<small>{L(en,'από τους Δείκτες της εφαρμογής · τιμή 90 ημερών','from the app’s Indicators · 90-day value')}</small></span>
  <div className="risk-indicator-chips">
   {keys.map(key=><IndicatorChip key={key} indicatorKey={key} values={values} en={en} onRemove={disabled?null:()=>set(keys.filter(k=>k!==key))}/>)}
   {!keys.length&&<em>{L(en,'Κανένας δείκτης ακόμη.','No indicator yet.')}</em>}
  </div>
  {!disabled&&<div className="risk-indicator-add">
   {suggested.length>0&&<span className="risk-indicator-suggested">{L(en,'Προτείνονται:','Suggested:')}{suggested.map(key=><button type="button" key={key} onClick={()=>set([...keys,key])}><Plus size={12}/>{title(values.get(key),en)}</button>)}</span>}
   {groups.length>0&&<SearchableSelect className="risk-indicator-select" label={L(en,'Προσθήκη δείκτη','Add an indicator')} hideLabel value="" placeholder={L(en,'Προσθήκη δείκτη…','Add an indicator…')} emptyLabel={L(en,'Κανένας δείκτης','No indicator')} onChange={v=>{if(v)set([...keys,v])}} options={groups.flatMap(([category,items])=>items.map(item=>({value:item.key,label:title(item,en),description:CATEGORIES[category]?.[en?1:0]||category})))}/>}
  </div>}
 </div>
}

// Analysis: every linked indicator with its value, target, trend and the risks it measures.
export function RiskIndicatorTable({risks,values,en,onOpen}){
 const rows=useMemo(()=>{const map=new Map();for(const risk of risks)for(const key of risk.indicatorKeys||[]){const list=map.get(key)||[];list.push(risk);map.set(key,list)};return [...map.entries()].map(([key,list])=>({key,item:values?.get(key),risks:list})).sort((a,b)=>b.risks.length-a.risks.length)},[risks,values])
 const unlinked=risks.filter(r=>!(r.indicatorKeys||[]).length).length
 const {items:pageRows,pager}=usePaged(rows,{en})
 return <section className="risk-panel">
  <header><h3>{L(en,'Δείκτες παρακολούθησης','Monitoring indicators')}</h3><span className="risk-hint">{L(en,`${unlinked} από ${risks.length} κινδύνους χωρίς δείκτη`,`${unlinked} of ${risks.length} risks without an indicator`)}</span></header>
  {rows.length?<><RegistryTable className="risk-indicator-table" rows={pageRows} rowKey={({key})=>key}
   columns={[{key:'indicator',label:L(en,'Δείκτης','Indicator')},{key:'value',label:L(en,'Τιμή (90 ημ.)','Value (90 d)')},{key:'target',label:L(en,'Στόχος','Target')},{key:'trend',label:L(en,'Τάση','Trend')},{key:'risks',label:L(en,'Κίνδυνοι','Risks')}]}
   renderRow={({key,item,risks:list})=><><td><IndicatorChip indicatorKey={key} values={values} en={en}/></td><td><strong>{number(item?.value)}</strong>{item?.unit&&<small> {en?item.unitEn||item.unit:item.unit}</small>}</td><td>{number(item?.target)}</td><td>{item?<span className={`risk-trend-label trend-${item.trend}`}>{item.trend==='better'?L(en,'Βελτίωση','Improving'):item.trend==='worse'?L(en,'Επιδείνωση','Worsening'):L(en,'Σταθερός','Steady')}</span>:'—'}</td><td className="risk-indicator-risks">{list.map(r=><button type="button" key={r.id||r.lineageKey} onClick={()=>onOpen(r)}>{r.lineageKey}</button>)}</td></>}/>{rows.length>15&&pager}</>:<p className="risk-hint">{L(en,'Δεν έχουν συνδεθεί δείκτες. Από το «…» → «Αντιστοίχιση δεικτών» ή μέσα σε κάθε κίνδυνο.','No indicators linked yet. Use “…” → “Link indicators”, or open a risk.')}</p>}
 </section>
}

// Bulk linking: the indicators proposed for every risk, ticked, to confirm at once.
export function LinkIndicatorsDialog({risks,values,en,saving,onClose,onSave}){
 const available=useMemo(()=>[...(values?.keys()||[])],[values])
 const proposals=useMemo(()=>risks.map(risk=>({risk,keys:suggestIndicators(risk,available)})).filter(p=>p.keys.length),[risks,available])
 const [picked,setPicked]=useState(()=>new Set(proposals.flatMap(p=>p.keys.map(k=>`${p.risk.lineageKey}|${k}`))))
 const toggle=id=>setPicked(current=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next})
 const count=picked.size
 return <ObserverDialog width="wide" title={L(en,'Αντιστοίχιση δεικτών','Link indicators')} onClose={onClose}
  footer={<DialogActions onCancel={onClose} showCancel disabled={!count||saving} onSave={()=>onSave(proposals.map(p=>({risk:p.risk,keys:p.keys.filter(k=>picked.has(`${p.risk.lineageKey}|${k}`))})).filter(p=>p.keys.length))} saveLabel={L(en,`Σύνδεση ${count} δεικτών`,`Link ${count} indicators`)}/>}>
  <p className="risk-hint">{L(en,'Προτάσεις από τη διατύπωση κάθε κινδύνου και το πεδίο «δείκτης» του αρχείου. Ξετσεκάρετε ό,τι δεν ταιριάζει· οι υπάρχοντες δείκτες μένουν.','Proposals from each risk’s wording and the file’s “indicator” field. Untick what does not fit; indicators already linked stay.')}</p>
  {proposals.length?<RegistryTable wrapperClassName="scroll-table risk-link-table" rows={proposals} rowKey={({risk})=>risk.lineageKey}
   columns={[{key:'code',label:L(en,'Κωδ.','Code')},{key:'risk',label:L(en,'Κίνδυνος','Risk')},{key:'proposed',label:L(en,'Προτεινόμενοι δείκτες','Proposed indicators')}]}
   renderRow={({risk,keys})=><><td><strong>{risk.lineageKey}</strong></td><td><span className="risk-link-hazard">{risk.hazard}</span>{risk.indicator&&<small>{L(en,'Στο αρχείο','In the file')}: {risk.indicator}</small>}</td><td className="risk-link-options"><ChoiceChips options={keys.map(key=>({value:key,label:title(values.get(key),en)}))} selected={keys.filter(key=>picked.has(`${risk.lineageKey}|${key}`))} onToggle={key=>toggle(`${risk.lineageKey}|${key}`)}/></td></>}/>:<p className="risk-hint">{L(en,'Δεν βρέθηκαν προτάσεις.','No proposals found.')}</p>}
 </ObserverDialog>
}
