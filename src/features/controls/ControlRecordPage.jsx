import { useCallback,useEffect,useMemo,useState } from 'react'
import { CalendarX2,ClipboardCheck,FileClock,LockKeyhole,PlayCircle,Pencil,Printer,RotateCcw,Trash2 } from 'lucide-react'
import { useNavigate,useParams,useSearchParams } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { PrintExportActions } from '../../design-system/PrintExportActions'
import { downloadRecordJson } from '../../core/export/recordExport'
import { ActionButton } from '../../design-system/ActionButton'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { RegistryTable } from '../../design-system/RegistryTable'
import { RecordDetailsGrid } from '../../design-system/RecordDetailsGrid'
import { RecordTabPanel } from '../../design-system/RecordTabPanel'
import { SectionHeader } from '../../design-system/SectionHeader'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useAuth } from '../../core/auth/AuthContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { ControlEditor } from './ControlEditor'
import { ControlExecutionEditor } from './ControlExecutionEditor'
import { ControlExecutionModal } from './ControlExecutionModal'
import { ControlEvidenceLinks } from './ControlEvidence'
import { controlCriticality,criticalityLabel,deviationActions,requiresEvidence } from './controlCriticality'
import { ControlCancellationModal } from './ControlCancellationModal'
import { ControlExpiryPanel } from './ControlExpiryPanel'
import { expiryCounts,expiryItems,isExpiryControl,markRowRemoved } from './controlExpiry'
import { controlActorFromAuth } from './controlActor'
import { printControlForm,structuredSummary } from './controlStructured'
import { assignmentStatus,frequencyLabel,getAssignment } from './controlScheduling'
import { controlOverallStatus,controlRecordPermissions,pickControlDepartment } from './controlRecordAccess'
import { completeControlExecution,deleteControlDefinition,loadControlByCode,saveControlDefinition,updateControlExecution,voidControlExecution } from './controlCloudService'
import { useRecordSequenceNavigation } from '../../core/navigation/useRecordSequenceNavigation'
import './controlRecord.css'

