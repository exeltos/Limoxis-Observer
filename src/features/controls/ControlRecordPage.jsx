import { useEffect,useMemo,useState } from 'react'
import { CalendarClock,ClipboardCheck,FileClock,LockKeyhole,PlayCircle,Pencil,Printer,RotateCcw,Trash2 } from 'lucide-react'
import { useNavigate,useParams,useSearchParams } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { Button } from '../../design-system/Button'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useAuth } from '../../core/auth/AuthContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { CAPABILITIES,ROLES,can } from '../../core/permissions/roles'
import { ControlEditor } from './ControlEditor'
import { ControlExecutionModal } from './ControlExecutionModal'
import { ControlCancellationModal } from './ControlCancellationModal'
import { controlActorFromAuth } from './controlActor'
import { printControlForm,structuredSummary } from './controlStructured'
import { assignmentStatus,frequencyLabel,getAssignment,isControlDue } from './controlScheduling'
import { completeControlExecution,deleteControlDefinition,loadControlByCode,saveControlDefinition,updateControlExecution,voidControlExecution } from './controlCloudService'
import { useRecordSequenceNavigation } from '../../core/navigation/useRecordSequenceNavigation'

export function ControlRecordPage(){
 const {controlId}=useParams();const [searchParams]=useSearchParams();const navigate=useNavigate();const {confirm,notify,notifyError}=useFeedback();const {language,locale}=useLanguage();const en=language==='en';const {role,membership,tenant}=useTenant();const {profile,user}=useAuth()
 const actor=useMemo(()=>controlActorFromAuth({profile,user}),[profile,user])
 const [tab,setTab]=useState('details'),[entryOpen,setEntryOpen]=useState(false),[editOpen,setEditOpen]=useState(false),[cancelExecution,setCancelExecution]=useState(null),[editExecution,setEditExecution]=useState(null)
 const [record,setRecord]=useState(null),[loading,setLoading]=useState(true)
 const ownDepartment=membership?.previewDepartment||membership?.departmentName||membership?.department||''
 async function reload(){
  if(!tenant?.id){setRecord(null);setLoading(false);return}
  setLoading(true)
  try{setRecord(await loadControlByCode(tenant.id,controlId))}
  catch(error){setRecord(null);notifyError(error,'load',{operation:'control_record_load'})}
  finally{setLoading(false)}
 }
 useEffect(()=>{void reload()},[tenant?.id,controlId])
 const department=searchParams.get('department')||ownDepartment||record?.departments?.[0]||''
 const sequenceKey=`${controlId}:${department}`
 const recordNavigation=useRecordSequenceNavigation({registry:'controls',currentId:sequenceKey,pathForId:key=>{const split=key.indexOf(':');const id=split>=0?key.slice(0,split):key;const dep=split>=0?key.slice(split+1):'';return `/controls/${id}?department=${encodeURIComponent(dep)}`}})
 if(loading)return <Page title={en?'Controls':'Έλεγχοι'}><div className="inline-empty">{en?'Loading control…':'Φόρτωση ελέγχου…'}</div></Page>
 if(!record)return <Page title={en?'Controls':'Έλεγχοι'}><div className="inline-empty">{en?'Control not found.':'Δεν βρέθηκε ο έλεγχος.'}</div></Page>
 const assignment=getAssignment(record,department)
 const addOns=membership?.capabilities??[],customCapabilities=membership?.customCapabilities??[]
 const canManageControls=can(role,CAPABILITIES.MANAGE_CONTROLS,addOns,customCapabilities)
 const hasDraft=Boolean(assignment?.hasDraft)
 const hasExecuteCapability=can(role,CAPABILITIES.EXECUTE_CONTROL,addOns,customCapabilities)
 const canExecute=hasExecuteCapability&&(hasDraft||canManageControls||isControlDue(record,department))
 const canEditCentral=can(role,CAPABILITIES.EDIT_CONTROL_DEFINITION,addOns,customCapabilities)&&role===ROLES.INFECTION_CONTROL_LEAD&&record.createdByScope==='infection_control'
 const canModifyDefinition=can(role,CAPABILITIES.EDIT_CONTROL_DEFINITION,addOns,customCapabilities)&&(canManageControls||canEditCentral)
 const canDeleteDraft=record.status==='draft'&&can(role,CAPABILITIES.DELETE_CONTROL_DRAFT,addOns,customCapabilities)
 const canRemoveDefinition=canDeleteDraft||canModifyDefinition
 const fmt=v=>v?new Intl.DateTimeFormat(locale,{dateStyle:'short',timeStyle:'short',hour12:false}).format(new Date(v)):'—'
 const status=assignmentStatus(record,department)
 const sourceLabel=record.createdByScope==='platform'?'Platform Owner':record.createdByScope==='hospital_admin'?(en?'Hospital Administrator':'Διαχειριστής Νοσοκομείου'):record.createdByScope==='quality'?(en?'Quality Manager':'Υπεύθυνος Ποιότητας'):(en?'Infection Control Lead':'Προϊστάμενος Λοιμώξεων')
 const canCancelHistory=h=>h.status==='completed'&&can(role,CAPABILITIES.VOID_CONTROL_EXECUTION,addOns,customCapabilities)
 const canEditHistory=h=>h.status==='completed'&&can(role,CAPABILITIES.EDIT_CONTROL_EXECUTION,addOns,customCapabilities)&&(canManageControls||h.actorId===actor.id)
 async function removeDefinition(){
  const deleting=canDeleteDraft
  const ok=await confirm({title:deleting?(en?'Delete control':'Διαγραφή ελέγχου'):(en?'Archive control':'Αρχειοθέτηση ελέγχου'),message:deleting?(en?'The draft control and its schedule will be deleted. Continue?':'Ο πρόχειρος έλεγχος θα διαγραφεί μαζί με το πρόγραμμά του. Θέλετε να συνεχίσετε;'):(en?'The control will be removed from the active programme while its execution history remains preserved. Continue?':'Ο έλεγχος θα αφαιρεθεί από το ενεργό πρόγραμμα, ενώ το ιστορικό εκτελέσεων θα διατηρηθεί. Θέλετε να συνεχίσετε;'),confirmLabel:deleting?(en?'Delete':'Διαγραφή'):(en?'Archive':'Αρχειοθέτηση'),danger:true})
  if(!ok)return
  try{
   if(deleting)await deleteControlDefinition(tenant.id,record)
   else await saveControlDefinition(tenant.id,{...record,status:'archived'},{actorName:actor.name,createdByScope:record.createdByScope,createdForDepartment:record.createdForDepartment})
   notify(deleting?(en?'Control deleted.':'Ο έλεγχος διαγράφηκε.'):(en?'Control archived.':'Ο έλεγχος αρχειοθετήθηκε.'),'success');navigate('/controls')
  }catch(error){notifyError(error,deleting?'delete':'save',{operation:deleting?'control_definition_delete':'control_definition_archive'})}
 }
 async function saveDefinition(draft){
  try{await saveControlDefinition(tenant.id,{...record,...draft},{actorName:actor.name,createdByScope:record.createdByScope,createdForDepartment:record.createdForDepartment});setEditOpen(false);await reload();notify(en?'Changes saved.':'Οι αλλαγές αποθηκεύτηκαν.','success')}
  catch(error){notifyError(error,'save',{operation:'control_definition_update'})}
 }
 async function saveExecution(payload){
  try{await completeControlExecution(tenant.id,record,department,payload);setEntryOpen(false);setTab('history');await reload();notify(en?'Control recorded.':'Ο έλεγχος καταχωρήθηκε.','success')}
  catch(error){notifyError(error,'save',{operation:'control_execution_create'})}
 }
 async function editExistingExecution(payload){
  try{await updateControlExecution(tenant.id,record,department,editExecution,payload);setEditExecution(null);await reload();notify(en?'Entry updated.':'Η καταχώρηση ενημερώθηκε.','success')}
  catch(error){notifyError(error,'save',{operation:'control_execution_update'})}
 }
 async function voidExecution(payload){
  try{await voidControlExecution(tenant.id,record,department,cancelExecution,payload);setCancelExecution(null);await reload();notify(en?'Entry voided.':'Η καταχώρηση αναιρέθηκε.','success')}
  catch(error){notifyError(error,'save',{operation:'control_execution_void'})}
 }
 return <Page fill><EntityRecordShell className="control-record-shell workspace-fill" avatar={<ClipboardCheck size={19}/>} eyebrow={record.id} title={language==='el'?record.title:record.titleEn} subtitle={department} status={<div className="control-status-stack">{hasDraft&&<span className="status-badge temporary">{en?'Draft':'Προσωρινή'}</span>}<span className={`status-badge ${status==='overdue'?'danger':status==='dueSoon'?'warning':'active'}`}>{status==='overdue'?(en?'Overdue':'Εκπρόθεσμος'):status==='dueSoon'?(en?'Due soon':'Πλησιάζει'):(en?'On schedule':'Εντός προγράμματος')}</span></div>} recordNavigation={recordNavigation} headerActions={<>{canModifyDefinition&&<button className="general-edit-button edit" title={en?'Edit control':'Επεξεργασία ελέγχου'} aria-label={en?'Edit control':'Επεξεργασία ελέγχου'} onClick={()=>setEditOpen(true)}><Pencil size={16}/></button>}{canRemoveDefinition&&<button className="entity-record-icon-button danger" title={canDeleteDraft?(en?'Delete control':'Διαγραφή ελέγχου'):(en?'Archive control':'Αρχειοθέτηση ελέγχου')} aria-label={canDeleteDraft?(en?'Delete control':'Διαγραφή ελέγχου'):(en?'Archive control':'Αρχειοθέτηση ελέγχου')} onClick={removeDefinition}><Trash2 size={16}/></button>}</>} tabs={[{id:'details',label:en?'Control details':'Στοιχεία ελέγχου',icon:LockKeyhole},{id:'history',label:en?'Execution history':'Ιστορικό εκτελέσεων',icon:FileClock}]} activeTab={tab} onTabChange={setTab}>
  {tab==='details'&&<div className="record-section"><div className="detail-grid quality-detail-grid"><D l={en?'Category':'Κατηγορία'} v={record.category}/><D l={en?'Department':'Τμήμα'} v={department}/><D l={en?'Frequency':'Συχνότητα'} v={frequencyLabel(record.frequency,language)}/><D l={en?'Times':'Ώρες'} v={record.frequency.times?.join(' · ')||'—'}/><D l={en?'Last control':'Τελευταίος έλεγχος'} v={fmt(assignment?.lastCompletedAt)}/><D l={en?'Next control':'Επόμενος έλεγχος'} v={fmt(assignment?.nextDueAt)}/><D l={en?'Owner':'Υπεύθυνος'} v={record.owner||'—'}/><D l={en?'Source':'Προέλευση'} v={sourceLabel}/><D l={en?'Created by':'Δημιουργήθηκε από'} v={record.createdBy||sourceLabel}/>{record.updatedBy&&<D l={en?'Last changed by':'Τελευταία αλλαγή από'} v={record.updatedBy}/>}</div><div className="quality-description"><span>{en?'Description / instructions':'Περιγραφή / οδηγίες'}</span><p>{record.description||'—'}</p></div>{record.frequency.kind==='daily'&&record.frequency.timesPerDay>1&&<div className="governance-banner"><CalendarClock size={17}/><span>{record.frequency.timesPerDay} {en?'scheduled executions per day':'προγραμματισμένες εκτελέσεις την ημέρα'}: {record.frequency.times.join(', ')}.</span></div>}{canExecute&&<div className="record-edit-footer"><Button onClick={()=>setEntryOpen(true)}><PlayCircle size={15}/>{en?'Record control':'Καταχώρηση ελέγχου'}</Button></div>}</div>}
  {tab==='history'&&<div className="record-section"><div className="scroll-table"><table className="data-table sticky-table"><thead><tr><th>{en?'Date / time':'Ημερομηνία / ώρα'}</th><th>{en?'Result':'Αποτέλεσμα'}</th><th>{en?'Recorded by':'Καταχώρησε'}</th><th>{en?'Notes':'Σημειώσεις'}</th><th></th></tr></thead><tbody>{(assignment?.history||[]).map(h=><tr key={h.id} className={h.status==='cancelled'?'control-history-cancelled':''}><td>{fmt(h.at)}{h.editedAt&&<small>{en?'Edited':'Επεξεργάστηκε'} {fmt(h.editedAt)}</small>}{h.status==='cancelled'&&<small>{en?'Voided':'Ακυρώθηκε'} {fmt(h.cancelledAt)}</small>}</td><td>{h.status==='cancelled'?<span className="status-badge danger">{en?'Voided':'Ακυρώθηκε'}</span>:structuredSummary(h)}</td><td>{h.by||'—'}<small>{h.email||''}</small>{h.editedBy&&<small>{en?'Last change':'Τελευταία αλλαγή'}: {h.editedBy}</small>}{h.status==='cancelled'&&<small>{en?'Voided by':'Αναίρεση'}: {h.cancelledBy||'—'}</small>}</td><td>{h.status==='cancelled'?h.cancellationReason:(h.notes||'—')}</td><td className="control-action-col"><div className="control-history-actions">{h.structuredData?.rows?.length>0&&<button className="control-history-print" title={en?'Print entry':'Εκτύπωση καταχώρησης'} onClick={()=>printControlForm({record,department,execution:h})}><Printer size={15}/></button>}{canEditHistory(h)&&<button className="control-history-edit edit" title={en?'Edit entry':'Επεξεργασία καταχώρησης'} onClick={()=>setEditExecution(h)}><Pencil size={15}/></button>}{canCancelHistory(h)&&<button className="control-history-undo" title={en?'Void entry':'Αναίρεση καταχώρησης'} onClick={()=>setCancelExecution(h)}><RotateCcw size={15}/></button>}</div></td></tr>)}</tbody></table>{!(assignment?.history||[]).length&&<div className="registry-empty-state"><strong>{en?'No executions yet':'Δεν υπάρχουν ακόμη καταχωρήσεις'}</strong></div>}</div></div>}
 </EntityRecordShell>
 {editOpen&&<ControlEditor initial={record} onCancel={()=>setEditOpen(false)} onSave={saveDefinition}/>} 
 {entryOpen&&<ControlExecutionModal organizationId={tenant.id} record={record} department={department} onClose={()=>setEntryOpen(false)} onDraftSaved={async()=>{setEntryOpen(false);await reload();notify(en?'The entry was saved as a draft.':'Η καταχώρηση αποθηκεύτηκε προσωρινά.','success')}} onSave={saveExecution}/>} 
 {editExecution&&<ControlExecutionModal organizationId={tenant.id} record={record} department={department} initialExecution={editExecution} onClose={()=>setEditExecution(null)} onSave={editExistingExecution}/>} 
 {cancelExecution&&<ControlCancellationModal execution={cancelExecution} onClose={()=>setCancelExecution(null)} onConfirm={voidExecution}/>} 
 </Page>
}
function D({l,v}){return <div className="detail-item"><span>{l}</span><strong>{v}</strong></div>}
