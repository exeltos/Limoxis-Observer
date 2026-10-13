import { useMemo,useState } from 'react'
import { ClipboardX,Hourglass,Lightbulb,Pencil,Plus,Trash2,TrendingUp } from 'lucide-react'
import { FilterBar,FilterSelect } from '../../../design-system/FilterBar'
import { OverflowMenu } from '../../../design-system/OverflowMenu'
import { ActionButton } from '../../../design-system/ActionButton'
import { MetricCard } from '../../../design-system/MetricCard'
import { EFFECTIVENESS,OPPORTUNITY_RATINGS,normalizeOpportunity,opportunityCode,parseMeasures } from './riskModel'
import { L,returnedClass,usePaged } from './riskUi'

const pick=(list,id,en)=>{const x=list.find(item=>item.id===id);return x?(en?x.en:x.el):''}
export function RatingBadge({id,en}){return id?<span className={`status-badge ${id==='high'?'active':''}`}>{pick(OPPORTUNITY_RATINGS,id,en)}</span>:<span className="risk-axis-none">—</span>}
export function EffectivenessBadge({id,en}){const x=EFFECTIVENESS.find(item=>item.id===id);return x?<span className={`status-badge ${x.tone}`}>{en?x.en:x.el}</span>:<span className="risk-axis-none">{L(en,'Δεν αξιολογήθηκε','Not assessed')}</span>}

// What each KPI card keeps.
const QUICK={high:x=>x.o.ratingId==='high',noPlan:x=>!x.plan.length,unassessed:x=>!x.o.effectivenessStatus||x.o.effectivenessStatus==='pending'}

