// Excel (.csv) exports of the main registries. Each builder returns the
// headers and rows of what the list currently shows (after its filters), so
// the file matches the screen an inspector is looking at.
import { downloadCsv } from './csvExport'

const day=(value,en)=>{
 if(!value)return ''
 const date=new Date(String(value).length===10?`${value}T12:00:00`:value)
 return Number.isNaN(date.getTime())?String(value):new Intl.DateTimeFormat(en?'en-GB':'el-GR').format(date)
}
const stamp=()=>new Date().toISOString().slice(0,10)

export function exportRegistry({name,headers,rows}){
 downloadCsv(`${name}_${stamp()}.csv`,headers,rows)
}

export function documentsExport(families,{en,typeLabels={},statusLabels={}}){
 return {
  name:en?'documents':'eggrafa',
  headers:en?['Code','Title','Type','Current version','Versions','Owner','Department / audience','Effective','Review','Status']:['Κωδικός','Τίτλος','Τύπος','Τρέχουσα έκδοση','Εκδόσεις','Υπεύθυνος','Τμήμα / κοινό','Ισχύς από','Αναθεώρηση','Κατάσταση'],
  rows:families.map(family=>{const x=family.current||{};const live=family.activePublished||x;return [family.root?.id||x.id,x.title,typeLabels[x.type]||x.type,x.version,family.versionCount||1,x.owner,x.department,day(live.effectiveDate,en),day(live.reviewDate,en),statusLabels[x.status]||x.status]}),
 }
}

export function trainingProgramsExport(programs,assignments,{en,statusLabel=value=>value,categoryLabel=value=>value}){
 const byProgram=new Map()
 for(const a of assignments){const list=byProgram.get(a.programId)||[];list.push(a);byProgram.set(a.programId,list)}
 return {
  name:en?'training-programmes':'programmata-ekpaideusis',
  headers:en?['Code','Programme','Category','Trainer','Audience','Start','Due','Valid (months)','Assessment','Pass score','Participants','Completed','Overdue','Completion %','Status']:['Κωδικός','Πρόγραμμα','Κατηγορία','Εκπαιδευτής','Κοινό','Έναρξη','Προθεσμία','Ισχύς (μήνες)','Αξιολόγηση','Βάση','Συμμετέχοντες','Ολοκλήρωσαν','Εκπρόθεσμοι','Ολοκλήρωση %','Κατάσταση'],
  rows:programs.map(p=>{const list=byProgram.get(p.id)||[];const done=list.filter(a=>a.computedStatus==='completed').length;const late=list.filter(a=>a.computedStatus==='overdue').length;return [p.id,p.title,categoryLabel(p.category),p.trainer||p.owner,p.audience,day(p.startDate,en),day(p.dueDate,en),p.validMonths??'',p.requiresAssessment?(en?'Yes':'Ναι'):(en?'No':'Όχι'),p.requiresAssessment?(p.passScore??''):'',list.length,done,late,list.length?Math.round(done/list.length*100):'',statusLabel(p.status)]}),
 }
}

export function trainingParticipationExport(assignments,programs,certificates,{en,statusLabel=value=>value}){
 const programById=new Map(programs.map(p=>[p.id,p]))
 const certificateByAssignment=new Map(certificates.map(c=>[c.assignmentId,c]))
 return {
  name:en?'training-participation':'symmetoxes-ekpaideusis',
  headers:en?['Programme code','Programme','Person','Department','Email','Assigned','Due','Attendance','Completed','Score %','Status','Certificate','Valid until']:['Κωδικός προγράμματος','Πρόγραμμα','Άτομο','Τμήμα','Email','Ανάθεση','Προθεσμία','Παρουσία','Ολοκλήρωση','Βαθμός %','Κατάσταση','Πιστοποιητικό','Ισχύει έως'],
  rows:assignments.map(a=>{const p=programById.get(a.programId)||{};const c=certificateByAssignment.get(a.id)||{};return [a.programId,p.title||'',a.employeeName,a.department,a.email,day(a.assignedDate,en),day(a.dueDate,en),a.attendanceResponse==='confirmed'||a.attendance===true?(en?'Confirmed':'Επιβεβαιώθηκε'):(en?'Pending':'Εκκρεμεί'),day(a.completedDate||a.completionConfirmedAt,en),a.score??'',statusLabel(a.computedStatus||a.status),c.id||'',day(c.validUntil,en)]}),
 }
}

