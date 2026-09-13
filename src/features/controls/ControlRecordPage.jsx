import { useEffect,useMemo,useState } from 'react'
import { ClipboardCheck,FileClock,LockKeyhole,PlayCircle,Pencil,Printer,RotateCcw,Trash2 } from 'lucide-react'
import { useNavigate,useParams,useSearchParams } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { PrintExportActions } from '../../design-system/PrintExportActions'
import { downloadRecordJson } from '../../core/export/recordExport'
import { ActionButton } from '../../design-system/ActionButton'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { RegistryTable } from '../../design-system/RegistryTable'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useAuth } from '../../core/auth/AuthContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { CAPABILITIES,ROLES,can } from '../../core/permissions/roles'
import { ControlEditor } from './ControlEditor'
import { ControlExecutionEditor } from './ControlExecutionEditor'
import { ControlExecutionModal } from './ControlExecutionModal'
import { ControlCancellationModal } from './ControlCancellationModal'
import { controlActorFromAuth } from './controlActor'
import { printControlForm,structuredSummary } from './controlStructured'
import { assignmentStatus,frequencyLabel,getAssignment,isControlDue } from './controlScheduling'
import { completeControlExecution,deleteControlDefinition,loadControlByCode,saveControlDefinition,updateControlExecution,voidControlExecution } from './controlCloudService'
import { useRecordSequenceNavigation } from '../../core/navigation/useRecordSequenceNavigation'

