import './trainingMyView.css'
import './trainingProgramView.css'
import { useEffect,useMemo,useState } from 'react'
import { BookOpenCheck,ExternalLink,FileText,Pencil,UserPlus,X,XCircle } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { RecordDetailsGrid } from '../../design-system/RecordDetailsGrid'
import { RegistryTable } from '../../design-system/RegistryTable'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { Button } from '../../design-system/Button'
import { IconButton } from '../../design-system/IconButton'
import { AttachmentField } from '../../design-system/AttachmentField'
import { Meter } from '../../design-system/MiniCharts'
import { useTenant } from '../../core/tenant/TenantContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { formatDay } from '../../core/i18n/formatDay'
import { hospitalToday } from '../../core/dates/hospitalDate'
import { loadAttachments } from '../../core/attachments/attachmentService'
import { useCalendarScope } from '../calendar/useCalendarScope'
import { loadTrainingParticipationAsync,loadTrainingRequestsAsync } from './trainingRequestService'
import { trainingCategoryLabel,trainingDeliveryKindLabel,trainingMethodLabel } from './TrainingProgramForm'
import { TrainingStatusBadge as Badge } from './TrainingStatusBadge'
import { TrainingParticipantsDialog } from './TrainingParticipantsDialog'
import { TrainingDepartmentForm } from './TrainingDepartmentForm'
import { useTrainingOwnActions } from './useTrainingOwnActions'
import { canSeeDepartmentNames,latestOwnRequest,ownTrainingRows,participationFromAssignments,programParticipation,programState,type TrainingDepartment,type TrainingParticipation,type TrainingParticipationRequest,type TrainingProgramRow } from './trainingMyView'
import { canManageDepartmentProgram,departmentAssignments,departmentEmployees,departmentParticipants,findOwnDepartment,ownDepartmentKeys } from './trainingDepartmentPrograms'
import { cancelDepartmentTrainingAsync,setDepartmentTrainingParticipantsAsync } from './trainingDepartmentService'
import type { TrainingState } from './trainingData'
import type { TrainingEmployee, TrainingMaterial, TrainingProgram } from './trainingTypes'

