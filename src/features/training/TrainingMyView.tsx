import '../dashboard/departmentHome.css'
import './trainingMyView.css'
import { useEffect,useMemo,useState } from 'react'
import { GraduationCap } from 'lucide-react'
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
import { trainingCategoryLabel,trainingMethodLabel,trainingDeliveryKindLabel } from './TrainingProgramForm'
import { TrainingStatusBadge as Badge } from './TrainingStatusBadge'
import { departmentTrainingRows,filterTrainingRows,ownTrainingRows,trainingStatusCounts,trainingTiles,type TrainingMyRow,type TrainingMyScope,type TrainingMyStatus } from './trainingMyView'
import type { TrainingState } from './trainingData'
import type { TrainingAssignment, TrainingProgram } from './trainingTypes'

// «Εκπαίδευση» for the departments that do not manage training (owner, 20/11/2026): «Οι δικές μου | Όλο το τμήμα» at the
// top (the Department Manager starts on the department), four figures, then «Σε εξέλιξη | Ολοκληρωμένες | Όλες» with a
// search over a paged list that fills the screen. One small button per row: the certificate's «Λήψη». A learner starts or
// continues a training from the link of the invitation e-mail (training-access): the list has no start button.
interface TrainingMyViewProps { state: TrainingState, language: string, managerView: boolean, isDemo: boolean, inactiveCodes: Set<string> }
const fmt=(v: unknown)=>formatDay(v)

