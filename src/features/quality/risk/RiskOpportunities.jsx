import { useMemo,useState } from 'react'
import { ChevronRight,Plus } from 'lucide-react'
import { FilterBar,FilterSelect } from '../../../design-system/FilterBar'
import { ActionButton } from '../../../design-system/ActionButton'
import { RegistryTable } from '../../../design-system/RegistryTable'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { EFFECTIVENESS,OPPORTUNITY_RATINGS,normalizeOpportunity,opportunityCode,parseMeasures } from './riskModel'
import { L,defaultFrame,returnedClass,usePaged } from './riskUi'

const pick=(list,id,en)=>{const x=list.find(item=>item.id===id);return x?(en?x.en:x.el):''}
export function RatingBadge({id,en}){return id?<StatusBadge tone={id==='high'?'success':'neutral'}>{pick(OPPORTUNITY_RATINGS,id,en)}</StatusBadge>:<span className="risk-axis-none">—</span>}
export function EffectivenessBadge({id,en}){const x=EFFECTIVENESS.find(item=>item.id===id);return x?<StatusBadge tone={x.tone||'neutral'}>{en?x.en:x.el}</StatusBadge>:<span className="risk-axis-none">{L(en,'Δεν αξιολογήθηκε','Not assessed')}</span>}

// What each KPI card keeps.
const QUICK={high:x=>x.o.ratingId==='high',noPlan:x=>!x.plan.length,unassessed:x=>!x.o.effectivenessStatus||x.o.effectivenessStatus==='pending'}

// Opportunities (ISO 9001 §6.1 risks and opportunities) of the assessment.
export function RiskOpportunities({items,en,canEdit,onOpen,onCreate,actions=null,returned='',frame=defaultFrame}){
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
 const line=(id,value,label,late=false)=><button key={id} type="button" className={`${late&&value?'is-late':''}${quick===id?' is-active':''}`.trim()} onClick={()=>toggleQuick(id)}><b>{value}</b> {label}</button>
 const kpis=<div className="quality-summary-line risk-summary-line risk-figures-line">
   <button type="button" className={!quick?'is-active':undefined} onClick={()=>setQuick(null)}><b>{all.length}</b> {L(en,'ευκαιρίες','opportunities')}</button>
   {line('high',counts.high,L(en,'υψηλής απόδοσης','high yield'))}
   {line('noPlan',counts.noPlan,L(en,'χωρίς σχέδιο δράσης','without an action plan'),true)}
   {line('unassessed',counts.unassessed,L(en,'χωρίς αξιολόγηση αποτελεσματικότητας','effectiveness not assessed'),true)}
 </div>
 return frame(kpis,<>
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
  <RegistryTable sortable={false} wrapperClassName="scroll-table risk-table-wrap" className="risk-table risk-opportunity-table" rows={pageRows} rowKey={({item})=>item.id}
   columns={[{key:'code',label:L(en,'Κωδ.','Code')},{key:'opportunity',label:L(en,'Ευκαιρία','Opportunity')},{key:'rating',label:L(en,'Απόδοση','Yield')},{key:'plan',label:L(en,'Σχέδιο δράσης','Action plan')},{key:'owner',label:L(en,'Υπεύθυνος','Owner')},{key:'effect',label:L(en,'Αποτελεσματικότητα','Effectiveness')},{key:'open',label:''}]}
   rowProps={({item})=>({className:`risk-row-clickable${returnedClass(returned,item.id)}`,onClick:()=>onOpen(item)})}
   emptyTitle={all.length?L(en,'Καμία ευκαιρία με αυτά τα φίλτρα.','No opportunity matches these filters.'):L(en,'Δεν έχουν καταγραφεί ευκαιρίες','No opportunities recorded')} emptyText={all.length?'':L(en,'Καταγράψτε τις ευκαιρίες που μπορεί να αξιοποιήσει ο οργανισμός, με το σχέδιο δράσης και την αποτελεσματικότητά του.','Record the opportunities the organization can seize, with their action plan and its effectiveness.')}
   renderRow={({item,o,code,plan})=><>
    <td><strong>{code}</strong></td>
    <td className="risk-hazard"><span>{o.activity||'—'}</span>{o.opportunity&&<small className="risk-opportunity-text">{o.opportunity}</small>}</td>
    <td><RatingBadge id={o.ratingId} en={en}/></td>
    <td className="risk-opportunity-plan">{plan.length?<span className="risk-plan-line" title={plan.map((step,i)=>`${i+1}. ${step}`).join('\n')}><b>{plan.length}</b> {plan[0]}</span>:<span className="risk-axis-none">{L(en,'Χωρίς σχέδιο δράσης','No action plan')}</span>}</td>
    <td className="risk-opportunity-owner" title={o.owner||undefined}><span>{o.owner||'—'}</span>{o.timeframe&&<small>{o.timeframe}</small>}</td>
    <td className="risk-opportunity-effect" title={o.effectiveness||undefined}><EffectivenessBadge id={o.effectivenessStatus} en={en}/></td>
    <td className="risk-open-cell"><button type="button" className="risk-open-button" aria-label={L(en,'Άνοιγμα ευκαιρίας','Open the opportunity')} onClick={e=>{e.stopPropagation();onOpen(item)}}><ChevronRight size={15}/></button></td>
   </>}/>
  {rows.length>0&&pager}
 </>,{registry:true,name:'risk-opportunities'})
}
