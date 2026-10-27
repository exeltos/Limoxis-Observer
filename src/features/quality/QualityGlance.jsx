import { RecordMetricStrip } from '../../design-system/RecordMetricStrip'
import { meterTone } from '../../design-system/MiniCharts'
import { formatDay } from '../../core/i18n/formatDay'
import { EFFECTIVENESS,FINDING_SOURCES,IMPACTS,INCIDENT_CLASSES,harmLevel,reportKindOf,vocabularyLabel } from './qualityVocabulary'
import { auditCompliance } from './qualityAudit'
import { analysisProgress } from './rootCauseAnalysis'
import { subActionProgress } from './qualityDeviations'

// A record «at a glance»: the three or four figures that say where it stands,
// above its details. What is late or harmful is coloured; progress is a bar.

const isClosed=record=>['closed','completed','cancelled'].includes(record?.status)||record?.lifecycleStatus==='voided'
const dayMs=86400000
const today=()=>new Date().toISOString().slice(0,10)
// Whole days from today to a date (negative: in the past).
export function daysUntil(date,now=today()){
  if(!date)return null
  return Math.round((Date.parse(`${String(date).slice(0,10)}T12:00:00Z`)-Date.parse(`${now}T12:00:00Z`))/dayMs)
}
const plural=(count,en,one,many,oneEn,manyEn)=>en?(count===1?oneEn:manyEn):(count===1?one:many)

// A deadline: how many days are left, or how late it is.
function deadline(label,date,{en,language,done=false,doneText}){
  const days=daysUntil(date)
  if(done)return {id:label,label,value:doneText,tone:'success',note:formatDay(date,language)||undefined}
  if(days==null)return {id:label,label,value:'—',note:en?'No date set':'Χωρίς ημερομηνία'}
  if(days<0)return {id:label,label,value:-days,unit:en?(-days===1?'day late':'days late'):'ημ. καθυστέρηση',tone:'danger',note:`${en?'Overdue since':'Εκπρόθεσμη από'} ${formatDay(date,language)}`}
  return {id:label,label,value:days===0?(en?'Today':'Σήμερα'):days,unit:days===0?undefined:en?(days===1?'day left':'days left'):(days===1?'ημέρα ακόμη':'ημέρες ακόμη'),tone:days<=7?'warning':undefined,note:`${en?'Due':'Έως'} ${formatDay(date,language)}`}
}

// The corrective actions (or findings) that follow a record: how many are done.
function followUps(label,rows,{en,open,noneText}){
  const done=rows.filter(isClosed).length
  if(!rows.length)return {id:label,label,value:0,tone:open?'warning':undefined,note:noneText}
  return {id:label,label,value:`${done}/${rows.length}`,meter:done*100/rows.length,tone:done===rows.length?'success':undefined,note:en?'completed':'ολοκληρωμένες'}
}

function age(label,date,{en,language,open}){
  const days=daysUntil(date)
  if(days==null)return null
  const since=-days
  return {id:label,label,value:Math.max(0,since),unit:plural(since,en,'ημέρα','ημέρες','day','days'),note:`${open?(en?'Open · since':'Ανοιχτό · από'):(en?'Since':'Από')} ${formatDay(date,language)}`}
}

