import { dueState,nextDeadlineAfter,periodBounds,periodProgress,slotDeadline,slotOpens,slotStarts,slotWindowMinutes,zonedParts } from './controlDueRules'
import { ROLES } from '../../core/permissions/roles'
import type { ControlExecution, ControlFrequency, ControlRecord, CountedProgress, PeriodProgress } from './controlTypes'

// When an entry may be recorded (recordWindow): not held to a window, or open, before or closed.
export type RecordWindow = { gated: boolean, state?: string, opens?: Date | null, closes?: Date | null }
// A control as the schedule reads it: its status, schedule and departments' assignments.
type ScheduleAssignment = { frequency?: ControlFrequency | null, nextDueAt?: string | null, status?: string, hasDraft?: boolean, progress?: CountedProgress | null, history?: ControlExecution[] }
export type ScheduleItem<A extends ScheduleAssignment = ScheduleAssignment> = Partial<Pick<ControlRecord, 'status' | 'frequency'>> & { assignments?: Record<string, A> }
type Item<A extends ScheduleAssignment = ScheduleAssignment> = ScheduleItem<A> | null | undefined
type Instant = Date | string | number

export function frequencyLabel(f:ControlFrequency={},language='el'){
 const en=language==='en'
 if(f.kind==='daily'){const label=Number(f.timesPerDay||1)>1?(en?`${f.timesPerDay} times / day`:`${f.timesPerDay} φορές / ημέρα`):(en?'Daily':'Καθημερινά');return f.weekdaysOnly===true?`${label} ${en?'(Mon–Fri)':'(Δευ–Παρ)'}`:label}
 if(f.kind==='weekly')return Number(f.interval||1)===1?(en?'Weekly':'Εβδομαδιαία'):(en?`Every ${f.interval} weeks`:`Κάθε ${f.interval} εβδομάδες`)
 if(f.kind==='monthly')return Number(f.interval||1)===1?(en?'Monthly':'Μηνιαία'):(en?`Every ${f.interval} months`:`Κάθε ${f.interval} μήνες`)
 if(f.kind==='yearly')return Number(f.interval||1)===1?(en?'Yearly':'Ετήσια'):(en?`Every ${f.interval} years`:`Κάθε ${f.interval} έτη`)
 return en?`Every ${f.interval||1} days`:`Κάθε ${f.interval||1} ημέρες`
}

const hhmm=(minutes:number)=>minutes>=1440?'23:59':`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`
// A daily control's times with the window each counts as on time: «09:00 (08:00–11:00)».
export function timesWithWindows(f:ControlFrequency={}){
 const times=(f.times||[]).filter(Boolean)
 if(f.kind!=='daily'||!times.length)return times.join(' · ')
 return times.map((time:string,index:number)=>{const {open,close}=slotWindowMinutes(f,index);return `${time} (${hhmm(open)}–${hhmm(close)})`}).join(' · ')
}
// A schedule in a few words: a daily one by its times («07:00, 15:00 · Δευ–Παρ»), any other by its frequency.
export function scheduleSummary(f:ControlFrequency={},language='el'){
 const times=f.kind==='daily'?(f.times||[]).filter(Boolean):[]
 if(!times.length)return frequencyLabel(f,language)
 return `${times.join(', ')}${f.weekdaysOnly===true?(language==='en'?' · Mon–Fri':' · Δευ–Παρ'):''}`
}

// The schedule that applies in one department: its own when it has one, else the control's.
export function assignmentFrequency(item:Item,department:string){
 return getAssignment(item,department)?.frequency||item?.frequency||{}
}

// A control's frequency for a list: the common one, or «varies by department» when its departments differ.
export function controlFrequencyLabel(item:Item,departments?:string[]|null,language='el'){
 const names=departments?.length?departments:Object.keys(item?.assignments||{})
 if(names.length>1&&scheduleVariants(item,names)>1)return language==='en'?'Varies by department':'Διαφέρει ανά τμήμα'
 return frequencyLabel(names.length?assignmentFrequency(item,names[0]):item?.frequency,language)
}

// The same for the lines of an adherence or calendar group (each line knows its own frequency).
export function linesFrequencyLabel(lines:{frequency?:ControlFrequency|null}[]|null|undefined,item:Item,language='el'){
 const frequencies=(lines||[]).map(line=>line.frequency||item?.frequency||{})
 if(new Set(frequencies.map(f=>JSON.stringify(f))).size>1)return language==='en'?'Varies by department':'Διαφέρει ανά τμήμα'
 return frequencyLabel(frequencies[0]||item?.frequency,language)
}

