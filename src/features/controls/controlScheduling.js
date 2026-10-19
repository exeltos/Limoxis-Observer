import { dueState,nextDeadlineAfter,periodBounds,periodProgress } from './controlDueRules'

export function frequencyLabel(f={},language='el'){
 const en=language==='en'
 if(f.kind==='daily')return Number(f.timesPerDay||1)>1?(en?`${f.timesPerDay} times / day`:`${f.timesPerDay} φορές / ημέρα`):(en?'Daily':'Καθημερινά')
 if(f.kind==='weekly')return Number(f.interval||1)===1?(en?'Weekly':'Εβδομαδιαία'):(en?`Every ${f.interval} weeks`:`Κάθε ${f.interval} εβδομάδες`)
 if(f.kind==='monthly')return Number(f.interval||1)===1?(en?'Monthly':'Μηνιαία'):(en?`Every ${f.interval} months`:`Κάθε ${f.interval} μήνες`)
 if(f.kind==='yearly')return Number(f.interval||1)===1?(en?'Yearly':'Ετήσια'):(en?`Every ${f.interval} years`:`Κάθε ${f.interval} έτη`)
 return en?`Every ${f.interval||1} days`:`Κάθε ${f.interval||1} ημέρες`
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
 return dueState(assignment.nextDueAt,item?.frequency,now)
}

// Something to record now: the current period still needs an entry (its
// deadline falls within the period) or the control is overdue.
export function isControlDue(item,department,now=new Date()){
 const assignment=getAssignment(item,department)
 if(!assignment?.nextDueAt||item?.status==='inactive')return false
 if(assignmentProgress(item,department,now)?.complete)return false
 return new Date(assignment.nextDueAt)<periodBounds(item?.frequency||{},now).end
}

// The current period's progress for one department: { required, done, extra,
// complete }. The database counts it for the list (control_period_progress);
// otherwise, and once the period has moved on, the loaded history is counted.
export function assignmentProgress(item,department,now=new Date()){
 const assignment=getAssignment(item,department)
 if(!assignment)return null
 const frequency=item?.frequency||{}
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
