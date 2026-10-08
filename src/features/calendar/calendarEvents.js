// Everything with a date that someone has to act on, from every module, as
// one list of calendar events: { id, date (YYYY-MM-DD), time, kind, title,
// detail, department, path, state }. state is 'overdue', 'due' or 'planned'.
import { calculateNextDue } from '../controls/controlScheduling'

export const CALENDAR_KINDS=['controls','capa','audits','training','documents','committees']

const KIND_LABELS={
 el:{controls:'Έλεγχοι',capa:'CAPA',audits:'Επιθεωρήσεις',training:'Εκπαίδευση',documents:'Έγγραφα',committees:'Επιτροπές'},
 en:{controls:'Controls',capa:'CAPA',audits:'Audits',training:'Training',documents:'Documents',committees:'Committees'},
}
export const calendarKindLabel=(kind,language='el')=>KIND_LABELS[language==='en'?'en':'el'][kind]||kind

const pad=n=>String(n).padStart(2,'0')
export const dayKey=date=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`
const toDay=value=>{
 if(!value)return ''
 const text=String(value)
 if(/^\d{4}-\d{2}-\d{2}$/.test(text))return text
 const date=new Date(text)
 return Number.isNaN(date.getTime())?'':dayKey(date)
}
const toTime=value=>{
 const text=String(value||'')
 if(text.length<=10)return ''
 const date=new Date(text)
 return Number.isNaN(date.getTime())?'':`${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function stateOf(date,today,done=false){
 if(done)return 'done'
 if(date<today)return 'overdue'
 return 'due'
}

function push(list,event,range){
 if(!event.date)return
 if(range&&(event.date<range.from||event.date>range.to)&&event.state!=='overdue')return
 list.push(event)
}

// Daily controls are listed once, at their next due time; weekly and longer
// ones are projected across the range so the month shows every occurrence.
function controlEvents(controls,range,today,list,en){
 for(const control of controls){
  const daily=control.frequency?.kind==='daily'
  for(const [department,assignment] of Object.entries(control.assignments||{})){
   if(!assignment?.nextDueAt||assignment.status==='paused')continue
   const title=en?control.titleEn||control.title:control.title
   const base={kind:'controls',title,department,path:`/controls/${control.id}`,criticality:control.responseConfig?.criticality||'medium'}
   let due=new Date(assignment.nextDueAt)
   const first=toDay(due)
   push(list,{...base,id:`ctrl:${assignment.dbId||control.id}:${first}`,date:first,time:toTime(assignment.nextDueAt),state:stateOf(first,today),detail:daily?(en?'Daily':'Καθημερινός'):''},range)
   if(daily||!range)continue
   for(let i=0;i<60;i+=1){
    due=new Date(calculateNextDue(control.frequency||{},due))
    const day=toDay(due)
    if(!day||day>range.to)break
    if(day>=range.from)push(list,{...base,id:`ctrl:${assignment.dbId||control.id}:${day}`,date:day,time:toTime(due.toISOString()),state:'planned',detail:''},range)
   }
  }
 }
}

function capaEvents(capas,range,today,list,en){
 for(const capa of capas){
  if(capa.lifecycleStatus==='voided')continue
  const title=en?capa.titleEn||capa.title:capa.title
  const department=en?capa.departmentEn||capa.department:capa.department
  const path=`/quality/capas/${capa.id}`
  const closed=['closed','completed'].includes(capa.status)
  if(!closed){
   push(list,{id:`capa:${capa.id}`,kind:'capa',date:toDay(capa.dueDate),title,detail:en?'CAPA due':'Προθεσμία CAPA',department,path,state:stateOf(toDay(capa.dueDate),today)},range)
   for(const step of capa.subActions||[]){
    if(step.done)continue
    push(list,{id:`capa-step:${capa.id}:${step.id}`,kind:'capa',date:toDay(step.dueDate),title:step.title,detail:`${capa.displayId||capa.id}${step.owner?` · ${step.owner}`:''}`,department,path,state:stateOf(toDay(step.dueDate),today)},range)
   }
  }
  if(capa.effectivenessDue&&(capa.effectivenessStatus||'pending')==='pending'){
   push(list,{id:`capa-eff:${capa.id}`,kind:'capa',date:toDay(capa.effectivenessDue),title,detail:en?'Effectiveness review':'Έλεγχος αποτελεσματικότητας',department,path,state:stateOf(toDay(capa.effectivenessDue),today)},range)
  }
 }
}

function auditEvents(audits,range,today,list,en){
 for(const audit of audits){
  if(audit.lifecycleStatus==='voided'||['completed','cancelled'].includes(audit.status))continue
  push(list,{id:`audit:${audit.id}`,kind:'audits',date:toDay(audit.plannedDate),title:en?audit.titleEn||audit.title:audit.title,detail:audit.leadAuditor||'',department:'',path:`/quality/audits/${audit.id}`,state:stateOf(toDay(audit.plannedDate),today)},range)
 }
}

function trainingEvents(training,range,today,list,en){
 const programs=training?.programs||[]
 const assignments=training?.assignments||[]
 for(const program of programs){
  const path=`/training/${program.id}`
  // Effectiveness is evaluated months after the programme, so completed ones count.
  if(program.status!=='cancelled'&&program.effectiveness?.plannedDate&&!program.effectiveness.result){const day=toDay(program.effectiveness.plannedDate);push(list,{id:`trn-eff:${program.id}`,kind:'training',date:day,title:program.title,detail:en?'Effectiveness evaluation':'Αξιολόγηση αποτελεσματικότητας',department:program.audience||'',path,state:stateOf(day,today)},range)}
  if(['completed','cancelled'].includes(program.status))continue
  const open=assignments.filter(a=>a.programId===program.id&&a.status!=='completed').length
  if(program.startDate&&toDay(program.startDate)>=today)push(list,{id:`trn-start:${program.id}`,kind:'training',date:toDay(program.startDate),title:program.title,detail:en?'Starts':'Έναρξη',department:program.audience||'',path,state:'planned'},range)
  push(list,{id:`trn-due:${program.id}`,kind:'training',date:toDay(program.dueDate),title:program.title,detail:en?`Completion due · ${open} pending`:`Προθεσμία ολοκλήρωσης · ${open} εκκρεμούν`,department:program.audience||'',path,state:open?stateOf(toDay(program.dueDate),today):'done'},range)
 }
 for(const certificate of training?.certificates||[]){
  const day=toDay(certificate.validUntil)
  if(!day)continue
  const person=assignments.find(a=>a.id===certificate.assignmentId)
  push(list,{id:`cert:${certificate.id}`,kind:'training',date:day,title:certificate.title,detail:`${en?'Certificate expires':'Λήξη πιστοποιητικού'}${person?` · ${person.employeeName}`:''}`,department:person?.department||'',path:'/training',state:day<today?'overdue':'planned'},range)
 }
}

function documentEvents(families,range,today,list,en){
 for(const family of families){
  const live=family.activePublished
  if(!live?.reviewDate)continue
  const day=toDay(live.reviewDate)
  push(list,{id:`doc:${live.id}`,kind:'documents',date:day,title:live.title,detail:`${en?'Review due':'Αναθεώρηση'} · ${family.root?.id||live.id} v${live.version||''}`,department:live.department||'',path:`/documents/${live.id}`,state:stateOf(day,today)},range)
 }
}

function committeeEvents(committees,range,today,list,en){
 for(const committee of committees){
  const name=committee.shortName||committee.name
  const path=`/committees/${committee.id}`
  for(const meeting of committee.meetings||[]){
   if(meeting.status==='finalized'||meeting.status==='cancelled')continue
   const day=toDay(meeting.scheduledAt||meeting.date)
   push(list,{id:`mtg:${committee.id}:${meeting.id}`,kind:'committees',date:day,time:meeting.time||toTime(meeting.scheduledAt),title:meeting.title,detail:name,department:'',path,state:day<today?'overdue':'planned'},range)
  }
  for(const decision of committee.decisions||[]){
   if(['completed','closed','done'].includes(decision.status))continue
   const day=toDay(decision.dueDate)
   push(list,{id:`dec:${committee.id}:${decision.id}`,kind:'committees',date:day,title:decision.title,detail:`${name} · ${en?'decision':'απόφαση'}${decision.owner?` · ${decision.owner}`:''}`,department:'',path,state:stateOf(day,today)},range)
  }
 }
}

export function buildCalendarEvents({controls=[],capas=[],audits=[],training=null,documentFamilies=[],committees=[]}={},{from,to,today=dayKey(new Date()),language='el'}={}){
 const en=language==='en'
 const range=from&&to?{from,to}:null
 const list=[]
 controlEvents(controls,range,today,list,en)
 capaEvents(capas,range,today,list,en)
 auditEvents(audits,range,today,list,en)
 trainingEvents(training,range,today,list,en)
 documentEvents(documentFamilies,range,today,list,en)
 committeeEvents(committees,range,today,list,en)
 const seen=new Set()
 return list.filter(event=>{if(seen.has(event.id))return false;seen.add(event.id);return true}).sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'99').localeCompare(b.time||'99')||a.title.localeCompare(b.title))
}

// Monday-first weeks covering the month, as arrays of YYYY-MM-DD.
export function monthGrid(year,month){
 const first=new Date(year,month,1)
 const offset=(first.getDay()+6)%7
 const start=new Date(year,month,1-offset)
 const weeks=[]
 for(let w=0;w<6;w+=1){
  const week=[]
  for(let d=0;d<7;d+=1)week.push(dayKey(new Date(start.getFullYear(),start.getMonth(),start.getDate()+w*7+d)))
  weeks.push(week)
  const next=new Date(start.getFullYear(),start.getMonth(),start.getDate()+(w+1)*7)
  if(next.getMonth()!==month&&w>=3)break
 }
 return weeks
}