// The programme's read-only page (owner, 21/11/2026) for everyone who does not manage training: /training/<programKey>
// from any line of «Εκπαίδευση» (TrainingMyView). The details, the description and the material (names; the files
// open from «Έναρξη», on the learner's page), «Η συμμετοχή μου» (the same buttons as the list: useTrainingOwnActions)
// and «Συμμετοχή τμήματος»: numbers for everyone, the names (status, deadline) only for the Department Manager and the
// Division Director of the department (canSeeDepartmentNames; the database gives them their department's assignments).
// The Department Manager also edits, chooses the participants of and cancels his own department's training
// (canManageDepartmentProgram, «⋯» on the record card); the training office keeps its own record (ProgramRecord).
type DepartmentOption = { id?: string, name?: string, nameEn?: string }
interface TrainingProgramViewProps { program: TrainingProgram, state: TrainingState, language: string, isDemo: boolean, organizationId: string|null, departments?: DepartmentOption[], employees?: TrainingEmployee[], onBack?: ()=>void, onStateChange: (state: TrainingState)=>void }
const fmt=(v: unknown)=>formatDay(v)
function periodText(start: string,due: string){
 if(!start)return fmt(due)
 if(!due)return fmt(start)
 if(start.slice(0,4)!==due.slice(0,4))return `${fmt(start)} – ${fmt(due)}`
 return `${fmt(start).replace(/\/\d{4}$/,'')} – ${fmt(due)}`
}
const day=(value: unknown)=>String(value||'').slice(0,10)
const linkOf=(url: string|undefined)=>(/^https?:\/\//i.test(String(url||'').trim())?String(url).trim():'')

export function TrainingProgramView({program,state,language,isDemo,organizationId,departments=[],employees=[],onBack,onStateChange}: TrainingProgramViewProps){
 const en=language==='en',tr=(el: string,enText: string)=>en?enText:el
 const {role,membership}=useTenant(),{notify,notifyError,confirm}=useFeedback(),location=useLocation()
 const scope=useCalendarScope(),today=hospitalToday()
 const departmentList=useMemo((): TrainingDepartment[]=>departments.filter(item=>item.name).map(item=>({id:String(item.id||item.name),name:String(item.name),nameEn:item.nameEn||''})),[departments])
 const ownKeys=useMemo(()=>ownDepartmentKeys(scope,membership),[scope,membership])
 const ownDepartment=useMemo(()=>findOwnDepartment(departmentList,ownKeys),[departmentList,ownKeys])
 const [requests,setRequests]=useState<TrainingParticipationRequest[]>([]),[participation,setParticipation]=useState<TrainingParticipation[]|null>(null)
 useEffect(()=>{let active=true;loadTrainingRequestsAsync(organizationId).then(rows=>{if(active)setRequests(rows)}).catch(()=>{if(active)setRequests([])});return()=>{active=false}},[organizationId,state])
 useEffect(()=>{let active=true;loadTrainingParticipationAsync(isDemo?null:organizationId).then(rows=>{if(active)setParticipation(rows)}).catch(()=>{/* the numbers stay «—» */});return()=>{active=false}},[isDemo,organizationId,state])
 const {actionCell,meCell,requestDialog}=useTrainingOwnActions({state,language,isDemo,organizationId,setRequests})
 // The user's own part, as a line of the list (trainingMeState / trainingRowAction).
 const counted=useMemo(()=>isDemo?participationFromAssignments(state):(participation||[]),[isDemo,participation,state])
 const own=useMemo(()=>ownTrainingRows(state,scope,today).find(row=>row.assignment.programId===program.id)||null,[state,scope,today,program.id])
 const row: TrainingProgramRow={id:program.id,program,title:program.title||'',trainer:program.trainer||program.owner||'',audience:program.audience||'',startDate:day(program.startDate),dueDate:day(program.dueDate),state:programState(program,today),own,participation:programParticipation(program.id,counted,ownDepartment),request:latestOwnRequest(requests,program.id,scope)}
 const cancelled=program.status==='cancelled'
 // The department: numbers for everyone; names only for the Department Manager and the Division Director of it.
 const namesAllowed=canSeeDepartmentNames(role,ownDepartment,ownKeys)
 const people=useMemo(()=>namesAllowed?departmentParticipants(state,program.id,ownDepartment,today):[],[namesAllowed,state,program.id,ownDepartment,today])
 const manages=canManageDepartmentProgram(role,program,ownDepartment)
 const [mode,setMode]=useState<'view'|'edit'|'participants'>(()=>manages&&location.state?.pickParticipants?'participants':'view'),[busy,setBusy]=useState(false)
 // The uploaded files of the programme (names only here: they open from «Έναρξη», where the reading time is counted).
 const [files,setFiles]=useState<{id: string,name: string}[]>([])
 useEffect(()=>{let active=true;if(isDemo||!organizationId||!program.dbId||manages)return()=>{active=false};loadAttachments(organizationId,'training_program',program.dbId).then(rows=>{if(active)setFiles(rows.map(file=>({id:file.id,name:file.name})))}).catch(()=>{if(active)setFiles([])});return()=>{active=false}},[isDemo,organizationId,program.dbId,manages])
 const listed=(program.materials||[]).filter((item: TrainingMaterial)=>item.title||item.url)
 const deptRows=useMemo(()=>departmentAssignments(state,program.id,ownDepartment),[state,program.id,ownDepartment])
 async function saveParticipants(selected: TrainingEmployee[]){
  if(!ownDepartment||busy)return
  setBusy(true)
  try{onStateChange(await setDepartmentTrainingParticipantsAsync(organizationId,program,ownDepartment,deptRows,selected));setMode('view');notify(tr('Οι συμμετέχοντες αποθηκεύτηκαν.','The participants were saved.'),'success')}
  catch(error){notifyError(error,'save',{operation:'training_department_participants'})}
  finally{setBusy(false)}
 }
 async function removeParticipant(assignmentId: string,name: string){
  if(!ownDepartment||busy)return
  if(!await confirm({title:tr('Αφαίρεση συμμετέχοντα','Remove participant'),message:en?`Remove ${name} from the training?`:`Να αφαιρεθεί ο/η ${name} από την εκπαίδευση;`,confirmLabel:tr('Αφαίρεση','Remove'),danger:true}))return
  setBusy(true)
  try{onStateChange(await setDepartmentTrainingParticipantsAsync(organizationId,program,ownDepartment,deptRows.filter(item=>item.id!==assignmentId),[]));notify(tr('Ο συμμετέχων αφαιρέθηκε.','The participant was removed.'),'success')}
  catch(error){notifyError(error,'save',{operation:'training_department_participants'})}
  finally{setBusy(false)}
 }
 async function cancelProgram(){
  if(!await confirm({title:tr('Ακύρωση προγράμματος','Cancel the programme'),message:tr('Το πρόγραμμα σημειώνεται ως ακυρωμένο· οι συμμετέχοντες και τα αποτελέσματα διατηρούνται.','The programme is marked as cancelled; its participants and results are kept.'),confirmLabel:tr('Ακύρωση προγράμματος','Cancel the programme'),danger:true}))return
  setBusy(true)
  try{onStateChange(await cancelDepartmentTrainingAsync(organizationId,program.id));notify(tr('Το πρόγραμμα ακυρώθηκε.','The programme was cancelled.'),'success')}
  catch(error){notifyError(error,'save',{operation:'training_department_cancel'})}
  finally{setBusy(false)}
 }
 if(mode==='edit'&&manages&&ownDepartment)return <TrainingDepartmentForm language={language} organizationId={organizationId} department={ownDepartment} employees={employees} program={program} onCancel={()=>setMode('view')} onSaved={next=>{onStateChange(next);setMode('view')}}/>
 if(mode==='participants'&&manages&&ownDepartment)return <TrainingParticipantsDialog registryOnly en={en} employees={departmentEmployees(employees,ownDepartment)} alreadyAssignedIds={deptRows.map(item=>item.employeeId).filter(Boolean)} busy={busy} subtitle={en?`${program.title} · the staff of ${ownDepartment.nameEn||ownDepartment.name}`:`${program.title} · το προσωπικό του τμήματος ${ownDepartment.name}`} onClose={()=>setMode('view')} onSave={({selected})=>saveParticipants(selected)}/>
 const categoryLine=[program.category?trainingCategoryLabel(program.category,language):'',program.deliveryKind?trainingDeliveryKindLabel(program.deliveryKind,language):''].filter(part=>part&&part!=='—').join(' · ')
 const organiser=program.organizerDepartmentId?(departmentList.find(item=>item.id===program.organizerDepartmentId)?.name||program.owner):program.owner
 const method=trainingMethodLabel(program.method,language)
 const menu=manages?<OverflowMenu label={tr('Ενέργειες προγράμματος','Programme actions')} items={[
  {id:'edit',label:tr('Επεξεργασία','Edit'),icon:Pencil,disabled:busy,onClick:()=>setMode('edit')},
  {id:'cancel',label:tr('Ακύρωση προγράμματος','Cancel the programme'),icon:XCircle,tone:'danger',separatorBefore:true,disabled:busy,onClick:cancelProgram},
 ]}/>:null
 const ownStatus=own?<Badge status={own.status}/>:null
 const resultText=own?(own.result==='review'?tr('Αναμονή ελέγχου','Review pending'):own.result==='score'?`${own.score}%`:own.result==='done'?tr('Ολοκληρώθηκε','Completed'):'—'):'—'
 const deptLabel=ownDepartment?(en&&ownDepartment.nameEn?ownDepartment.nameEn:ownDepartment.name):''
 return <Page fill className="training-program-view-page">
  <EntityRecordShell className="training-record-shell training-program-view" avatar={<BookOpenCheck size={19}/>} eyebrow={program.id} title={program.title} subtitle={categoryLine||undefined} status={<Badge status={cancelled?'cancelled':row.state}/>} tabs={[]} activeTab="" onTabChange={()=>{}} onBack={onBack} backLabel={tr('Πίσω στην εκπαίδευση','Back to training')}>
   <div className="training-program-view-grid">
    <section className="training-program-view-main" aria-label={tr('Στοιχεία προγράμματος','Programme details')}>
     <div className="record-section-header"><div><h3>{tr('Στοιχεία προγράμματος','Programme details')}</h3></div>{menu}</div>
     <RecordDetailsGrid className="training-program-view-details" fields={[
      {id:'period',label:tr('Περίοδος','Period'),value:periodText(day(program.startDate),day(program.dueDate))},
      {id:'trainer',label:tr('Εκπαιδευτής','Trainer'),value:program.trainer||program.owner},
      {id:'organiser',label:tr('Τμήμα διοργάνωσης','Organising department'),value:organiser},
      {id:'audience',label:tr('Απευθύνεται σε','Intended for'),value:program.audience},
      {id:'method',label:tr('Τρόπος','Method'),value:method==='—'?'':method,hidden:method==='—'},
      {id:'when',label:tr('Ώρα · διάρκεια','Time · duration'),value:[program.startTime,program.durationHours?`${program.durationHours} ${tr('ώρες','h')}`:''].filter(Boolean).join(' · '),hidden:!program.startTime&&!program.durationHours},
      {id:'location',label:tr('Τόπος','Location'),value:program.location,hidden:!program.location},
     ]}/>
     <div className="training-program-view-block">
      <h4>{tr('Σκοπός / περιγραφή','Purpose / description')}</h4>
      <p className={program.description?'training-program-view-text':'muted'}>{program.description||tr('Δεν υπάρχει περιγραφή.','No description.')}</p>
     </div>
     <div className="training-program-view-block">
      <h4>{tr('Εκπαιδευτικό υλικό','Training material')}</h4>
      {manages&&organizationId?<AttachmentField organizationId={organizationId} entityType="training_program" entityId={program.dbId||program.id} value={[]} onChange={()=>{}}/>:
      files.length||listed.length?<ul className="training-material-list training-program-view-files">
       {files.map(file=><li key={file.id}><FileText size={14} aria-hidden="true"/><strong>{file.name}</strong></li>)}
       {listed.map(item=><li key={item.id}><FileText size={14} aria-hidden="true"/><strong>{item.title||item.url}</strong>{item.type&&<span>{item.type}</span>}{linkOf(item.url)&&<a href={linkOf(item.url)} target="_blank" rel="noreferrer"><ExternalLink size={13} aria-hidden="true"/>{tr('Άνοιγμα','Open')}</a>}</li>)}
      </ul>:<p className="muted">{tr('Δεν υπάρχει υλικό.','No material.')}</p>}
      {!manages&&(files.length>0||listed.length>0)&&<p className="training-program-view-note">{own?tr('Τα αρχεία ανοίγουν από το «Έναρξη» / «Συνέχεια», στη σελίδα της εκπαίδευσης.','The files open from “Start” / “Continue”, on the training page.'):tr('Τα αρχεία ανοίγουν στους συμμετέχοντες, από το «Έναρξη».','Participants open the files from “Start”.')}</p>}
     </div>
    </section>
    <aside className="training-program-view-side">
     <section className="training-program-view-card" aria-label={tr('Η συμμετοχή μου','My participation')}>
      <h3>{tr('Η συμμετοχή μου','My participation')}</h3>
      {own?<><dl className="training-program-view-facts">
        <div><dt>{tr('Κατάσταση','Status')}</dt><dd>{ownStatus}</dd></div>
        <div><dt>{tr('Προθεσμία','Due')}</dt><dd>{own.dueDate?fmt(own.dueDate):'—'}</dd></div>
        <div><dt>{tr('Αποτέλεσμα','Result')}</dt><dd>{resultText}</dd></div>
        {own.certificate&&<div><dt>{tr('Πιστοποιητικό','Certificate')}</dt><dd>{own.certificate.validUntil?`${own.certificateState==='expired'?tr('Έληξε','Expired'):tr('Έως','Until')} ${fmt(own.certificate.validUntil)}`:tr('Χωρίς λήξη','No expiry')}</dd></div>}
       </dl>
       {!cancelled&&<div className="training-program-view-action">{actionCell(own,true)}</div>}</>
      :cancelled?<p className="muted">{tr('Το πρόγραμμα ακυρώθηκε.','The programme was cancelled.')}</p>
      :<><p className="muted">{row.state==='completed'?tr('Δεν συμμετείχατε σε αυτό το πρόγραμμα.','You did not take part in this programme.'):tr('Δεν συμμετέχετε σε αυτό το πρόγραμμα.','You do not take part in this programme.')}</p><div className="training-program-view-action training-hospital-own">{meCell(row)}</div></>}
     </section>
     <section className="training-program-view-card training-program-view-department" aria-label={tr('Συμμετοχή τμήματος','Department participation')}>
      <div className="training-program-view-card-head"><h3>{tr('Συμμετοχή τμήματος','Department participation')}{deptLabel&&<small>{deptLabel}</small>}</h3>{manages&&<Button variant="secondary" className="training-my-open" disabled={busy} onClick={()=>setMode('participants')}><UserPlus size={14}/>{tr('Συμμετέχοντες','Participants')}</Button>}</div>
      {!ownDepartment?<p className="muted">{tr('Ο λογαριασμός σας δεν έχει τμήμα.','Your account has no department.')}</p>
      :row.participation?<div className="training-programme-participation training-program-view-meter"><span>{en?`${row.participation.completed} of ${row.participation.assigned} completed`:`${row.participation.completed} από ${row.participation.assigned} ολοκλήρωσαν`}</span><Meter value={row.participation.assigned?row.participation.completed/row.participation.assigned*100:0} tone={row.participation.completed===row.participation.assigned?'success':'neutral'} label={en?`${row.participation.completed} of ${row.participation.assigned} completed`:`${row.participation.completed} από ${row.participation.assigned} ολοκλήρωσαν`}/></div>
      :<p className="muted">{tr('Κανείς του τμήματος δεν έχει ανάθεση.','Nobody of the department is assigned.')}</p>}
      {namesAllowed&&people.length>0&&<RegistryTable wrapperClassName="scroll-table training-program-view-people" className="training-names-table" sortable={false} columns={[{key:'name',label:tr('Εργαζόμενος','Employee')},{key:'status',label:tr('Κατάσταση','Status')},{key:'due',label:tr('Προθεσμία','Due')},...(manages?[{key:'remove',label:'',ariaLabel:tr('Αφαίρεση','Remove')}]:[])]} rows={people}
       renderRow={person=><tr><td><strong>{person.name||'—'}</strong></td><td><Badge status={person.status}/></td><td className="training-my-due">{person.dueDate?fmt(person.dueDate):'—'}</td>{manages&&<td className="open-record-cell">{!person.started&&<IconButton size="sm" tone="danger" label={tr('Αφαίρεση συμμετέχοντα','Remove participant')} disabled={busy} onClick={()=>void removeParticipant(person.assignmentId,person.name)}><X size={14}/></IconButton>}</td>}</tr>}/>}
     </section>
    </aside>
   </div>
  </EntityRecordShell>
  {requestDialog}
 </Page>
}
