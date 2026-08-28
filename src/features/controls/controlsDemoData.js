export const controlDefinitions=[
 {id:'CTRL-001',title:'Θερμοκρασία ψυγείου φαρμάκων',titleEn:'Medication refrigerator temperature',category:'Θερμοκρασίες',responseConfig:{mode:'numeric',label:'Θερμοκρασία',unit:'°C',min:2,max:8,reportOnOutOfRange:true},departments:['ΜΕΘ'],departmentEn:['ICU'],frequency:{kind:'daily',timesPerDay:3,times:['08:00','14:00','20:00']},owner:'Νοσηλευτής βάρδιας',createdByScope:'department',createdByRole:'department_manager',createdForDepartment:'ΜΕΘ',createdBy:'Προϊστάμενος ΜΕΘ',createdById:'demo-dept-manager-icu',lastCompletedAt:'2026-08-27T14:05:00+03:00',nextDueAt:'2026-08-27T20:00:00+03:00',description:'Καταγραφή θερμοκρασίας ψυγείου και επιβεβαίωση αποδεκτών ορίων.',history:[{id:'EX-001',at:'2026-08-27T08:02:00+03:00',value:'4,2 °C',status:'completed',by:'Α. Νοσηλευτής'},{id:'EX-002',at:'2026-08-27T14:05:00+03:00',value:'4,5 °C',status:'completed',by:'Β. Νοσηλευτής'}]},
 {id:'CTRL-002',title:'Έλεγχος λήξης φαρμάκων',titleEn:'Medication expiry check',category:'Φάρμακα / Υλικά',responseConfig:{mode:'list',template:'medication_expiry',label:'Φάρμακα / υλικά που απαιτούν ενέργεια'},departments:['ΜΕΘ','ΤΕΠ'],departmentEn:['ICU','ED'],frequency:{kind:'monthly',interval:1},owner:'Προϊστάμενος τμήματος',createdByScope:'infection_control',createdByRole:'infection_control_lead',createdForDepartment:null,createdBy:'Προϊστάμενος Λοιμώξεων',createdById:'demo-infection-lead',lastCompletedAt:'2026-08-01T10:00:00+03:00',nextDueAt:'2026-09-01T10:00:00+03:00',description:'Έλεγχος ημερομηνιών λήξης φαρμάκων και αναλωσίμων.',history:[{id:'EX-003',at:'2026-08-01T10:00:00+03:00',value:'Ολοκληρώθηκε',status:'completed',by:'Προϊστάμενος ΜΕΘ'}]},
 {id:'CTRL-003',title:'Πρόγραμμα καλλιεργειών περιβάλλοντος',titleEn:'Environmental cultures programme',category:'Καλλιέργειες',responseConfig:{mode:'list',template:'generic_findings',label:'Σημεία / δείγματα'},departments:['ΜΕΘ','Χειρουργεία','ΜΤΝ'],departmentEn:['ICU','Operating Rooms','Dialysis'],frequency:{kind:'monthly',interval:3},owner:'Ομάδα Ελέγχου Λοιμώξεων',createdByScope:'infection_control',createdByRole:'infection_control_lead',createdForDepartment:null,createdBy:'Προϊστάμενος Λοιμώξεων',createdById:'demo-infection-lead',lastCompletedAt:'2026-05-15T09:00:00+03:00',nextDueAt:'2026-08-15T09:00:00+03:00',description:'Προγραμματισμένη δειγματοληψία στα επιλεγμένα τμήματα.',history:[{id:'EX-004',at:'2026-05-15T09:00:00+03:00',value:'Ολοκληρώθηκε',status:'completed',by:'Ομάδα Ελέγχου Λοιμώξεων'}]},
 {id:'CTRL-004',title:'Έλεγχος emergency trolley',titleEn:'Emergency trolley check',category:'Εξοπλισμός',responseConfig:{mode:'choice',label:'Κατάσταση ελέγχου',options:['Συμμορφώνεται','Μη συμμόρφωση'],reportOn:['Μη συμμόρφωση']},departments:['ΤΕΠ'],departmentEn:['ED'],frequency:{kind:'daily',timesPerDay:1,times:['07:30']},owner:'Υπεύθυνος βάρδιας',createdByScope:'department',createdByRole:'department_manager',createdForDepartment:'ΤΕΠ',createdBy:'Προϊστάμενος ΤΕΠ',createdById:'demo-dept-manager-ed',lastCompletedAt:'2026-08-27T07:31:00+03:00',nextDueAt:'2026-08-28T07:30:00+03:00',description:'Έλεγχος πληρότητας, σφραγίδας και ημερομηνιών λήξης.',history:[]},
]
export const demoControls=controlDefinitions
export const controlsAuditLog=[]
export const getControl=id=>controlDefinitions.find(x=>x.id===id)??null

