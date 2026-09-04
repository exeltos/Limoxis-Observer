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

export function assignmentStatus(item,department,now=new Date()){
 const assignment=getAssignment(item,department)
 if(!assignment?.nextDueAt)return assignment?.status==='paused'?'paused':'scheduled'
 const diff=new Date(assignment.nextDueAt)-now
 if(diff<=0)return 'overdue'
 if(diff<=24*60*60*1000)return 'dueSoon'
 return 'scheduled'
}

export function isControlDue(item,department,now=new Date()){
 const assignment=getAssignment(item,department)
 return Boolean(assignment?.nextDueAt)&&new Date(assignment.nextDueAt)<=now
}

function nextDailySlot(f,from){
 const times=(f.times||['09:00']).filter(Boolean).slice().sort()
 const safeTimes=times.length?times:['09:00']
 const y=from.getFullYear(),m=String(from.getMonth()+1).padStart(2,'0'),d=String(from.getDate()).padStart(2,'0'),day=`${y}-${m}-${d}`
 for(const time of safeTimes){
  const candidate=new Date(`${day}T${time}:00`)
  if(candidate>from)return candidate.toISOString()
 }
 const tomorrow=new Date(from)
 tomorrow.setDate(tomorrow.getDate()+1)
 const yy=tomorrow.getFullYear(),mm=String(tomorrow.getMonth()+1).padStart(2,'0'),dd=String(tomorrow.getDate()).padStart(2,'0')
 return new Date(`${yy}-${mm}-${dd}T${safeTimes[0]}:00`).toISOString()
}

export function calculateNextDue(itemOrFrequency,fromDate=new Date()){
 const f=itemOrFrequency?.frequency||itemOrFrequency||{}
 if(f.kind==='daily')return nextDailySlot(f,fromDate)
 const d=new Date(fromDate)
 if(f.kind==='weekly')d.setDate(d.getDate()+7*(Number(f.interval)||1))
 else if(f.kind==='monthly')d.setMonth(d.getMonth()+(Number(f.interval)||1))
 else if(f.kind==='yearly')d.setFullYear(d.getFullYear()+(Number(f.interval)||1))
 else d.setDate(d.getDate()+(Number(f.interval)||1))
 return d.toISOString()
}