export function glanceItems(recordType,record,{language,t,linked=[]}){
  const en=language==='en'
  const open=!isClosed(record)
  const severityTone=['high','critical'].includes(record.severity)?'danger':undefined
  if(recordType==='incidents'){
    const kind=reportKindOf(record)
    const reaches=['clinical','nonClinical'].includes(kind)
    const harmful=record.incidentClass==='harmful'
    const harm=harmLevel(record.impact)
    return [
      reaches?{id:'harm',label:en?'Outcome for the patient':'Έκβαση για τον ασθενή',value:harmful?vocabularyLabel(IMPACTS,harm,language):vocabularyLabel(INCIDENT_CLASSES,record.incidentClass||'nearMiss',language),tone:harmful?(['severe','death'].includes(harm)?'danger':'warning'):undefined,note:harmful?(en?'Harm (WHO)':'Βλάβη (WHO)'):undefined}
       :{id:'severity',label:t('severity'),value:t(record.severity),tone:severityTone},
      age(en?'Since the event':'Από το συμβάν',record.date,{en,language,open}),
      followUps(en?'Corrective actions':'Διορθωτικές ενέργειες',linked,{en,open:open&&kind!=='suggestion',noneText:en?'None yet':'Καμία ακόμη'}),
      record.sentinel?deadline(en?'Root cause analysis':'Ανάλυση ριζικής αιτίας',record.rcaDueDate,{en,language,done:!open,doneText:en?'Closed':'Έκλεισε'}):{id:'severity',label:t('severity'),value:t(record.severity),tone:severityTone},
    ].filter(Boolean).filter((item,index,list)=>list.findIndex(other=>other.id===item.id)===index)
  }
  if(recordType==='findings')return [
    {id:'severity',label:t('severity'),value:t(record.severity),tone:severityTone},
    age(en?'Since it was found':'Από τον εντοπισμό',record.date,{en,language,open}),
    followUps(en?'Corrective actions':'Διορθωτικές ενέργειες',linked,{en,open,noneText:en?'None yet':'Καμία ακόμη'}),
    {id:'source',label:en?'Source':'Πηγή',value:vocabularyLabel(FINDING_SOURCES,record.source||'manual',language),note:record.sourceId||undefined},
  ].filter(Boolean)
  if(recordType==='capas'){
    const steps=subActionProgress(record.subActions||[])
    const causes=analysisProgress(record.rootCauseAnalysis)
    const effectiveness=record.effectivenessStatus||'pending'
    return [
      steps.total?{id:'steps',label:en?'Steps':'Βήματα',value:`${steps.done}/${steps.total}`,meter:steps.done*100/steps.total,tone:steps.done===steps.total?'success':undefined,primary:true,note:en?'completed':'ολοκληρωμένα'}:{id:'steps',label:en?'Steps':'Βήματα',value:open?0:'—',note:open?(en?'Add them in «Steps»':'Προσθέστε τα στα «Βήματα»'):(en?'No steps recorded':'Χωρίς καταγεγραμμένα βήματα')},
      deadline(en?'Due':'Προθεσμία',record.dueDate,{en,language,done:!open,doneText:en?'Done':'Ολοκληρώθηκε'}),
      {id:'causes',label:en?'Root causes':'Αιτίες',value:causes.concluded?(en?'Documented':'Τεκμηριώθηκαν'):causes.started?(en?'In progress':'Σε εξέλιξη'):(en?'Pending':'Εκκρεμούν'),tone:causes.concluded?'success':undefined,note:causes.started?`${causes.whys} ${en?'whys':'γιατί'} · ${causes.causes} ${en?'causes':'αιτίες'}`:undefined},
      {id:'effectiveness',label:en?'Effectiveness':'Αποτελεσματικότητα',value:vocabularyLabel(EFFECTIVENESS,effectiveness,language),tone:effectiveness==='effective'?'success':effectiveness==='notEffective'?'danger':undefined,note:record.effectivenessDue?`${en?'Check by':'Έλεγχος έως'} ${formatDay(record.effectivenessDue,language)}`:undefined},
    ]
  }
  if(recordType==='audits'){
    const score=auditCompliance(record)
    const total=(record.checklist||[]).length
    const date=record.completedDate||record.plannedDate
    const until=daysUntil(record.plannedDate)
    return [
      {id:'compliance',label:en?'Compliance':'Συμμόρφωση',value:score.rate==null?'—':`${score.rate}%`,meter:score.rate,tone:score.rate==null?undefined:meterTone(score.rate),primary:true,note:total?`${score.yes} ${en?'yes':'ναι'} · ${score.no} ${en?'no':'όχι'}${score.unanswered?` · ${score.unanswered} ${en?'unanswered':'αναπάντητα'}`:''}`:(en?'No checklist yet':'Χωρίς λίστα ελέγχου')},
      {id:'findings',label:en?'Findings':'Ευρήματα',value:linked.length,tone:linked.some(row=>!isClosed(row))?'warning':undefined,note:linked.length?`${linked.filter(row=>!isClosed(row)).length} ${en?'open':'ανοιχτά'}`:(score.no?(en?'Create them from the checklist':'Δημιουργούνται από τη λίστα ελέγχου'):undefined)},
      {id:'date',label:record.completedDate?(en?'Completed':'Ολοκληρώθηκε'):(en?'Planned':'Προγραμματισμένη'),value:formatDay(date,language)||'—',note:!record.completedDate&&until!=null?(until<0?(en?`${-until} days ago`:`πριν από ${-until} ημέρες`):until===0?(en?'Today':'Σήμερα'):(en?`in ${until} days`:`σε ${until} ημέρες`)):undefined,tone:!record.completedDate&&open&&until!=null&&until<0?'danger':undefined},
    ]
  }
  return []
}