// How many distinct schedules the departments of a control run (1 = all the same).
export function scheduleVariants(item:Item,departments:string[]=Object.keys(item?.assignments||{})){
 return new Set(departments.map(department=>JSON.stringify(assignmentFrequency(item,department)))).size
}

export function getAssignment<A extends ScheduleAssignment>(item:Item<A>,department:string):A|null{
 if(!item)return null
 const assignments=item.assignments||{}
 return assignments[department]??Object.values(assignments)[0]??null
}

// Overdue, due soon or scheduled, from the assignment's next_due_at (set by
// the database with the rules in controlDueRules.js, deadlines included).
export function assignmentStatus(item:Item,department:string,now:Instant=new Date()){
 const assignment=getAssignment(item,department)
 // An inactive control (a FileMaker one no longer carried out) is not due anywhere.
 if(item?.status==='inactive')return 'paused'
 if(!assignment?.nextDueAt)return assignment?.status==='paused'?'paused':'scheduled'
 return dueState(assignment.nextDueAt,assignmentFrequency(item,department),now)
}

// Something to record now: the current period still needs an entry (its
// deadline falls within the period) or the control is overdue.
export function isControlDue(item:Item,department:string,now:Instant=new Date()){
 const assignment=getAssignment(item,department)
 if(!assignment?.nextDueAt||item?.status==='inactive')return false
 if(assignmentProgress(item,department,now)?.complete)return false
 return new Date(assignment.nextDueAt)<periodBounds(assignmentFrequency(item,department),now).end
}

// Who records at any time, outside the window of the control's time: only the
// hospital administrator and the platform owner (the database holds the same rule).
export function canRecordAnytime(role:string|null|undefined){return role===ROLES.HOSPITAL_ADMIN||role===ROLES.PLATFORM_OWNER}

// When a department may record a daily control with set times: only inside
// the window of one of its times (the on-time window: 1 hour before to the
// control's margin after, as slotOpens / slotDeadline). Outside it the entry
// is not offered: the department asks the infection control team. Other
// frequencies, and controls without set times, are not held to a window.
// → { gated:false } | { gated:true, state:'open'|'before'|'closed', opens, closes }
export function recordWindow(item:Item,department:string,now:Instant=new Date()):RecordWindow{
 const frequency=assignmentFrequency(item,department)
 if(frequency?.kind!=='daily'||!(frequency.times||[]).some(Boolean))return {gated:false}
 const progress=assignmentProgress(item,department,now)
 if(!progress||progress.complete)return {gated:false}
 const p=zonedParts(periodBounds(frequency,now).start)
 const day={year:p.year,month:p.month,day:p.day}
 const at=new Date(now)
 let next:{opens:Date,closes:Date}|null=null
 // The times already recorded are behind it: look at the rest of the day's.
 for(let index=progress.done;index<slotStarts(frequency).length;index+=1){
  const opens=slotOpens(frequency,day,index),closes=slotDeadline(frequency,day,index)
  if(at>=opens&&at<=closes)return {gated:true,state:'open',opens,closes}
  if(at<opens&&!next)next={opens,closes}
 }
 return next?{gated:true,state:'before',...next}:{gated:true,state:'closed',opens:null,closes:null}
}

// The current period's progress for one department: { required, done, extra,
// complete }. The database counts it for the list (control_period_progress);
// otherwise, and once the period has moved on, the loaded history is counted.
export function assignmentProgress(item:Item,department:string,now:Instant=new Date()):PeriodProgress|null{
 const assignment=getAssignment(item,department)
 if(!assignment)return null
 const frequency=assignmentFrequency(item,department)
 const counted=assignment.progress
 const {start,unit}=periodBounds(frequency,now)
 if(counted&&new Date(counted.start).getTime()===start.getTime())return {...counted,unit,complete:counted.done>=counted.required}
 return periodProgress(frequency,assignment.history||[],now)
}

// A step of the schedule: the next deadline after `fromDate`.
export function calculateNextDue(itemOrFrequency:(ControlFrequency&{frequency?:ControlFrequency})|null|undefined,fromDate:Instant=new Date()){
 const f=itemOrFrequency?.frequency||itemOrFrequency||{}
 return nextDeadlineAfter(f,fromDate)
}
