import { useCallback,useEffect,useMemo,useState } from 'react'
import { Building2, CalendarX2, ClipboardCheck, FileClock, ListChecks, LockKeyhole, PlayCircle, Pencil, FileText, RotateCcw, Trash2 } from 'lucide-react'
import { useLocation,useNavigate,useParams,useSearchParams } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { ExportMenu } from '../../design-system/ExportMenu'
import { downloadRecordJson } from '../../core/export/recordExport'
import { ActionButton } from '../../design-system/ActionButton'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { RegistryTable } from '../../design-system/RegistryTable'
import { FilterSelect } from '../../design-system/FilterBar'
import { DetailList } from '../../design-system/DetailList'
import { SectionHeader } from '../../design-system/SectionHeader'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useAuth } from '../../core/auth/AuthContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { ControlEditor } from './ControlEditor'
import { ControlExecutionEditor,ControlExecutionModal } from './ControlExecutionForm'
import { SignalBadge } from '../../design-system/StatusBadge'
import { formatDateTime } from '../../core/i18n/formatDay'
import { ownerText,personLabel } from '../employees/peopleOptions'
import { ControlEvidenceLinks } from './ControlEvidence'
import { controlCriticality,criticalityLabel,deviationActions,requiresEvidence } from './controlCriticality'
import { assignmentResponse,limitsText,responseVariants } from './controlResponse'
import { ControlCancellationModal } from './ControlCancellationModal'
import { ControlExpiryPanel } from './ControlExpiryPanel'
import { ControlDepartmentListDialog } from './ControlDepartmentListDialog'
import { expiryCounts,expiryItems,isExpiryControl,prefilledExpiryRows,recordsFindingsOnly } from './controlExpiry'
import { removeExpiryItem } from './controlExpiryRemoval'
import { controlActorFromAuth } from './controlActor'
import { printControlForm,structuredSummary } from './controlStructured'
import { assignmentFrequency,assignmentProgress,assignmentStatus,controlFrequencyLabel,frequencyLabel,canRecordAnytime,getAssignment,recordWindow,scheduleVariants,timesWithWindows } from './controlScheduling'
import { slotStarts,slotWindowMinutes,zonedInstant,zonedParts } from './controlDueRules'
import { ChoiceChips } from '../../design-system/ChoiceChips'
import { RateMeter,useAdherenceLines } from './ControlAdherencePanel'
import { ControlMissedDialog,missedText } from './ControlMissedDialog'
import { periodRange,periodShort } from './controlAdherence'
import { progressCompleteMessage,progressText } from './controlProgress'
import { controlOverallStatus,controlRecordPermissions,pickControlDepartment } from './controlRecordAccess'
import { completeControlExecution,deleteControlDefinition,loadControlByCode,loadControlHistoryPage,saveControlDefinition,updateControlExecution,voidControlExecution } from './controlCloudService'
import { useRecordSequenceNavigation } from '../../core/navigation/useRecordSequenceNavigation'
import './controlRecord.css'

