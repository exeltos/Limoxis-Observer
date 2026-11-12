// Everything with a date that someone has to act on, from every module, as
// one list of calendar events: { id, date (YYYY-MM-DD), time, kind, title,
// detail, department, path, state }. state is 'overdue', 'due' or 'planned'.
import { calculateNextDue } from '../controls/controlScheduling'
import { controlTypeCode } from '../controls/controlVocabulary'
import { suggestionCalendarItems as suggestionCalendarItemsJs } from '../documents/protocolReview/protocolReviewModel'
import { standardShort } from '../quality/audits/auditStandards'
import type { AnyRecord } from '../../types/featureTypes'

// One event of the calendar (the modules' items keep their own extra fields).
export interface CalendarEvent {
 id: string
 date: string
 time?: string
 kind: string
 title: string
 detail?: string
 department?: string
 path?: string
 state: string
 expiry?: boolean
 criticality?: string
 // eslint-disable-next-line @typescript-eslint/no-explicit-any -- extra fields of each module's items
 [key: string]: any
}
type Range={ from: string, to: string }
// documents is still JavaScript: its options ({ownerId} without a default) would leave ownerId out of the type.
const suggestionCalendarItems=suggestionCalendarItemsJs as (list: AnyRecord[], documents: AnyRecord[], options: { today?: string, language?: string, ownerId?: string | null }) => CalendarEvent[]
// The sources the calendar reads (useCalendarSources).
export interface CalendarSources {
 controls?: AnyRecord[]
 capas?: AnyRecord[]
 audits?: AnyRecord[]
 training?: AnyRecord | null
 documentFamilies?: AnyRecord[]
 committees?: AnyRecord[]
 meetingGroups?: AnyRecord[]
 protocolSuggestions?: AnyRecord[]
 suppliers?: AnyRecord[]
 kitchen?: CalendarEvent[]
}

export const CALENDAR_KINDS=['controls','cultures','capa','audits','training','documents','committees','suppliers','kitchen']

const KIND_LABELS: Record<'el' | 'en', Record<string, string>>={
 el:{controls:'Έλεγχοι',cultures:'Καλλιέργειες',capa:'Διορθωτικές ενέργειες',audits:'Επιθεωρήσεις',training:'Εκπαίδευση',documents:'Έγγραφα',committees:'Επιτροπές',suppliers:'Προμηθευτές',kitchen:'Κουζίνα'},
 en:{controls:'Controls',cultures:'Cultures',capa:'CAPA',audits:'Audits',training:'Training',documents:'Documents',committees:'Committees',suppliers:'Suppliers',kitchen:'Kitchen'},
}
export const calendarKindLabel=(kind: string,language='el')=>KIND_LABELS[language==='en'?'en':'el'][kind]||kind

// The calendar's filter chips: controls, trainings, meetings and expiries
// (certificates, licences, kitchen batches); everything else is «Other».
// ?filter=controls (or controls,training) opens the calendar with only those on.
export const CALENDAR_FILTERS=['controls','cultures','training','meetings','expiries','other']
const FILTER_LABELS: Record<'el' | 'en', Record<string, string>>={
 el:{controls:'Έλεγχοι',cultures:'Καλλιέργειες',training:'Εκπαιδεύσεις',meetings:'Συνεδριάσεις',expiries:'Λήξεις',other:'Λοιπά'},
 en:{controls:'Controls',cultures:'Cultures',training:'Trainings',meetings:'Meetings',expiries:'Expiries',other:'Other'},
}
export const calendarFilterLabel=(filter: string,language='el')=>FILTER_LABELS[language==='en'?'en':'el'][filter]||filter
export function calendarFilterOf(event: CalendarEvent){
 if(event.expiry||/^(cert|kit-exp):/.test(String(event.id||'')))return 'expiries'
 if(event.kind==='controls')return 'controls'
 if(event.kind==='cultures')return 'cultures'
 if(event.kind==='training')return 'training'
 if(event.kind==='committees')return 'meetings'
 return 'other'
}
// The chips a calendar can offer from the modules the user may see.
export function calendarFiltersFor(kinds: readonly string[]=[]){
 const has=(kind: string)=>kinds.includes(kind)
 return CALENDAR_FILTERS.filter(filter=>filter==='controls'?has('controls'):filter==='cultures'?has('cultures'):filter==='training'?has('training'):filter==='meetings'?has('committees'):filter==='expiries'?has('training')||has('documents')||has('kitchen'):kinds.some(kind=>['capa','audits','documents','suppliers','kitchen'].includes(kind)))
}
// ?filter= as the set of chips that are on; null when the address names none (all on).
export function parseCalendarFilter(value: string | null | undefined){
 if(value==='none')return new Set()
 const picked=String(value||'').split(',').map(item=>item.trim()).filter(item=>CALENDAR_FILTERS.includes(item))
 return picked.length?new Set(picked):null
}