export function frequencyLabel(f){if(f.kind==='daily')return f.timesPerDay>1?`${f.timesPerDay} φορές / ημέρα`:'Καθημερινά';if(f.kind==='weekly')return (f.interval||1)===1?'Εβδομαδιαία':`Κάθε ${f.interval} εβδομάδες`;if(f.kind==='monthly')return (f.interval||1)===1?'Μηνιαία':`Κάθε ${f.interval} μήνες`;if(f.kind==='yearly')return (f.interval||1)===1?'Ετήσια':`Κάθε ${f.interval} έτη`;return `Κάθε ${f.interval||1} ημέρες`}

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
export function assignmentStatus(item,department,now=new Date()){const a=getAssignment(item,department);if(!a?.nextDueAt)return 'scheduled';const diff=new Date(a.nextDueAt)-now;if(diff<=0)return 'overdue';if(diff<=24*60*60*1000)return 'dueSoon';return 'scheduled'}
export function controlStatus(item,now=new Date()){const states=item.departments.map(d=>assignmentStatus(item,d,now));if(states.includes('overdue'))return 'overdue';if(states.includes('dueSoon'))return 'dueSoon';return 'scheduled'}
export function isControlDue(item,department,now=new Date()){const a=getAssignment(item,department);return Boolean(a?.nextDueAt)&&new Date(a.nextDueAt)<=now}

function nextDailySlot(f,from){
 const times=(f.times||['09:00']).slice().sort()
 const y=from.getFullYear(),m=String(from.getMonth()+1).padStart(2,'0'),d=String(from.getDate()).padStart(2,'0'),day=`${y}-${m}-${d}`
 for(const time of times){const candidate=new Date(`${day}T${time}:00`);if(candidate>from)return candidate.toISOString()}
 const tomorrow=new Date(from);tomorrow.setDate(tomorrow.getDate()+1)
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
 const item=getControl(id);if(!item)return null
 const assignment=getAssignment(item,department);if(!assignment)return null
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
  Object.assign(existing,normalized,{updatedAt:now,updatedBy:actorSafe.name,updatedById:actorSafe.id})
  ensureAssignments(existing)
  controlsAuditLog.unshift({id:`AUD-${Date.now()}`,action:'control_definition_updated',controlId:existing.id,at:now,actor:actorSafe})
  return existing
 }
 normalized.id=`CTRL-${String(controlDefinitions.length+1).padStart(3,'0')}`
 normalized.history=[]
 normalized.createdAt=now;normalized.createdBy=actorSafe.name;normalized.createdById=actorSafe.id
 if(!normalized.nextDueAt)normalized.nextDueAt=calculateNextDue(normalized,new Date())
 normalized.assignments={}
 controlDefinitions.unshift(normalized);ensureAssignments(normalized)
 controlsAuditLog.unshift({id:`AUD-${Date.now()}`,action:'control_definition_created',controlId:normalized.id,at:now,actor:actorSafe})
 return normalized
}
export function deleteControl(id,{actor}={}){
 const index=controlDefinitions.findIndex(x=>x.id===id);if(index<0)return false
 const item=controlDefinitions[index],actorSafe=actor||{id:'unknown',name:'Άγνωστος χρήστης',email:''}
 controlsAuditLog.unshift({id:`AUD-${Date.now()}`,action:'control_definition_deleted',controlId:id,title:item.title,departments:[...item.departments],at:new Date().toISOString(),actor:actorSafe})
 controlDefinitions.splice(index,1);return true
}