export function TrainingMyView({state,language,managerView,isDemo,inactiveCodes}: TrainingMyViewProps){
 const en=language==='en',tr=(el: string,enText: string)=>en?enText:el
 const {notify}=useFeedback()
 const scope=useCalendarScope(),today=hospitalToday()
 const [view,setView]=useState<TrainingMyScope>(managerView?'department':'mine'),[status,setStatus]=useState<TrainingMyStatus>('open'),[query,setQuery]=useState(''),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(15),[certBusyId,setCertBusyId]=useState<string|null>(null)
 // The database keeps a department's rows to the department; the sample data is kept by the department's name.
 const departments=isDemo&&!scope.all&&scope.departments.length?scope.departments:null
 const mine=view==='mine'
 const rows=useMemo(()=>mine?ownTrainingRows(state,scope,today):departmentTrainingRows(state,today,departments),[mine,state,scope,today,departments])
 const tiles=trainingTiles(rows,today,mine?{records:state,own:scope}:null),counts=trainingStatusCounts(rows)
 const detailOf=(row: TrainingMyRow)=>[row.program?.category?trainingCategoryLabel(row.program.category,language):'',row.program?.deliveryKind?trainingDeliveryKindLabel(row.program.deliveryKind,language):row.program?.method?trainingMethodLabel(row.program.method,language):''].filter(Boolean).join(' · ')
 const filtered=useMemo(()=>filterTrainingRows(rows,status).filter(row=>matchesSearch(query,[row.title,row.employeeName,row.department,detailOf(row)])),[rows,status,query])// eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>setPage(1),[view,status,query,pageSize])
 const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize)),safePage=Math.min(page,totalPages),pageRows=filtered.slice((safePage-1)*pageSize,safePage*pageSize)
 async function downloadCertificate(row: TrainingAssignment,program: TrainingProgram|null|undefined,pdf=false){
  const certificate=row.certificateId?(state.certificates||[]).find(c=>c.id===row.certificateId):(state.certificates||[]).find(c=>c.assignmentId===row.id)
  if(certBusyId||!certificate)return
  setCertBusyId(row.id)
  try{await downloadCertificatePdf({certificate,program,participantName:row.employeeName,en,pdf})}
  catch(error){notify((error as Error)?.message||(en?'Could not export the certificate.':'Δεν ήταν δυνατή η εξαγωγή του πιστοποιητικού.'),'danger')}
  finally{setCertBusyId(null)}
 }
 const whole=scope.all?tr('Όλο το νοσοκομείο','Whole hospital'):tr('Όλο το τμήμα','Whole department')
 const expired=tiles.certificates.expired
 const tileList=[
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
 const resultText=(row: TrainingMyRow)=>row.result==='review'?tr('Αναμονή ελέγχου','Review pending'):row.result==='score'?`${row.score}%`:row.result==='done'?tr('Ολοκληρώθηκε','Completed'):'—'
 const certificateCell=(row: TrainingMyRow)=>{
  if(!row.certificate)return <td>—</td>
  const until=row.certificate.validUntil
  return <td className="training-my-certificate">{until?<span className={row.certificateState==='expired'?'status-badge danger':row.certificateState==='expiring'?'status-badge warning':''}>{row.certificateState==='expired'?`${tr('Έληξε','Expired')} ${fmt(until)}`:`${tr('Έως','Until')} ${fmt(until)}`}</span>:tr('Χωρίς λήξη','No expiry')}</td>
 }
 const columns=[...(mine?[]:[{key:'employee',label:tr('Εργαζόμενος','Employee')}]),{key:'title',label:tr('Εκπαίδευση','Training')},{key:'due',label:tr('Προθεσμία','Due')},{key:'status',label:tr('Κατάσταση','Status')},{key:'result',label:tr('Αποτέλεσμα','Result')},{key:'certificate',label:tr('Πιστοποιητικό','Certificate')},{key:'action',label:'',ariaLabel:tr('Λήψη πιστοποιητικού','Certificate download')}]
 const emptyTitle=rows.length?tr('Καμία εκπαίδευση σε αυτή την επιλογή.','No training in this choice.'):mine?tr('Δεν σας έχει ανατεθεί εκπαίδευση.','No training is assigned to you.'):tr('Δεν υπάρχουν εκπαιδεύσεις στο τμήμα.','No training in the department.')
 return <Page fill className="training-my-page" title={tr('Εκπαίδευση','Training')} subtitle={mine?tr('Οι εκπαιδεύσεις σας, οι προθεσμίες και τα πιστοποιητικά σας.','Your trainings, deadlines and certificates.'):tr('Οι εκπαιδεύσεις των εργαζομένων του τμήματος, οι προθεσμίες και τα πιστοποιητικά τους.','The department’s staff trainings, deadlines and certificates.')} actions={<SegmentedControl ariaLabel={tr('Ποιες εκπαιδεύσεις','Which trainings')} value={view} onChange={value=>setView(value as TrainingMyScope)} options={[{value:'mine',label:tr('Οι δικές μου','Mine')},{value:'department',label:whole}]}/>}>
  <div className="dephome-tiles training-my-tiles" style={{'--dephome-tiles':tileList.length}}>
   {tileList.map(tile=><button type="button" key={tile.key} className={`dephome-tile${tile.tone?` is-${tile.tone}`:''}`} onClick={tile.onClick}>
    <span className="dephome-tile-label">{tile.label}</span>
    <span className="dephome-tile-figure"><strong className="dephome-tile-value">{tile.value}</strong></span>
    <small className="dephome-tile-detail">{tile.detail}</small>
   </button>)}
  </div>
  <section className="surface registry-workspace training-registry training-my-list workspace-column workspace-fill">
   <FilterBar query={query} onQueryChange={setQuery} placeholder={mine?tr('Αναζήτηση εκπαίδευσης…','Search training…'):tr('Αναζήτηση εργαζομένου ή εκπαίδευσης…','Search employee or training…')} end={<SegmentedControl ariaLabel={tr('Κατάσταση','Status')} value={status} onChange={value=>setStatus(value as TrainingMyStatus)} options={[{value:'open',label:`${tr('Σε εξέλιξη','In progress')} (${counts.open})`},{value:'completed',label:`${tr('Ολοκληρωμένες','Completed')} (${counts.completed})`},{value:'all',label:`${tr('Όλες','All')} (${counts.all})`}]}/>}/>
   <RegistryTable className="training-my-table" sortable={false} columns={columns} rows={pageRows} emptyTitle={emptyTitle} emptyIcon={rows.length?undefined:GraduationCap} emptyFiltered={Boolean(rows.length&&query)} onClearFilters={()=>setQuery('')}
    renderRow={(row: TrainingMyRow)=>{const inactive=!mine&&inactiveCodes.has(String(row.assignment.employeeId||''));const detail=detailOf(row);return <tr className={inactive?'inactive-employee-row':undefined}>
     {!mine&&<td className="training-my-person"><strong>{row.employeeName||'—'}</strong><InactiveEmployeeBadge inactive={inactive}/>{scope.all&&row.department&&<small>{row.department}</small>}</td>}
     <td className="training-my-title"><strong title={row.title}>{row.title}</strong>{detail&&<small>{detail}</small>}{mine&&row.times>1&&<small>{en?`${row.times} times · latest ${fmt(row.lastDate)}`:`${row.times} φορές · τελευταία ${fmt(row.lastDate)}`}</small>}</td>
     {dueCell(row)}
     <td><Badge status={row.status}/></td>
     <td className="training-my-result">{resultText(row)}</td>
     {certificateCell(row)}
     <td className="open-record-cell">{row.certificate&&<ExportMenu compact disabled={Boolean(certBusyId)} onPrint={()=>downloadCertificate(row.assignment,row.program)} onPdf={()=>downloadCertificate(row.assignment,row.program,true)}/>}</td>
    </tr>}}/>
   <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/>
  </section>
 </Page>
}