export function ControlRecordPage(){
 const {controlId}=useParams()
 const [searchParams]=useSearchParams()
 const navigate=useNavigate()
 const {confirm,notify,notifyError}=useFeedback()
 const {language,locale}=useLanguage();const en=language==='en'
 const {role,membership,tenant,canAccessRecord}=useTenant()
 const {profile,user}=useAuth()
 const actor=useMemo(()=>controlActorFromAuth({profile,user}),[profile,user])
 const [tab,setTab]=useState('details')
 const [editOpen,setEditOpen]=useState(false)
 const [cancelExecution,setCancelExecution]=useState(null)
 const [editExecution,setEditExecution]=useState(null)
 const [record,setRecord]=useState(null)
 const [loading,setLoading]=useState(true)
 const [historyPage,setHistoryPage]=useState(1)
 const [historyPageSize,setHistoryPageSize]=useState(15)
 const ownDepartment=membership?.previewDepartment||membership?.departmentName||membership?.department||''
 const executing=searchParams.get('execute')==='1'
 const recordNavigation=useRecordSequenceNavigation({registry:'controls',currentId:controlId,pathForId:id=>`/controls/${id}`})

 async function reload(){
  if(!tenant?.id){setRecord(null);setLoading(false);return}
  setLoading(true)
  try{setRecord(await loadControlByCode(tenant.id,controlId))}
  catch(error){setRecord(null);notifyError(error,'load',{operation:'control_record_load'})}
  finally{setLoading(false)}
 }
 useEffect(()=>{void reload()},[tenant?.id,controlId])

 if(loading)return <Page title={en?'Controls':'Έλεγχοι'}><div className="inline-empty">{en?'Loading control…':'Φόρτωση ελέγχου…'}</div></Page>
 if(!record)return <Page title={en?'Controls':'Έλεγχοι'}><div className="inline-empty">{en?'Control not found.':'Δεν βρέθηκε ο έλεγχος.'}</div></Page>

 const visibleDepartments=record.departments.filter(dep=>canAccessRecord({department:dep}))
 const requestedDepartment=searchParams.get('department')||''
 const department=(requestedDepartment&&visibleDepartments.includes(requestedDepartment)?requestedDepartment:'')||(ownDepartment&&visibleDepartments.includes(ownDepartment)?ownDepartment:'')||visibleDepartments[0]||''
 const recordUrl=`/controls/${controlId}`
 const assignments=visibleDepartments.map(dep=>({department:dep,assignment:getAssignment(record,dep)}))

 const addOns=membership?.capabilities??[],customCapabilities=membership?.customCapabilities??[]
 const canManageControls=can(role,CAPABILITIES.MANAGE_CONTROLS,addOns,customCapabilities)
 const hasExecuteCapability=can(role,CAPABILITIES.EXECUTE_CONTROL,addOns,customCapabilities)
 const canExecuteDepartment=dep=>{const current=getAssignment(record,dep);return Boolean(current)&&hasExecuteCapability&&(Boolean(current.hasDraft)||canManageControls||isControlDue(record,dep))}
 const canExecute=Boolean(department)&&canExecuteDepartment(department)
 const canEditCentral=can(role,CAPABILITIES.EDIT_CONTROL_DEFINITION,addOns,customCapabilities)&&role===ROLES.INFECTION_CONTROL_LEAD&&record.createdByScope==='infection_control'
 const canModifyDefinition=can(role,CAPABILITIES.EDIT_CONTROL_DEFINITION,addOns,customCapabilities)&&(canManageControls||canEditCentral)
 const canDeleteDraft=record.status==='draft'&&can(role,CAPABILITIES.DELETE_CONTROL_DRAFT,addOns,customCapabilities)
 const canRemoveDefinition=canDeleteDraft||canModifyDefinition
 const fmt=v=>v?new Intl.DateTimeFormat(locale,{dateStyle:'short',timeStyle:'short',hour12:false}).format(new Date(v)):'—'
 const states=visibleDepartments.map(dep=>assignmentStatus(record,dep))
 const status=states.includes('overdue')?'overdue':states.includes('dueSoon')?'dueSoon':'scheduled'
 const hasDraft=assignments.some(x=>Boolean(x.assignment?.hasDraft))
 const sourceLabel=record.createdByScope==='platform'?'Platform Owner':record.createdByScope==='hospital_admin'?(en?'Hospital Administrator':'Διαχειριστής Νοσοκομείου'):record.createdByScope==='quality'?(en?'Quality Manager':'Υπεύθυνος Ποιότητας'):(en?'Infection Control Lead':'Προϊστάμενος Λοιμώξεων')
 const canCancelHistory=h=>h.status==='completed'&&can(role,CAPABILITIES.VOID_CONTROL_EXECUTION,addOns,customCapabilities)
 const canEditHistory=h=>h.status==='completed'&&can(role,CAPABILITIES.EDIT_CONTROL_EXECUTION,addOns,customCapabilities)&&(canManageControls||h.actorId===actor.id)
 const historyRows=assignments.flatMap(({department:dep,assignment:current})=>(current?.history||[]).map(h=>({...h,department:dep}))).sort((a,b)=>new Date(b.at)-new Date(a.at))
 const historyTotalPages=Math.max(1,Math.ceil(historyRows.length/historyPageSize))
 const historySafePage=Math.min(historyPage,historyTotalPages)
 const pagedHistory=historyRows.slice((historySafePage-1)*historyPageSize,historySafePage*historyPageSize)

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
  try{await saveControlDefinition(tenant.id,{...record,...draft},{actorName:actor.name,createdByScope:record.createdByScope,createdForDepartment:record.createdForDepartment});setEditOpen(false);await reload();notify(en?'Changes saved.':'Οι αλλαγές αποθηκεύτηκαν.','success')}
  catch(error){notifyError(error,'save',{operation:'control_definition_update'})}
 }
 async function saveExecution(payload){
  try{
   await completeControlExecution(tenant.id,record,department,payload)
   notify(en?'Control recorded.':'Ο έλεγχος καταχωρήθηκε.','success')
   navigate(recordUrl,{replace:true})
  }catch(error){notifyError(error,'save',{operation:'control_execution_create'});throw error}
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

 function historyActions(h){
  return [
   h.structuredData?.rows?.length>0?{id:'print',label:en?'Print entry':'Εκτύπωση καταχώρησης',icon:Printer,onClick:()=>printControlForm({record,department:h.department,execution:h})}:null,
   canEditHistory(h)?{id:'edit',label:en?'Edit entry':'Επεξεργασία καταχώρησης',icon:Pencil,onClick:()=>setEditExecution(h)}:null,
   canCancelHistory(h)?{id:'void',label:en?'Void entry':'Αναίρεση καταχώρησης',icon:RotateCcw,tone:'danger',separatorBefore:true,onClick:()=>setCancelExecution(h)}:null,
  ]
 }

 if(executing){
  if(!canExecute)return <Page title={en?'Controls':'Έλεγχοι'}><div className="inline-empty">{en?'This control is not available for execution right now.':'Ο έλεγχος δεν είναι διαθέσιμος για καταχώρηση αυτή τη στιγμή.'}</div></Page>
  return <Page fill><EntityRecordShell className="control-record-shell control-execution-record-shell workspace-fill" avatar={<ClipboardCheck size={19}/>} eyebrow={record.id} title={`${en?'Record control':'Καταχώρηση ελέγχου'} · ${language==='el'?record.title:record.titleEn}`} subtitle={`${department} · ${frequencyLabel(record.frequency,language)}`} tabs={[]} onBack={()=>navigate(recordUrl,{replace:true})}>
   <div className="record-section control-execution-page-card"><ControlExecutionEditor organizationId={tenant.id} record={record} department={department} onCancel={()=>navigate(recordUrl,{replace:true})} onDraftSaved={async()=>{await reload()}} onSave={saveExecution}/></div>
  </EntityRecordShell></Page>
 }

 const headerActions=<>
  {canModifyDefinition&&<ActionButton label={en?'Edit control':'Επεξεργασία ελέγχου'} tone="edit" onClick={()=>setEditOpen(true)}><Pencil size={15}/><span>{en?'Edit':'Επεξεργασία'}</span></ActionButton>}
  {canRemoveDefinition&&<ActionButton label={canDeleteDraft?(en?'Delete control':'Διαγραφή ελέγχου'):(en?'Archive control':'Αρχειοθέτηση ελέγχου')} tone="danger" onClick={removeDefinition}><Trash2 size={15}/><span>{canDeleteDraft?(en?'Delete':'Διαγραφή'):(en?'Archive':'Αρχειοθέτηση')}</span></ActionButton>}
  <PrintExportActions onExport={()=>downloadRecordJson(record,{filename:record?.id})}/>
 </>
 const subtitle=visibleDepartments.length===1?visibleDepartments[0]:`${visibleDepartments.length} ${en?'departments':'τμήματα'}`

 return <Page fill><EntityRecordShell className="control-record-shell workspace-fill" avatar={<ClipboardCheck size={19}/>} eyebrow={record.id} title={language==='el'?record.title:record.titleEn} subtitle={subtitle} status={<div className="control-status-stack">{hasDraft&&<span className="status-badge temporary">{en?'Draft':'Προσωρινή'}</span>}<span className={`status-badge ${status==='overdue'?'danger':status==='dueSoon'?'warning':'active'}`}>{status==='overdue'?(en?'Overdue':'Εκπρόθεσμος'):status==='dueSoon'?(en?'Due soon':'Πλησιάζει'):(en?'On schedule':'Εντός προγράμματος')}</span></div>} headerActions={headerActions} recordNavigation={recordNavigation} tabs={[{id:'details',label:en?'Control details':'Στοιχεία ελέγχου',icon:LockKeyhole},{id:'history',label:en?'Executions':'Εκτελέσεις',icon:FileClock}]} activeTab={tab} onTabChange={next=>{setTab(next);if(next==='history')setHistoryPage(1)}}>
  {tab==='details'&&<div className="record-section control-details-overview"><div className="control-overview-heading"><span className="eyebrow">{en?'CONTROL DETAILS':'ΣΤΟΙΧΕΙΑ ΕΛΕΓΧΟΥ'}</span><h3>{en?'Basic details':'Βασικά στοιχεία'}</h3></div><div className="control-overview-grid"><D l={en?'Category':'Κατηγορία'} v={record.category}/><D l={en?'Departments':'Τμήματα'} v={visibleDepartments.join(' · ')||'—'}/><D l={en?'Frequency':'Συχνότητα'} v={frequencyLabel(record.frequency,language)}/><D l={en?'Execution times':'Ώρες εκτέλεσης'} v={record.frequency.times?.join(' · ')||'—'}/><D l={en?'Responsible':'Υπεύθυνος'} v={record.owner||'—'}/><D l={en?'Creation level':'Επίπεδο δημιουργίας'} v={sourceLabel}/><D l={en?'Created by':'Δημιουργήθηκε από'} v={record.createdBy||sourceLabel}/>{record.updatedBy&&<D l={en?'Last changed by':'Τελευταία αλλαγή από'} v={record.updatedBy}/>}</div>{record.description&&<div className="control-overview-description"><span>{en?'Description / instructions':'Περιγραφή / οδηγίες'}</span><p>{record.description}</p></div>}<section className="surface registry-workspace control-history-workspace"><RegistryTable className="control-history-table" columns={[{key:'department',label:en?'Department':'Τμήμα'},{key:'last',label:en?'Last execution':'Τελευταία εκτέλεση'},{key:'next',label:en?'Next execution':'Επόμενη εκτέλεση'},{key:'status',label:en?'Status':'Κατάσταση'},{key:'actions',label:''}]} rows={assignments} rowKey={row=>row.department} renderRow={({department:dep,assignment:current})=>{const state=assignmentStatus(record,dep),draft=Boolean(current?.hasDraft),allowed=canExecuteDepartment(dep);return <><td><strong>{dep}</strong></td><td>{fmt(current?.lastCompletedAt)}</td><td>{fmt(current?.nextDueAt)}</td><td><div className="control-status-stack">{draft&&<span className="status-badge temporary">{en?'Draft':'Προσωρινή'}</span>}<span className={`status-badge ${state==='overdue'?'danger':state==='dueSoon'?'warning':'active'}`}>{state==='overdue'?(en?'Overdue':'Εκπρόθεσμος'):state==='dueSoon'?(en?'Due soon':'Πλησιάζει'):(en?'On schedule':'Εντός προγράμματος')}</span></div></td><td>{allowed&&<ActionButton label={draft?(en?'Continue draft entry':'Συνέχιση προσωρινής καταχώρησης'):(en?'Record control':'Καταχώρηση ελέγχου')} tone="primary" onClick={()=>navigate(`/controls/${controlId}?department=${encodeURIComponent(dep)}&execute=1`)}><PlayCircle size={15}/><span>{draft?(en?'Continue':'Συνέχιση'):(en?'Record':'Καταχώρηση')}</span></ActionButton>}</td></>}}/></section></div>}
  {tab==='history'&&<div className="workspace-column workspace-fill control-history-section"><section className="surface registry-workspace control-history-workspace"><RegistryTable
    className="control-history-table"
    columns={[{key:'at',label:en?'Date / time':'Ημερομηνία / ώρα'},{key:'department',label:en?'Department':'Τμήμα'},{key:'result',label:en?'Result':'Αποτέλεσμα'},{key:'by',label:en?'Recorded by':'Καταχώρησε'},{key:'notes',label:en?'Notes':'Σημειώσεις'},{key:'actions',label:'',className:'control-history-menu-col'}]}
    rows={pagedHistory}
    rowKey={h=>h.id}
    rowProps={h=>({className:h.status==='cancelled'?'control-history-cancelled':''})}
    renderRow={h=><><td><strong>{fmt(h.at)}</strong>{h.editedAt&&<small>{en?'Edited':'Επεξεργάστηκε'} {fmt(h.editedAt)}</small>}{h.status==='cancelled'&&<small>{en?'Voided':'Ακυρώθηκε'} {fmt(h.cancelledAt)}</small>}</td><td>{h.department}</td><td>{h.status==='cancelled'?<span className="status-badge danger">{en?'Voided':'Ακυρώθηκε'}</span>:structuredSummary(h)}</td><td><strong>{h.by||'—'}</strong><small>{h.email||''}</small>{h.editedBy&&<small>{en?'Last change':'Τελευταία αλλαγή'}: {h.editedBy}</small>}{h.status==='cancelled'&&<small>{en?'Voided by':'Αναίρεση'}: {h.cancelledBy||'—'}</small>}</td><td>{h.status==='cancelled'?h.cancellationReason:(h.notes||'—')}</td><td className="open-record-cell control-history-menu-col"><OverflowMenu items={historyActions(h)} label={en?'Entry actions':'Ενέργειες καταχώρησης'} align="end"/></td></>}
  />{!historyRows.length&&<div className="registry-empty-state"><strong>{en?'No executions yet':'Δεν υπάρχουν ακόμη εκτελέσεις'}</strong></div>}{historyRows.length>0&&<RegistryPagination language={language} page={historySafePage} totalPages={historyTotalPages} totalItems={historyRows.length} pageSize={historyPageSize} onPageChange={setHistoryPage} onPageSizeChange={size=>{setHistoryPageSize(size);setHistoryPage(1)}}/>}</section></div>}
 </EntityRecordShell>
 {editOpen&&<ControlEditor initial={record} onCancel={()=>setEditOpen(false)} onSave={saveDefinition}/>} 
 {editExecution&&<ControlExecutionModal organizationId={tenant.id} record={record} department={editExecution.department||department} initialExecution={editExecution} onClose={()=>setEditExecution(null)} onSave={editExistingExecution}/>} 
 {cancelExecution&&<ControlCancellationModal execution={cancelExecution} onClose={()=>setCancelExecution(null)} onConfirm={voidExecution}/>} 
 </Page>
}

function D({l,v}){return <div className="control-overview-item"><span>{l}</span><strong>{v}</strong></div>}