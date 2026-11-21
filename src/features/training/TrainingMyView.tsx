import '../dashboard/departmentHome.css'
import './trainingMyView.css'
import { useEffect,useMemo,useState } from 'react'
import { ClipboardCheck,GraduationCap,PlayCircle,Send,X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../design-system/Button'
import { IconButton } from '../../design-system/IconButton'
import { Page } from '../../design-system/Page'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { SegmentedControl } from '../../design-system/SegmentedControl'
import { RegistryTable } from '../../design-system/RegistryTable'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { ExportMenu } from '../../design-system/ExportMenu'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { Field } from '../../design-system/Field'
import { Meter } from '../../design-system/MiniCharts'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { formatDay } from '../../core/i18n/formatDay'
import { foldSearch,matchesSearch } from '../../core/i18n/searchMatch'
import { hospitalToday } from '../../core/dates/hospitalDate'
import { useCalendarScope } from '../calendar/useCalendarScope'
import { dueInText,overdueDurationText } from '../calendar/calendarView'
import { downloadCertificatePdf } from './trainingCertificate'
import { openOwnTrainingAccessAsync } from './trainingInvitationService'
import { cancelTrainingRequestAsync,loadTrainingParticipationAsync,loadTrainingRequestsAsync,requestTrainingParticipationAsync } from './trainingRequestService'
import { trainingCategoryLabel,trainingMethodLabel,trainingDeliveryKindLabel } from './TrainingProgramForm'
import { TrainingStatusBadge as Badge } from './TrainingStatusBadge'
import { canSeeDepartmentNames,departmentPendingPeople,filterProgramRows,filterTrainingRows,hospitalProgramRows,ownTrainingRows,participationFromAssignments,programStatusCounts,programTiles,trainingMeState,trainingRowAction,trainingStatusCounts,trainingTiles,type TrainingDepartment,type TrainingMyRow,type TrainingMyScope,type TrainingMyStatus,type TrainingParticipation,type TrainingParticipationRequest,type TrainingProgramFilter,type TrainingProgramRow } from './trainingMyView'
import type { TrainingState } from './trainingData'
import type { TrainingAssignment, TrainingProgram } from './trainingTypes'

// «Εκπαίδευση» for the departments that do not manage training (owner, 20/11/2026): «Οι δικές μου | Του τμήματός μου |
// Όλο το νοσοκομείο» at the top (the Department User and the Link Nurse start on their own, the Department Manager on the
// department, a hospital-wide role on the hospital), four figures, then a paged list that fills the screen.
// «Οι δικές μου»: one line per programme of the user with one small button (trainingRowAction): «Έναρξη» / «Συνέχεια»
// open the learner's page of the user's own assignment (training_my_access gives its personal link), «Αποτέλεσμα» shows
// a submitted one; the certificate's «Λήψη» where there is a certificate.
// «Του τμήματός μου» and «Όλο το νοσοκομείο»: programmes, never employees («δεν θέλω να βλέπω εργαζόμενους αλλά
// εκπαιδεύσεις»): «Συμμετοχή τμήματος» in numbers, «Εγώ» with the user's own part or «Αίτηση συμμετοχής». Filters:
// «Τμήμα» (any department of the hospital), «Κατάσταση», «Κατηγορία». Only the Department Manager (and the Division
// Director) opens, for a department of their own, who has not completed a programme.
type DepartmentOption = { id?: string, name?: string, nameEn?: string }
interface TrainingMyViewProps { state: TrainingState, language: string, managerView: boolean, isDemo: boolean, organizationId?: string|null, departments?: DepartmentOption[] }
const fmt=(v: unknown)=>formatDay(v)
// «31/7 – 29/8/2026» on one line (the year once when both dates fall in it), as the programmes' list.
function periodText(start: string,due: string){
 if(!start)return fmt(due)
 if(!due)return fmt(start)
 if(start.slice(0,4)!==due.slice(0,4))return `${fmt(start)} – ${fmt(due)}`
 return `${fmt(start).replace(/\/\d{4}$/,'')} – ${fmt(due)}`
}
const PLAIN_ROLES=new Set(['department_user','link_nurse'])

export function TrainingMyView({state,language,managerView,isDemo,organizationId=null,departments=[]}: TrainingMyViewProps){
 const en=language==='en',tr=(el: string,enText: string)=>en?enText:el
 const {notify,notifyError,confirm}=useFeedback(),navigate=useNavigate(),{role,membership}=useTenant()
 const scope=useCalendarScope(),today=hospitalToday()
 // The hospital's departments for «Τμήμα», and the user's own (the department scope; a hospital-wide role its membership's).
 const departmentList=useMemo((): TrainingDepartment[]=>departments.filter(item=>item.name).map(item=>({id:String(item.id||item.name),name:String(item.name),nameEn:item.nameEn||''})).sort((a,b)=>a.name.localeCompare(b.name,'el')),[departments])
 const ownKeys=useMemo(()=>{const names=scope.all?[membership?.departmentName,...(Array.isArray(membership?.departmentNames)?membership.departmentNames:[])]:scope.departments;return [...new Set([...names.map(name=>foldSearch(name).trim()).filter(Boolean),...(membership?.departmentIds||[]).filter(Boolean).map(String)])]},[scope,membership])
 const ownDepartment=useMemo(()=>departmentList.find(item=>ownKeys.includes(item.id)||ownKeys.includes(foldSearch(item.name).trim())||Boolean(item.nameEn&&ownKeys.includes(foldSearch(item.nameEn).trim())))||null,[departmentList,ownKeys])
 const initialView: TrainingMyScope=scope.all?'hospital':PLAIN_ROLES.has(String(role))&&!managerView?'mine':'department'
 const [view,setView]=useState<TrainingMyScope>(initialView),[status,setStatus]=useState<TrainingMyStatus>('open'),[programFilter,setProgramFilter]=useState<TrainingProgramFilter>('all'),[category,setCategory]=useState('all'),[departmentId,setDepartmentId]=useState('all'),[query,setQuery]=useState(''),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(15),[certBusyId,setCertBusyId]=useState<string|null>(null),[openBusyId,setOpenBusyId]=useState<string|null>(null)
 // «Του τμήματός μου» opens on the user's department once the departments are known.
 useEffect(()=>{if(view==='department'&&departmentId==='all'&&ownDepartment)setDepartmentId(ownDepartment.id)},[view,ownDepartment])// eslint-disable-line react-hooks/exhaustive-deps
 // The figures per department (numbers only) and the user's requests; the Demo keeps both in its sample data.
 const [participation,setParticipation]=useState<TrainingParticipation[]|null>(null),[requests,setRequests]=useState<TrainingParticipationRequest[]>([]),[requesting,setRequesting]=useState<TrainingProgramRow|null>(null),[requestNote,setRequestNote]=useState(''),[requestBusy,setRequestBusy]=useState(false),[namesOf,setNamesOf]=useState<TrainingProgramRow|null>(null)
 useEffect(()=>{let active=true;loadTrainingParticipationAsync(isDemo?null:organizationId).then(rows=>{if(active)setParticipation(rows)}).catch(()=>{/* a failed load keeps the last numbers the database gave */});return()=>{active=false}},[isDemo,organizationId,state])
 useEffect(()=>{let active=true;loadTrainingRequestsAsync(organizationId).then(rows=>{if(active)setRequests(rows)}).catch(()=>{if(active)setRequests([])});return()=>{active=false}},[organizationId,state])
 const mine=view==='mine'
 const rows=useMemo(()=>mine?ownTrainingRows(state,scope,today):[],[mine,state,scope,today])
 const tiles=trainingTiles(rows,today,mine?{records:state,own:scope}:null),counts=trainingStatusCounts(rows)
 const programDetail=(program: TrainingProgram|null|undefined)=>[program?.category?trainingCategoryLabel(program.category,language):'',program?.deliveryKind?trainingDeliveryKindLabel(program.deliveryKind,language):program?.method?trainingMethodLabel(program.method,language):''].filter(part=>part&&part!=='—').join(' · ')
 const detailOf=(row: TrainingMyRow)=>programDetail(row.program)
 const filtered=useMemo(()=>filterTrainingRows(rows,status).filter(row=>matchesSearch(query,[row.title,row.department,detailOf(row)])),[rows,status,query])// eslint-disable-line react-hooks/exhaustive-deps
 // The programmes: of the chosen department (by the audience or its people), or of the whole hospital.
 const department=departmentList.find(item=>item.id===departmentId)||null
 // In a hospital the numbers come only from the database (the assignments the user reads are limited by RLS, so they
 // are never counted as totals); until they arrive, or when they fail, the column shows «—». The Demo counts its own.
 const counted=useMemo(()=>isDemo?participationFromAssignments(state):(participation||[]),[isDemo,participation,state])
 const programRows=useMemo(()=>hospitalProgramRows(state,scope,today,{department,participation:counted,requests}),[state,scope,today,department,counted,requests])
 const tileRows=useMemo(()=>mine?hospitalProgramRows(state,scope,today,{participation:counted,requests}).filter(row=>row.own&&row.own.status!=='completed'):programRows,[mine,state,scope,today,counted,requests,programRows])
 const programFigures=programTiles(tileRows,today,requests,scope),programCounts=programStatusCounts(programRows)
 const categories=useMemo(()=>[...new Set(programRows.map(row=>row.program.category).filter(Boolean))] as string[],[programRows])
 const programsShown=useMemo(()=>filterProgramRows(programRows,programFilter,query,(row: TrainingProgramRow)=>[programDetail(row.program)],category),[programRows,programFilter,query,category])// eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>setPage(1),[view,status,programFilter,category,departmentId,query,pageSize])
 const shownCount=mine?filtered.length:programsShown.length
 const totalPages=Math.max(1,Math.ceil(shownCount/pageSize)),safePage=Math.min(page,totalPages),pageRows=filtered.slice((safePage-1)*pageSize,safePage*pageSize),programPage=programsShown.slice((safePage-1)*pageSize,safePage*pageSize)
 const namesAllowed=!mine&&canSeeDepartmentNames(role,department,ownKeys)
 function changeView(next: TrainingMyScope){setView(next);if(next==='department')setDepartmentId(ownDepartment?.id||'all');if(next==='hospital')setDepartmentId('all')}
 // Another department in «Του τμήματός μου» stays there; «Όλα» is the whole hospital.
 function changeDepartment(next: string){setDepartmentId(next);if(next==='all'&&view==='department')setView('hospital')}
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
 const expired=tiles.certificates.expired
 const scopeText=department?tr('στο τμήμα','in the department'):tr('στο νοσοκομείο','in the hospital')
 const requestsTile={key:'requests',label:tr('Οι αιτήσεις μου','My requests'),value:programFigures.requests,detail:programFigures.rejected?(en?`${programFigures.rejected} rejected`:`${programFigures.rejected} ${programFigures.rejected===1?'απορρίφθηκε':'απορρίφθηκαν'}`):tr('σε αναμονή απάντησης','awaiting an answer'),tone:'',onClick:()=>{changeView(ownDepartment?'department':'hospital');setProgramFilter('all')}}
 const tileList=mine?[
  {key:'current',label:tr('Προγράμματα σε εξέλιξη','Programmes in progress'),value:programFigures.current,detail:tr('όσα παρακολουθώ τώρα','the ones I attend now'),tone:'',onClick:()=>setStatus('open')},
  {key:'planned',label:tr('Προγραμματισμένα','Planned'),value:programFigures.planned,detail:programFigures.nextStart?`${tr('επόμενο','next')} ${fmt(programFigures.nextStart)}`:tr('κανένα επόμενο','none upcoming'),tone:'',onClick:()=>setStatus('open')},
  {key:'open',label:tr('Να ολοκληρώσω','To complete'),value:tiles.open,detail:tiles.nextDue?`${tr('επόμενη προθεσμία','next due')} ${fmt(tiles.nextDue)}`:expired?(en?`${expired} certificate(s) expired`:`${expired} ${expired===1?'πιστοποιητικό έληξε':'πιστοποιητικά έληξαν'}`):tr('καμία επόμενη προθεσμία','no upcoming deadline'),tone:tiles.overdue>0?'danger':'',onClick:()=>setStatus('open')},
  requestsTile,
 ]:[
  {key:'current',label:tr('Προγράμματα σε εξέλιξη','Programmes in progress'),value:programFigures.current,detail:en?`running now ${scopeText}`:`τρέχουν τώρα ${scopeText}`,tone:'',onClick:()=>setProgramFilter('current')},
  {key:'planned',label:tr('Προγραμματισμένα','Planned'),value:programFigures.planned,detail:programFigures.nextStart?`${tr('επόμενο','next')} ${fmt(programFigures.nextStart)}`:tr('κανένα επόμενο','none upcoming'),tone:'',onClick:()=>setProgramFilter('planned')},
  {key:'pending',label:department?tr('Εκκρεμούν στο τμήμα','Pending in the department'):tr('Εκκρεμούν στο νοσοκομείο','Pending in the hospital'),value:programFigures.pending,detail:tr('συμμετοχές σε τρέχοντα προγράμματα','participations in running programmes'),tone:programFigures.pending>0?'warning':'',onClick:()=>setProgramFilter('current')},
  requestsTile,
 ]
 const dueCell=(row: TrainingMyRow)=>{
  if(!row.dueDate)return <td className="training-my-due">—</td>
  const note=row.status==='completed'?(row.completedDate?`${tr('ολοκληρώθηκε','completed')} ${fmt(row.completedDate)}`:''):row.status==='overdue'?(en?`${overdueDurationText(row.dueDate,today,language)} late`:`καθυστέρηση ${overdueDurationText(row.dueDate,today,language)}`):dueInText(row.dueDate,today,language)
  return <td className="training-my-due">{fmt(row.dueDate)}{note&&<small className={row.status==='overdue'?'danger':''}>{note}</small>}</td>
 }
 // The row's one small button (trainingRowAction): the user's own training, or a certificate's download.
 const actionCell=(row: TrainingMyRow,own: boolean)=>{const action=trainingRowAction(row,own);return action==='certificate'?<ExportMenu compact disabled={Boolean(certBusyId)} onPrint={()=>downloadCertificate(row.assignment,row.program)} onPdf={()=>downloadCertificate(row.assignment,row.program,true)}/>:action?<Button variant={action==='result'?'secondary':'primary'} className="training-my-open" loading={openBusyId===row.id} disabled={Boolean(openBusyId)} onClick={event=>{event.stopPropagation();void openTraining(row)}}>{action==='result'?<ClipboardCheck size={14}/>:<PlayCircle size={14}/>}{action==='start'?tr('Έναρξη','Start'):action==='continue'?tr('Συνέχεια','Continue'):tr('Αποτέλεσμα','Result')}</Button>:null}
 const resultText=(row: TrainingMyRow)=>row.result==='review'?tr('Αναμονή ελέγχου','Review pending'):row.result==='score'?`${row.score}%`:row.result==='done'?tr('Ολοκληρώθηκε','Completed'):'—'
 const certificateCell=(row: TrainingMyRow)=>{
  if(!row.certificate)return <td>—</td>
  const until=row.certificate.validUntil
  return <td className="training-my-certificate">{until?<span className={row.certificateState==='expired'?'status-badge danger':row.certificateState==='expiring'?'status-badge warning':''}>{row.certificateState==='expired'?`${tr('Έληξε','Expired')} ${fmt(until)}`:`${tr('Έως','Until')} ${fmt(until)}`}</span>:tr('Χωρίς λήξη','No expiry')}</td>
 }
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
 const participationCell=(row: TrainingProgramRow)=>{
  if(!row.participation)return <td className="training-programme-participation">—</td>
  const {assigned,completed}=row.participation,label=en?`${completed} of ${assigned}`:`${completed} από ${assigned}`
  return <td className="training-programme-participation"><span>{label}</span><Meter value={assigned?completed/assigned*100:0} tone={completed===assigned?'success':'neutral'} label={en?`${completed} of ${assigned} completed`:`${completed} από ${assigned} ολοκλήρωσαν`}/></td>
 }
 const columns=[{key:'title',label:tr('Εκπαίδευση','Training')},{key:'due',label:tr('Προθεσμία','Due')},{key:'status',label:tr('Κατάσταση','Status')},{key:'result',label:tr('Αποτέλεσμα','Result')},{key:'certificate',label:tr('Πιστοποιητικό','Certificate')},{key:'action',label:'',ariaLabel:tr('Ενέργεια','Action')}]
 const programColumns=[{key:'title',label:tr('Εκπαίδευση','Training')},{key:'period',label:tr('Περίοδος','Period')},{key:'audience',label:tr('Απευθύνεται σε','Intended for')},{key:'participation',label:department?tr('Συμμετοχή τμήματος','Department participation'):tr('Συμμετοχή','Participation')},{key:'status',label:tr('Κατάσταση','Status')},{key:'me',label:tr('Εγώ','Me')}]
 const programEmpty=state.programs.length?tr('Κανένα πρόγραμμα σε αυτή την επιλογή.','No programme in this choice.'):tr('Δεν υπάρχουν προγράμματα εκπαίδευσης στο νοσοκομείο.','No training programmes in the hospital.')
 const subtitle=mine?tr('Οι εκπαιδεύσεις σας, οι προθεσμίες και τα πιστοποιητικά σας.','Your trainings, deadlines and certificates.'):department?(en?`The training programmes that concern ${department.nameEn||department.name}.`:`Τα προγράμματα εκπαίδευσης που αφορούν το τμήμα ${department.name}.`):tr('Τα προγράμματα εκπαίδευσης του νοσοκομείου.','The hospital’s training programmes.')
 const emptyTitle=rows.length?tr('Καμία εκπαίδευση σε αυτή την επιλογή.','No training in this choice.'):tr('Δεν σας έχει ανατεθεί εκπαίδευση.','No training is assigned to you.')
 const statusLabel: Record<TrainingProgramFilter, string>={current:tr('Τρέχοντα','Current'),planned:tr('Προγραμματισμένα','Planned'),completed:tr('Ολοκληρωμένα','Completed'),all:tr('Όλα','All')}
 const departmentName=(item: TrainingDepartment)=>en&&item.nameEn?item.nameEn:item.name
 const activeFilters=[
  ...(department?[{key:'department',label:`${tr('Τμήμα','Department')}: ${departmentName(department)}`,onRemove:()=>changeDepartment('all')}]:[]),
  ...(programFilter!=='all'?[{key:'status',label:`${tr('Κατάσταση','Status')}: ${statusLabel[programFilter]}`,onRemove:()=>setProgramFilter('all')}]:[]),
  ...(category!=='all'?[{key:'category',label:`${tr('Κατηγορία','Category')}: ${trainingCategoryLabel(category,language)}`,onRemove:()=>setCategory('all')}]:[]),
 ]
 const viewOptions=[{value:'mine',label:tr('Οι δικές μου','Mine')},...(ownDepartment?[{value:'department',label:tr('Του τμήματός μου','My department')}]:[]),{value:'hospital',label:tr('Όλο το νοσοκομείο','Whole hospital')}]
 const shownView=view==='department'&&!ownDepartment?'hospital':view
 const people=namesOf&&department?departmentPendingPeople(state,namesOf.id,department,today):[]
 return <Page fill className="training-my-page" title={tr('Εκπαίδευση','Training')} subtitle={subtitle} actions={<SegmentedControl ariaLabel={tr('Ποιες εκπαιδεύσεις','Which trainings')} value={shownView} onChange={value=>changeView(value as TrainingMyScope)} options={viewOptions}/>}>
  <div className="dephome-tiles training-my-tiles" style={{'--dephome-tiles':tileList.length}}>
   {tileList.map(tile=><button type="button" key={tile.key} className={`dephome-tile${tile.tone?` is-${tile.tone}`:''}`} onClick={tile.onClick}>
    <span className="dephome-tile-label">{tile.label}</span>
    <span className="dephome-tile-figure"><strong className="dephome-tile-value">{tile.value}</strong></span>
    <small className="dephome-tile-detail">{tile.detail}</small>
   </button>)}
  </div>
  {!mine?<section className="surface registry-workspace training-registry training-my-list workspace-column workspace-fill">
   <FilterBar query={query} onQueryChange={setQuery} placeholder={tr('Αναζήτηση προγράμματος, εκπαιδευτή ή κατηγορίας…','Search programme, trainer or category…')} activeAdvancedCount={activeFilters.length} activeFilters={activeFilters} onClear={()=>{changeDepartment('all');setProgramFilter('all');setCategory('all')}}>
    <FilterSelect label={tr('Τμήμα','Department')} value={departmentId} onChange={changeDepartment}><option value="all">{tr('Όλα','All')}</option>{departmentList.map(item=><option key={item.id} value={item.id}>{departmentName(item)}</option>)}</FilterSelect>
    <FilterSelect label={tr('Κατάσταση','Status')} value={programFilter} onChange={value=>setProgramFilter(value as TrainingProgramFilter)}>{(['current','planned','completed','all'] as TrainingProgramFilter[]).map(value=><option key={value} value={value}>{`${statusLabel[value]} (${programCounts[value]})`}</option>)}</FilterSelect>
    <FilterSelect label={tr('Κατηγορία','Category')} value={category} onChange={setCategory}><option value="all">{tr('Όλες','All')}</option>{categories.map(value=><option key={value} value={value}>{trainingCategoryLabel(value,language)}</option>)}</FilterSelect>
   </FilterBar>
   <RegistryTable className="training-my-table training-hospital-table" sortable={false} columns={programColumns} rows={programPage} emptyTitle={programEmpty} emptyIcon={state.programs.length?undefined:GraduationCap} emptyFiltered={Boolean(programRows.length&&(query||activeFilters.length))} onClearFilters={()=>{setQuery('');changeDepartment('all');setProgramFilter('all');setCategory('all')}}
    rowProps={(row: TrainingProgramRow)=>namesAllowed&&row.participation&&row.participation.completed<row.participation.assigned?{className:'clickable-row',tabIndex:0,title:tr('Ποιοι δεν έχουν ολοκληρώσει','Who has not completed'),onClick:()=>setNamesOf(row),onKeyDown:event=>{if(event.key==='Enter')setNamesOf(row)}}:null}
    renderRow={(row: TrainingProgramRow)=>{const detail=[programDetail(row.program),row.trainer].filter(Boolean).join(' · ');return <tr>
     <td className="training-my-title"><strong title={row.title}>{row.title}</strong>{detail&&<small title={detail}>{detail}</small>}</td>
     <td className="training-my-due">{periodText(row.startDate,row.dueDate)||'—'}</td>
     <td className="training-hospital-audience" title={row.audience}>{row.audience||'—'}</td>
     {participationCell(row)}
     <td><Badge status={row.state}/></td>
     <td className="open-record-cell"><span className="training-hospital-own">{meCell(row)}</span></td>
    </tr>}}/>
   <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={programsShown.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/>
  </section>:<section className="surface registry-workspace training-registry training-my-list workspace-column workspace-fill">
   <FilterBar query={query} onQueryChange={setQuery} placeholder={tr('Αναζήτηση εκπαίδευσης…','Search training…')} end={<SegmentedControl ariaLabel={tr('Κατάσταση','Status')} value={status} onChange={value=>setStatus(value as TrainingMyStatus)} options={[{value:'open',label:`${tr('Σε εξέλιξη','In progress')} (${counts.open})`},{value:'completed',label:`${tr('Ολοκληρωμένες','Completed')} (${counts.completed})`},{value:'all',label:`${tr('Όλες','All')} (${counts.all})`}]}/>}/>
   <RegistryTable className="training-my-table" sortable={false} columns={columns} rows={pageRows} emptyTitle={emptyTitle} emptyIcon={rows.length?undefined:GraduationCap} emptyFiltered={Boolean(rows.length&&query)} onClearFilters={()=>setQuery('')}
    renderRow={(row: TrainingMyRow)=>{const detail=detailOf(row);return <tr>
     <td className="training-my-title"><strong title={row.title}>{row.title}</strong>{detail&&<small>{detail}</small>}{row.times>1&&<small>{en?`${row.times} times · latest ${fmt(row.lastDate)}`:`${row.times} φορές · τελευταία ${fmt(row.lastDate)}`}</small>}</td>
     {dueCell(row)}
     <td><Badge status={row.status}/></td>
     <td className="training-my-result">{resultText(row)}</td>
     {certificateCell(row)}
     <td className="open-record-cell">{actionCell(row,true)}</td>
    </tr>}}/>
   <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/>
  </section>}
  {requesting&&<ObserverDialog width="compact" className="training-request-dialog" eyebrow={tr('Αίτηση συμμετοχής','Request to attend')} title={requesting.title} subtitle={[periodText(requesting.startDate,requesting.dueDate),requesting.trainer].filter(Boolean).join(' · ')||undefined} onClose={()=>setRequesting(null)} footer={<Button loading={requestBusy} disabled={requestBusy} onClick={sendRequest}><Send size={14}/>{tr('Αποστολή αίτησης','Send request')}</Button>}>
   <p className="training-request-intro">{tr('Η αίτηση πηγαίνει στους υπεύθυνους εκπαίδευσης. Όταν γίνει δεκτή, η εκπαίδευση εμφανίζεται στις «Οι δικές μου».','The request goes to the training managers. Once accepted, the training appears under “Mine”.')}</p>
   <Field label={tr('Σημείωση (προαιρετικά)','Note (optional)')}><textarea rows={3} maxLength={1000} value={requestNote} onChange={event=>setRequestNote(event.target.value)} placeholder={tr('Π.χ. γιατί θέλετε να την παρακολουθήσετε','E.g. why you would like to attend')}/></Field>
  </ObserverDialog>}
  {namesOf&&department&&<ObserverDialog width="standard" className="training-names-dialog" eyebrow={departmentName(department)} title={namesOf.title} subtitle={tr('Όσοι του τμήματος δεν έχουν ολοκληρώσει την εκπαίδευση.','The department’s people who have not completed the training.')} onClose={()=>setNamesOf(null)}>
   <RegistryTable className="training-names-table" sortable={false} columns={[{key:'name',label:tr('Εργαζόμενος','Employee')},{key:'status',label:tr('Κατάσταση','Status')},{key:'due',label:tr('Προθεσμία','Due')}]} rows={people} emptyTitle={tr('Δεν βρέθηκαν εκκρεμότητες που μπορείτε να δείτε.','No pending participation you can see.')}
    renderRow={person=><tr><td><strong>{person.name||'—'}</strong></td><td><Badge status={person.status}/></td><td className="training-my-due">{person.dueDate?fmt(person.dueDate):'—'}</td></tr>}/>
  </ObserverDialog>}
 </Page>
}
