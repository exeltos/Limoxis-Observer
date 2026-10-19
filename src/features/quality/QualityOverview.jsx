import { useMemo } from 'react'
import { formatDay } from '../../core/i18n/formatDay'
import { daysUntil } from './QualityGlance'
import { isOpenRecord } from './QualityLists'
import { stageLabel } from './QualityReportRegister'
import { IMPACTS,INCIDENT_CLASSES,REPORT_KINDS,harmLevel,incidentCategoryLabel,qualityCode,reportKindOf,vocabularyLabel } from './qualityVocabulary'
import './risk/riskAssessment.css'

// The first tab of the Quality Center, built like the risk assessment's
// «Analysis»: what needs a decision first, what falls due next, then the
// reports of the last twelve months by month, category, department and harm.

const SOON_DAYS=14
const L=(en,el,enText)=>en?enText:el
const titleOf=(row,en)=>(en?row.titleEn:row.title)||row.title||''
const departmentOf=(row,en)=>(en?row.departmentEn:row.department)||row.department||''

// A short coloured figure in front of a list line: days late, days left, age.
function Chip({value,unit,tone='neutral',title}){
 return <span className={`quality-chip is-${tone}`} title={title}><strong>{value}</strong>{unit&&<small>{unit}</small>}</span>
}

function AttentionList({items,empty,onOpen}){
 if(!items.length)return <p className="risk-empty-note">{empty}</p>
 return <ol className="risk-list quality-attention-list">{items.map(item=><li key={item.key}><button type="button" onClick={()=>onOpen(item)}>
  <Chip {...item.chip}/><span><strong>{item.code} · {item.title}</strong><small>{item.meta.filter(Boolean).join(' · ')}</small></span>
 </button></li>)}</ol>
}

function Panel({title,caption,count,onAll,allLabel,children}){
 return <section className="risk-panel quality-panel">
  <header><h3>{title}{count>0&&<span className="quality-panel-count">{count}</span>}</h3>{caption&&<small>{caption}</small>}</header>
  {children}
  {onAll&&count>0&&<button type="button" className="quality-panel-all" onClick={onAll}>{allLabel}</button>}
 </section>
}

// Horizontal bars of a few groups, largest first; the value is written beside each bar.
function BarList({rows,empty}){
 const max=Math.max(1,...rows.map(row=>row.value))
 if(!rows.length)return <p className="risk-empty-note">{empty}</p>
 return <ul className="quality-bars">{rows.map(row=><li key={row.key} title={`${row.label}: ${row.value}`}>
  <span>{row.label}</span><span className="quality-bar"><i style={{width:`${row.value*100/max}%`}}/></span><strong>{row.value}</strong><small>{row.share!=null?`${row.share}%`:''}</small>
 </li>)}</ul>
}

// Twelve monthly columns, the current month last; each column shows its count.
function MonthColumns({months,en}){
 const max=Math.max(1,...months.map(month=>month.value))
 return <div className="quality-columns" role="img" aria-label={L(en,'Αναφορές ανά μήνα','Reports by month')}>
  {months.map(month=><div key={month.key} className="quality-column" title={`${month.label}: ${month.value}`}>
   <small>{month.value||''}</small><span><i style={{height:`${month.value*100/max}%`}}/></span><em>{month.short}</em>
  </div>)}
 </div>
}

const monthKey=date=>String(date||'').slice(0,7)
function lastMonths(count,locale){
 const now=new Date()
 return Array.from({length:count},(_,index)=>{
  const day=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-(count-1-index),1))
  return {key:day.toISOString().slice(0,7),short:day.toLocaleDateString(locale,{month:'short',timeZone:'UTC'}).replace('.',''),label:day.toLocaleDateString(locale,{month:'long',year:'numeric',timeZone:'UTC'})}
 })
}
function grouped(rows,keyOf,labelOf,limit=6){
 const counts=new Map()
 rows.forEach(row=>{const key=keyOf(row);if(key)counts.set(key,(counts.get(key)||0)+1)})
 const total=rows.length
 return [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,limit).map(([key,value])=>({key,label:labelOf(key),value,share:total?Math.round(value*100/total):null}))
}