// What the controls' own calendar showed, day by day: the executions done
// (on time or late), the missed due dates and — from controlEvents — the
// planned ones. lines: programmeCalendar() of controls/controlCalendar.js for the year.
const EXECUTION_DETAIL={el:{done:'Έγινε',late:'Έγινε με καθυστέρηση',missed:'Χάθηκε'},en:{done:'Done',late:'Done late',missed:'Missed'}}
// The culture sampling is done by the infection control team in the department: the department sees it as a notice, not as its own task.
const CULTURE_DETAIL={el:{done:'Λήφθηκαν δείγματα',late:'Λήφθηκαν δείγματα με καθυστέρηση',missed:'Δεν λήφθηκαν δείγματα',planned:'Έλεγχος Λοιμώξεων'},en:{done:'Samples taken',late:'Samples taken late',missed:'Samples not taken',planned:'Infection Control'}}
const controlKind=(control: AnyRecord)=>(controlTypeCode(control.category)==='CTRL-ENV'?'cultures':'controls')
export function controlExecutionEvents(lines: AnyRecord[]=[],{year,month,today=dayKey(new Date()),language='el'}: { year: number, month: number, today?: string, language?: string }){
 const en=language==='en'
 const list: CalendarEvent[]=[]
 const day=(n: number)=>`${year}-${pad(month+1)}-${pad(n)}`
 for(const {item,department,months} of lines){
  const cell=months?.[month]
  if(!cell||cell.inactive)continue
  const kind=controlKind(item)
  const words=kind==='cultures'?CULTURE_DETAIL[en?'en':'el']:EXECUTION_DETAIL[en?'en':'el']
  const base={kind,title:en?item.titleEn||item.title:item.title,department,path:`/controls/${item.id}`,criticality:item.responseConfig?.criticality||'medium'}
  ;(cell.marks||[]).forEach((mark: AnyRecord,index: number)=>{const date=day(mark.day);list.push({...base,id:`ctrl-done:${item.id}:${department}:${date}:${index}`,date,state:mark.late?'late':'done',detail:mark.late?words.late:words.done})})
  if(!cell.frequent)for(const missed of cell.missed||[]){const date=day(missed);if(date<today)list.push({...base,id:`ctrl-missed:${item.id}:${department}:${date}`,date,state:'missed',detail:words.missed})}
 }
 return list
}