// An incident «at a glance» as one line under the title (the figures of the other records are still boxes).
export function incidentSummary(record,{language,t}){
  const en=language==='en'
  const kind=reportKindOf(record)
  const open=!isClosed(record)
  const items=[]
  if(['clinical','nonClinical'].includes(kind)){
    const harmful=record.incidentClass==='harmful'
    items.push({text:harmful?`${vocabularyLabel(IMPACTS,harmLevel(record.impact),language)} (WHO)`:vocabularyLabel(INCIDENT_CLASSES,record.incidentClass||'nearMiss',language),tone:harmful?'danger':undefined})
  }
  items.push({text:`${t('severity')}: ${t(record.severity)}`,tone:['high','critical'].includes(record.severity)?'danger':undefined})
  if(record.sentinel)items.push({text:'Sentinel',tone:'danger'})
  const since=-daysUntil(record.date)
  if(Number.isFinite(since))items.push({text:open?(en?`open ${Math.max(0,since)} ${plural(since,en,'ημέρα','ημέρες','day','days')}`:`ανοιχτό ${Math.max(0,since)} ${plural(since,en,'ημέρα','ημέρες','day','days')}`):(en?'closed':'κλειστό')})
  if(record.sentinel&&open&&record.rcaDueDate){
    const left=daysUntil(record.rcaDueDate)
    items.push(left<0
      ?{text:en?`root cause analysis ${-left} ${plural(-left,en,'ημέρα','ημέρες','day','days')} late`:`ανάλυση αιτίας: εκπρόθεσμη ${-left} ${plural(-left,en,'ημέρα','ημέρες','day','days')}`,tone:'danger'}
      :{text:en?`root cause analysis by ${formatDay(record.rcaDueDate,language)} (${left} ${plural(left,en,'ημέρα','ημέρες','day','days')})`:`ανάλυση αιτίας έως ${formatDay(record.rcaDueDate,language)} (${left} ${plural(left,en,'ημέρα','ημέρες','day','days')})`,tone:left<=7?'danger':undefined})
  }
  return items
}

// A finding «at a glance» as one line under the title.
export function findingSummary(record,{language,t,linked=[]}){
  const en=language==='en'
  const open=!isClosed(record)
  const items=[{text:`${t('severity')}: ${t(record.severity)}`,tone:['high','critical'].includes(record.severity)?'danger':undefined}]
  const since=-daysUntil(record.date)
  if(Number.isFinite(since))items.push({text:open?(en?`open ${Math.max(0,since)} ${plural(since,en,'ημέρα','ημέρες','day','days')}`:`ανοιχτή ${Math.max(0,since)} ${plural(since,en,'ημέρα','ημέρες','day','days')}`):(en?'closed':'κλειστή')})
  const done=linked.filter(isClosed).length
  items.push(linked.length?{text:en?`${done}/${linked.length} corrective actions done`:`${done}/${linked.length} διορθωτικές ενέργειες ολοκληρώθηκαν`}:{text:en?'no corrective action yet':'χωρίς διορθωτική ενέργεια',tone:open?'danger':undefined})
  items.push({text:`${en?'Source':'Πηγή'}: ${vocabularyLabel(FINDING_SOURCES,record.source||'manual',language)}${record.sourceId?` ${record.sourceId}`:''}`})
  return items
}

export function QualityGlance({recordType,record,language,t,linked}){
  if(recordType==='findings')return <p className="quality-summary-line quality-record-line">{findingSummary(record,{language,t,linked}).map((item,index)=><span key={index} className={item.tone==='danger'?'is-late':undefined}>{item.text}</span>)}</p>
  if(recordType==='incidents')return <p className="quality-summary-line quality-record-line">{incidentSummary(record,{language,t}).map((item,index)=><span key={index} className={item.tone==='danger'?'is-late':undefined}>{item.text}</span>)}</p>
  const items=glanceItems(recordType,record,{language,t,linked})
  if(!items.length)return null
  return <RecordMetricStrip className="quality-glance" items={items}/>
}