export function controlsExport(rows,{en,frequencyLabel=()=>'' ,stateLabel=value=>value,criticality=()=>'',criticalityLabel=value=>value}){
 const lines=[]
 for(const {item,departments} of rows){
  for(const department of departments){
   const assignment=item.assignments?.[department]||{}
   // Counted in the database (control_assignment_summary, voided entries left out).
   const summary=assignment.summary||{}
   lines.push([item.id,item.title,item.category,department,frequencyLabel(assignment.frequency||item.frequency),criticalityLabel(criticality(item)),item.owner,summary.executions||0,summary.findings||0,day(assignment.lastCompletedAt,en),day(assignment.nextDueAt,en),stateLabel(assignment)])
  }
 }
 return {
  name:en?'controls-programme':'programma-elegxon',
  headers:en?['Code','Control','Category','Department','Frequency','Criticality','Responsible','Entries','With finding','Last done','Next due','Status']:['Κωδικός','Έλεγχος','Κατηγορία','Τμήμα','Συχνότητα','Κρισιμότητα','Υπεύθυνος','Καταχωρήσεις','Με εύρημα','Τελευταία','Επόμενη','Κατάσταση'],
  rows:lines,
 }
}

export function qualityExport(section,rows,{en,t=value=>value}){
 const owner=r=>(r.owners?.length?r.owners:[r.owner].filter(Boolean)).join(', ')
 const title=r=>(en?r.titleEn:r.title)||r.title
 const department=r=>(en?r.departmentEn:r.department)||r.department
 const common=[en?'Code':'Κωδικός',en?'Title':'Τίτλος',en?'Department':'Τμήμα']
 if(section==='capas'){
  return {name:en?'capa':'capa',headers:[...common,en?'Type':'Τύπος',en?'Priority':'Προτεραιότητα',en?'Owner':'Υπεύθυνος',en?'Due':'Προθεσμία',en?'Steps done':'Βήματα',en?'Source':'Πηγή',en?'Effectiveness review':'Έλεγχος αποτελεσματικότητας',en?'Effectiveness':'Αποτελεσματικότητα',en?'Status':'Κατάσταση'],
   rows:rows.map(r=>{const steps=r.subActions||[];return [r.displayId||r.id,title(r),department(r),t(r.actionType),t(r.priority),owner(r),day(r.dueDate,en),steps.length?`${steps.filter(s=>s.done).length}/${steps.length}`:'',r.sourceId||'',day(r.effectivenessDue,en),t(r.effectivenessStatus),t(r.status)]})}
 }
 if(section==='incidents'){
  return {name:en?'incidents':'symvanta',headers:[...common,en?'Date':'Ημερομηνία',en?'Type':'Τύπος',en?'Severity':'Σοβαρότητα',en?'Reached patient':'Έφτασε στον ασθενή',en?'Harm':'Βλάβη',en?'Owner':'Υπεύθυνος',en?'Status':'Κατάσταση'],
   rows:rows.map(r=>[r.displayId||r.id,title(r),department(r),day(r.date,en),r.incidentClass||'',t(r.severity),r.reachedPatient?(en?'Yes':'Ναι'):(en?'No':'Όχι'),r.harmOccurred?(en?'Yes':'Ναι'):(en?'No':'Όχι'),owner(r),t(r.status)])}
 }
 if(section==='findings'){
  return {name:en?'findings':'evrimata',headers:[...common,en?'Date':'Ημερομηνία',en?'Severity':'Σοβαρότητα',en?'Source':'Πηγή',en?'Owner':'Υπεύθυνος',en?'Status':'Κατάσταση'],
   rows:rows.map(r=>[r.displayId||r.id,title(r),department(r),day(r.date,en),t(r.severity),[t(r.source),r.sourceId].filter(Boolean).join(' · '),owner(r),t(r.status)])}
 }
 return {name:en?'audits':'epitheoriseis',headers:[en?'Code':'Κωδικός',en?'Title':'Τίτλος',en?'Type':'Τύπος',en?'Planned':'Προγραμματισμένη',en?'Completed':'Ολοκληρώθηκε',en?'Lead auditor':'Επικεφαλής ελεγκτής',en?'Status':'Κατάσταση'],
  rows:rows.map(r=>[r.displayId||r.id,title(r),t(r.auditType),day(r.plannedDate,en),day(r.completedDate,en),r.leadAuditor||'',t(r.status)])}
}

