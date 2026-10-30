import { useMemo,useState } from 'react'
import { auditReadiness } from './audits/auditModel'
import { standardShort } from './audits/auditStandards'
import { formatDay } from '../../core/i18n/formatDay'
import { daysUntil } from './QualityGlance'
import { isOpenRecord } from './QualityLists'
import { stageLabel } from './QualityReportRegister'
import { IMPACTS,INCIDENT_CLASSES,REPORT_KINDS,harmLevel,incidentCategoryLabel,qualityCode,reportKindOf,vocabularyLabel } from './qualityVocabulary'
import './risk/riskAssessment.css'
import { roleTitleText } from '../../core/i18n/roleTitles'

// The first tab of the Quality Center, built like the risk assessment's
// «Analysis»: what needs a decision first, what falls due next, then the
// reports of the last twelve months by month, category, department and harm.

const SOON_DAYS=30
const FIRST=8
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
// A row can be picked (filters the other charts) and can carry the change from the previous period.
function Delta({row,en}){
 if(row.prev==null)return null
 const diff=row.value-row.prev
 return <small className={`quality-delta${diff>0?' is-up':diff<0?' is-down':''}`} title={L(en,`Προηγούμενη περίοδος: ${row.prev}`,`Previous period: ${row.prev}`)}>{diff>0?'▲ +':diff<0?'▼ −':'= '}{diff===0?0:Math.abs(diff)}</small>
}
function BarList({rows,empty,en,onPick,picked}){
 const max=Math.max(1,...rows.map(row=>Math.max(row.value,row.prev||0)))
 if(!rows.length)return <p className="risk-empty-note">{empty}</p>
 return <ul className="quality-bars">{rows.map(row=>{
  const body=<>
   <span>{row.label}</span><span className="quality-bar">{row.prev!=null&&<b style={{width:`${row.prev*100/max}%`}}/>}<i style={{width:`${row.value*100/max}%`}}/></span><strong>{row.value}</strong>{row.prev!=null?<Delta row={row} en={en}/>:<small>{row.share!=null?`${row.share}%`:''}</small>}
  </>
  return <li key={row.key} title={`${row.label}: ${row.value}`} className={picked===row.key?'is-picked':undefined}>
   {onPick?<button type="button" aria-pressed={picked===row.key} onClick={()=>onPick(picked===row.key?null:row.key)}>{body}</button>:body}
  </li>})}</ul>
}

