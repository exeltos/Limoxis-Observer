import '../dashboard/departmentHome.css'
import './trainingMyView.css'
import { useEffect,useMemo,useState } from 'react'
import { ClipboardCheck,GraduationCap,PlayCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../design-system/Button'
import { Page } from '../../design-system/Page'
import { FilterBar } from '../../design-system/FilterBar'
import { SegmentedControl } from '../../design-system/SegmentedControl'
import { RegistryTable } from '../../design-system/RegistryTable'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { ExportMenu } from '../../design-system/ExportMenu'
import { InactiveEmployeeBadge } from '../../design-system/InactiveEmployeeBadge'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { formatDay } from '../../core/i18n/formatDay'
import { matchesSearch } from '../../core/i18n/searchMatch'
import { hospitalToday } from '../../core/dates/hospitalDate'
import { useCalendarScope } from '../calendar/useCalendarScope'
import { dueInText,overdueDurationText } from '../calendar/calendarView'
import { downloadCertificatePdf } from './trainingCertificate'
import { openOwnTrainingAccessAsync } from './trainingInvitationService'
import { trainingCategoryLabel,trainingMethodLabel,trainingDeliveryKindLabel } from './TrainingProgramForm'
import { TrainingStatusBadge as Badge } from './TrainingStatusBadge'
import { departmentTrainingRows,filterProgramRows,filterTrainingRows,hospitalProgramRows,hospitalProgramTiles,ownTrainingRows,programStatusCounts,trainingRowAction,trainingStatusCounts,trainingTiles,type TrainingMyRow,type TrainingMyScope,type TrainingMyStatus,type TrainingProgramFilter,type TrainingProgramRow } from './trainingMyView'
import type { TrainingState } from './trainingData'
import type { TrainingAssignment, TrainingProgram } from './trainingTypes'

// «Εκπαίδευση» for the departments that do not manage training (owner, 20/11/2026): «Οι δικές μου | Όλο το τμήμα» at the
// top (the Department Manager starts on the department), four figures, then «Σε εξέλιξη | Ολοκληρωμένες | Όλες» with a
// search over a paged list that fills the screen. One small button per row (trainingRowAction): in «Οι δικές μου»
// «Έναρξη» / «Συνέχεια» open the learner's page of the user's own assignment (training_my_access gives its personal
// link), «Αποτέλεσμα» shows a submitted one; the certificate's «Λήψη» where there is a certificate.
// «Όλο το νοσοκομείο» (owner, 20/11/2026): the hospital's programmes (never the participants' names), «Τρέχοντα |
// Προγραμματισμένα | Όλα», «Συμμετέχω» with the user's own button. A hospital-wide role keeps its list of everyone's
// assignments as «Όλο το προσωπικό», so the two choices never share a name.
interface TrainingMyViewProps { state: TrainingState, language: string, managerView: boolean, isDemo: boolean, inactiveCodes: Set<string>, organizationId?: string|null }
const fmt=(v: unknown)=>formatDay(v)
// «31/7 – 29/8/2026» on one line (the year once when both dates fall in it), as the programmes' list.
function periodText(start: string,due: string){
 if(!start)return fmt(due)
 if(!due)return fmt(start)
 if(start.slice(0,4)!==due.slice(0,4))return `${fmt(start)} – ${fmt(due)}`
 return `${fmt(start).replace(/\/\d{4}$/,'')} – ${fmt(due)}`
}

export function TrainingMyView({state,language,managerView,isDemo,inactiveCodes,organizationId=null}: TrainingMyViewProps){
 const en=language==='en',tr=(el: string,enText: string)=>en?enText:el
 const {notify,notifyError}=useFeedback(),navigate=useNavigate()
 const scope=useCalendarScope(),today=hospitalToday()
 const [view,setView]=useState<TrainingMyScope>(managerView?'department':'mine'),[status,setStatus]=useState<TrainingMyStatus>('open'),[programFilter,setProgramFilter]=useState<TrainingProgramFilter>('current'),[query,setQuery]=useState(''),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(15),[certBusyId,setCertBusyId]=useState<string|null>(null),[openBusyId,setOpenBusyId]=useState<string|null>(null)
 // The database keeps a department's rows to the department; the sample data is kept by the department's name.
 const departments=isDemo&&!scope.all&&scope.departments.length?scope.departments:null
 const mine=view==='mine',hospital=view==='hospital'
 const rows=useMemo(()=>hospital?[]:mine?ownTrainingRows(state,scope,today):departmentTrainingRows(state,today,departments),[hospital,mine,state,scope,today,departments])
 const tiles=trainingTiles(rows,today,mine?{records:state,own:scope}:null),counts=trainingStatusCounts(rows)
 const programDetail=(program: TrainingProgram|null|undefined)=>[program?.category?trainingCategoryLabel(program.category,language):'',program?.deliveryKind?trainingDeliveryKindLabel(program.deliveryKind,language):program?.method?trainingMethodLabel(program.method,language):''].filter(part=>part&&part!=='—').join(' · ')
 const detailOf=(row: TrainingMyRow)=>programDetail(row.program)
 const filtered=useMemo(()=>filterTrainingRows(rows,status).filter(row=>matchesSearch(query,[row.title,row.employeeName,row.department,detailOf(row)])),[rows,status,query])// eslint-disable-line react-hooks/exhaustive-deps
 // «Όλο το νοσοκομείο»: the programmes, their own filter and figures.
 const programRows=useMemo(()=>hospital?hospitalProgramRows(state,scope,today):[],[hospital,state,scope,today])
 const programTiles=hospitalProgramTiles(programRows,today),programCounts=programStatusCounts(programRows)
 const programsShown=useMemo(()=>filterProgramRows(programRows,programFilter,query,(row: TrainingProgramRow)=>[programDetail(row.program)]),[programRows,programFilter,query])// eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>setPage(1),[view,status,programFilter,query,pageSize])
 const shownCount=hospital?programsShown.length:filtered.length
 const totalPages=Math.max(1,Math.ceil(shownCount/pageSize)),safePage=Math.min(page,totalPages),pageRows=filtered.slice((safePage-1)*pageSize,safePage*pageSize),programPage=programsShown.slice((safePage-1)*pageSize,safePage*pageSize)
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
 const whole=scope.all?tr('Όλο το προσωπικό','All staff'):tr('Όλο το τμήμα','Whole department')
 const expired=tiles.certificates.expired
 const programTileList=[
  {key:'current',label:tr('Προγράμματα σε εξέλιξη','Programmes in progress'),value:programTiles.current,detail:tr('τρέχουν τώρα στο νοσοκομείο','running now in the hospital'),tone:'',onClick:()=>setProgramFilter('current')},
  {key:'planned',label:tr('Προγραμματισμένα','Planned'),value:programTiles.planned,detail:programTiles.nextStart?`${tr('επόμενο','next')} ${fmt(programTiles.nextStart)}`:tr('κανένα επόμενο','none upcoming'),tone:'',onClick:()=>setProgramFilter('planned')},
  {key:'completed',label:tr('Ολοκληρωμένα φέτος','Completed this year'),value:programTiles.completedYear,detail:`${tr('έτος','year')} ${today.slice(0,4)}`,tone:'',onClick:()=>setProgramFilter('all')},
  {key:'own',label:tr('Συμμετέχω σε','I take part in'),value:programTiles.own,detail:!programTiles.own?tr('σε κανένα πρόγραμμα ακόμη','in no programme yet'):programTiles.ownOpen?(en?`${programTiles.ownOpen} still to complete`:`${programTiles.ownOpen} να ολοκληρώσω`):tr('όλα ολοκληρωμένα','all completed'),tone:'',onClick:()=>{setStatus('all');setView('mine')}},
 ]
 const tileList=hospital?programTileList:[
  {key:'open',label:mine?tr('Να ολοκληρώσω','To complete'):tr('Προς ολοκλήρωση','Still to complete'),value:tiles.open,detail:tiles.nextDue?`${tr('επόμενη προθεσμία','next due')} ${fmt(tiles.nextDue)}`:tr('καμία επόμενη προθεσμία','no upcoming deadline'),tone:'',onClick:()=>setStatus('open')},
  {key:'overdue',label:tr('Εκπρόθεσμες','Overdue'),value:tiles.overdue,detail:tr('πέρασε η προθεσμία','past the deadline'),tone:tiles.overdue>0?'danger':'',onClick:()=>setStatus('open')},
  {key:'completed',label:tr('Ολοκληρωμένες','Completed'),value:tiles.completedYear,detail:tr('τελευταίος χρόνος','last 12 months'),tone:'',onClick:()=>setStatus('completed')},
  {key:'certificates',label:tr('Πιστοποιητικά που λήγουν','Certificates expiring'),value:tiles.certificates.count,detail:expired?(en?`${expired} expired · others within 90 days`:`${expired} ${expired===1?'έληξε':'έληξαν'} · τα άλλα σε 90 ημέρες`):tr('σε 90 ημέρες','within 90 days'),tone:tiles.certificates.count>0?'warning':'',onClick:()=>setStatus('all')},
 ]
 const dueCell=(row: TrainingMyRow)=>{
  if(!row.dueDate)return <td className="training-my-due">—</td>
  const note=row.status==='completed'?(row.completedDate?`${tr('ολοκληρώθηκε','completed')} ${fmt(row.completedDate)}`:''):row.status==='overdue'?(en?`${overdueDurationText(row.dueDate,today,language)} late`:`καθυστέρηση ${overdueDurationText(row.dueDate,today,language)}`):dueInText(row.dueDate,today,language)
  return <td className="training-my-due">{fmt(row.dueDate)}{note&&<small className={row.status==='overdue'?'danger':''}>{note}</small>}</td>
 }
 // The row's one small button (trainingRowAction): the user's own training, or a certificate's download.
 const actionCell=(row: TrainingMyRow,own: boolean)=>{const action=trainingRowAction(row,own);return action==='certificate'?<ExportMenu compact disabled={Boolean(certBusyId)} onPrint={()=>downloadCertificate(row.assignment,row.program)} onPdf={()=>downloadCertificate(row.assignment,row.program,true)}/>:action?<Button variant={action==='result'?'secondary':'primary'} className="training-my-open" loading={openBusyId===row.id} disabled={Boolean(openBusyId)} onClick={()=>openTraining(row)}>{action==='result'?<ClipboardCheck size={14}/>:<PlayCircle size={14}/>}{action==='start'?tr('Έναρξη','Start'):action==='continue'?tr('Συνέχεια','Continue'):tr('Αποτέλεσμα','Result')}</Button>:null}
 const resultText=(row: TrainingMyRow)=>row.result==='review'?tr('Αναμονή ελέγχου','Review pending'):row.result==='score'?`${row.score}%`:row.result==='done'?tr('Ολοκληρώθηκε','Completed'):'—'
 const certificateCell=(row: TrainingMyRow)=>{
  if(!row.certificate)return <td>—</td>
  const until=row.certificate.validUntil
  return <td className="training-my-certificate">{until?<span className={row.certificateState==='expired'?'status-badge danger':row.certificateState==='expiring'?'status-badge warning':''}>{row.certificateState==='expired'?`${tr('Έληξε','Expired')} ${fmt(until)}`:`${tr('Έως','Until')} ${fmt(until)}`}</span>:tr('Χωρίς λήξη','No expiry')}</td>
 }
 const columns=[...(mine?[]:[{key:'employee',label:tr('Εργαζόμενος','Employee')}]),{key:'title',label:tr('Εκπαίδευση','Training')},{key:'due',label:tr('Προθεσμία','Due')},{key:'status',label:tr('Κατάσταση','Status')},{key:'result',label:tr('Αποτέλεσμα','Result')},{key:'certificate',label:tr('Πιστοποιητικό','Certificate')},{key:'action',label:'',ariaLabel:mine?tr('Ενέργεια','Action'):tr('Λήψη πιστοποιητικού','Certificate download')}]
 const programColumns=[{key:'title',label:tr('Εκπαίδευση','Training')},{key:'trainer',label:tr('Εκπαιδευτής','Trainer')},{key:'period',label:tr('Περίοδος','Period')},{key:'audience',label:tr('Απευθύνεται σε','Intended for')},{key:'status',label:tr('Κατάσταση','Status')},{key:'own',label:tr('Η συμμετοχή μου','My participation')}]
 const programEmpty=programRows.length?tr('Κανένα πρόγραμμα σε αυτή την επιλογή.','No programme in this choice.'):tr('Δεν υπάρχουν προγράμματα εκπαίδευσης στο νοσοκομείο.','No training programmes in the hospital.')
 const subtitle=hospital?tr('Τα προγράμματα εκπαίδευσης του νοσοκομείου και όσα παρακολουθείτε.','The hospital’s training programmes and the ones you attend.'):mine?tr('Οι εκπαιδεύσεις σας, οι προθεσμίες και τα πιστοποιητικά σας.','Your trainings, deadlines and certificates.'):scope.all?tr('Οι εκπαιδεύσεις του προσωπικού, οι προθεσμίες και τα πιστοποιητικά τους.','The staff’s trainings, deadlines and certificates.'):tr('Οι εκπαιδεύσεις των εργαζομένων του τμήματος, οι προθεσμίες και τα πιστοποιητικά τους.','The department’s staff trainings, deadlines and certificates.')
 const emptyTitle=rows.length?tr('Καμία εκπαίδευση σε αυτή την επιλογή.','No training in this choice.'):mine?tr('Δεν σας έχει ανατεθεί εκπαίδευση.','No training is assigned to you.'):tr('Δεν υπάρχουν εκπαιδεύσεις στο τμήμα.','No training in the department.')
 return <Page fill className="training-my-page" title={tr('Εκπαίδευση','Training')} subtitle={subtitle} actions={<SegmentedControl ariaLabel={tr('Ποιες εκπαιδεύσεις','Which trainings')} value={view} onChange={value=>setView(value as TrainingMyScope)} options={[{value:'mine',label:tr('Οι δικές μου','Mine')},{value:'department',label:whole},{value:'hospital',label:tr('Όλο το νοσοκομείο','Whole hospital')}]}/>}>
  <div className="dephome-tiles training-my-tiles" style={{'--dephome-tiles':tileList.length}}>
   {tileList.map(tile=><button type="button" key={tile.key} className={`dephome-tile${tile.tone?` is-${tile.tone}`:''}`} onClick={tile.onClick}>
    <span className="dephome-tile-label">{tile.label}</span>
    <span className="dephome-tile-figure"><strong className="dephome-tile-value">{tile.value}</strong></span>
    <small className="dephome-tile-detail">{tile.detail}</small>
   </button>)}
  </div>
  {hospital?<section className="surface registry-workspace training-registry training-my-list workspace-column workspace-fill">
   <FilterBar query={query} onQueryChange={setQuery} placeholder={tr('Αναζήτηση προγράμματος, εκπαιδευτή ή τμήματος…','Search programme, trainer or department…')} end={<SegmentedControl ariaLabel={tr('Κατάσταση','Status')} value={programFilter} onChange={value=>setProgramFilter(value as TrainingProgramFilter)} options={[{value:'current',label:`${tr('Τρέχοντα','Current')} (${programCounts.current})`},{value:'planned',label:`${tr('Προγραμματισμένα','Planned')} (${programCounts.planned})`},{value:'all',label:`${tr('Όλα','All')} (${programCounts.all})`}]}/>}/>
   <RegistryTable className="training-my-table training-hospital-table" sortable={false} columns={programColumns} rows={programPage} emptyTitle={programEmpty} emptyIcon={programRows.length?undefined:GraduationCap} emptyFiltered={Boolean(programRows.length&&query)} onClearFilters={()=>setQuery('')}
    renderRow={(row: TrainingProgramRow)=>{const detail=programDetail(row.program);return <tr>
     <td className="training-my-title"><strong title={row.title}>{row.title}</strong>{detail&&<small>{detail}</small>}</td>
     <td className="training-hospital-trainer" title={row.trainer}>{row.trainer||'—'}</td>
     <td className="training-my-due">{periodText(row.startDate,row.dueDate)||'—'}</td>
     <td className="training-hospital-audience" title={row.audience}>{row.audience||'—'}</td>
     <td><Badge status={row.state}/></td>
     <td className="open-record-cell"><span className="training-hospital-own">{row.own&&<span className="status-badge info">{tr('Συμμετέχω','Participating')}</span>}{row.own&&actionCell(row.own,true)}</span></td>
    </tr>}}/>
   <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={programsShown.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/>
  </section>:<section className="surface registry-workspace training-registry training-my-list workspace-column workspace-fill">
   <FilterBar query={query} onQueryChange={setQuery} placeholder={mine?tr('Αναζήτηση εκπαίδευσης…','Search training…'):tr('Αναζήτηση εργαζομένου ή εκπαίδευσης…','Search employee or training…')} end={<SegmentedControl ariaLabel={tr('Κατάσταση','Status')} value={status} onChange={value=>setStatus(value as TrainingMyStatus)} options={[{value:'open',label:`${tr('Σε εξέλιξη','In progress')} (${counts.open})`},{value:'completed',label:`${tr('Ολοκληρωμένες','Completed')} (${counts.completed})`},{value:'all',label:`${tr('Όλες','All')} (${counts.all})`}]}/>}/>
   <RegistryTable className="training-my-table" sortable={false} columns={columns} rows={pageRows} emptyTitle={emptyTitle} emptyIcon={rows.length?undefined:GraduationCap} emptyFiltered={Boolean(rows.length&&query)} onClearFilters={()=>setQuery('')}
    renderRow={(row: TrainingMyRow)=>{const inactive=!mine&&inactiveCodes.has(String(row.assignment.employeeId||''));const detail=detailOf(row);return <tr className={inactive?'inactive-employee-row':undefined}>
     {!mine&&<td className="training-my-person"><strong>{row.employeeName||'—'}</strong><InactiveEmployeeBadge inactive={inactive}/>{scope.all&&row.department&&<small>{row.department}</small>}</td>}
     <td className="training-my-title"><strong title={row.title}>{row.title}</strong>{detail&&<small>{detail}</small>}{mine&&row.times>1&&<small>{en?`${row.times} times · latest ${fmt(row.lastDate)}`:`${row.times} φορές · τελευταία ${fmt(row.lastDate)}`}</small>}</td>
     {dueCell(row)}
     <td><Badge status={row.status}/></td>
     <td className="training-my-result">{resultText(row)}</td>
     {certificateCell(row)}
     <td className="open-record-cell">{actionCell(row,mine)}</td>
    </tr>}}/>
   <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/>
  </section>}
 </Page>
}