const pad=(n: number)=>String(n).padStart(2,'0')
export const dayKey=(date: Date)=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`
const toDay=(value: unknown)=>{
 if(!value)return ''
 const text=String(value)
 if(/^\d{4}-\d{2}-\d{2}$/.test(text))return text
 const date=new Date(text)
 return Number.isNaN(date.getTime())?'':dayKey(date)
}
const toTime=(value: unknown)=>{
 const text=String(value||'')
 if(text.length<=10)return ''
 const date=new Date(text)
 return Number.isNaN(date.getTime())?'':`${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function stateOf(date: string,today: string,done=false){
 if(done)return 'done'
 if(date<today)return 'overdue'
 return 'due'
}

function push(list: CalendarEvent[],event: CalendarEvent,range: Range | null){
 if(!event.date)return
 if(range&&(event.date<range.from||event.date>range.to)&&event.state!=='overdue')return
 list.push(event)
}

// Daily controls are listed once, at their next due time; weekly and longer
// ones are projected across the range so the month shows every occurrence.
function controlEvents(controls: AnyRecord[],range: Range | null,today: string,list: CalendarEvent[],en: boolean){
 for(const control of controls){
  for(const [department,assignment] of Object.entries<AnyRecord>(control.assignments||{})){
   if(!assignment?.nextDueAt||assignment.status==='paused')continue
   const frequency=assignment.frequency||control.frequency||{}
   const daily=frequency.kind==='daily'
   const title=en?control.titleEn||control.title:control.title
   const kind=controlKind(control)
   const base={kind,title,department,path:`/controls/${control.id}`,criticality:control.responseConfig?.criticality||'medium'}
   const plannedDetail=kind==='cultures'?CULTURE_DETAIL[en?'en':'el'].planned:''
   let due=new Date(assignment.nextDueAt)
   const first=toDay(due)
   push(list,{...base,id:`ctrl:${assignment.dbId||control.id}:${first}`,date:first,time:toTime(assignment.nextDueAt),state:stateOf(first,today),detail:plannedDetail||(daily?(en?'Daily':'Καθημερινός'):'')},range)
   if(daily||!range)continue
   for(let i=0;i<60;i+=1){
    due=new Date(calculateNextDue(frequency,due))
    const day=toDay(due)
    if(!day||day>range.to)break
    if(day>=range.from)push(list,{...base,id:`ctrl:${assignment.dbId||control.id}:${day}`,date:day,time:toTime(due.toISOString()),state:'planned',detail:plannedDetail},range)
   }
  }
 }
}

function capaEvents(capas: AnyRecord[],range: Range | null,today: string,list: CalendarEvent[],en: boolean){
 for(const capa of capas){
  if(capa.lifecycleStatus==='voided')continue
  const title=en?capa.titleEn||capa.title:capa.title
  const department=en?capa.departmentEn||capa.department:capa.department
  const path=`/quality/capas/${capa.id}`
  const closed=['closed','completed'].includes(capa.status)
  if(!closed){
   push(list,{id:`capa:${capa.id}`,kind:'capa',date:toDay(capa.dueDate),title,detail:en?'CAPA due':'Προθεσμία διορθωτικής ενέργειας',department,path,state:stateOf(toDay(capa.dueDate),today)},range)
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

function auditEvents(audits: AnyRecord[],range: Range | null,today: string,list: CalendarEvent[],en: boolean){
 for(const audit of audits){
  if(audit.lifecycleStatus==='voided'||['completed','cancelled'].includes(audit.status))continue
  // A planned audit of the programme: its standard and lead auditor, its department.
  push(list,{id:`audit:${audit.id}`,kind:'audits',date:toDay(audit.plannedDate),title:en?audit.titleEn||audit.title:audit.title,detail:[audit.standard&&standardShort(audit.standard),audit.leadAuditor,audit.plannedMonthOnly&&(en?'day to be fixed':'η ημέρα θα οριστεί')].filter(Boolean).join(' · '),department:audit.department||'',path:`/quality/audits/${audit.id}`,state:stateOf(toDay(audit.plannedDate),today)},range)
 }
}

function trainingEvents(training: AnyRecord | null,range: Range | null,today: string,list: CalendarEvent[],en: boolean){
 const programs: AnyRecord[]=training?.programs||[]
 const assignments: AnyRecord[]=training?.assignments||[]
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

function documentEvents(families: AnyRecord[],range: Range | null,today: string,list: CalendarEvent[],en: boolean){
 for(const family of families){
  const live=family.activePublished
  if(!live?.reviewDate)continue
  const day=toDay(live.reviewDate)
  push(list,{id:`doc:${live.id}`,kind:'documents',expiry:live.type==='licence',date:day,title:live.title,detail:`${live.type==='licence'?(en?'Expires':'Λήξη'):(en?'Review due':'Αναθεώρηση')} · ${family.root?.id||live.id} v${live.version||''}`,department:live.department||'',path:`/documents/${live.id}`,state:stateOf(day,today)},range)
 }
}

function committeeEvents(committees: AnyRecord[],range: Range | null,today: string,list: CalendarEvent[],en: boolean){
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

// A department's meeting group: its next regular meeting (the last one plus the frequency), and the meetings already set.
// meetingGroups: [{ group, nextDue, upcoming: [meeting] }].
function departmentMeetingEvents(meetingGroups: AnyRecord[],range: Range | null,today: string,list: CalendarEvent[],en: boolean){
 for(const {group,nextDue,upcoming=[]} of meetingGroups){
  if(group.active===false)continue
  const path=`/meetings/groups/${group.id}`
  for(const meeting of upcoming)push(list,{id:`dm:${meeting.id}`,kind:'committees',date:toDay(meeting.meetingDate),title:group.name,detail:`${meeting.kind==='extraordinary'?(en?'Extraordinary meeting':'Έκτακτη συνάντηση'):(en?'Department meeting':'Συνάντηση τμήματος')} · ${meeting.code||''}`,department:group.department||'',path:`/meetings/${meeting.id}`,state:'planned'},range)
  if(!nextDue||upcoming.length)continue
  push(list,{id:`dmg:${group.id}`,kind:'committees',date:toDay(nextDue),title:group.name,detail:en?'Department meeting due':'Οφειλόμενη συνάντηση τμήματος',department:group.department||'',path,state:nextDue<today?'overdue':'planned'},range)
 }
}

// A supplier's next evaluation (its latest evaluation plus the frequency): «Αξιολόγηση προμηθευτή».
// suppliers: [{ id, code, name, nextEvaluation, evaluationDue }] as supplierStatus gives them.
function supplierEvents(suppliers: AnyRecord[],range: Range | null,today: string,list: CalendarEvent[],en: boolean){
 for(const supplier of suppliers){
  if(supplier.status==='inactive')continue
  const day=toDay(supplier.nextEvaluation)
  push(list,{id:`sup-eval:${supplier.id}`,kind:'suppliers',date:day,title:supplier.name,detail:`${en?'Supplier evaluation':'Αξιολόγηση προμηθευτή'}${supplier.code?` · ${supplier.code}`:''}`,department:'',path:`/quality/suppliers/${supplier.id}`,state:stateOf(day,today)},range)
 }
}

export function buildCalendarEvents({controls=[],capas=[],audits=[],training=null,documentFamilies=[],committees=[],meetingGroups=[],protocolSuggestions=[],suppliers=[],kitchen=[]}: CalendarSources={},{from,to,today=dayKey(new Date()),language='el',ownerId}: { from?: string, to?: string, today?: string, language?: string, ownerId?: string | null }={}): CalendarEvent[]{
 const en=language==='en'
 const range=from&&to?{from,to}:null
 const list: CalendarEvent[]=[]
 controlEvents(controls,range,today,list,en)
 capaEvents(capas,range,today,list,en)
 auditEvents(audits,range,today,list,en)
 trainingEvents(training,range,today,list,en)
 documentEvents(documentFamilies,range,today,list,en)
 // Open protocol update suggestions are pending items of the documents.
 for(const event of suggestionCalendarItems(protocolSuggestions,documentFamilies.flatMap(family=>family.versions||[]),{today,language,ownerId}))push(list,event,range)
 committeeEvents(committees,range,today,list,en)
 departmentMeetingEvents(meetingGroups,range,today,list,en)
 supplierEvents(suppliers,range,today,list,en)
 // The kitchen's items are built by its model (kitchenModel.kitchenCalendarItems).
 for(const event of kitchen)push(list,event,range)
 const seen=new Set<string>()
 return list.filter(event=>{if(seen.has(event.id))return false;seen.add(event.id);return true}).sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'99').localeCompare(b.time||'99')||a.title.localeCompare(b.title))
}

// Monday-first weeks covering the month, as arrays of YYYY-MM-DD.
export function monthGrid(year: number,month: number){
 const first=new Date(year,month,1)
 const offset=(first.getDay()+6)%7
 const start=new Date(year,month,1-offset)
 const weeks: string[][]=[]
 for(let w=0;w<6;w+=1){
  const week: string[]=[]
  for(let d=0;d<7;d+=1)week.push(dayKey(new Date(start.getFullYear(),start.getMonth(),start.getDate()+w*7+d)))
  weeks.push(week)
  const next=new Date(start.getFullYear(),start.getMonth(),start.getDate()+(w+1)*7)
  if(next.getMonth()!==month&&w>=3)break
 }
 return weeks
}