// Monthly columns, the current month last; each column shows its count and can be picked.
function MonthColumns({months,en,picked,onPick}){
 const max=Math.max(1,...months.map(month=>Math.max(month.value,month.prev||0)))
 return <div className="quality-columns" style={{gridTemplateColumns:`repeat(${months.length},minmax(0,1fr))`}} role="group" aria-label={L(en,'Αναφορές ανά μήνα','Reports by month')}>
  {months.map(month=><button type="button" key={month.key} className={`quality-column${picked.includes(month.key)?' is-picked':''}`} aria-pressed={picked.includes(month.key)} onClick={()=>onPick(month.key)}
   title={`${month.label}: ${month.value}${month.prev!=null?` · ${L(en,'πριν','before')}: ${month.prev}`:''}`}>
   <small>{month.value||''}</small><span>{month.prev!=null&&<b style={{height:`${month.prev*100/max}%`}}/>}<i style={{height:`${month.value*100/max}%`}}/></span><em>{month.short}</em>
  </button>)}
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
function grouped(rows,keyOf,labelOf,limit=6,prevRows){
 const count=list=>{const counts=new Map();list.forEach(row=>{const key=keyOf(row);if(key)counts.set(key,(counts.get(key)||0)+1)});return counts}
 const counts=count(rows),before=prevRows&&count(prevRows)
 const total=rows.length
 return [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,limit).map(([key,value])=>({key,label:labelOf(key),value,share:total?Math.round(value*100/total):null,prev:before?(before.get(key)||0):undefined}))
}
const shiftMonth=(key,by)=>{const [y,m]=key.split('-').map(Number);return new Date(Date.UTC(y,m-1+by,1)).toISOString().slice(0,7)}
const PERIODS=[3,6,12]

export function QualityOverview({reports,capas,audits,findings=[],objectives,language,categories,onOpen,onGo,onMeetings}){
 const en=language==='en'
 const locale=en?'en-GB':'el-GR'
 const data=useMemo(()=>{
  const plural=(n,one,many,oneEn,manyEn)=>en?(n===1?oneEn:manyEn):(n===1?one:many)
  const openReports=reports.filter(row=>!['closed','voided'].includes(row.stage))
  const openCapas=capas.filter(isOpenRecord)
  const sentinel=openReports.filter(row=>row.sentinel).map(row=>{const days=daysUntil(row.record.rcaDueDate);return {key:`s:${row.id}`,type:'incidents',id:row.id,rank:-1000+(days??0),code:row.code,title:titleOf(row,en),
   chip:days==null?{value:'RCA',tone:'danger'}:days<0?{value:-days,unit:L(en,'ημέρες καθυστέρηση','days late'),tone:'danger',title:L(en,'Ανάλυση ριζικής αιτίας εκπρόθεσμη','Root cause analysis overdue')}:{value:days,unit:L(en,'ημέρες για RCA','days to RCA'),tone:'danger'},
   meta:['Sentinel',departmentOf(row,en),stageLabel(row.stage,language)]}})
  const overdue=openCapas.filter(row=>row.dueDate&&daysUntil(row.dueDate)<0).map(row=>{const late=-daysUntil(row.dueDate);return {key:`c:${row.id}`,type:'capas',id:row.id,rank:-late,code:qualityCode(row,language),title:titleOf(row,en),chip:{value:late,unit:L(en,'ημέρες καθυστέρηση','days late'),tone:'danger'},meta:[L(en,'Εκπρόθεσμη διορθωτική ενέργεια','Overdue corrective action'),departmentOf(row,en),(row.owners?.length?row.owners:[row.owner]).filter(Boolean).map(name=>roleTitleText(name,language)).join(', ')]}})
  const toAssess=openReports.filter(row=>row.stage==='toAssess'&&!row.sentinel).map(row=>{const age=Math.max(0,-(daysUntil(row.date)??0));return {key:`r:${row.id}`,type:'incidents',id:row.id,rank:1000-age,code:row.code,title:titleOf(row,en),chip:{value:age,unit:plural(age,'ημέρα','ημέρες','day','days'),tone:age>7?'warning':'neutral',title:L(en,'Από την αναφορά','Since reported')},meta:[L(en,'Προς αξιολόγηση','To assess'),vocabularyLabel(REPORT_KINDS,row.kind,language),departmentOf(row,en)]}})
  const decide=[...sentinel,...overdue,...toAssess].sort((a,b)=>a.rank-b.rank)
  const dueSoon=openCapas.filter(row=>{const days=daysUntil(row.dueDate);return days!=null&&days>=0&&days<=SOON_DAYS}).sort((a,b)=>String(a.dueDate).localeCompare(String(b.dueDate))).map(row=>{const days=daysUntil(row.dueDate);return {key:`d:${row.id}`,type:'capas',id:row.id,days,kind:L(en,'Λήξη ενέργειας','Action due'),code:qualityCode(row,language),title:titleOf(row,en),chip:{value:days===0?L(en,'Σήμερα','Today'):days,unit:days===0?'':plural(days,'ημέρα','ημέρες','day','days'),tone:days<=7?'warning':'neutral'},meta:[formatDay(row.dueDate,language),departmentOf(row,en)]}})
  // CAPAs whose effectiveness is to be checked: in verification, or due for the check and still pending.
  const effectiveness=capas.filter(row=>row.lifecycleStatus!=='voided'&&(row.effectivenessStatus||'pending')==='pending'&&(row.status==='verification'||(row.effectivenessDue&&daysUntil(row.effectivenessDue)<=SOON_DAYS))).map(row=>{const days=daysUntil(row.effectivenessDue);return {key:`e:${row.id}`,type:'capas',id:row.id,days:days??0,kind:L(en,'Έλεγχος αποτελεσματικότητας','Effectiveness check'),code:qualityCode(row,language),title:titleOf(row,en),chip:days==null?{value:'✓?',tone:'warning'}:days<0?{value:-days,unit:L(en,'ημέρες καθυστέρηση','days late'),tone:'danger'}:{value:days,unit:plural(days,'ημέρα','ημέρες','day','days'),tone:'warning'},meta:[row.status==='verification'?L(en,'Σε επαλήθευση','In verification'):L(en,'Έλεγχος έως','Check by')+' '+formatDay(row.effectivenessDue,language),departmentOf(row,en)]}})
  const auditsDue=audits.filter(row=>!['completed','cancelled'].includes(row.status)&&row.lifecycleStatus!=='voided'&&row.plannedDate&&daysUntil(row.plannedDate)<=SOON_DAYS).sort((a,b)=>String(a.plannedDate).localeCompare(String(b.plannedDate))).map(row=>{const days=daysUntil(row.plannedDate);return {key:`a:${row.id}`,type:'audits',id:row.id,days,kind:L(en,'Επιθεώρηση','Audit'),code:qualityCode(row,language),title:titleOf(row,en),chip:days<0?{value:-days,unit:L(en,'ημέρες καθυστέρηση','days late'),tone:'danger'}:{value:days===0?L(en,'Σήμερα','Today'):days,unit:days===0?'':plural(days,'ημέρα','ημέρες','day','days'),tone:days<=7?'warning':'neutral'},meta:[formatDay(row.plannedDate,language),departmentOf(row,en),roleTitleText(row.leadAuditor,language)]}})
  const missed=objectives.filter(item=>(item.status||'active')==='active'&&item.current?.status==='missed').map(item=>({key:`o:${item.id}`,type:'objectives',id:item.id,days:-1,kind:L(en,'Στόχος εκτός πορείας','Objective off track'),code:item.code,title:(language==='en'&&item.titleEn)||item.title,chip:{value:'↓',tone:'danger'},meta:[roleTitleText(item.ownerLabel,language),item.dueDate&&formatDay(item.dueDate,language)]}))

  const next=[...dueSoon,...effectiveness,...auditsDue,...missed].sort((a,b)=>(a.days??0)-(b.days??0)).map(item=>({...item,meta:[item.kind,...item.meta]}))
  const readiness=auditReadiness(audits,findings).rows.filter(row=>row.rate!=null)
  return {decide,next,readiness}
 },[reports,capas,audits,findings,objectives,language,en])

 // The reports by month and in groups: a period of 3, 6 or 12 months, optionally against the one before it.
 const [period,setPeriod]=useState(12)
 const [compare,setCompare]=useState(false)
 const [pickedMonths,setPickedMonths]=useState([])
 const [category,setCategory]=useState(null)
 const [department,setDepartment]=useState(null)
 const pickMonth=key=>setPickedMonths(list=>list.includes(key)?list.filter(item=>item!==key):[...list,key])
 const changePeriod=value=>{setPeriod(value);setPickedMonths([])}
 const stats=useMemo(()=>{
  const all=lastMonths(period*2,locale)
  const months=all.slice(period),before=all.slice(0,period)
  const since=months[0].key,until=months[months.length-1].key
  const base=reports.filter(row=>row.stage!=='voided')
  const catOf=row=>row.category,depOf=row=>departmentOf(row,en)
  const pass=(row,skip)=>(skip==='category'||!category||catOf(row)===category)&&(skip==='department'||!department||depOf(row)===department)
  const inMonths=(row,keys)=>keys.includes(monthKey(row.date))
  const chosen=pickedMonths.length?pickedMonths:months.map(month=>month.key)
  const chosenBefore=chosen.map(key=>shiftMonth(key,-period))
  const rows=skip=>base.filter(row=>inMonths(row,chosen)&&pass(row,skip))
  const prevRows=skip=>compare?base.filter(row=>inMonths(row,chosenBefore)&&pass(row,skip)):undefined
  const monthRows=base.filter(row=>pass(row))
  const monthCount=key=>monthRows.filter(row=>monthKey(row.date)===key).length
  const byMonth=months.map((month,index)=>({...month,value:monthCount(month.key),prev:compare?monthCount(before[index].key):undefined}))
  const current=rows()
  const patientOf=list=>list?.filter(row=>['clinical','nonClinical'].includes(reportKindOf(row.record)))
  const patientIncidents=patientOf(current)
  const outcomeOf=row=>row.record.incidentClass==='harmful'?harmLevel(row.record.impact):row.record.incidentClass||'nearMiss'
  const outcomeLabel=key=>INCIDENT_CLASSES.some(item=>item.value===key)?vocabularyLabel(INCIDENT_CLASSES,key,language):`${L(en,'Βλάβη','Harm')}: ${vocabularyLabel(IMPACTS,key,language)}`
  const ORDER=['nearMiss','noHarm','mild','moderate','severe','death']
  const total=current.length,totalBefore=compare?prevRows().length:null
  return {
   byMonth,total,totalBefore,since,until,
   byCategory:grouped(rows('category'),catOf,key=>incidentCategoryLabel(key,categories,language),6,prevRows('category')),
   byDepartment:grouped(rows('department'),depOf,key=>key,6,prevRows('department')),
   byKind:grouped(current,row=>row.kind,key=>vocabularyLabel(REPORT_KINDS,key,language),4,prevRows()),
   byOutcome:grouped(patientIncidents,outcomeOf,outcomeLabel,ORDER.length,patientOf(prevRows())).sort((a,b)=>ORDER.indexOf(a.key)-ORDER.indexOf(b.key)),
   patient:patientIncidents.length,
   pickedLabels:chosen.length&&pickedMonths.length?months.filter(month=>pickedMonths.includes(month.key)).map(month=>month.label):[]
  }
 },[reports,period,compare,pickedMonths,category,department,language,en,locale,categories])
 const catLabel=category?incidentCategoryLabel(category,categories,language):null
 const hasFilter=pickedMonths.length>0||category||department
 const clearFilters=()=>{setPickedMonths([]);setCategory(null);setDepartment(null)}

 const open=item=>item.type==='objectives'?onGo('objectives'):onOpen(item.type,item.id)
 const [allDecide,setAllDecide]=useState(false)
 const [allNext,setAllNext]=useState(false)
 const more=(count,shown,toggle)=>count>FIRST&&<button type="button" className="quality-panel-all" onClick={toggle}>{shown?L(en,'Λιγότερα','Less'):L(en,`Όλα (${count})`,`All (${count})`)}</button>
 return <div className="risk-analysis quality-overview">
  {(data.readiness.length>0||onMeetings)&&<p className="quality-summary-line quality-overview-links">
   {data.readiness.length>0&&<button type="button" onClick={()=>onGo('readiness')}>{L(en,'Ετοιμότητα επιθεωρήσεων','Audit readiness')}: {data.readiness.map(row=><span key={row.standard} className={row.rate<80?'is-late':undefined}> {standardShort(row.standard)} <b>{row.rate}%</b></span>)}</button>}
   {onMeetings&&<button type="button" onClick={onMeetings}>{L(en,'Συνεδριάσεις & αποφάσεις','Meetings & decisions')} →</button>}
  </p>}
  <div className="risk-two-columns risk-analysis-decide">
   <Panel title={L(en,'Θέλει απόφαση τώρα','Needs a decision now')} caption={L(en,'Συμβάντα-φρουροί, εκπρόθεσμες ενέργειες, αναφορές προς αξιολόγηση','Sentinel events, overdue actions, reports to assess')} count={data.decide.length}>
    <AttentionList items={allDecide?data.decide:data.decide.slice(0,FIRST)} onOpen={open} empty={L(en,'Τίποτα δεν περιμένει απόφαση.','Nothing is waiting for a decision.')}/>
    {more(data.decide.length,allDecide,()=>setAllDecide(!allDecide))}
   </Panel>
   <Panel title={L(en,`Επόμενες ${SOON_DAYS} ημέρες`,`Next ${SOON_DAYS} days`)} caption={L(en,'Λήξεις ενεργειών, έλεγχοι αποτελεσματικότητας, επιθεωρήσεις, στόχοι','Actions due, effectiveness checks, audits, objectives')} count={data.next.length}>
    <AttentionList items={allNext?data.next:data.next.slice(0,FIRST)} onOpen={open} empty={L(en,'Τίποτα τις επόμενες ημέρες.','Nothing in the coming days.')}/>
    {more(data.next.length,allNext,()=>setAllNext(!allNext))}
   </Panel>
  </div>
  <div className="quality-period-bar">
   <div className="quality-period-options" role="group" aria-label={L(en,'Περίοδος','Period')}>
    {PERIODS.map(value=><button key={value} type="button" aria-pressed={period===value} className={period===value?'is-active':undefined} onClick={()=>changePeriod(value)}>{L(en,`${value} μήνες`,`${value} months`)}</button>)}
   </div>
   <label className="quality-compare-toggle"><input type="checkbox" checked={compare} onChange={event=>setCompare(event.target.checked)}/>{L(en,'Σύγκριση με την προηγούμενη περίοδο','Compare with the previous period')}</label>
   {hasFilter&&<span className="quality-active-filters">
    {stats.pickedLabels.length>0&&<button type="button" onClick={()=>setPickedMonths([])}>{stats.pickedLabels.join(', ')} ✕</button>}
    {catLabel&&<button type="button" onClick={()=>setCategory(null)}>{catLabel} ✕</button>}
    {department&&<button type="button" onClick={()=>setDepartment(null)}>{department} ✕</button>}
    <button type="button" className="is-clear" onClick={clearFilters}>{L(en,'Καθαρισμός','Clear')}</button>
   </span>}
  </div>
  <section className="risk-panel quality-panel">
   <header><h3>{L(en,'Αναφορές ανά μήνα','Reports by month')}</h3><small>{L(en,`${stats.byMonth.reduce((sum,month)=>sum+month.value,0)} τους τελευταίους ${period} μήνες`,`${stats.byMonth.reduce((sum,month)=>sum+month.value,0)} in the last ${period} months`)}{compare&&` · ${L(en,'αχνές στήλες: προηγούμενη περίοδος','faint columns: previous period')}`}</small></header>
   <MonthColumns months={stats.byMonth} en={en} picked={pickedMonths} onPick={pickMonth}/>
  </section>
  <p className="quality-period-summary">{L(en,'Στην επιλογή,'In the selection')}: <b>{stats.total}</b> {L(en,'αναφορές','reports')}{stats.totalBefore!=null&&<> {L(en,'έναντι','against')} <b>{stats.totalBefore}</b>{stats.totalBefore>0&&<> ({stats.total>=stats.totalBefore?'+':'−'}{Math.abs(Math.round((stats.total-stats.totalBefore)*100/stats.totalBefore))}%)</>}</>}</p>
  <div className="quality-breakdowns">
   <section className="risk-panel quality-panel"><header><h3>{L(en,'Ανά κατηγορία','By category')}</h3><small>{L(en,'Πάτησε για φίλτρο','Click to filter')}</small></header><BarList rows={stats.byCategory} en={en} picked={category} onPick={setCategory} empty={L(en,'Καμία αναφορά.','No reports.')}/></section>
   <section className="risk-panel quality-panel"><header><h3>{L(en,'Ανά τμήμα','By department')}</h3><small>{L(en,'Τα 6 με τις περισσότερες','Top 6')}</small></header><BarList rows={stats.byDepartment} en={en} picked={department} onPick={setDepartment} empty={L(en,'Καμία αναφορά.','No reports.')}/></section>
   <section className="risk-panel quality-panel"><header><h3>{L(en,'Είδος αναφοράς','Kind of report')}</h3></header><BarList rows={stats.byKind} en={en} empty={L(en,'Καμία αναφορά.','No reports.')}/></section>
   <section className="risk-panel quality-panel"><header><h3>{L(en,'Έκβαση για τον ασθενή','Outcome for the patient')}</h3><small>{L(en,`WHO · ${stats.patient} συμβάντα`,`WHO · ${stats.patient} incidents`)}</small></header><BarList rows={stats.byOutcome} en={en} empty={L(en,'Κανένα κλινικό ή μη κλινικό συμβάν.','No clinical or non-clinical incident.')}/></section>
  </div>
 </div>
}
