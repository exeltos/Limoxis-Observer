import { dueState,nextDeadlineAfter,periodBounds,periodProgress,slotWindowMinutes } from './controlDueRules'

export function frequencyLabel(f={},language='el'){
 const en=language==='en'
 if(f.kind==='daily'){const label=Number(f.timesPerDay||1)>1?(en?`${f.timesPerDay} times / day`:`${f.timesPerDay} φορές / ημέρα`):(en?'Daily':'Καθημερινά');return f.weekdaysOnly===true?`${label} ${en?'(Mon–Fri)':'(Δευ–Παρ)'}`:label}
 if(f.kind==='weekly')return Number(f.interval||1)===1?(en?'Weekly':'Εβδομαδιαία'):(en?`Every ${f.interval} weeks`:`Κάθε ${f.interval} εβδομάδες`)
 if(f.kind==='monthly')return Number(f.interval||1)===1?(en?'Monthly':'Μηνιαία'):(en?`Every ${f.interval} months`:`Κάθε ${f.interval} μήνες`)
 if(f.kind==='yearly')return Number(f.interval||1)===1?(en?'Yearly':'Ετήσια'):(en?`Every ${f.interval} years`:`Κάθε ${f.interval} έτη`)
 return en?`Every ${f.interval||1} days`:`Κάθε ${f.interval||1} ημέρες`
}

const hhmm=minutes=>minutes>=1440?'23:59':`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`
// A daily control's times with the window each counts as on time: «09:00 (08:00–11:00)».
export function timesWithWindows(f={}){
 const times=(f.times||[]).filter(Boolean)
 if(f.kind!=='daily'||!times.length)return times.join(' · ')
 return times.map((time,index)=>{const {open,close}=slotWindowMinutes(f,index);return `${time} (${hhmm(open)}–${hhmm(close)})`}).join(' · ')
}
// A schedule in a few words: a daily one by its times («07:00, 15:00 · Δευ–Παρ»), any other by its frequency.
export function scheduleSummary(f={},language='el'){
 const times=f.kind==='daily'?(f.times||[]).filter(Boolean):[]
 if(!times.length)return frequencyLabel(f,language)
 return `${times.join(', ')}${f.weekdaysOnly===true?(language==='en'?' · Mon–Fri':' · Δευ–Παρ'):''}`
}

// The schedule that applies in one department: its own when it has one, else the control's.
export function assignmentFrequency(item,department){
 return getAssignment(item,department)?.frequency||item?.frequency||{}
}

// A control's frequency for a list: the common one, or «varies by department» when its departments differ.
export function controlFrequencyLabel(item,departments,language='el'){
 const names=departments?.length?departments:Object.keys(item?.assignments||{})
 if(names.length>1&&scheduleVariants(item,names)>1)return language==='en'?'Varies by department':'Διαφέρει ανά τμήμα'
 return frequencyLabel(names.length?assignmentFrequency(item,names[0]):item?.frequency,language)
}

// The same for the lines of an adherence or calendar group (each line knows its own frequency).
export function linesFrequencyLabel(lines,item,language='el'){
 const frequencies=(lines||[]).map(line=>line.frequency||item?.frequency||{})
 if(new Set(frequencies.map(f=>JSON.stringify(f))).size>1)return language==='en'?'Varies by department':'Διαφέρει ανά τμήμα'
 return frequencyLabel(frequencies[0]||item?.frequency,language)
}

// How many distinct schedules the departments of a control run (1 = all the same).
export function scheduleVariants(item,departments=Object.keys(item?.assignments||{})){
 return new Set(departments.map(department=>JSON.stringify(assignmentFrequency(item,department)))).size
}

export function getAssignment(item,department){
 if(!item)return null
 const assignments=item.assignments||{}
 return assignments[department]??Object.values(assignments)[0]??null
}

// Overdue, due soon or scheduled, from the assignment's next_due_at (set by
// the database with the rules in controlDueRules.js, deadlines included).
export function assignmentStatus(item,department,now=new Date()){
 const assignment=getAssignment(item,department)
 // An inactive control (a FileMaker one no longer carried out) is not due anywhere.
 if(item?.status==='inactive')return 'paused'
 if(!assignment?.nextDueAt)return assignment?.status==='paused'?'paused':'scheduled'
 return dueState(assignment.nextDueAt,assignmentFrequency(item,department),now)
}

// Something to record now: the current period still needs an entry (its
// deadline falls within the period) or the control is overdue.
export function isControlDue(item,department,now=new Date()){
 const assignment=getAssignment(item,department)
 if(!assignment?.nextDueAt||item?.status==='inactive')return false
 if(assignmentProgress(item,department,now)?.complete)return false
 return new Date(assignment.nextDueAt)<periodBounds(assignmentFrequency(item,department),now).end
}

// The current period's progress for one department: { required, done, extra,
// complete }. The database counts it for the list (control_period_progress);
// otherwise, and once the period has moved on, the loaded history is counted.
export function assignmentProgress(item,department,now=new Date()){
 const assignment=getAssignment(item,department)
 if(!assignment)return null
 const frequency=assignmentFrequency(item,department)
 const counted=assignment.progress
 const {start,unit}=periodBounds(frequency,now)
 if(counted&&new Date(counted.start).getTime()===start.getTime())return {...counted,unit,complete:counted.done>=counted.required}
 return periodProgress(frequency,assignment.history||[],now)
}

// A step of the schedule: the next deadline after `fromDate`.
export function calculateNextDue(itemOrFrequency,fromDate=new Date()){
 const f=itemOrFrequency?.frequency||itemOrFrequency||{}
 return nextDeadlineAfter(f,fromDate)
}
