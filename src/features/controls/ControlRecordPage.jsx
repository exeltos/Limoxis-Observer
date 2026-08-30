import { useMemo,useState } from 'react'
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
import { getControl,assignmentStatus,frequencyLabel,completeControl,isControlDue,getAssignment,upsertControl,deleteControl,cancelControlExecution,updateControlExecution } from './controlsDemoData'
import { ControlEditor } from './ControlEditor'
import { ControlExecutionModal } from './ControlExecutionModal'
import { ControlCancellationModal } from './ControlCancellationModal'
import { controlActorFromAuth } from './controlActor'
import { printControlForm,structuredSummary } from './controlStructured'
import { hasControlDraft } from './controlDrafts'
import { useRecordSequenceNavigation } from '../../core/navigation/useRecordSequenceNavigation'
import { PrintExportActions } from '../../design-system/PrintExportActions'
import { downloadRecordJson } from '../../core/export/recordExport'

export function ControlRecordPage(){
 const {controlId}=useParams();const [searchParams]=useSearchParams();const navigate=useNavigate();const {confirm,notify}=useFeedback();const {language,locale}=useLanguage();const en=language==='en';const {role,membership}=useTenant();const {profile,user}=useAuth()
 const actor=useMemo(()=>controlActorFromAuth({profile,user}),[profile,user])
 const [tab,setTab]=useState('details'),[entryOpen,setEntryOpen]=useState(false),[editOpen,setEditOpen]=useState(false),[cancelExecution,setCancelExecution]=useState(null),[editExecution,setEditExecution]=useState(null),[,setVersion]=useState(0)
 const record=getControl(controlId)
 const ownDepartment=membership?.previewDepartment||membership?.departmentName||membership?.department||''
 const department=searchParams.get('department')||ownDepartment||record?.departments?.[0]||''
 const sequenceKey=`${controlId}:${department}`
 const recordNavigation=useRecordSequenceNavigation({registry:'controls',currentId:sequenceKey,pathForId:key=>{
  const split=key.indexOf(':')
  const id=split>=0?key.slice(0,split):key
  const dep=split>=0?key.slice(split+1):''
  return `/controls/${id}?department=${encodeURIComponent(dep)}`
 }})
 if(!record)return <Page title={en?'Controls':'Έλεγχοι'}><div className="inline-empty">{en?'Control not found.':'Δεν βρέθηκε ο έλεγχος.'}</div></Page>
 const assignment=getAssignment(record,department)
 const addOns=membership?.capabilities??[],customCapabilities=membership?.customCapabilities??[]
 const canManageControls=can(role,CAPABILITIES.MANAGE_CONTROLS,addOns,customCapabilities)
 const hasDraft=hasControlDraft(record.id,department)
 const hasExecuteCapability=can(role,CAPABILITIES.EXECUTE_CONTROL,addOns,customCapabilities)
 const canExecute=hasExecuteCapability&&(hasDraft||canManageControls||isControlDue(record,department))
 const canEditCentral=can(role,CAPABILITIES.EDIT_CONTROL_DEFINITION,addOns,customCapabilities)&&role===ROLES.INFECTION_CONTROL_LEAD&&record.createdByScope==='infection_control'
 const canEditOwnDepartment=can(role,CAPABILITIES.EDIT_CONTROL_DEFINITION,addOns,customCapabilities)&&role===ROLES.DEPARTMENT_MANAGER&&record.createdByScope==='department'&&Boolean(ownDepartment)&&record.createdForDepartment===ownDepartment&&department===ownDepartment
 const canModifyDefinition=can(role,CAPABILITIES.EDIT_CONTROL_DEFINITION,addOns,customCapabilities)&&(canManageControls||canEditCentral||canEditOwnDepartment)
 const canDeleteDefinition=record.status==='draft'&&can(role,CAPABILITIES.DELETE_CONTROL_DRAFT,addOns,customCapabilities)
 const fmt=v=>v?new Intl.DateTimeFormat(locale,{dateStyle:'short',timeStyle:'short',hour12:false}).format(new Date(v)):'—'
 const status=assignmentStatus(record,department)
 const sourceLabel=record.createdByScope==='platform'?'Platform Owner':record.createdByScope==='hospital_admin'?(en?'Hospital Administrator':'Διαχειριστής Νοσοκομείου'):record.createdByScope==='infection_control'?(en?'Infection Control Lead':'Προϊστάμενος Λοιμώξεων'):(en?'Department Manager':'Προϊστάμενος Τμήματος')
 const canCancelHistory=h=>h.status==='completed'&&can(role,CAPABILITIES.VOID_CONTROL_EXECUTION,addOns,customCapabilities)&&(canManageControls||(role===ROLES.INFECTION_CONTROL_LEAD&&record.createdByScope==='infection_control')||(role===ROLES.DEPARTMENT_MANAGER&&department===ownDepartment))
 const canEditHistory=h=>h.status==='completed'&&can(role,CAPABILITIES.EDIT_CONTROL_EXECUTION,addOns,customCapabilities)&&(canManageControls||h.actorId===actor.id||(role===ROLES.DEPARTMENT_MANAGER&&department===ownDepartment))
 async function removeDefinition(){
  const ok=await confirm({title:en?'Delete control':'Διαγραφή ελέγχου',message:record.departments.length>1?(en?'The control will be removed from all departments to which it is assigned. Continue?':'Ο έλεγχος θα αφαιρεθεί από όλα τα τμήματα στα οποία έχει ανατεθεί. Θέλετε να συνεχίσετε;'):(en?'The control and its schedule will be deleted. Continue?':'Ο έλεγχος θα διαγραφεί μαζί με το πρόγραμμά του. Θέλετε να συνεχίσετε;'),confirmLabel:en?'Delete':'Διαγραφή',danger:true})
  if(!ok)return
  deleteControl(record.id,{actor});notify(en?'Control deleted.':'Ο έλεγχος διαγράφηκε.','success');navigate('/controls')
 }
 return <Page fill><EntityRecordShell className="control-record-shell workspace-fill" avatar={<ClipboardCheck size={19}/>} eyebrow={record.id} title={language==='el'?record.title:record.titleEn} subtitle={department} status={<div className="control-status-stack">{hasDraft&&<span className="status-badge temporary">{en?'Draft':'Προσωρινή'}</span>}<span className={`status-badge ${status==='overdue'?'danger':status==='dueSoon'?'warning':'active'}`}>{status==='overdue'?(en?'Overdue':'Εκπρόθεσμος'):status==='dueSoon'?(en?'Due soon':'Πλησιάζει'):(en?'On schedule':'Εντός προγράμματος')}</span></div>} recordNavigation={recordNavigation} headerActions={<>{canExecute&&<Button onClick={()=>setEntryOpen(true)}><PlayCircle size={15}/>{en?' Record control':' Καταχώρηση ελέγχου'}</Button>}{canModifyDefinition&&<button className="general-edit-button edit" onClick={()=>setEditOpen(true)}><Pencil size={15}/>{en?' Edit':' Επεξεργασία'}</button>}{canDeleteDefinition&&<button className="entity-record-icon-button danger" title={en?'Delete control':'Διαγραφή ελέγχου'} aria-label={en?'Delete control':'Διαγραφή ελέγχου'} onClick={removeDefinition}><Trash2 size={15}/></button>}<PrintExportActions onExport={()=>downloadRecordJson({record,assignment},{filename:record.id})}/></>} tabs={[{id:'details',label:en?'Control details':'Στοιχεία ελέγχου',icon:LockKeyhole},{id:'history',label:en?'Execution history':'Ιστορικό εκτελέσεων',icon:FileClock}]} activeTab={tab} onTabChange={setTab}>
  {tab==='details'&&<div className="record-section"><div className="governance-banner control-readonly-banner"><LockKeyhole size={16}/><span>{canModifyDefinition?(en?'This view is locked. Use Edit to change the schedule.':'Η προβολή είναι κλειδωμένη. Χρησιμοποιήστε «Επεξεργασία» για αλλαγή του προγράμματος.'):(en?'Schedule details are locked and cannot be modified by the current role.':'Τα στοιχεία του προγράμματος είναι κλειδωμένα και δεν επιτρέπεται να τροποποιηθούν από τον τρέχοντα ρόλο.')}</span></div><div className="detail-grid quality-detail-grid"><D l={en?'Category':'Κατηγορία'} v={record.category}/><D l={en?'Department':'Τμήμα'} v={department}/><D l={en?'Frequency':'Συχνότητα'} v={frequencyLabel(record.frequency,language)}/><D l={en?'Times':'Ώρες'} v={record.frequency.times?.join(' · ')||'—'}/><D l={en?'Last control':'Τελευταίος έλεγχος'} v={fmt(assignment?.lastCompletedAt)}/><D l={en?'Next control':'Επόμενος έλεγχος'} v={fmt(assignment?.nextDueAt)}/><D l={en?'Owner':'Υπεύθυνος'} v={record.owner}/><D l={en?'Source':'Προέλευση'} v={sourceLabel}/><D l={en?'Created by':'Δημιουργήθηκε από'} v={record.createdBy||sourceLabel}/>{record.updatedBy&&<D l={en?'Last changed by':'Τελευταία αλλαγή από'} v={record.updatedBy}/>}</div><div className="quality-description"><span>{en?'Description / instructions':'Περιγραφή / οδηγίες'}</span><p>{record.description||'—'}</p></div>{record.frequency.kind==='daily'&&record.frequency.timesPerDay>1&&<div className="governance-banner"><CalendarClock size={17}/><span>{record.frequency.timesPerDay} {en?'scheduled executions per day':'προγραμματισμένες εκτελέσεις την ημέρα'}: {record.frequency.times.join(', ')}.</span></div>}</div>}
  {tab==='history'&&<div className="record-section"><div className="scroll-table"><table className="data-table sticky-table"><thead><tr><th>{en?'Date / time':'Ημερομηνία / ώρα'}</th><th>{en?'Result':'Αποτέλεσμα'}</th><th>{en?'Recorded by':'Καταχώρησε'}</th><th>{en?'Notes':'Σημειώσεις'}</th><th></th></tr></thead><tbody>{(assignment?.history||[]).map(h=><tr key={h.id} className={h.status==='cancelled'?'control-history-cancelled':''}><td>{fmt(h.at)}{h.editedAt&&<small>{en?'Edited':'Επεξεργάστηκε'} {fmt(h.editedAt)}</small>}{h.status==='cancelled'&&<small>{en?'Voided':'Ακυρώθηκε'} {fmt(h.cancelledAt)}</small>}</td><td>{h.status==='cancelled'?<span className="status-badge danger">{en?'Voided':'Ακυρώθηκε'}</span>:structuredSummary(h)}</td><td>{h.by}<small>{h.email||''}</small>{h.editedBy&&<small>{en?'Last change':'Τελευταία αλλαγή'}: {h.editedBy}</small>}{h.status==='cancelled'&&<small>{en?'Voided by':'Αναίρεση'}: {h.cancelledBy}</small>}</td><td>{h.status==='cancelled'?h.cancellationReason:(h.notes||'—')}</td><td className="control-action-col"><div className="control-history-actions">{h.structuredData?.rows?.length>0&&<button className="control-history-print" title={en?'Print entry':'Εκτύπωση καταχώρησης'} onClick={()=>printControlForm({record,department,execution:h})}><Printer size={15}/></button>}{canEditHistory(h)&&<button className="control-history-edit edit" title={en?'Edit entry':'Επεξεργασία καταχώρησης'} onClick={()=>setEditExecution(h)}><Pencil size={15}/></button>}{canCancelHistory(h)&&<button className="control-history-undo" title={en?'Void entry':'Αναίρεση καταχώρησης'} onClick={()=>setCancelExecution(h)}><RotateCcw size={15}/></button>}</div></td></tr>)}</tbody></table></div></div>}
 </EntityRecordShell>
 {editOpen&&<ControlEditor initial={record} departmentOnly={canEditOwnDepartment} fixedDepartment={canEditOwnDepartment?ownDepartment:''} onCancel={()=>setEditOpen(false)} onSave={draft=>{upsertControl(draft,{actor});setVersion(v=>v+1);setEditOpen(false);notify(en?'Changes saved.':'Οι αλλαγές αποθηκεύτηκαν.','success')}}/>}
 {entryOpen&&<ControlExecutionModal record={record} department={department} onClose={()=>setEntryOpen(false)} onDraftSaved={()=>{setVersion(v=>v+1);setEntryOpen(false);notify(en?'The entry was saved as a draft. You will find it in the Controls list marked Draft.':'Η καταχώρηση αποθηκεύτηκε προσωρινά. Θα τη βρείτε στη λίστα Ελέγχων με ένδειξη «Προσωρινή».','success')}} onSave={payload=>{completeControl(record.id,department,payload);setVersion(v=>v+1);setEntryOpen(false);setTab('history');notify(en?'Control recorded.':'Ο έλεγχος καταχωρήθηκε.','success')}}/>}
 {editExecution&&<ControlExecutionModal record={record} department={department} initialExecution={editExecution} onClose={()=>setEditExecution(null)} onSave={payload=>{if(updateControlExecution(record.id,department,editExecution.id,payload)){setVersion(v=>v+1);notify(en?'Entry updated.':'Η καταχώρηση ενημερώθηκε.','success')}setEditExecution(null)}}/>}
 {cancelExecution&&<ControlCancellationModal execution={cancelExecution} onClose={()=>setCancelExecution(null)} onConfirm={payload=>{if(cancelControlExecution(record.id,department,cancelExecution.id,payload)){setVersion(v=>v+1);notify(en?'Entry voided.':'Η καταχώρηση αναιρέθηκε.','success')}setCancelExecution(null)}}/>}
 </Page>
}
function D({l,v}){return <div className="detail-item"><span>{l}</span><strong>{v}</strong></div>}
