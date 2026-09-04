import { creationMetadata, updateMetadata } from '../../core/audit/actor'

// Production-facing baseline: no seeded control records.
// Users with permission create the control programme from the Controls screen.
export const controlDefinitions=[]
export const demoControls=controlDefinitions
export const controlsAuditLog=[]
export const getControl=id=>controlDefinitions.find(x=>x.id===id)??null

export function frequencyLabel(f,language='el'){
 const en=language==='en'
 if(f.kind==='daily')return f.timesPerDay>1?(en?`${f.timesPerDay} times / day`:`${f.timesPerDay} φορές / ημέρα`):(en?'Daily':'Καθημερινά')
 if(f.kind==='weekly')return (f.interval||1)===1?(en?'Weekly':'Εβδομαδιαία'):(en?`Every ${f.interval} weeks`:`Κάθε ${f.interval} εβδομάδες`)
 if(f.kind==='monthly')return (f.interval||1)===1?(en?'Monthly':'Μηνιαία'):(en?`Every ${f.interval} months`:`Κάθε ${f.interval} μήνες`)
 if(f.kind==='yearly')return (f.interval||1)===1?(en?'Yearly':'Ετήσια'):(en?`Every ${f.interval} years`:`Κάθε ${f.interval} έτη`)
 return en?`Every ${f.interval||1} days`:`Κάθε ${f.interval||1} ημέρες`
}

export function ensureAssignments(item){
 if(!item.assignments)item.assignments={}
 for(const department of item.departments){
  if(!item.assignments[department])item.assignments[department]={department,lastCompletedAt:item.lastCompletedAt||null,nextDueAt:item.nextDueAt||null,history:[...(item.history||[])]}
 }
 Object.keys(item.assignments).forEach(d=>{if(!item.departments.includes(d))delete item.assignments[d]})
 return item.assignments
}

export function getAssignment(item,department){
 const assignments=ensureAssignments(item)
 return assignments[department]??assignments[item.departments[0]]??null
}

export function assignmentStatus(item,department,now=new Date()){
 const a=getAssignment(item,department)
 if(!a?.nextDueAt)return 'scheduled'
 const diff=new Date(a.nextDueAt)-now
 if(diff<=0)return 'overdue'
 if(diff<=24*60*60*1000)return 'dueSoon'
 return 'scheduled'
}

export function controlStatus(item,now=new Date()){
 const states=item.departments.map(d=>assignmentStatus(item,d,now))
 if(states.includes('overdue'))return 'overdue'
 if(states.includes('dueSoon'))return 'dueSoon'
 return 'scheduled'
}

export function isControlDue(item,department,now=new Date()){
 const a=getAssignment(item,department)
 return Boolean(a?.nextDueAt)&&new Date(a.nextDueAt)<=now
}

function nextDailySlot(f,from){
 const times=(f.times||['09:00']).slice().sort()
 const y=from.getFullYear(),m=String(from.getMonth()+1).padStart(2,'0'),d=String(from.getDate()).padStart(2,'0'),day=`${y}-${m}-${d}`
 for(const time of times){
  const candidate=new Date(`${day}T${time}:00`)
  if(candidate>from)return candidate.toISOString()
 }
 const tomorrow=new Date(from)
 tomorrow.setDate(tomorrow.getDate()+1)
 const yy=tomorrow.getFullYear(),mm=String(tomorrow.getMonth()+1).padStart(2,'0'),dd=String(tomorrow.getDate()).padStart(2,'0')
 return new Date(`${yy}-${mm}-${dd}T${times[0]||'09:00'}:00`).toISOString()
}

export function calculateNextDue(item,fromDate=new Date()){
 const f=item.frequency||{}
 if(f.kind==='daily')return nextDailySlot(f,fromDate)
 const d=new Date(fromDate)
 if(f.kind==='weekly')d.setDate(d.getDate()+7*(Number(f.interval)||1))
 else if(f.kind==='monthly')d.setMonth(d.getMonth()+(Number(f.interval)||1))
 else if(f.kind==='yearly')d.setFullYear(d.getFullYear()+(Number(f.interval)||1))
 else d.setDate(d.getDate()+(Number(f.interval)||1))
 return d.toISOString()
}

export function completeControl(id,department,{value='',notes='',structuredData=null,hasFinding=false,actor}={}){
 const item=getControl(id)
 if(!item)return null
 const assignment=getAssignment(item,department)
 if(!assignment)return null
 const now=new Date(),at=now.toISOString()
 const actorSafe=actor||{id:'unknown',name:'Άγνωστος χρήστης',email:''}
 const execution={id:`EX-${Date.now()}`,at,value,notes,structuredData,hasFinding,status:'completed',department,actorId:actorSafe.id,by:actorSafe.name,email:actorSafe.email||'',previousLastCompletedAt:assignment.lastCompletedAt||null,previousNextDueAt:assignment.nextDueAt||null}
 assignment.history.unshift(execution)
 assignment.lastCompletedAt=at
 assignment.nextDueAt=calculateNextDue(item,now)
 controlsAuditLog.unshift({id:`AUD-${Date.now()}`,action:'control_execution_completed',controlId:id,department,executionId:execution.id,at,actor:actorSafe})
 return execution
}