export function ControlRecordPage(){
 const {controlId}=useParams()
 const [searchParams]=useSearchParams()
 const navigate=useNavigate()
 const {confirm,notify,notifyError}=useFeedback()
 const {language,locale}=useLanguage();const en=language==='en'
 const {role,membership,tenant,canAccessRecord}=useTenant()
 const {profile,user}=useAuth()
 const actor=useMemo(()=>controlActorFromAuth({profile,user}),[profile,user])
 const [tab,setTab]=useState(()=>searchParams.get('tab')==='expiry'?'expiry':'details')
 const [editOpen,setEditOpen]=useState(false)
 const [cancelExecution,setCancelExecution]=useState(null)
 const [deleteExecution,setDeleteExecution]=useState(null)
 const [editExecution,setEditExecution]=useState(null)
 const [record,setRecord]=useState(null)
 const [loading,setLoading]=useState(true)
 const [historyPage,setHistoryPage]=useState(1)
 const [historyPageSize,setHistoryPageSize]=useState(15)
 const ownDepartment=membership?.previewDepartment||membership?.departmentName||membership?.department||''
 const executing=searchParams.get('execute')==='1'
 const recordNavigation=useRecordSequenceNavigation({registry:'controls',currentId:controlId,pathForId:id=>`/controls/${id}`})

 const reload=useCallback(async()=>{
  if(!tenant?.id){setRecord(null);setLoading(false);return}
  setLoading(true)
  try{setRecord(await loadControlByCode(tenant.id,controlId))}
  catch(error){setRecord(null);notifyError(error,'load',{operation:'control_record_load'})}
  finally{setLoading(false)}
 },[tenant?.id,controlId,notifyError])
 useEffect(()=>{void reload()},[reload])

 if(loading)return <Page title={en?'Controls':'Έλεγχοι'}><div className="inline-empty">{en?'Loading control…':'Φόρτωση ελέγχου…'}</div></Page>
 if(!record)return <Page title={en?'Controls':'Έλεγχοι'}><div className="inline-empty">{en?'Control not found.':'Δεν βρέθηκε ο έλεγχος.'}</div></Page>

 const visibleDepartments=record.departments.filter(dep=>canAccessRecord({department:dep,departmentId:record.departmentIdByName?.[dep]||null}))
 const requestedDepartment=searchParams.get('department')||''
 const department=pickControlDepartment(visibleDepartments,requestedDepartment,ownDepartment)
 const recordUrl=`/controls/${controlId}`
 const assignments=visibleDepartments.map(dep=>({department:dep,assignment:getAssignment(record,dep)}))

 const {canModifyDefinition,editsOwnDepartmentOnly,canDeleteDraft,canRemoveDefinition,canExecuteDepartment,canCancelHistory,canDeleteHistory,canEditHistory}=controlRecordPermissions({role,membership,record,actorId:actor.id,allDepartmentsVisible:record.departments.length>0&&visibleDepartments.length===record.departments.length})
 const canExecute=Boolean(department)&&canExecuteDepartment(department)
 const fmt=v=>v?new Intl.DateTimeFormat(locale,{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v)):'—'
 const status=controlOverallStatus(record,visibleDepartments)
 const hasDraft=assignments.some(x=>Boolean(x.assignment?.hasDraft))
 const sourceLabel=record.createdByScope==='platform'?'Platform Owner':record.createdByScope==='hospital_admin'?(en?'Hospital Administrator':'Διαχειριστής Νοσοκομείου'):record.createdByScope==='quality'?(en?'Quality Manager':'Υπεύθυνος Ποιότητας'):(record.createdByScope==='department'?(en?'Department manager':'Προϊστάμενος Τμήματος'):(en?'Infection Control Lead':'Προϊστάμενος Λοιμώξεων'))
 const historyRows=assignments.flatMap(({department:dep,assignment:current})=>(current?.history||[]).map(h=>({...h,department:dep}))).sort((a,b)=>new Date(b.at)-new Date(a.at))
 const historyTotalPages=Math.max(1,Math.ceil(historyRows.length/historyPageSize))
 const historySafePage=Math.min(historyPage,historyTotalPages)
 const pagedHistory=historyRows.slice((historySafePage-1)*historyPageSize,historySafePage*historyPageSize)
 const expiryControl=isExpiryControl(record)
 const expiry=expiryControl?expiryCounts(expiryItems(record,visibleDepartments)):{expired:0,expiring:0,alerting:0}
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
  try{await saveControlDefinition(tenant.id,{...record,...draft},{actorName:actor.name,createdByScope:record.createdByScope,createdForDepartment:record.createdForDepartment});setEditOpen(false);await reload();notify(en?'Changes saved.':'Οι αλλαγές αποθηκεύτηκαν.','success')}
  catch(error){notifyError(error,'save',{operation:'control_definition_update'})}
 }
 async function saveExecution(payload){
  try{
   await completeControlExecution(tenant.id,record,department,payload)
   await reload()
   setTab('history')
   setHistoryPage(1)
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
 async function deleteExecutionEntry(payload){
  const dep=deleteExecution?.department||department
  try{await voidControlExecution(tenant.id,record,dep,deleteExecution,{...payload,reason:`[DELETE] ${payload.reason.trim()}`});setDeleteExecution(null);await reload();notify(en?'Entry deleted.':'Η καταχώρηση διαγράφηκε.','success')}
  catch(error){notifyError(error,'save',{operation:'control_execution_delete'})}
 }

 async function removeExpiryItem(item){
  const ok=await confirm({title:en?'Remove item from the list':'Αφαίρεση υλικού από τη λίστα',message:en?`${item.row.item} will leave the expiry list and stop alerting. Continue?`:`Το «${item.row.item}» θα φύγει από τη λίστα λήξεων και δεν θα ειδοποιεί πια. Θέλετε να συνεχίσετε;`,confirmLabel:en?'Removed / replaced':'Αφαιρέθηκε / Αντικαταστάθηκε'})
  if(!ok)return
  const execution=item.execution
  try{
   await updateControlExecution(tenant.id,record,item.department,execution,{value:execution.value,notes:execution.notes,hasFinding:execution.hasFinding,structuredData:markRowRemoved(execution,item.index,{actorName:actor.name}),actor,reason:`${en?'Item removed / replaced':'Αφαίρεση / αντικατάσταση υλικού'}: ${item.row.item}`})
   await reload()
   notify(en?'Item removed from the list.':'Το υλικό αφαιρέθηκε από τη λίστα.','success')
  }catch(error){notifyError(error,'save',{operation:'control_expiry_item_remove'})}
 }
 function historyActions(h){
  return [
   h.structuredData?.rows?.length>0?{id:'print',label:en?'Print entry':'Εκτύπωση καταχώρησης',icon:Printer,onClick:()=>printControlForm({record,department:h.department,execution:h})}:null,
   canEditHistory(h)?{id:'edit',label:en?'Edit entry':'Επεξεργασία καταχώρησης',icon:Pencil,onClick:()=>setEditExecution(h)}:null,
   canDeleteHistory(h)?{id:'delete',label:en?'Delete entry':'Διαγραφή καταχώρησης',icon:Trash2,tone:'danger',separatorBefore:true,onClick:()=>setDeleteExecution(h)}:null,
   canCancelHistory(h)?{id:'void',label:en?'Void entry':'Αναίρεση καταχώρησης',icon:RotateCcw,onClick:()=>setCancelExecution(h)}:null,
  ]
 }

 if(executing){
  if(!canExecute)return <Page title={en?'Controls':'Έλεγχοι'}><div className="inline-empty">{en?'This control is not available for execution right now.':'Ο έλεγχος δεν είναι διαθέσιμος για καταχώρηση αυτή τη στιγμή.'}</div></Page>
  return <Page fill><EntityRecordShell className="control-record-shell control-execution-record-shell workspace-fill" avatar={<ClipboardCheck size={19}/>} eyebrow={record.id} title={`${en?'Record control':'Καταχώρηση ελέγχου'} · ${language==='el'?record.title:record.titleEn}`} subtitle={`${department} · ${frequencyLabel(record.frequency,language)}`} tabs={[]} onBack={()=>navigate(recordUrl,{replace:true})}>
   <div className="record-section control-execution-page-card"><ControlExecutionEditor organizationId={tenant.id} record={record} department={department} onDraftSaved={async()=>{await reload()}} onSave={saveExecution}/></div>
  </EntityRecordShell></Page>
 }

 const headerActions=<>
  {canExecute&&<ActionButton label={en?'Record control':'Καταχώρηση ελέγχου'} tone="primary" onClick={()=>navigate(`/controls/${controlId}?department=${encodeURIComponent(department)}&execute=1`)}><PlayCircle size={15}/><span>{en?'Record':'Καταχώρηση'}</span></ActionButton>}
  {canModifyDefinition&&<ActionButton label={en?'Edit control':'Επεξεργασία ελέγχου'} tone="edit" onClick={()=>setEditOpen(true)}><Pencil size={15}/><span>{en?'Edit':'Επεξεργασία'}</span></ActionButton>}
  {canRemoveDefinition&&<ActionButton label={canDeleteDraft?(en?'Delete control':'Διαγραφή ελέγχου'):(en?'Archive control':'Αρχειοθέτηση ελέγχου')} tone="danger" onClick={removeDefinition}><Trash2 size={15}/><span>{canDeleteDraft?(en?'Delete':'Διαγραφή'):(en?'Archive':'Αρχειοθέτηση')}</span></ActionButton>}
  <PrintExportActions onExport={()=>downloadRecordJson(record,{filename:record?.id})}/>
 </>
 const subtitle=visibleDepartments.length===1?visibleDepartments[0]:`${visibleDepartments.length} ${en?'departments':'τμήματα'}`

 return <Page fill><EntityRecordShell className="control-record-shell workspace-fill" avatar={<ClipboardCheck size={19}/>} eyebrow={record.id} title={language==='el'?record.title:record.titleEn} subtitle={subtitle} status={<div className="control-status-stack">{expiry.expired>0&&<span className="status-badge danger">{expiry.expired} {en?'expired':(expiry.expired===1?'ληγμένο':'ληγμένα')}</span>}{expiry.expiring>0&&<span className="status-badge warning">{expiry.expiring} {en?'expiring':(expiry.expiring===1?'λήγει':'λήγουν')}</span>}{hasDraft&&<span className="status-badge temporary">{en?'Draft':'Προσωρινή'}</span>}<span className={`status-badge ${status==='overdue'?'danger':status==='dueSoon'?'warning':'active'}`}>{status==='overdue'?(en?'Overdue':'Εκπρόθεσμος'):status==='dueSoon'?(en?'Due soon':'Πλησιάζει'):(en?'On schedule':'Εντός προγράμματος')}</span></div>} headerActions={headerActions} recordNavigation={recordNavigation} tabs={[{id:'details',label:en?'Control details':'Στοιχεία ελέγχου',icon:LockKeyhole},expiryControl&&{id:'expiry',label:en?'Expiry':'Λήξεις',icon:CalendarX2},{id:'history',label:en?'Executions':'Εκτελέσεις',icon:FileClock}].filter(Boolean)} activeTab={tab} onTabChange={next=>{setTab(next);if(next==='history')setHistoryPage(1)}}>
  {tab==='details'&&<div className="record-view-stack control-record-view workspace-fill">
   <section>
    <SectionHeader title={en?'Control details':'Στοιχεία ελέγχου'}/>
    <RecordDetailsGrid fields={[
     {id:'category',label:en?'Category':'Κατηγορία',value:record.category},
     {id:'frequency',label:en?'Frequency':'Συχνότητα',value:frequencyLabel(record.frequency,language)},
     {id:'times',label:en?'Execution times':'Ώρες εκτέλεσης',value:record.frequency.times?.join(' · ')},
     {id:'owner',label:en?'Responsible':'Υπεύθυνος',value:record.owner},
     {id:'criticality',label:en?'Criticality':'Κρισιμότητα',value:criticalityLabel(controlCriticality(record),language)},
     {id:'evidence',label:en?'Evidence':'Τεκμήριο',value:requiresEvidence(record)?(en?'Required on every entry':'Υποχρεωτικό σε κάθε καταχώρηση'):(en?'Optional':'Προαιρετικό')},
     {id:'source',label:en?'Created by':'Δημιουργία από',value:record.createdBy||sourceLabel,meta:record.createdBy?sourceLabel:''},
     {id:'updated',label:en?'Last changed by':'Τελευταία αλλαγή από',value:record.updatedBy},
     {id:'instructions',label:en?'Instructions':'Οδηγίες',value:record.description||(en?'No instructions.':'Δεν υπάρχουν οδηγίες.'),className:'is-wide'},
     {id:'deviation',label:en?'Actions on deviation':'Ενέργειες σε απόκλιση',value:deviationActions(record),className:'is-wide',hidden:!deviationActions(record)},
    ]}/>
   </section>
   <section className="control-record-departments">
    <SectionHeader title={en?'Departments':'Τμήματα'} subtitle={`${assignments.length} ${en?(assignments.length===1?'department':'departments'):(assignments.length===1?'τμήμα':'τμήματα')}`}/>
    <RegistryTable
     className="control-ov-department-table"
     columns={[{key:'department',label:en?'Department':'Τμήμα'},{key:'status',label:en?'Status':'Κατάσταση'},{key:'next',label:en?'Next entry':'Επόμενη καταχώρηση'},{key:'last',label:en?'Last entry':'Τελευταία καταχώρηση'},{key:'action',label:'',ariaLabel:en?'Actions':'Ενέργειες',className:'control-ov-action-col'}]}
     rows={assignments}
     rowKey={row=>row.department}
     emptyTitle={en?'No departments':'Δεν υπάρχουν τμήματα'}
     renderRow={({department:dep,assignment:current})=>{const state=assignmentStatus(record,dep),draft=Boolean(current?.hasDraft),allowed=canExecuteDepartment(dep);return <tr className={`control-ov-department ${state}`}>
      <td><strong>{dep}</strong></td>
      <td><div className="control-status-stack">{draft&&<span className="status-badge temporary">{en?'Draft':'Προσωρινή'}</span>}<span className={`status-badge ${state==='overdue'?'danger':state==='dueSoon'?'warning':'active'}`}>{state==='overdue'?(en?'Overdue':'Εκπρόθεσμος'):state==='dueSoon'?(en?'Due soon':'Πλησιάζει'):(en?'On schedule':'Εντός προγράμματος')}</span></div></td>
      <td className={state==='overdue'?'control-ov-late':''}>{fmt(current?.nextDueAt)}</td>
      <td>{fmt(current?.lastCompletedAt)}</td>
      <td className="control-ov-action-col">{allowed&&<ActionButton label={draft?(en?'Continue draft entry':'Συνέχιση προσωρινής καταχώρησης'):(en?'Record control':'Καταχώρηση ελέγχου')} tone="primary" onClick={()=>navigate(`/controls/${controlId}?department=${encodeURIComponent(dep)}&execute=1`)}><PlayCircle size={15}/><span>{draft?(en?'Continue':'Συνέχιση'):(en?'Record':'Καταχώρηση')}</span></ActionButton>}</td>
     </tr>}}
    />
   </section>
  </div>}
  {tab==='expiry'&&expiryControl&&<ControlExpiryPanel record={record} departments={visibleDepartments} canRemove={dep=>canExecuteDepartment(dep)} onRemove={removeExpiryItem} language={language} locale={locale}/>}
  {tab==='history'&&<RecordTabPanel className="control-history-panel workspace-fill" title={en?'Executions':'Εκτελέσεις'} subtitle={historyRows.length?`${historyRows.length.toLocaleString(locale)} ${en?(historyRows.length===1?'entry':'entries'):(historyRows.length===1?'καταχώρηση':'καταχωρήσεις')}`:''} footer={historyRows.length>0&&<RegistryPagination language={language} page={historySafePage} totalPages={historyTotalPages} totalItems={historyRows.length} pageSize={historyPageSize} onPageChange={setHistoryPage} onPageSizeChange={size=>{setHistoryPageSize(size);setHistoryPage(1)}}/>}><RegistryTable
    wrapperClassName="scroll-table"
    className="control-history-table"
    columns={[{key:'at',label:en?'Date / time':'Ημερομηνία / ώρα'},{key:'department',label:en?'Department':'Τμήμα'},{key:'result',label:en?'Result':'Αποτέλεσμα'},{key:'by',label:en?'Recorded by':'Καταχώρησε'},{key:'notes',label:en?'Notes':'Σημειώσεις'},{key:'actions',label:'',className:'control-history-menu-col'}]}
    rows={pagedHistory}
    rowKey={h=>h.id}
    emptyTitle={en?'No executions yet':'Δεν υπάρχουν ακόμη εκτελέσεις'}
    emptyText={en?'Entries appear here once the control is recorded.':'Οι καταχωρήσεις εμφανίζονται εδώ μόλις καταχωρηθεί ο έλεγχος.'}
    rowProps={h=>({className:h.status==='cancelled'?'control-history-cancelled':''})}
    renderRow={h=>{const deleted=isDeletedExecution(h);return <><td><strong>{fmt(h.at)}</strong>{h.editedAt&&<small>{en?'Edited':'Επεξεργάστηκε'} {fmt(h.editedAt)}</small>}{h.status==='cancelled'&&<small>{deleted?(en?'Deleted':'Διαγράφηκε'):(en?'Voided':'Ακυρώθηκε')} {fmt(h.cancelledAt)}</small>}</td><td>{h.department}</td><td>{h.status==='cancelled'?<span className="status-badge danger">{deleted?(en?'Deleted':'Διαγράφηκε'):(en?'Voided':'Ακυρώθηκε')}</span>:<>{structuredSummary(h)}<ControlEvidenceLinks evidence={h.evidence} language={language}/></>}</td><td><strong>{h.by||'—'}</strong><small>{h.email||''}</small>{h.editedBy&&<small>{en?'Last change':'Τελευταία αλλαγή'}: {h.editedBy}</small>}{h.status==='cancelled'&&<small>{deleted?(en?'Deleted by':'Διαγραφή από'):(en?'Voided by':'Αναίρεση')}: {h.cancelledBy||'—'}</small>}</td><td>{h.status==='cancelled'?cancellationText(h):(h.notes||'—')}</td><td className="open-record-cell control-history-menu-col"><OverflowMenu items={historyActions(h)} label={en?'Entry actions':'Ενέργειες καταχώρησης'} align="end"/></td></>}}
  /></RecordTabPanel>}
 </EntityRecordShell>
 {editOpen&&<ControlEditor initial={record} departmentOnly={editsOwnDepartmentOnly} fixedDepartment={editsOwnDepartmentOnly?(record.createdForDepartment||visibleDepartments[0]||''):''} onCancel={()=>setEditOpen(false)} onSave={saveDefinition}/>} 
 {editExecution&&<ControlExecutionModal organizationId={tenant.id} record={record} department={editExecution.department||department} initialExecution={editExecution} onClose={()=>setEditExecution(null)} onSave={editExistingExecution}/>} 
 {cancelExecution&&<ControlCancellationModal execution={cancelExecution} onClose={()=>setCancelExecution(null)} onConfirm={voidExecution}/>} 
 {deleteExecution&&<ControlCancellationModal mode="delete" execution={deleteExecution} onClose={()=>setDeleteExecution(null)} onConfirm={deleteExecutionEntry}/>} 
 </Page>
}