// Opportunities (ISO 9001 §6.1 risks and opportunities) of the assessment.
export function RiskOpportunities({items,en,canEdit,onOpen,onCreate,onDelete,actions=null,returned=''}){
 const [query,setQuery]=useState('')
 const [rating,setRating]=useState('all')
 const [effect,setEffect]=useState('all')
 const [owner,setOwner]=useState('all')
 const [quick,setQuick]=useState(null)
 const toggleQuick=id=>setQuick(current=>current===id?null:id)
 const all=useMemo(()=>items.map((item,i)=>{const o=normalizeOpportunity(item);return {item,o,code:opportunityCode(i),plan:parseMeasures(o.actionPlan)}}),[items])
 const owners=useMemo(()=>[...new Set(all.map(x=>x.o.owner).filter(Boolean))].sort(),[all])
 const counts=useMemo(()=>Object.fromEntries(Object.entries(QUICK).map(([id,test])=>[id,all.filter(test).length])),[all])
 const rows=all.filter(x=>!quick||QUICK[quick](x)).filter(({o,code})=>{
  const text=`${code} ${o.activity} ${o.opportunity} ${o.actionPlan} ${o.owner} ${o.effectiveness}`.toLowerCase()
  if(query&&!text.includes(query.toLowerCase()))return false
  if(rating!=='all'&&o.ratingId!==rating)return false
  if(effect==='none'?Boolean(o.effectivenessStatus):effect!=='all'&&o.effectivenessStatus!==effect)return false
  if(owner!=='all'&&o.owner!==owner)return false
  return true
 })
 const active=(rating!=='all')+(effect!=='all')+(owner!=='all')
 const {items:pageRows,pager}=usePaged(rows,{en,resetOn:JSON.stringify([query,rating,effect,owner,quick]),startIndex:rows.findIndex(x=>String(x.item.id)===returned)})
 return <div className="risk-opportunities">
  <div className="module-summary-strip risk-kpi-strip">
   <MetricCard icon={Lightbulb} value={all.length} label={L(en,'Ευκαιρίες','Opportunities')} onClick={()=>setQuick(null)} active={!quick}/>
   <MetricCard icon={TrendingUp} value={counts.high} label={L(en,'Υψηλής απόδοσης','High yield')} onClick={()=>toggleQuick('high')} active={quick==='high'}/>
   <MetricCard icon={ClipboardX} value={counts.noPlan} label={L(en,'Χωρίς σχέδιο δράσης','Without an action plan')} onClick={()=>toggleQuick('noPlan')} active={quick==='noPlan'}/>
   <MetricCard icon={Hourglass} value={counts.unassessed} label={L(en,'Χωρίς αξιολόγηση αποτελεσματικότητας','Effectiveness not assessed')} onClick={()=>toggleQuick('unassessed')} active={quick==='unassessed'}/>
  </div>
  <div className="risk-toolbar">
   <FilterBar query={query} onQueryChange={setQuery} placeholder={L(en,'Αναζήτηση ευκαιρίας, σχεδίου δράσης, υπευθύνου…','Search opportunity, action plan, owner…')} activeAdvancedCount={active+(quick?1:0)} onClear={()=>{setQuery('');setRating('all');setEffect('all');setOwner('all');setQuick(null)}}>
    <FilterSelect label={L(en,'Απόδοση','Yield')} value={rating} onChange={setRating}><option value="all">{L(en,'Όλες','All')}</option>{OPPORTUNITY_RATINGS.map(x=><option key={x.id} value={x.id}>{en?x.en:x.el}</option>)}</FilterSelect>
    <FilterSelect label={L(en,'Αποτελεσματικότητα','Effectiveness')} value={effect} onChange={setEffect}><option value="all">{L(en,'Όλες','All')}</option>{EFFECTIVENESS.map(x=><option key={x.id} value={x.id}>{en?x.en:x.el}</option>)}<option value="none">{L(en,'Δεν αξιολογήθηκε','Not assessed')}</option></FilterSelect>
    <FilterSelect label={L(en,'Υπεύθυνος','Owner')} value={owner} onChange={setOwner}><option value="all">{L(en,'Όλοι','All')}</option>{owners.map(x=><option key={x} value={x}>{x}</option>)}</FilterSelect>
   </FilterBar>
   <div className="risk-toolbar-actions">
    {canEdit&&<ActionButton label={L(en,'Νέα ευκαιρία','New opportunity')} tone="primary" onClick={onCreate}><Plus size={16}/><span>{L(en,'Νέα ευκαιρία','New opportunity')}</span></ActionButton>}
    {actions}
   </div>
  </div>
  <div className="scroll-table risk-table-wrap"><table className="data-table risk-table risk-opportunity-table"><thead><tr>
   <th>{L(en,'Κωδ.','Code')}</th><th>{L(en,'Ευκαιρία','Opportunity')}</th><th>{L(en,'Απόδοση','Yield')}</th><th>{L(en,'Σχέδιο δράσης','Action plan')}</th><th>{L(en,'Αποτελεσματικότητα','Effectiveness')}</th><th aria-label={L(en,'Ενέργειες','Actions')}/>
  </tr></thead><tbody>
   {pageRows.map(({item,o,code,plan})=><tr key={item.id} className={`risk-row-clickable${returnedClass(returned,item.id)}`} onClick={()=>onOpen(item)}>
    <td><strong>{code}</strong></td>
    <td className="risk-hazard"><span>{o.activity||'—'}</span>{o.opportunity&&<small className="risk-opportunity-text">{o.opportunity}</small>}</td>
    <td><RatingBadge id={o.ratingId} en={en}/></td>
    <td className="risk-opportunity-plan">{plan.length?<ol>{plan.map((step,i)=><li key={i}>{step}</li>)}</ol>:<span className="risk-axis-none">{L(en,'Χωρίς σχέδιο δράσης','No action plan')}</span>}{(o.owner||o.timeframe)&&<small>{[o.owner,o.timeframe].filter(Boolean).join(' · ')}</small>}</td>
    <td className="risk-opportunity-effect"><EffectivenessBadge id={o.effectivenessStatus} en={en}/>{o.effectiveness&&<small>{o.effectiveness}</small>}</td>
    <td onClick={e=>e.stopPropagation()}><OverflowMenu label={L(en,'Ενέργειες','Actions')} items={[{id:'edit',label:canEdit?L(en,'Επεξεργασία','Edit'):L(en,'Προβολή','View'),icon:Pencil,onClick:()=>onOpen(item)},...(canEdit?[{id:'delete',label:L(en,'Διαγραφή','Delete'),icon:Trash2,tone:'danger',separatorBefore:true,onClick:()=>onDelete(item)}]:[])]}/></td>
   </tr>)}
   {all.length>0&&!rows.length&&<tr><td colSpan={6} className="risk-empty-note">{L(en,'Καμία ευκαιρία με αυτά τα φίλτρα.','No opportunity matches these filters.')}</td></tr>}
  </tbody></table>{!all.length&&<div className="registry-empty-state"><strong>{L(en,'Δεν έχουν καταγραφεί ευκαιρίες','No opportunities recorded')}</strong><span>{L(en,'Καταγράψτε τις ευκαιρίες που μπορεί να αξιοποιήσει ο οργανισμός, με το σχέδιο δράσης και την αποτελεσματικότητά του.','Record the opportunities the organization can seize, with their action plan and its effectiveness.')}</span></div>}</div>
  {rows.length>0&&pager}
 </div>
}