// The Excel (.csv) file of what the open tab lists, after its search and filters.
export function surveillanceListExport(mode, rows, { language, t, fmt, organism, resistance, screening }) {
  const en = language === 'en'
  const pick = (el, enValue) => (en ? enValue || el : el)
  if (mode === 'employees')
    return {
      name: en ? 'employee-screenings' : 'elegxoi-ergazomenon',
      headers: en ? ['Employee', 'Code', 'Department', 'Started', 'Screening', 'Result', 'Status'] : ['Εργαζόμενος', 'Κωδικός', 'Τμήμα', 'Έναρξη', 'Έλεγχος', 'Αποτέλεσμα', 'Κατάσταση'],
      rows: rows.map(x => [pick(x.employeeName, x.employeeNameEn), x.employeeId || '', pick(x.department, x.departmentEn), fmt(x.startedAt), (x.screeningTypes || []).map(screening).join(', '), t(x.resultStatus || 'pending'), t(x.status)]),
    }
  if (mode === 'environmental')
    return {
      name: en ? 'environmental-sampling' : 'perivallontiki-epitirisi',
      headers: en ? ['Code', 'Type', 'Department', 'Sampling point', 'Date', 'Batch', 'Result', 'CFU', 'Status'] : ['Κωδικός', 'Τύπος', 'Τμήμα', 'Σημείο δειγματοληψίας', 'Ημερομηνία', 'Παρτίδα', 'Αποτέλεσμα', 'CFU', 'Κατάσταση'],
      rows: rows.map(x => [x.code || x.id, x.type || '', x.department || '', [x.location, x.point].filter(Boolean).join(' · '), fmt(x.collectedAt || x.requestedAt), x.environmentalBatchId || '', x.result ? t(x.result) : '', x.microbiologyResults?.[0]?.cfuCount ?? '', t(x.status)]),
    }
  return {
    name: en ? 'surveillance-episodes' : 'epeisodia-epitirisis',
    headers: en ? ['Patient', 'Patient code', 'Department', 'Started', 'Organism', 'Resistance', 'Status', 'Next review'] : ['Ασθενής', 'Κωδικός ασθενούς', 'Τμήμα', 'Έναρξη', 'Μικροοργανισμός', 'Αντοχή', 'Κατάσταση', 'Επόμενη επανεκτίμηση'],
    rows: rows.map(x => [pick(x.patient, x.patientEn), x.patientId || '', pick(x.department, x.departmentEn), fmt(x.startedAt), organism(x), resistance(x), t(x.status), x.status === 'active' ? fmt(x.groupReviewDue ?? x.reviewDue) : '']),
  }
}

// The Excel (.csv) file of the registry as filtered on screen.
export function patientsListExport(rows,{language,t,fmt}){
  const en=language==='en'
  return {
    name:en?'patients':'asthenis',
    headers:en?['Patient','Patient code','Record number','Department','Admission','Status']:['Ασθενής','Κωδικός ασθενούς','Αριθμός φακέλου','Τμήμα','Εισαγωγή','Κατάσταση'],
    rows:rows.map(p=>[en?(p.nameEn||p.name):p.name,p.id,p.hospitalRecordNumber||'',en?p.departmentEn:p.department,fmt(p.admissionDate),t(p.status)]),
  }
}