export function ControlRecordPage(){
 const {controlId}=useParams()
 const [searchParams]=useSearchParams()
 const navigate=useNavigate()
 // Where an entry started from the list or the home page returns to after saving.
 const location=useLocation(),returnTo=location.state?.returnTo||null
 const {confirm,notify,notifyError}=useFeedback()
 const {language,locale}=useLanguage();const en=language==='en'
 const {role,membership,tenant,canAccessRecord}=useTenant()
 const {profile,user}=useAuth()
 const actor=useMemo(()=>controlActorFromAuth({profile,user}),[profile,user])
 const [tab,setTab]=useState(()=>searchParams.get('tab')||'')
 // Moving to another control (‹ ›) opens it on its details again.
 const [tabFor,setTabFor]=useState(controlId)

 const [expiryExport,setExpiryExport]=useState(null)
 const [listDepartment,setListDepartment]=useState(null)
 const [cancelExecution,setCancelExecution]=useState(null)
 const [deleteExecution,setDeleteExecution]=useState(null)
 const [editExecution,setEditExecution]=useState(null)
 const [record,setRecord]=useState(null)
 const [loading,setLoading]=useState(true)
 const [historyPage,setHistoryPage]=useState(1)
 const [historyPageSize,setHistoryPageSize]=useState(15)
 const [historyDepartment,setHistoryDepartment]=useState('all')
 // The period of this control's rates and of its executions list (the same choices as the Controls page).
 const [period,setPeriod]=useState('30d')
 const [withMissed,setWithMissed]=useState(false)
 const [missedOf,setMissedOf]=useState(null)
 // Moving to another control starts on its own tab and on the first page of its history.
 if(tabFor!==controlId){setTabFor(controlId);setTab(searchParams.get('tab')||'');setHistoryPage(1)}
 const ownDepartment=membership?.previewDepartment||membership?.departmentName||membership?.department||''
 const executing=searchParams.get('execute')==='1'
 const editing=searchParams.get('edit')==='1'
 const recordNavigation=useRecordSequenceNavigation({registry:'controls',currentId:controlId,pathForId:id=>`/controls/${id}`})

 const reload=useCallback(async()=>{
  if(!tenant?.id){setRecord(null);setLoading(false);return}
  setLoading(true)
  try{setRecord(await loadControlByCode(tenant.id,controlId))}
  catch(error){setRecord(null);notifyError(error,'load',{operation:'control_record_load'})}
  finally{setLoading(false)}
 },[tenant?.id,controlId,notifyError])
 useEffect(()=>{void reload()},[reload])

 // The executions tab reads one page at a time from the database (a control
 // done daily for years has thousands of entries); it reloads with the record.
 const [historyData,setHistoryData]=useState({key:'',rows:[],total:0})
 // One department or all of them (the «Department» choice above the table).
 const historyAssignmentIds=useMemo(()=>record?record.departments.filter(dep=>canAccessRecord({department:dep,departmentId:record.departmentIdByName?.[dep]||null})).filter(dep=>historyDepartment==='all'||dep===historyDepartment).map(dep=>record.assignments?.[dep]?.dbId).filter(Boolean):[],[record,canAccessRecord,historyDepartment])
 const historyFrom=useMemo(()=>periodRange(period,new Date()).from.toISOString().slice(0,13),[period])
 const historyKey=`${historyAssignmentIds.join(',')}|${historyPage}|${historyPageSize}|${historyFrom}`
 const historyOpen=tab==='history'
 useEffect(()=>{
  if(!tenant?.id||!historyOpen||!historyAssignmentIds.length)return undefined
  let active=true
  loadControlHistoryPage(tenant.id,historyAssignmentIds,{page:historyPage,pageSize:historyPageSize,from:periodRange(period,new Date()).from})
   .then(result=>{if(active)setHistoryData({key:historyKey,...result})})
   .catch(error=>{if(active){setHistoryData({key:historyKey,rows:[],total:0});notifyError(error,'load',{operation:'control_history_load'})}})
  return()=>{active=false}
 },[tenant?.id,historyOpen,historyAssignmentIds,historyPage,historyPageSize,historyKey,period,record,notifyError])
 // The rates and the missed executions per department, read only for the two tabs that show them.
 const adherenceRows=useMemo(()=>record?[{item:record,departments:record.departments.filter(dep=>canAccessRecord({department:dep,departmentId:record.departmentIdByName?.[dep]||null}))}]:[],[record,canAccessRecord])
 const adherence=useAdherenceLines(adherenceRows,tab==='departments'||tab==='history'?tenant?.id:null,period,record,null)

 if(loading)return <Page title={en?'Controls':'Έλεγχοι'}><div className="inline-empty">{en?'Loading control…':'Φόρτωση ελέγχου…'}</div></Page>
 if(!record)return <Page title={en?'Controls':'Έλεγχοι'}><div className="inline-empty">{en?'Control not found.':'Δεν βρέθηκε ο έλεγχος.'}</div></Page>

 const visibleDepartments=record.departments.filter(dep=>canAccessRecord({department:dep,departmentId:record.departmentIdByName?.[dep]||null}))
 const requestedDepartment=searchParams.get('department')||''
 const department=pickControlDepartment(visibleDepartments,requestedDepartment,ownDepartment)
 const recordUrl=`/controls/${controlId}`
 const assignments=visibleDepartments.map(dep=>({department:dep,assignment:getAssignment(record,dep)}))
 // Departments that run on different schedules show each one's own in the Departments tab.
 const differentSchedules=scheduleVariants(record,visibleDepartments)>1
 // Limits per department, when they are not the same everywhere.
 const differentLimits=record.responseConfig?.mode==='numeric'&&responseVariants(record,visibleDepartments)>1

 const {canModifyDefinition,editsOwnDepartmentOnly,canDeleteDraft,canRemoveDefinition,canExecuteDepartment,canCancelHistory,canDeleteHistory,canEditHistory}=controlRecordPermissions({role,membership,record,actorId:actor.id,allDepartmentsVisible:record.departments.length>0&&visibleDepartments.length===record.departments.length})
 const canExecute=Boolean(department)&&canExecuteDepartment(department)
 // A department records a daily control with set times only inside its window (1 hour before to its margin after);
 // only the hospital administrator and the platform owner record at any time.
 const windowOf=dep=>canRecordAnytime(role)?{gated:false}:recordWindow(record,dep)
 const heldBack=dep=>{const win=windowOf(dep);return win.gated&&win.state!=='open'}
 const clock=d=>d?`${String(zonedParts(d).hour).padStart(2,'0')}:${String(zonedParts(d).minute).padStart(2,'0')}`:''
 const heldText=dep=>{const win=windowOf(dep);return win.state==='before'?(en?`From ${clock(win.opens)}`:`Από ${clock(win.opens)}`):(en?'Closed':'Έκλεισε')}
 const heldHint=dep=>{const win=windowOf(dep);return win.state==='before'?(en?`The entry opens at ${clock(win.opens)} (1 hour before its time). For anything else, contact the hospital administrator.`:`Η καταχώρηση ανοίγει στις ${clock(win.opens)} (1 ώρα πριν την ώρα του ελέγχου). Για οτιδήποτε άλλο, επικοινωνήστε με τον Διαχειριστή.`):(en?'The time of this control has passed. Contact the hospital administrator.':'Η ώρα του ελέγχου πέρασε. Επικοινωνήστε με τον Διαχειριστή.')}
 const fmt=v=>formatDateTime(v,language)
 const status=controlOverallStatus(record,visibleDepartments)
 const hasDraft=assignments.some(x=>Boolean(x.assignment?.hasDraft))
 const sourceLabel=record.createdByScope==='platform'?'Platform Owner':record.createdByScope==='hospital_admin'?(en?'Hospital Administrator':'Διαχειριστής Νοσοκομείου'):record.createdByScope==='quality'?(en?'Quality Manager':'Υπεύθυνος Ποιότητας'):(record.createdByScope==='department'?(en?'Department manager':'Προϊστάμενος Τμήματος'):(en?'Infection Control Lead':'Προϊστάμενος Λοιμώξεων'))
 const historyLoaded=!historyAssignmentIds.length||historyData.key===historyKey
 const historyRows=assignments.flatMap(({department:dep,assignment:current})=>(historyLoaded?historyData.rows:[]).filter(h=>h.assignmentId===current?.dbId).map(h=>({...h,department:dep}))).sort((a,b)=>new Date(b.at)-new Date(a.at))
 const historyTotal=historyLoaded?historyData.total:0
 const historyTotalPages=Math.max(1,Math.ceil(historyTotal/historyPageSize))
 const historySafePage=Math.min(historyPage,historyTotalPages)
 const pagedHistory=historyRows
 const periodChips=<ChoiceChips className="control-record-period" label="" options={['today','30d','60d','6m','12m'].map(key=>({value:key,label:periodShort(key,language)}))} selected={[period]} onToggle={setPeriod}/>
 const lineOf=dep=>adherence.lines.find(line=>line.department===dep)
 const hhmm=minutes=>`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`
 // The set time an entry belongs to (the nearest) and whether it fell inside that time's window.
 const timeOfEntry=h=>{
  const f=assignmentFrequency(record,h.department)
  if(f?.kind!=='daily'||!(f.times||[]).some(Boolean))return null
  const starts=slotStarts(f),p=zonedParts(h.at),m=p.hour*60+p.minute
  let index=0,best=Infinity
  starts.forEach((start,k)=>{const d=Math.abs(m-start);if(d<best){best=d;index=k}})
  const window=slotWindowMinutes(f,index)
  return {time:hhmm(starts[index]),onTime:m>=window.open&&m<=window.close}
 }
 // The missed executions as rows between the entries of the page, newest first.
 const missedRows=withMissed&&historyLoaded?adherence.lines.filter(line=>historyDepartment==='all'||line.department===historyDepartment).flatMap(line=>(line.missedDays||[]).flatMap(miss=>{
  const [y,mo,d]=miss.day.split('-').map(Number)
  const times=miss.times?.length?miss.times:[null]
  return times.map(time=>{const minutes=time?Number(time.slice(0,2))*60+Number(time.slice(3,5)):23*60+59;return {id:`missed|${line.department}|${miss.day}|${time||''}`,missed:true,department:line.department,at:zonedInstant(y,mo,d,minutes).toISOString(),miss:{...miss,times:time?[time]:[]}}})
 })):[]
 const upper=historySafePage===1?Infinity:new Date(pagedHistory[0]?.at||0).getTime()
 const lower=historySafePage>=historyTotalPages?-Infinity:new Date(pagedHistory[pagedHistory.length-1]?.at||0).getTime()
 const shownHistory=withMissed?[...pagedHistory,...missedRows.filter(row=>{const t=new Date(row.at).getTime();return t<=upper&&t>lower})].sort((a,b)=>new Date(b.at)-new Date(a.at)):pagedHistory
 const expiryControl=isExpiryControl(record)
 const expiry=expiryControl?expiryCounts(expiryItems(record,visibleDepartments)):{expired:0,expiring:0,alerting:0}
 // A control opens on its details; links from the expiry lists and alerts ask for ?tab=expiry.
 const currentTab=tab==='expiry'&&!expiryControl?'details':tab||'details'
 const isDeletedExecution=h=>h.status==='cancelled'&&String(h.cancellationReason||'').startsWith('[DELETE]')
 const cancellationText=h=>String(h.cancellationReason||'').replace(/^\[DELETE\]\s*/,'')

 async function removeDefinition(){
  const deleting=canDeleteDraft
  const ok=await confirm({title:deleting?(en?'Delete control':'Διαγραφή ελέγχου'):(en?'Archive control':'Αρχειοθέτηση ελέγχου'),message:deleting?(en?'The draft control and its schedule will be deleted. Continue?':'Ο πρόχειρος έλεγχος θα διαγραφεί μαζί με το πρόγραμμά του. Θέλετε να συνεχίσετε;'):(en?'The control will be removed from the active programme while its execution history remains preserved. Continue?':'Ο έλεγχος θα αφαιρεθεί από το ενεργό πρόγραμμα, ενώ το ιστορικό εκτελέσεων θα διατηρηθεί. Θέλετε να συνεχίσετε;'),confirmLabel:deleting?(en?'Delete':'Διαγραφή'):(en?'Archive':'Αρχειοθέτηση'),danger:true})
  if(!ok)return
  try{
   if(deleting)await deleteControlDefinition(tenant.id,record)
   else await saveControlDefinition(tenant.id,{...record,status:'archived'},{actorName:actor.name,createdByScope:record.createdByScope,createdForDepartment:record.createdForDepartment})
   notify(deleting?(en?'Control deleted.':'Ο έλεγχος διαγράφηκε.'):(en?'Control archived.':'Ο έλεγχος αρχειοθετήθηκε.'),'success')
   navigate('/controls')
  }catch(error){notifyError(error,deleting?'delete':'save',{operation:deleting?'control_definition_delete':'control_definition_archive'})}
 }
 async function saveDefinition(draft){
  try{await saveControlDefinition(tenant.id,{...record,...draft},{actorName:actor.name,createdByScope:record.createdByScope,createdForDepartment:record.createdForDepartment});await reload();navigate(recordUrl,{replace:true});notify(en?'Changes saved.':'Οι αλλαγές αποθηκεύτηκαν.','success')}
  catch(error){notifyError(error,'save',{operation:'control_definition_update'})}
 }
 async function saveExecution(payload){
  try{
   await completeControlExecution(tenant.id,record,department,payload)
   await reload()
   setTab('history')
   setHistoryPage(1)
   notify(en?'Control recorded.':'Ο έλεγχος καταχωρήθηκε.','success')
   // Back to where the entry started (the list or the home page), else to the control.
   navigate(returnTo||recordUrl,{replace:true})
  }catch(error){
   // Someone else completed the period meanwhile: say so and show the new count.
   if(error?.code==='control_period_complete'){await reload();notify(progressCompleteMessage(error.progress||assignmentProgress(record,department),language),'warning');return}
   if(/control_outside_window/.test(String(error?.message||''))){await reload();notify(en?'This control can be recorded only inside the window of its time. Contact the hospital administrator.':'Ο έλεγχος καταχωρείται μόνο μέσα στο παράθυρο της ώρας του. Επικοινωνήστε με τον Διαχειριστή.','warning');return}
   notifyError(error,'save',{operation:'control_execution_create'});throw error
  }
 }
 async function editExistingExecution(payload){
  const dep=editExecution?.department||department
  try{await updateControlExecution(tenant.id,record,dep,editExecution,payload);setEditExecution(null);await reload();notify(en?'Entry updated.':'Η καταχώρηση ενημερώθηκε.','success')}
  catch(error){notifyError(error,'save',{operation:'control_execution_update'})}
 }
 async function voidExecution(payload){
  const dep=cancelExecution?.department||department
  try{await voidControlExecution(tenant.id,record,dep,cancelExecution,payload);setCancelExecution(null);await reload();notify(en?'Entry voided.':'Η καταχώρηση αναιρέθηκε.','success')}
  catch(error){notifyError(error,'save',{operation:'control_execution_void'})}
 }
 async function deleteExecutionEntry(payload){
  const dep=deleteExecution?.department||department
  try{await voidControlExecution(tenant.id,record,dep,deleteExecution,{...payload,reason:`[DELETE] ${payload.reason.trim()}`});setDeleteExecution(null);await reload();notify(en?'Entry deleted.':'Η καταχώρηση διαγράφηκε.','success')}
  catch(error){notifyError(error,'save',{operation:'control_execution_delete'})}
 }

 function historyActions(h){
  return [
   h.structuredData?.rows?.length>0?{id:'entry-form',label:isExpiryControl(record)?(en?'Print change form':'Εκτύπωση εντύπου αλλαγών'):(en?'Print entry form':'Εκτύπωση εντύπου καταχώρησης'),icon:FileText,onClick:()=>printControlForm({record,department:h.department,execution:h})}:null,
   canEditHistory(h)?{id:'edit',label:en?'Edit entry':'Επεξεργασία καταχώρησης',icon:Pencil,onClick:()=>setEditExecution(h)}:null,
   canDeleteHistory(h)?{id:'delete',label:en?'Delete entry':'Διαγραφή καταχώρησης',icon:Trash2,tone:'danger',separatorBefore:true,onClick:()=>setDeleteExecution(h)}:null,
   canCancelHistory(h)?{id:'void',label:en?'Void entry':'Αναίρεση καταχώρησης',icon:RotateCcw,onClick:()=>setCancelExecution(h)}:null,
  ]
 }

 if(editing&&canModifyDefinition)return <ControlEditor initial={record} departmentOnly={editsOwnDepartmentOnly} fixedDepartment={editsOwnDepartmentOnly?(record.createdForDepartment||visibleDepartments[0]||''):''} onCancel={()=>navigate(recordUrl,{replace:true})} onSave={saveDefinition}/>

 if(executing){
  if(canExecute&&heldBack(department))return <Page title={en?'Controls':'Έλεγχοι'}><div className="inline-empty"><strong>{heldText(department)}</strong><span>{heldHint(department)}</span></div></Page>
  if(!canExecute)return <Page title={en?'Controls':'Έλεγχοι'}><div className="inline-empty">{en?'This control is not available for execution right now.':'Ο έλεγχος δεν είναι διαθέσιμος για καταχώρηση αυτή τη στιγμή.'}</div></Page>
  return <Page fill><EntityRecordShell className="control-record-shell control-execution-record-shell workspace-fill" avatar={<ClipboardCheck size={19}/>} eyebrow={en?'Control':'Έλεγχος'} recordId={record.id} title={`${en?'Record control':'Καταχώρηση ελέγχου'} · ${language==='el'?record.title:record.titleEn}`} subtitle={`${department} · ${frequencyLabel(assignmentFrequency(record,department),language)}`} tabs={[]} onBack={()=>navigate(returnTo||recordUrl,{replace:true})}>
   <div className="record-section control-execution-page-card"><ControlExecutionEditor organizationId={tenant.id} record={record} department={department} onDraftSaved={async()=>{await reload()}} onSave={saveExecution}/></div>
  </EntityRecordShell></Page>
 }

 const headerActions=<>
  {canExecute&&visibleDepartments.length===1&&heldBack(department)&&<ActionButton label={heldHint(department)} title={heldHint(department)} tone="primary" disabled onClick={()=>{}}><PlayCircle size={15}/><span>{heldText(department)}</span></ActionButton>}
  {canExecute&&visibleDepartments.length===1&&!heldBack(department)&&<ActionButton label={en?'Record control':'Καταχώρηση ελέγχου'} tone="primary" onClick={()=>navigate(`/controls/${controlId}?department=${encodeURIComponent(department)}&execute=1`)}><PlayCircle size={15}/><span>{en?'Record':'Καταχώρηση'}</span></ActionButton>}
  {canModifyDefinition&&<ActionButton label={en?'Edit control':'Επεξεργασία ελέγχου'} tone="edit" onClick={()=>navigate(`${recordUrl}?edit=1`)}><Pencil size={15}/><span>{en?'Edit':'Επεξεργασία'}</span></ActionButton>}
  {canRemoveDefinition&&<ActionButton label={canDeleteDraft?(en?'Delete control':'Διαγραφή ελέγχου'):(en?'Archive control':'Αρχειοθέτηση ελέγχου')} tone="danger" onClick={removeDefinition}><Trash2 size={15}/><span>{canDeleteDraft?(en?'Delete':'Διαγραφή'):(en?'Archive':'Αρχειοθέτηση')}</span></ActionButton>}
  <ExportMenu onPrint={()=>window.print()} items={[{id:'json',kind:'data',label:en?'Data file (JSON)':'Αρχείο δεδομένων',onClick:()=>downloadRecordJson(record,{filename:record?.id})},...(currentTab==='expiry'&&expiryExport?expiryExport:[])]} />
 </>
 const subtitle=visibleDepartments.length===1?visibleDepartments[0]:`${visibleDepartments.length} ${en?'departments':'τμήματα'}`

 return <Page fill><EntityRecordShell className="control-record-shell workspace-fill" avatar={<ClipboardCheck size={19}/>} eyebrow={en?'Control':'Έλεγχος'} recordId={record.id} title={language==='el'?record.title:record.titleEn} subtitle={`${subtitle} · ${record.id}`} status={<div className="control-status-stack">{expiry.expired>0&&<SignalBadge tone="danger">{expiry.expired} {en?'expired':(expiry.expired===1?'ληγμένο':'ληγμένα')}</SignalBadge>}{expiry.expiring>0&&<SignalBadge tone="warning">{expiry.expiring} {en?'expiring':(expiry.expiring===1?'λήγει':'λήγουν')}</SignalBadge>}{hasDraft&&<SignalBadge tone="info">{en?'Draft':'Προσωρινή'}</SignalBadge>}<SignalBadge tone={status==='overdue'?'danger':status==='dueSoon'?'warning':'success'}>{status==='overdue'?(en?'Overdue':'Εκπρόθεσμος'):status==='dueSoon'?(en?'Due soon':'Πλησιάζει'):(en?'On schedule':'Εντός προγράμματος')}</SignalBadge></div>} headerActions={headerActions} recordNavigation={recordNavigation} tabs={[{id:'details',label:en?'Control details':'Στοιχεία ελέγχου',icon:LockKeyhole},{id:'departments',label:en?'Departments':'Τμήματα',icon:Building2},expiryControl&&{id:'expiry',label:en?'Items & expiry':'Υλικά & λήξεις',icon:CalendarX2},{id:'history',label:en?'Executions':'Εκτελέσεις',icon:FileClock}].filter(Boolean)} activeTab={currentTab} onTabChange={next=>{setTab(next);if(next==='history')setHistoryPage(1)}}>
  {currentTab==='details'&&<div className="record-view-stack control-record-view workspace-fill">
   <div className="control-record-cards">
    <section className="control-record-card">
     <SectionHeader title={en?'What is checked':'Τι ελέγχεται'}/>
     <DetailList className="control-record-details" sections={[{items:[
      {label:en?'Control type':'Είδος ελέγχου',value:record.category},
      record.location&&{label:en?'Location':'Χώρος',value:record.location},
      record.equipment&&{label:en?'Equipment / point':'Εξοπλισμός / σημείο',value:record.equipment},
      {label:en?'Criticality':'Κρισιμότητα',value:criticalityLabel(controlCriticality(record),language)},
      {label:en?'Evidence':'Τεκμήριο',value:requiresEvidence(record)?(en?'Required on every entry':'Υποχρεωτικό σε κάθε καταχώρηση'):(en?'Optional':'Προαιρετικό')},
     ].filter(Boolean)}]}/>
     {assignments.length>0&&<div className="control-record-dept-chips" aria-label={en?'Departments':'Τμήματα'}>{assignments.map(({department:dep})=><span key={dep} className="control-dept-chip">{dep}</span>)}</div>}
    </section>
    <section className="control-record-card">
     <SectionHeader title={en?'Responsibility and schedule':'Υπευθυνότητα και προγραμματισμός'}/>
     <DetailList sections={[{items:[
      {label:en?'Responsible':'Υπεύθυνος',value:ownerText(record,language)},
      {label:en?'Frequency':'Συχνότητα',value:controlFrequencyLabel(record,visibleDepartments,language)},
      !differentSchedules&&{label:en?'Execution times':'Ώρες εκτέλεσης',value:timesWithWindows(assignmentFrequency(record,visibleDepartments[0]))},
      {label:en?'Created by':'Δημιουργία από',value:<>{record.createdBy||sourceLabel}{record.createdBy&&<small>{sourceLabel}</small>}</>},
      record.updatedBy&&{label:en?'Last changed by':'Τελευταία αλλαγή από',value:record.updatedBy},
     ].filter(Boolean)}]}/>
    </section>
   </div>
   <section className="control-record-card control-record-guidance">
    <SectionHeader title={en?'Goal and instructions':'Στόχος και οδηγίες'}/>
    <DetailList className="control-record-texts" sections={[{items:[
     record.goal&&{label:en?'Goal':'Στόχος',value:record.goal,wide:true},
     record.acceptanceCriteria&&{label:en?'Acceptance criteria':'Κριτήρια αποδοχής',value:record.acceptanceCriteria,wide:true},
     (record.description||!(record.goal||record.acceptanceCriteria||record.guideNotes))&&{label:en?'Instructions':'Οδηγίες',value:record.description||(en?'No instructions.':'Δεν υπάρχουν οδηγίες.'),wide:true},
     record.guideNotes&&{label:en?'Guidance notes':'Σημειώσεις καθοδήγησης',value:record.guideNotes,wide:true},
     deviationActions(record,visibleDepartments[0])&&{label:en?'Actions on deviation':'Ενέργειες σε απόκλιση',value:deviationActions(record,visibleDepartments[0]),wide:true},
    ].filter(Boolean)}]}/>
   </section>
  </div>}
  {currentTab==='departments'&&<div className="record-view-stack control-record-view workspace-fill">
   <section className="control-record-departments">
    <SectionHeader title={en?'Departments of this control':'Τμήματα του ελέγχου'} subtitle={`${assignments.length} ${en?(assignments.length===1?'department':'departments'):(assignments.length===1?'τμήμα':'τμήματα')}`} actions={periodChips}/>
    <RegistryTable
     className="control-ov-department-table"
     columns={[{key:'department',label:en?'Department':'Τμήμα'},{key:'responsible',label:en?'Responsible':'Υπεύθυνος'},{key:'schedule',label:en?'Schedule':'Πρόγραμμα'},...(differentLimits?[{key:'limits',label:en?'Limits':'Όρια'}]:[]),{key:'status',label:en?'Status':'Κατάσταση'},{key:'rate',label:`${en?'Adherence':'Τήρηση'} · ${periodShort(period,language).toLowerCase()}`},{key:'next',label:en?'Next entry':'Επόμενη καταχώρηση'},{key:'last',label:en?'Last entry':'Τελευταία καταχώρηση'},...(expiryControl&&assignments.some(({department:dep})=>!recordsFindingsOnly(record,dep))?[{key:'list',label:en?'Department list':'Λίστα τμήματος'}]:[]),{key:'action',label:'',ariaLabel:en?'Actions':'Ενέργειες',className:'control-ov-action-col'}]}
     rows={assignments}
     rowKey={row=>row.department}
     emptyTitle={en?'No departments':'Δεν υπάρχουν τμήματα'}
     renderRow={({department:dep,assignment:current})=>{const state=assignmentStatus(record,dep),draft=Boolean(current?.hasDraft),allowed=canExecuteDepartment(dep);return <tr className={`control-ov-department ${state}`}>
      <td><strong>{dep}</strong></td>
      <td>{personLabel(record.assignees?.[dep],language)||ownerText(record,language)||'—'}</td>
      <td>{frequencyLabel(assignmentFrequency(record,dep),language)}{(assignmentFrequency(record,dep).times||[]).length>0&&<small>{timesWithWindows(assignmentFrequency(record,dep))}</small>}</td>
      {differentLimits&&<td>{limitsText(assignmentResponse(record,dep))||'—'}</td>}
      <td><div className="control-status-stack">{draft&&<SignalBadge tone="info">{en?'Draft':'Προσωρινή'}</SignalBadge>}{!(state==='overdue'&&heldBack(dep)&&windowOf(dep).state==='closed')&&<SignalBadge tone={state==='overdue'?'danger':state==='dueSoon'?'warning':'success'}>{state==='overdue'?(en?'Overdue':'Εκπρόθεσμος'):state==='dueSoon'?(en?'Due soon':'Πλησιάζει'):(en?'On schedule':'Εντός προγράμματος')}</SignalBadge>}<small className="control-progress-text">{progressText(assignmentProgress(record,dep),language)}</small></div></td>
      <td>{lineOf(dep)?<><RateMeter rate={lineOf(dep).rate}/>{lineOf(dep).missed>0&&<button type="button" className="control-missed-link" onClick={()=>setMissedOf({lines:[lineOf(dep)],title:`${language==='el'?record.title:record.titleEn||record.title} · ${dep}`})}>{en?`${lineOf(dep).missed} missed`:`${lineOf(dep).missed} ${lineOf(dep).missed===1?'χαμένος':'χαμένοι'}`}</button>}</>:'—'}</td>
      <td className={state==='overdue'?'control-ov-late':''}>{fmt(current?.nextDueAt)}</td>
      <td>{fmt(current?.lastCompletedAt)}</td>
      {expiryControl&&assignments.some(({department:d})=>!recordsFindingsOnly(record,d))&&<td>{!recordsFindingsOnly(record,dep)&&<ActionButton label={en?`List of ${dep}`:`Λίστα: ${dep}`} tone="neutral" onClick={()=>setListDepartment(dep)}><ListChecks size={15}/><span>{en?'List':'Λίστα'} ({prefilledExpiryRows(record,dep).length})</span></ActionButton>}</td>}
      <td className="control-ov-action-col">{allowed&&assignments.length>1&&heldBack(dep)&&<ActionButton label={heldHint(dep)} title={heldHint(dep)} tone="primary" disabled onClick={()=>{}}><PlayCircle size={15}/><span>{heldText(dep)}</span></ActionButton>}{allowed&&assignments.length>1&&!heldBack(dep)&&<ActionButton label={draft?(en?'Continue draft entry':'Συνέχιση προσωρινής καταχώρησης'):(en?'Record control':'Καταχώρηση ελέγχου')} tone="primary" onClick={()=>navigate(`/controls/${controlId}?department=${encodeURIComponent(dep)}&execute=1`)}><PlayCircle size={15}/><span>{draft?(en?'Continue':'Συνέχιση'):(en?'Record':'Καταχώρηση')}</span></ActionButton>}</td>
     </tr>}}
    />
   </section>
   {listDepartment&&<ControlDepartmentListDialog record={record} department={listDepartment} language={language} onClose={()=>setListDepartment(null)}/>}
  </div>}
  {currentTab==='expiry'&&expiryControl&&<ControlExpiryPanel actorName={actor.name} onExportChange={setExpiryExport} sources={[{record,departments:visibleDepartments}]} canRemove={(_,dep)=>canExecuteDepartment(dep)} onRemove={item=>removeExpiryItem({item,organizationId:tenant.id,actor,language,confirm,notify,notifyError,reload})} language={language} locale={locale}/>}
  {currentTab==='history'&&<section className="record-tab-panel control-history-panel workspace-fill"><div className="control-history-toolbar">{assignments.length>1&&<FilterSelect label={en?'Department':'Τμήμα'} value={historyDepartment} onChange={value=>{setHistoryDepartment(value);setHistoryPage(1)}}><option value="all">{en?'All departments':'Όλα τα τμήματα'}</option>{assignments.map(({department:dep})=><option key={dep} value={dep}>{dep}</option>)}</FilterSelect>}{periodChips}<ChoiceChips className="control-history-missed-switch" label="" options={[{value:'missed',label:en?'With the missed':'Με τα χαμένα'}]} selected={withMissed?['missed']:[]} onToggle={()=>setWithMissed(value=>!value)}/></div><div className="record-tab-panel-body"><RegistryTable
    wrapperClassName="scroll-table"
    className="control-history-table"
    columns={[{key:'at',label:en?'Date / time':'Ημερομηνία / ώρα'},{key:'department',label:en?'Department':'Τμήμα'},{key:'slot',label:en?'Control time':'Ώρα ελέγχου'},{key:'result',label:en?'Result':'Αποτέλεσμα'},{key:'by',label:en?'Recorded by':'Καταχώρησε'},{key:'notes',label:en?'Notes':'Σημειώσεις'},{key:'actions',label:'',className:'control-history-menu-col'}]}
    rows={shownHistory}
    rowKey={h=>h.id}
    emptyTitle={historyLoaded?(en?'No executions yet':'Δεν υπάρχουν ακόμη εκτελέσεις'):(en?'Loading executions…':'Φόρτωση εκτελέσεων…')}
    emptyText={historyLoaded?(en?'Entries appear here once the control is recorded.':'Οι καταχωρήσεις εμφανίζονται εδώ μόλις καταχωρηθεί ο έλεγχος.'):undefined}
    rowProps={h=>({className:h.missed?'control-history-missed':h.status==='cancelled'?'control-history-cancelled':''})}
    renderRow={h=>{if(h.missed){const text=missedText(h.miss,language);return <><td><strong>{text.when}</strong></td><td>{h.department}</td><td>{text.times}</td><td><SignalBadge tone="danger">{en?'Missed':'Χάθηκε'}</SignalBadge></td><td>—</td><td>—</td><td/></>}const deleted=isDeletedExecution(h);const slot=timeOfEntry(h);return <><td><strong>{fmt(h.at)}</strong>{h.editedAt&&<small>{en?'Edited':'Επεξεργάστηκε'} {fmt(h.editedAt)}</small>}{h.status==='cancelled'&&<small>{deleted?(en?'Deleted':'Διαγράφηκε'):(en?'Voided':'Ακυρώθηκε')} {fmt(h.cancelledAt)}</small>}</td><td>{h.department}</td><td>{h.isExtra?<SignalBadge tone="warning">{en?'Extra':'Έκτακτη'}</SignalBadge>:slot?<><strong>{slot.time}</strong><small>{slot.onTime?(en?'On time':'Στην ώρα'):(en?'Late':'Με καθυστέρηση')}</small></>:'—'}</td><td>{h.isExtra&&h.status!=='cancelled'&&<><SignalBadge tone="warning">{en?'Extra entry':'Έκτακτη'}</SignalBadge><small>{h.extraReason}</small></>}{h.status==='cancelled'?<SignalBadge tone="danger">{deleted?(en?'Deleted':'Διαγράφηκε'):(en?'Voided':'Ακυρώθηκε')}</SignalBadge>:<><SignalBadge tone={h.hasFinding?'danger':'success'}>{structuredSummary(h,{record,language})}</SignalBadge>{h.resultText&&<small>{en?'Result details':'Αναλυτικό αποτέλεσμα'}: {h.resultText}</small>}{h.checkedPoints&&<small>{en?'Points checked':'Σημεία ελέγχου'}: {h.checkedPoints}</small>}<ControlEvidenceLinks evidence={h.evidence} language={language}/></>}</td><td title={h.email||undefined}><strong>{h.by||'—'}</strong>{h.editedBy&&<small>{en?'Last change':'Τελευταία αλλαγή'}: {h.editedBy}</small>}{h.status==='cancelled'&&<small>{deleted?(en?'Deleted by':'Διαγραφή από'):(en?'Voided by':'Αναίρεση')}: {h.cancelledBy||'—'}</small>}</td><td>{h.status==='cancelled'?cancellationText(h):(h.notes||'—')}</td><td className="open-record-cell control-history-menu-col"><OverflowMenu items={historyActions(h)} label={en?'Entry actions':'Ενέργειες καταχώρησης'} align="end"/></td></>}}
  /></div>{historyTotal>0&&<RegistryPagination language={language} page={historySafePage} totalPages={historyTotalPages} totalItems={historyTotal} pageSize={historyPageSize} onPageChange={setHistoryPage} onPageSizeChange={size=>{setHistoryPageSize(size);setHistoryPage(1)}}/>}</section>}
 </EntityRecordShell>
 {missedOf&&<ControlMissedDialog lines={missedOf.lines} title={missedOf.title} language={language} onClose={()=>setMissedOf(null)}/>}
 {editExecution&&<ControlExecutionModal organizationId={tenant.id} record={record} department={editExecution.department||department} initialExecution={editExecution} onClose={()=>setEditExecution(null)} onSave={editExistingExecution}/>} 
 {cancelExecution&&<ControlCancellationModal execution={cancelExecution} onClose={()=>setCancelExecution(null)} onConfirm={voidExecution}/>} 
 {deleteExecution&&<ControlCancellationModal mode="delete" execution={deleteExecution} onClose={()=>setDeleteExecution(null)} onConfirm={deleteExecutionEntry}/>} 
 </Page>
}