export function updateControlExecution(id,department,executionId,{value='',notes='',structuredData=null,hasFinding=false,actor}={}){
 const item=getControl(id),assignment=item?getAssignment(item,department):null
 const execution=assignment?.history.find(x=>x.id===executionId)
 if(!execution||execution.status!=='completed')return false
 const actorSafe=actor||{id:'unknown',name:'Άγνωστος χρήστης',email:''}
 const before={value:execution.value,notes:execution.notes,structuredData:execution.structuredData,hasFinding:execution.hasFinding}
 const editedAt=new Date().toISOString()
 Object.assign(execution,{value,notes,structuredData,hasFinding,editedAt,editedBy:actorSafe.name,editedById:actorSafe.id,editCount:(execution.editCount||0)+1})
 execution.revisions=[...(execution.revisions||[]),{at:editedAt,actor:actorSafe,before,after:{value,notes,structuredData,hasFinding}}]
 controlsAuditLog.unshift({id:`AUD-${Date.now()}`,action:'control_execution_updated',controlId:id,department,executionId,at:editedAt,actor:actorSafe,before,after:{value,notes,structuredData,hasFinding}})
 return execution
}

export function cancelControlExecution(id,department,executionId,{reason='',actor}={}){
 const item=getControl(id),assignment=item?getAssignment(item,department):null
 const execution=assignment?.history.find(x=>x.id===executionId)
 if(!execution||execution.status!=='completed'||!reason.trim())return false
 const actorSafe=actor||{id:'unknown',name:'Άγνωστος χρήστης',email:''}
 execution.status='cancelled'
 execution.cancelledAt=new Date().toISOString()
 execution.cancelledBy=actorSafe.name
 execution.cancelledById=actorSafe.id
 execution.cancellationReason=reason.trim()
 if(assignment.history.find(x=>x.status==='completed')===undefined){
  assignment.lastCompletedAt=execution.previousLastCompletedAt||null
  assignment.nextDueAt=execution.previousNextDueAt||assignment.nextDueAt
 }else if(assignment.history[0]?.id===execution.id){
  assignment.lastCompletedAt=execution.previousLastCompletedAt||null
  assignment.nextDueAt=execution.previousNextDueAt||assignment.nextDueAt
 }
 controlsAuditLog.unshift({id:`AUD-${Date.now()}`,action:'control_execution_cancelled',controlId:id,department,executionId,at:execution.cancelledAt,reason:reason.trim(),actor:actorSafe})
 return true
}

export function upsertControl(draft,{actor}={}){
 const existing=getControl(draft.id)
 const normalized={...draft,frequency:{...draft.frequency,times:(draft.frequency.times||[]).filter(Boolean)}}
 const actorSafe=actor||{id:'unknown',name:'Άγνωστος χρήστης',email:''}
 const now=new Date().toISOString()
 if(existing){
  Object.assign(existing,normalized,updateMetadata(actorSafe,now))
  ensureAssignments(existing)
  controlsAuditLog.unshift({id:`AUD-${Date.now()}`,action:'control_definition_updated',controlId:existing.id,at:now,actor:actorSafe})
  return existing
 }
 normalized.id=`CTRL-${String(controlDefinitions.length+1).padStart(3,'0')}`
 normalized.history=[]
 Object.assign(normalized,creationMetadata(actorSafe,now))
 if(!normalized.nextDueAt)normalized.nextDueAt=calculateNextDue(normalized,new Date())
 normalized.assignments={}
 controlDefinitions.unshift(normalized)
 ensureAssignments(normalized)
 controlsAuditLog.unshift({id:`AUD-${Date.now()}`,action:'control_definition_created',controlId:normalized.id,at:now,actor:actorSafe})
 return normalized
}

export function deleteControl(id,{actor}={}){
 const index=controlDefinitions.findIndex(x=>x.id===id)
 if(index<0)return false
 const item=controlDefinitions[index],actorSafe=actor||{id:'unknown',name:'Άγνωστος χρήστης',email:''}
 controlsAuditLog.unshift({id:`AUD-${Date.now()}`,action:'control_definition_deleted',controlId:id,title:item.title,departments:[...item.departments],at:new Date().toISOString(),actor:actorSafe})
 controlDefinitions.splice(index,1)
 return true
}