export function QualityOverview({reports,capas,audits,objectives,language,categories,onOpen,onGo}){
 const en=language==='en'
 const locale=en?'en-GB':'el-GR'
 const data=useMemo(()=>{
  const plural=(n,one,many,oneEn,manyEn)=>en?(n===1?oneEn:manyEn):(n===1?one:many)
  const openReports=reports.filter(row=>!['closed','voided'].includes(row.stage))
  const openCapas=capas.filter(isOpenRecord)
  const sentinel=openReports.filter(row=>row.sentinel).map(row=>{const days=daysUntil(row.record.rcaDueDate);return {key:`s:${row.id}`,type:'incidents',id:row.id,rank:-1000+(days??0),code:row.code,title:titleOf(row,en),
   chip:days==null?{value:'RCA',tone:'danger'}:days<0?{value:-days,unit:L(en,'ημέρες καθυστέρηση','days late'),tone:'danger',title:L(en,'Ανάλυση ριζικής αιτίας εκπρόθεσμη','Root cause analysis overdue')}:{value:days,unit:L(en,'ημέρες για RCA','days to RCA'),tone:'danger'},
   meta:['Sentinel',departmentOf(row,en),stageLabel(row.stage,language)]}})
  const overdue=openCapas.filter(row=>row.dueDate&&daysUntil(row.dueDate)<0).map(row=>{const late=-daysUntil(row.dueDate);return {key:`c:${row.id}`,type:'capas',id:row.id,rank:-late,code:qualityCode(row,language),title:titleOf(row,en),chip:{value:late,unit:L(en,'ημέρες καθυστέρηση','days late'),tone:'danger'},meta:[L(en,'Εκπρόθεσμη διορθωτική ενέργεια','Overdue corrective action'),departmentOf(row,en),(row.owners?.length?row.owners:[row.owner]).filter(Boolean).join(', ')]}})
  const toAssess=openReports.filter(row=>row.stage==='toAssess'&&!row.sentinel).map(row=>{const age=Math.max(0,-(daysUntil(row.date)??0));return {key:`r:${row.id}`,type:'incidents',id:row.id,rank:1000-age,code:row.code,title:titleOf(row,en),chip:{value:age,unit:plural(age,'ημέρα','ημέρες','day','days'),tone:age>7?'warning':'neutral',title:L(en,'Από την αναφορά','Since reported')},meta:[L(en,'Προς αξιολόγηση','To assess'),vocabularyLabel(REPORT_KINDS,row.kind,language),departmentOf(row,en)]}})
  const decide=[...sentinel,...overdue,...toAssess].sort((a,b)=>a.rank-b.rank)
  const dueSoon=openCapas.filter(row=>{const days=daysUntil(row.dueDate);return days!=null&&days>=0&&days<=SOON_DAYS}).sort((a,b)=>String(a.dueDate).localeCompare(String(b.dueDate))).map(row=>{const days=daysUntil(row.dueDate);return {key:`d:${row.id}`,type:'capas',id:row.id,code:qualityCode(row,language),title:titleOf(row,en),chip:{value:days===0?L(en,'Σήμερα','Today'):days,unit:days===0?'':plural(days,'ημέρα','ημέρες','day','days'),tone:days<=7?'warning':'neutral'},meta:[formatDay(row.dueDate,language),departmentOf(row,en)]}})
  // CAPAs whose effectiveness is to be checked: in verification, or due for the check and still pending.
  const effectiveness=capas.filter(row=>row.lifecycleStatus!=='voided'&&(row.effectivenessStatus||'pending')==='pending'&&(row.status==='verification'||(row.effectivenessDue&&daysUntil(row.effectivenessDue)<=SOON_DAYS))).map(row=>{const days=daysUntil(row.effectivenessDue);return {key:`e:${row.id}`,type:'capas',id:row.id,code:qualityCode(row,language),title:titleOf(row,en),chip:days==null?{value:'✓?',tone:'warning'}:days<0?{value:-days,unit:L(en,'ημέρες καθυστέρηση','days late'),tone:'danger'}:{value:days,unit:plural(days,'ημέρα','ημέρες','day','days'),tone:'warning'},meta:[row.status==='verification'?L(en,'Σε επαλήθευση','In verification'):L(en,'Έλεγχος έως','Check by')+' '+formatDay(row.effectivenessDue,language),departmentOf(row,en)]}})
  const auditsDue=audits.filter(row=>!['completed','cancelled'].includes(row.status)&&row.lifecycleStatus!=='voided'&&row.plannedDate&&daysUntil(row.plannedDate)<=31).sort((a,b)=>String(a.plannedDate).localeCompare(String(b.plannedDate))).map(row=>{const days=daysUntil(row.plannedDate);return {key:`a:${row.id}`,type:'audits',id:row.id,code:qualityCode(row,language),title:titleOf(row,en),chip:days<0?{value:-days,unit:L(en,'ημέρες καθυστέρηση','days late'),tone:'danger'}:{value:days===0?L(en,'Σήμερα','Today'):days,unit:days===0?'':plural(days,'ημέρα','ημέρες','day','days'),tone:days<=7?'warning':'neutral'},meta:[formatDay(row.plannedDate,language),departmentOf(row,en),row.leadAuditor]}})
  const missed=objectives.filter(item=>(item.status||'active')==='active'&&item.current?.status==='missed').map(item=>({key:`o:${item.id}`,type:'objectives',id:item.id,code:item.code,title:item.title,chip:{value:'↓',tone:'danger'},meta:[item.ownerLabel,item.dueDate&&formatDay(item.dueDate,language)]}))

  // The last twelve months of reports.
  const months=lastMonths(12,locale)
  const since=months[0].key
  // Within the twelve months shown: a report dated ahead stays out until its month comes.
  const recent=reports.filter(row=>row.stage!=='voided'&&monthKey(row.date)>=since&&monthKey(row.date)<=months[months.length-1].key)
  const byMonth=months.map(month=>({...month,value:recent.filter(row=>monthKey(row.date)===month.key).length}))
  const byCategory=grouped(recent,row=>row.category,key=>incidentCategoryLabel(key,categories,language))
  const byDepartment=grouped(recent,row=>departmentOf(row,en),key=>key)
  const byKind=grouped(recent,row=>row.kind,key=>vocabularyLabel(REPORT_KINDS,key,language),4)
  // The outcome of the incidents that could reach a patient (WHO).
  const patientIncidents=recent.filter(row=>['clinical','nonClinical'].includes(reportKindOf(row.record)))
  const outcomeOf=row=>row.record.incidentClass==='harmful'?harmLevel(row.record.impact):row.record.incidentClass||'nearMiss'
  const outcomeLabel=key=>INCIDENT_CLASSES.some(item=>item.value===key)?vocabularyLabel(INCIDENT_CLASSES,key,language):`${L(en,'Βλάβη','Harm')}: ${vocabularyLabel(IMPACTS,key,language)}`
  const ORDER=['nearMiss','noHarm','mild','moderate','severe','death']
  const byOutcome=grouped(patientIncidents,outcomeOf,outcomeLabel,ORDER.length).sort((a,b)=>ORDER.indexOf(a.key)-ORDER.indexOf(b.key))
  return {decide,dueSoon,effectiveness,auditsDue,missed,byMonth,byCategory,byDepartment,byKind,byOutcome,recent:recent.length,patient:patientIncidents.length}
 },[reports,capas,audits,objectives,language,en,locale,categories])

 const open=item=>item.type==='objectives'?onGo('objectives'):onOpen(item.type,item.id)
 const all=L(en,'Όλα στη λίστα','All in the list')
 return <div className="risk-analysis quality-overview">
  <div className="risk-two-columns risk-analysis-decide">
   <Panel title={L(en,'Θέλει απόφαση τώρα','Needs a decision now')} caption={L(en,'Συμβάντα-φρουροί, εκπρόθεσμες ενέργειες, αναφορές προς αξιολόγηση','Sentinel events, overdue actions, reports to assess')} count={data.decide.length}>
    <AttentionList items={data.decide.slice(0,14)} onOpen={open} empty={L(en,'Τίποτα δεν περιμένει απόφαση.','Nothing is waiting for a decision.')}/>
    {data.decide.length>14&&<p className="risk-hint">{L(en,`Και ${data.decide.length-14} ακόμη.`,`And ${data.decide.length-14} more.`)}</p>}
   </Panel>
   <div className="risk-analysis-side">
    <Panel title={L(en,`Λήγουν σε ${SOON_DAYS} ημέρες`,`Due in ${SOON_DAYS} days`)} caption={L(en,'Διορθωτικές ενέργειες','Corrective actions')} count={data.dueSoon.length} onAll={()=>onGo('actions')} allLabel={all}>
     <AttentionList items={data.dueSoon.slice(0,6)} onOpen={open} empty={L(en,'Καμία ενέργεια δεν λήγει σύντομα.','No action falls due soon.')}/>
    </Panel>
    <Panel title={L(en,'Έλεγχος αποτελεσματικότητας','Effectiveness checks')} caption={L(en,'Άλλαξε κάτι μετά την ενέργεια;','Did the action change anything?')} count={data.effectiveness.length}>
     <AttentionList items={data.effectiveness.slice(0,6)} onOpen={open} empty={L(en,'Κανένας έλεγχος δεν οφείλεται.','No check is due.')}/>
    </Panel>
    <Panel title={L(en,'Επιθεωρήσεις','Audits')} caption={L(en,'Εκπρόθεσμες και του επόμενου μήνα','Overdue and next month')} count={data.auditsDue.length} onAll={()=>onGo('audits')} allLabel={all}>
     <AttentionList items={data.auditsDue.slice(0,6)} onOpen={open} empty={L(en,'Καμία επιθεώρηση τον επόμενο μήνα.','No audit next month.')}/>
    </Panel>
    {data.missed.length>0&&<Panel title={L(en,'Στόχοι εκτός πορείας','Objectives off track')} caption={L(en,'Ενεργοί στόχοι που δεν επιτυγχάνονται','Active objectives not met')} count={data.missed.length} onAll={()=>onGo('objectives')} allLabel={all}>
     <AttentionList items={data.missed.slice(0,6)} onOpen={open} empty=""/>
    </Panel>}
   </div>
  </div>
  <section className="risk-panel quality-panel">
   <header><h3>{L(en,'Αναφορές ανά μήνα','Reports by month')}</h3><small>{L(en,`${data.recent} τους τελευταίους 12 μήνες`,`${data.recent} in the last 12 months`)}</small></header>
   <MonthColumns months={data.byMonth} en={en}/>
  </section>
  <div className="quality-breakdowns">
   <section className="risk-panel quality-panel"><header><h3>{L(en,'Ανά κατηγορία','By category')}</h3><small>{L(en,'12 μήνες','12 months')}</small></header><BarList rows={data.byCategory} empty={L(en,'Καμία αναφορά.','No reports.')}/></section>
   <section className="risk-panel quality-panel"><header><h3>{L(en,'Ανά τμήμα','By department')}</h3><small>{L(en,'Τα 6 με τις περισσότερες','Top 6')}</small></header><BarList rows={data.byDepartment} empty={L(en,'Καμία αναφορά.','No reports.')}/></section>
   <section className="risk-panel quality-panel"><header><h3>{L(en,'Είδος αναφοράς','Kind of report')}</h3><small>{L(en,'12 μήνες','12 months')}</small></header><BarList rows={data.byKind} empty={L(en,'Καμία αναφορά.','No reports.')}/></section>
   <section className="risk-panel quality-panel"><header><h3>{L(en,'Έκβαση για τον ασθενή','Outcome for the patient')}</h3><small>{L(en,`WHO · ${data.patient} συμβάντα`,`WHO · ${data.patient} incidents`)}</small></header><BarList rows={data.byOutcome} empty={L(en,'Κανένα κλινικό ή μη κλινικό συμβάν.','No clinical or non-clinical incident.')}/></section>
  </div>
 </div>
}
