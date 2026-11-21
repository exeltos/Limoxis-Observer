import { useState } from 'react'
import { ClipboardCheck,PlayCircle,Send,X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../design-system/Button'
import { IconButton } from '../../design-system/IconButton'
import { ExportMenu } from '../../design-system/ExportMenu'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { Field } from '../../design-system/Field'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { formatDay } from '../../core/i18n/formatDay'
import { downloadCertificatePdf } from './trainingCertificate'
import { openOwnTrainingAccessAsync } from './trainingInvitationService'
import { cancelTrainingRequestAsync,requestTrainingParticipationAsync } from './trainingRequestService'
import { trainingMeState,trainingRowAction,type TrainingMyRow,type TrainingParticipationRequest,type TrainingProgramRow } from './trainingMyView'
import type { TrainingState } from './trainingData'
import type { TrainingAssignment, TrainingProgram } from './trainingTypes'

// The user's own part in a programme, the same in the list («Εκπαίδευση» of the departments, TrainingMyView) and on the
// programme's read-only page (TrainingProgramView): «Έναρξη» / «Συνέχεια» / «Αποτέλεσμα» open the learner's page of the
// user's own assignment (training_my_access gives its personal link), the certificate's «Λήψη», and the participation
// request: «Αίτηση συμμετοχής» (a short note, then the training managers decide), «Ακύρωση αίτησης», «Νέα αίτηση».
const fmt=(v: unknown)=>formatDay(v)
function periodText(start: string,due: string){
 if(!start)return fmt(due)
 if(!due)return fmt(start)
 if(start.slice(0,4)!==due.slice(0,4))return `${fmt(start)} – ${fmt(due)}`
 return `${fmt(start).replace(/\/\d{4}$/,'')} – ${fmt(due)}`
}
interface OwnActionsOptions { state: TrainingState, language: string, isDemo: boolean, organizationId: string|null, setRequests: (rows: TrainingParticipationRequest[])=>void }
export function useTrainingOwnActions({state,language,isDemo,organizationId,setRequests}: OwnActionsOptions){
 const en=language==='en',tr=(el: string,enText: string)=>en?enText:el
 const {notify,notifyError,confirm}=useFeedback(),navigate=useNavigate()
 const [certBusyId,setCertBusyId]=useState<string|null>(null),[openBusyId,setOpenBusyId]=useState<string|null>(null)
 const [requesting,setRequesting]=useState<TrainingProgramRow|null>(null),[requestNote,setRequestNote]=useState(''),[requestBusy,setRequestBusy]=useState(false)
 async function downloadCertificate(row: TrainingAssignment,program: TrainingProgram|null|undefined,pdf=false){
  const certificate=row.certificateId?(state.certificates||[]).find(c=>c.id===row.certificateId):(state.certificates||[]).find(c=>c.assignmentId===row.id)
  if(certBusyId||!certificate)return
  setCertBusyId(row.id)
  try{await downloadCertificatePdf({certificate,program,participantName:row.employeeName,en,pdf})}
  catch(error){notify((error as Error)?.message||(en?'Could not export the certificate.':'Δεν ήταν δυνατή η εξαγωγή του πιστοποιητικού.'),'danger')}
  finally{setCertBusyId(null)}
 }
 // The learner's page of the user's own assignment, in the same tab (the Demo opens its own sample flow by the assignment).
 async function openTraining(row: TrainingMyRow){
  if(openBusyId)return
  const go=(key: string)=>navigate(`/training-access/${encodeURIComponent(key)}`,{state:{trainingFromApp:true}})
  if(isDemo){go(row.assignment.id);return}
  if(!organizationId)return
  setOpenBusyId(row.id)
  try{const token=await openOwnTrainingAccessAsync(organizationId,row.assignment.id);if(!token)throw new Error('TRAINING_ACCESS_NOT_AVAILABLE');go(token)}
  catch(error){notifyError(error,'load',{operation:'training_my_access'})}
  finally{setOpenBusyId(null)}
 }
 // «Αίτηση συμμετοχής»: a short note, then the training managers decide.
 async function sendRequest(){
  if(!requesting||requestBusy)return
  setRequestBusy(true)
  try{setRequests(await requestTrainingParticipationAsync(organizationId,requesting.program,requestNote));setRequesting(null);setRequestNote('');notify(tr('Η αίτηση στάλθηκε στους υπεύθυνους εκπαίδευσης.','The request was sent to the training managers.'),'success')}
  catch(error){notifyError(error,'save',{operation:'training_request_participation'})}
  finally{setRequestBusy(false)}
 }
 // «Ακύρωση αίτησης»: the user withdraws a request still waiting (after a confirmation).
 const [cancelBusyId,setCancelBusyId]=useState<string|null>(null)
 async function cancelRequest(row: TrainingProgramRow){
  const request=row.request
  if(!request||request.status!=='pending'||cancelBusyId)return
  if(!await confirm({title:tr('Ακύρωση αίτησης','Cancel request'),message:en?`Withdraw your request to attend “${row.title}”?`:`Να ακυρωθεί η αίτησή σας για «${row.title}»;`,confirmLabel:tr('Απόσυρση αίτησης','Withdraw request'),danger:true}))return
  setCancelBusyId(request.id)
  try{setRequests(await cancelTrainingRequestAsync(organizationId,request.id));notify(tr('Η αίτηση ακυρώθηκε.','The request was cancelled.'),'success')}
  catch(error){notifyError(error,'save',{operation:'training_cancel_participation_request'})}
  finally{setCancelBusyId(null)}
 }
 // The row's one small button (trainingRowAction): the user's own training, or a certificate's download.
 const actionCell=(row: TrainingMyRow,own: boolean)=>{const action=trainingRowAction(row,own);return action==='certificate'?<ExportMenu compact disabled={Boolean(certBusyId)} onPrint={()=>downloadCertificate(row.assignment,row.program)} onPdf={()=>downloadCertificate(row.assignment,row.program,true)}/>:action?<Button variant={action==='result'?'secondary':'primary'} className="training-my-open" loading={openBusyId===row.id} disabled={Boolean(openBusyId)} onClick={event=>{event.stopPropagation();void openTraining(row)}}>{action==='result'?<ClipboardCheck size={14}/>:<PlayCircle size={14}/>}{action==='start'?tr('Έναρξη','Start'):action==='continue'?tr('Συνέχεια','Continue'):tr('Αποτέλεσμα','Result')}</Button>:null}
 // «Εγώ»: the user's own part in the programme (trainingMeState).
 const meCell=(row: TrainingProgramRow)=>{
  const me=trainingMeState(row)
  if(me==='action')return actionCell(row.own!,true)
  if(me==='completed')return <span className="status-badge active">{tr('Ολοκληρώθηκε','Completed')}</span>
  if(me==='pending')return <><span className="status-badge info">{tr('Αίτηση σε αναμονή','Request pending')}</span><IconButton size="sm" className="training-request-cancel" label={tr('Ακύρωση αίτησης','Cancel request')} disabled={Boolean(cancelBusyId)} onClick={event=>{event.stopPropagation();void cancelRequest(row)}}><X size={14}/></IconButton></>
  // A rejected request: the reason on the badge, and «Νέα αίτηση» while the programme is still open.
  if(me==='rejected')return <><span className="status-badge danger" title={row.request?.decisionReason||undefined}>{tr('Απορρίφθηκε','Rejected')}</span>{row.state!=='completed'&&<Button variant="secondary" className="training-my-open" onClick={event=>{event.stopPropagation();setRequesting(row);setRequestNote('')}}><Send size={14}/>{tr('Νέα αίτηση','New request')}</Button>}</>
  if(me==='request')return <Button variant="secondary" className="training-my-open" onClick={event=>{event.stopPropagation();setRequesting(row);setRequestNote('')}}><Send size={14}/>{tr('Αίτηση','Request')}<span className="training-request-more">{tr(' συμμετοχής',' to attend')}</span></Button>
  return '—'
 }
 const requestDialog=requesting?<ObserverDialog width="compact" className="training-request-dialog" eyebrow={tr('Αίτηση συμμετοχής','Request to attend')} title={requesting.title} subtitle={[periodText(requesting.startDate,requesting.dueDate),requesting.trainer].filter(Boolean).join(' · ')||undefined} onClose={()=>setRequesting(null)} footer={<Button loading={requestBusy} disabled={requestBusy} onClick={sendRequest}><Send size={14}/>{tr('Αποστολή αίτησης','Send request')}</Button>}>
  <p className="training-request-intro">{tr('Η αίτηση πηγαίνει στους υπεύθυνους εκπαίδευσης. Όταν γίνει δεκτή, η εκπαίδευση εμφανίζεται στις «Οι δικές μου».','The request goes to the training managers. Once accepted, the training appears under “Mine”.')}</p>
  <Field label={tr('Σημείωση (προαιρετικά)','Note (optional)')}><textarea rows={3} maxLength={1000} value={requestNote} onChange={event=>setRequestNote(event.target.value)} placeholder={tr('Π.χ. γιατί θέλετε να την παρακολουθήσετε','E.g. why you would like to attend')}/></Field>
 </ObserverDialog>:null
 return {actionCell,meCell,requestDialog,downloadCertificate}
}
