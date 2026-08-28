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
import { ROLES } from '../../core/permissions/roles'
import { getControl,assignmentStatus,frequencyLabel,completeControl,isControlDue,getAssignment,upsertControl,deleteControl,cancelControlExecution,updateControlExecution } from './controlsDemoData'
import { ControlEditor } from './ControlEditor'
import { ControlExecutionModal } from './ControlExecutionModal'
import { ControlCancellationModal } from './ControlCancellationModal'
import { controlActorFromAuth } from './controlActor'
import { printControlForm,structuredSummary } from './controlStructured'
import { hasControlDraft } from './controlDrafts'

export function ControlRecordPage(){
 const {controlId}=useParams();const [searchParams]=useSearchParams();const navigate=useNavigate();const {confirm,notify}=useFeedback();const {language,locale}=useLanguage();const {role,membership}=useTenant();const {profile,user}=useAuth()
 const actor=useMemo(()=>controlActorFromAuth({profile,user}),[profile,user])
 const [tab,setTab]=useState('details'),[entryOpen,setEntryOpen]=useState(false),[editOpen,setEditOpen]=useState(false),[cancelExecution,setCancelExecution]=useState(null),[editExecution,setEditExecution]=useState(null),[,setVersion]=useState(0)
 const record=getControl(controlId);if(!record)return <Page title="Έλεγχοι"><div className="inline-empty">Δεν βρέθηκε ο έλεγχος.</div></Page>
 const ownDepartment=membership?.previewDepartment||membership?.departmentName||membership?.department||''
 const department=searchParams.get('department')||ownDepartment||record.departments[0]
 const assignment=getAssignment(record,department)
 const isPlatformOwner=role===ROLES.PLATFORM_OWNER
 const isHospitalAdmin=role===ROLES.HOSPITAL_ADMIN
 const isFullControlsAdmin=isPlatformOwner||isHospitalAdmin
 const hasDraft=hasControlDraft(record.id,department)
 const canExecute=hasDraft||isFullControlsAdmin||([ROLES.DEPARTMENT_MANAGER,ROLES.DEPARTMENT_USER].includes(role)&&isControlDue(record,department))
 const canEditCentral=role===ROLES.INFECTION_CONTROL_LEAD&&record.createdByScope==='infection_control'
 const canEditOwnDepartment=role===ROLES.DEPARTMENT_MANAGER&&record.createdByScope==='department'&&Boolean(ownDepartment)&&record.createdForDepartment===ownDepartment&&department===ownDepartment
 const canModifyDefinition=isFullControlsAdmin||canEditCentral||canEditOwnDepartment
 const fmt=v=>v?new Intl.DateTimeFormat(locale,{dateStyle:'short',timeStyle:'short',hour12:false}).format(new Date(v)):'—'
 const status=assignmentStatus(record,department)
 const sourceLabel=record.createdByScope==='platform'?'Platform Owner':record.createdByScope==='hospital_admin'?'Διαχειριστής Νοσοκομείου':record.createdByScope==='infection_control'?'Προϊστάμενος Λοιμώξεων':'Προϊστάμενος Τμήματος'
 const canCancelHistory=h=>h.status==='completed'&&(isFullControlsAdmin||(role===ROLES.INFECTION_CONTROL_LEAD&&record.createdByScope==='infection_control')||(role===ROLES.DEPARTMENT_MANAGER&&department===ownDepartment)||(role===ROLES.DEPARTMENT_USER&&h.actorId===actor.id))
 const canEditHistory=h=>canCancelHistory(h)
 async function removeDefinition(){
  const ok=await confirm({title:'Διαγραφή ελέγχου',message:record.departments.length>1?'Ο έλεγχος θα αφαιρεθεί από όλα τα τμήματα στα οποία έχει ανατεθεί. Θέλετε να συνεχίσετε;':'Ο έλεγχος θα διαγραφεί μαζί με το πρόγραμμά του. Θέλετε να συνεχίσετε;',confirmLabel:'Διαγραφή',danger:true})
  if(!ok)return
  deleteControl(record.id,{actor});notify('Ο έλεγχος διαγράφηκε.','success');navigate('/controls')
 }
 return <Page fill><EntityRecordShell className="control-record-shell workspace-fill" avatar={<ClipboardCheck size={19}/>} eyebrow={record.id} title={language==='el'?record.title:record.titleEn} subtitle={department} status={<div className="control-status-stack">{hasDraft&&<span className="status-badge temporary">Προσωρινή</span>}<span className={`status-badge ${status==='overdue'?'danger':status==='dueSoon'?'warning':'active'}`}>{status==='overdue'?'Εκπρόθεσμος':status==='dueSoon'?'Πλησιάζει':'Εντός προγράμματος'}</span></div>} headerActions={<>{canExecute&&<Button onClick={()=>setEntryOpen(true)}><PlayCircle size={15}/> Καταχώρηση ελέγχου</Button>}{canModifyDefinition&&<button className="general-edit-button" onClick={()=>setEditOpen(true)}><Pencil size={15}/> Επεξεργασία</button>}{canModifyDefinition&&<button className="entity-record-icon-button danger" title="Διαγραφή ελέγχου" aria-label="Διαγραφή ελέγχου" onClick={removeDefinition}><Trash2 size={15}/></button>}</>} tabs={[{id:'details',label:'Στοιχεία ελέγχου',icon:LockKeyhole},{id:'history',label:'Ιστορικό εκτελέσεων',icon:FileClock}]} activeTab={tab} onTabChange={setTab}>
  {tab==='details'&&<div className="record-section"><div className="governance-banner control-readonly-banner"><LockKeyhole size={16}/><span>{canModifyDefinition?'Η προβολή είναι κλειδωμένη. Χρησιμοποιήστε «Επεξεργασία» για αλλαγή του προγράμματος.':'Τα στοιχεία του προγράμματος είναι κλειδωμένα και δεν επιτρέπεται να τροποποιηθούν από τον τρέχοντα ρόλο.'}</span></div><div className="detail-grid quality-detail-grid"><D l="Κατηγορία" v={record.category}/><D l="Τμήμα" v={department}/><D l="Συχνότητα" v={frequencyLabel(record.frequency)}/><D l="Ώρες" v={record.frequency.times?.join(' · ')||'—'}/><D l="Τελευταίος έλεγχος" v={fmt(assignment?.lastCompletedAt)}/><D l="Επόμενος έλεγχος" v={fmt(assignment?.nextDueAt)}/><D l="Υπεύθυνος" v={record.owner}/><D l="Προέλευση" v={sourceLabel}/><D l="Δημιουργήθηκε από" v={record.createdBy||sourceLabel}/>{record.updatedBy&&<D l="Τελευταία αλλαγή από" v={record.updatedBy}/>}</div><div className="quality-description"><span>Περιγραφή / οδηγίες</span><p>{record.description||'—'}</p></div>{record.frequency.kind==='daily'&&record.frequency.timesPerDay>1&&<div className="governance-banner"><CalendarClock size={17}/><span>{record.frequency.timesPerDay} προγραμματισμένες εκτελέσεις την ημέρα: {record.frequency.times.join(', ')}.</span></div>}</div>}
  {tab==='history'&&<div className="record-section"><div className="scroll-table"><table className="data-table sticky-table"><thead><tr><th>Ημερομηνία / ώρα</th><th>Αποτέλεσμα</th><th>Καταχώρησε</th><th>Σημειώσεις</th><th></th></tr></thead><tbody>{(assignment?.history||[]).map(h=><tr key={h.id} className={h.status==='cancelled'?'control-history-cancelled':''}><td>{fmt(h.at)}{h.editedAt&&<small>Επεξεργάστηκε {fmt(h.editedAt)}</small>}{h.status==='cancelled'&&<small>Ακυρώθηκε {fmt(h.cancelledAt)}</small>}</td><td>{h.status==='cancelled'?<span className="status-badge danger">Ακυρώθηκε</span>:structuredSummary(h)}</td><td>{h.by}<small>{h.email||''}</small>{h.editedBy&&<small>Τελευταία αλλαγή: {h.editedBy}</small>}{h.status==='cancelled'&&<small>Αναίρεση: {h.cancelledBy}</small>}</td><td>{h.status==='cancelled'?h.cancellationReason:(h.notes||'—')}</td><td className="control-action-col"><div className="control-history-actions">{h.structuredData?.rows?.length>0&&<button className="control-history-print" title="Εκτύπωση καταχώρησης" onClick={()=>printControlForm({record,department,execution:h})}><Printer size={15}/></button>}{canEditHistory(h)&&<button className="control-history-edit" title="Επεξεργασία καταχώρησης" onClick={()=>setEditExecution(h)}><Pencil size={15}/></button>}{canCancelHistory(h)&&<button className="control-history-undo" title="Αναίρεση καταχώρησης" onClick={()=>setCancelExecution(h)}><RotateCcw size={15}/></button>}</div></td></tr>)}</tbody></table></div></div>}
 </EntityRecordShell>
 {editOpen&&<ControlEditor initial={record} departmentOnly={canEditOwnDepartment} fixedDepartment={canEditOwnDepartment?ownDepartment:''} onCancel={()=>setEditOpen(false)} onSave={draft=>{upsertControl(draft,{actor});setVersion(v=>v+1);setEditOpen(false);notify('Οι αλλαγές αποθηκεύτηκαν.','success')}}/>}
 {entryOpen&&<ControlExecutionModal record={record} department={department} onClose={()=>setEntryOpen(false)} onDraftSaved={()=>{setVersion(v=>v+1);setEntryOpen(false);notify('Η καταχώρηση αποθηκεύτηκε προσωρινά. Θα τη βρείτε στη λίστα Ελέγχων με ένδειξη «Προσωρινή».','success')}} onSave={payload=>{completeControl(record.id,department,payload);setVersion(v=>v+1);setEntryOpen(false);setTab('history');notify('Ο έλεγχος καταχωρήθηκε.','success')}}/>}
 {editExecution&&<ControlExecutionModal record={record} department={department} initialExecution={editExecution} onClose={()=>setEditExecution(null)} onSave={payload=>{if(updateControlExecution(record.id,department,editExecution.id,payload)){setVersion(v=>v+1);notify('Η καταχώρηση ενημερώθηκε.','success')}setEditExecution(null)}}/>}
 {cancelExecution&&<ControlCancellationModal execution={cancelExecution} onClose={()=>setCancelExecution(null)} onConfirm={payload=>{if(cancelControlExecution(record.id,department,cancelExecution.id,payload)){setVersion(v=>v+1);notify('Η καταχώρηση αναιρέθηκε.','success')}setCancelExecution(null)}}/>}
 </Page>
}
function D({l,v}){return <div className="detail-item"><span>{l}</span><strong>{v}</strong></div>}
