import { formatDay } from '../../core/i18n/formatDay'
import { useCallback,useEffect,useMemo,useRef,useState } from 'react'
import { useLocation,useNavigate,useParams } from 'react-router-dom'
import { Award, BookOpenCheck, CalendarRange, CheckCircle2, ClipboardCheck, FileText, Pencil, Plus, Send, Trash2, Users, XCircle } from 'lucide-react'
import './trainingRecord.css'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { AttachmentField } from '../../design-system/AttachmentField'
import { FilterBar,FilterDate,FilterSelect } from '../../design-system/FilterBar'

import { RecordTabPanel } from '../../design-system/RecordTabPanel'
import { formatActiveTime, loadProgramMaterialTimes } from './trainingMaterialTime'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { RecordActions } from '../../design-system/RecordActions'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { RegistryEmptyState } from '../../design-system/RegistryEmptyState'
import { RouteLoading } from '../../design-system/RouteLoading'
import { UI_ACTIONS } from '../../core/actions/actionPolicy'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { useEmployeesData } from '../employees/useEmployeesData'
import { InactiveEmployeeBadge, inactiveEmployeeCodes } from '../../design-system/InactiveEmployeeBadge'
import { loadDepartments } from '../management/departmentsService'
import { demoLibrarySeed } from '../management/managementData'
import { CAPABILITIES,ROLES,can } from '../../core/permissions/roles'
import { computedAssignmentStatus } from './trainingData'
import { deleteTrainingRecordAsync,deleteTrainingRequirementAsync,loadTrainingProgramDetailAsync,loadTrainingStateAsync,saveManagedTrainingStateAsync,saveTrainingRequirementAsync } from './trainingService'
import { sendTrainingInvitationsAsync } from './trainingInvitationService'
import { TrainingProgramForm,trainingProgramIsValid,trainingCategoryLabel,trainingMethodLabel,TrainingProgramDetails } from './TrainingProgramForm'
import { TrainingParticipantsDialog } from './TrainingParticipantsDialog'
import { TrainingAssessmentEditor } from './TrainingAssessmentEditor'
import { TrainingResultsReview } from './TrainingResultsReview'
import { downloadCertificatePdf } from './trainingCertificate'
import { exportRegistry,printRegistry,registryItems,trainingParticipationExport,trainingProgramsExport } from '../../core/export/registryExports'
import { ExcelFieldsDialog,pickColumns,tableFields } from '../../design-system/ExcelFieldsDialog'
import { RegistryTotals } from '../../design-system/RegistryTotals'
import { ExportMenu } from '../../design-system/ExportMenu'
import { CanonicalTabs } from '../../design-system/CanonicalTabs'
import { TrainingCompetencePanel } from './TrainingCompetencePanel'
import { TrainingAnnualPlanPanel,planStateText } from './TrainingAnnualPlanPanel'
import { annualPlanExport,annualTrainingPlan } from './trainingAnnualPlan'
import { isStaffEmployee } from '../employees/staffCategory'

const fmt=v=>formatDay(v)
// «31/7 – 29/8/2026» on one line (the year once when both dates fall in it).
function periodText(start,due){
 if(!start)return fmt(due)
 if(!due)return fmt(start)
 if(String(start).slice(0,4)!==String(due).slice(0,4))return `${fmt(start)} – ${fmt(due)}`
 return `${fmt(start).replace(/\/\d{4}$/,'')} – ${fmt(due)}`
}
const labels={active:['Ενεργό','Active'],planned:['Προγραμματισμένο','Planned'],completed:['Ολοκληρωμένο','Completed'],assigned:['Ανατέθηκε','Assigned'],in_progress:['Σε εξέλιξη','In progress'],overdue:['Εκπρόθεσμο','Overdue'],cancelled:['Ακυρώθηκε','Cancelled']}
const blankState={programs:[],assignments:[],certificates:[],emailOutbox:[],history:[]}
const isActiveEmployee=employee=>!employee?.employmentStatus||String(employee.employmentStatus).toLowerCase()==='active'
// Hospital staff only: collaborating physicians and external collaborators can attend a training (participant picker)
// but are not counted in coverage and plans.
const isActiveStaff=employee=>isStaffEmployee(employee)&&isActiveEmployee(employee)
// The register holds lean rows; the open programme's details (questions, answers, evaluations) go over them.
function withProgramDetail(state,detail){
 if(!detail?.program)return state
 const id=detail.program.id,byId=new Map(detail.assignments.map(a=>[a.id,a]))
 return {...state,programs:state.programs.map(p=>p.id===id?{...p,...detail.program}:p),assignments:state.assignments.map(a=>a.programId===id&&byId.has(a.id)?{...a,...byId.get(a.id)}:a)}
}

export function TrainingProductionPage(){
 const {programId}=useParams(),navigate=useNavigate(),location=useLocation(),registry=useRegistryMemory('training-programs'),{language,t}=useLanguage(),en=language==='en',{tenant,role,membership,isDemo}=useTenant(),{notify,notifyError,confirm}=useFeedback(),{data:employees}=useEmployeesData()
 const printBlocked=()=>notify(en?'Allow pop-ups to print.':'Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.','error')
 const [leanState,setState]=useState(blankState),[detail,setDetail]=useState(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[query,setQuery]=useState(''),[status,setStatus]=useState('all'),[category,setCategory]=useState('all'),[dateFrom,setDateFrom]=useState(''),[dateTo,setDateTo]=useState(''),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(15),[departments,setDepartments]=useState([]),[sort,setSort]=useState({key:'title',dir:'asc'}),[trainingView,setTrainingView]=useState('programs'),[excelOpen,setExcelOpen]=useState(false)
 const canManage=can(role,CAPABILITIES.MANAGE_TRAINING,membership?.capabilities??[],membership?.customCapabilities??[]),managerView=role===ROLES.DEPARTMENT_MANAGER&&!canManage,employeeView=!canManage&&!managerView
 const openKey=useRef(programId);openKey.current=programId
 const loadDetail=useCallback(async key=>key&&canManage?{key,...await loadTrainingProgramDetailAsync(tenant.id,key)}:null,[tenant?.id,canManage])
 const detailOrLeave=useCallback(key=>loadDetail(key).catch(error=>{notifyError(error,'load',{operation:'training_program_load'});navigate('/training');return null}),[loadDetail,notifyError,navigate])
 const readAll=useCallback(async withDetail=>{if(!tenant?.id)return;setLoading(true);try{const [next,nextDetail]=await Promise.all([loadTrainingStateAsync(tenant.id),withDetail?detailOrLeave(openKey.current):undefined]);setState(next);if(withDetail)setDetail(nextDetail)}catch(error){notifyError(error,'load',{operation:'training_load'})}finally{setLoading(false)}},[tenant?.id,notifyError,detailOrLeave])
 const reload=useCallback(()=>readAll(true),[readAll])
 useEffect(()=>{void readAll(false)},[readAll])
 // Opening a programme reads its details; until they arrive the record waits (a save never goes out from a lean row).
 useEffect(()=>{let active=true;if(!programId||!canManage||!tenant?.id)return()=>{active=false};void detailOrLeave(programId).then(next=>{if(active&&next)setDetail(next)});return()=>{active=false}},[programId,canManage,tenant?.id,detailOrLeave])
 const state=useMemo(()=>detail?.key===programId?withProgramDetail(leanState,detail):leanState,[leanState,detail,programId])
 // loadDepartments is a plain cloud call with no demo awareness — calling it
 // with tenant.id='demo-hospital' (not a real UUID) fails with a Postgres 400.
 useEffect(()=>{let active=true;if(isDemo){setDepartments(demoLibrarySeed.departments.map(([elName,enName])=>({id:elName,name:elName,nameEn:enName})));return()=>{active=false}}if(!tenant?.id)return;loadDepartments(tenant.id).then(rows=>{if(active)setDepartments((rows||[]).filter(x=>x.is_active!==false))}).catch(()=>{if(active)setDepartments([])});return()=>{active=false}},[isDemo,tenant?.id])
 async function persist(next,success){if(!canManage)return false;setBusy(true);try{const saved=await saveManagedTrainingStateAsync(tenant.id,next),nextDetail=await detailOrLeave(openKey.current);setState(saved);setDetail(nextDetail);if(success)notify(success,'success');return true}catch(error){notifyError(error,'save',{operation:'training_save'});return false}finally{setBusy(false)}}
 const [planYear,setPlanYear]=useState(()=>new Date().getFullYear())
 // «Competence» reports its figures and its «Export» up to the page (cards and top bar).
 const [,setCompetence]=useState(null),[competenceExport,setCompetenceExport]=useState(null)
 const annualPlan=useMemo(()=>annualTrainingPlan({programs:state.programs,assignments:state.assignments,certificates:state.certificates,requirements:state.requirements||[],employees:(employees||[]).filter(isActiveStaff),year:planYear}),[state,employees,planYear])
 const assignments=useMemo(()=>state.assignments.map(x=>({...x,computedStatus:computedAssignmentStatus(x)})),[state.assignments])
 const programs=state.programs.filter(x=>(status==='all'||x.status===status)&&(category==='all'||x.category===category)&&programInRange(x,dateFrom,dateTo)&&`${x.id} ${x.title} ${x.owner} ${x.trainer} ${x.audience}`.toLowerCase().includes(query.toLowerCase())),categories=[...new Set(state.programs.map(x=>x.category).filter(Boolean))]
 const participantCounts=useMemo(()=>{const map=new Map();for(const a of assignments){const item=map.get(a.programId)||{total:0,done:0};item.total+=1;if(a.computedStatus==='completed')item.done+=1;map.set(a.programId,item)}return map},[assignments])
 const programSortAccessors=useMemo(()=>({title:x=>x.title||'',trainer:x=>x.trainer||x.owner||'',audience:x=>x.audience||'',period:x=>x.dueDate||x.startDate||'',participants:x=>participantCounts.get(x.id)?.total??0,status:x=>labels[x.status]?.[en?1:0]||x.status||''}),[en,participantCounts])
 const sortedPrograms=useMemo(()=>{const list=[...programs];const get=programSortAccessors[sort.key]||programSortAccessors.title;list.sort((a,b)=>{const av=get(a),bv=get(b);const cmp=typeof av==='number'&&typeof bv==='number'?av-bv:String(av).localeCompare(String(bv),language);return sort.dir==='asc'?cmp:-cmp});return list},[programs,sort,programSortAccessors,language])
 function toggleProgramSort(key){setSort(current=>current.key===key?{key,dir:current.dir==='asc'?'desc':'asc'}:{key,dir:'asc'})}
  useEffect(()=>setPage(1),[query,status,category,dateFrom,dateTo,pageSize])
 const totalPages=Math.max(1,Math.ceil(programs.length/pageSize)),safePage=Math.min(page,totalPages),pagedPrograms=sortedPrograms.slice((safePage-1)*pageSize,safePage*pageSize)
 const selected=state.programs.find(x=>x.id===programId),selectedAssignments=selected?assignments.filter(x=>x.programId===selected.id):[]
 const overdue=assignments.filter(x=>x.computedStatus==='overdue').length
 if(loading||(selected&&canManage&&(detail?.key!==programId||(!isDemo&&!detail.program))))return <RouteLoading/>
 if(selected&&canManage)return <ProgramRecord en={en} language={language} organizationId={tenant.id} program={selected} assignments={selectedAssignments} state={state} employees={employees||[]} departments={departments} busy={busy} notify={notify} notifyError={notifyError} confirm={confirm} reload={reload} onBack={location.state?.limoxisFrom?undefined:()=>navigate('/training')} onPersist={persist} onDelete={async()=>{if(selectedAssignments.length){notify(en?'The program has participants and cannot be deleted.':'Το πρόγραμμα έχει συμμετέχοντες και δεν μπορεί να διαγραφεί.','warning');return}if(!await confirm({title:en?'Delete program':'Διαγραφή προγράμματος',message:en?'Delete this training program?':'Να διαγραφεί το πρόγραμμα εκπαίδευσης;',danger:true}))return;await deleteTrainingRecordAsync(tenant.id,selected.id);navigate('/training');await reload()}}/>
 async function saveRequirement(requirement){setBusy(true);try{setState(await saveTrainingRequirementAsync(tenant.id,requirement,state));notify(en?'Requirement saved.':'Η απαίτηση αποθηκεύτηκε.','success');return true}catch(error){notifyError(error,'save',{operation:'training_requirement_save'});return false}finally{setBusy(false)}}
 async function removeRequirement(requirement){if(!await confirm({title:en?'Delete requirement':'Διαγραφή απαίτησης',message:en?`Delete “${requirement.title}”? Completed training records are not affected.`:`Να διαγραφεί η απαίτηση «${requirement.title}»; Οι ολοκληρωμένες εκπαιδεύσεις δεν επηρεάζονται.`,danger:true}))return;setBusy(true);try{setState(await deleteTrainingRequirementAsync(tenant.id,requirement.id,state));notify(en?'Requirement deleted.':'Η απαίτηση διαγράφηκε.','success')}catch(error){notifyError(error,'delete',{operation:'training_requirement_delete'})}finally{setBusy(false)}}
 function pageAction(action){if(action===UI_ACTIONS.CREATE)navigate('/training/new')}
 function openProgram(id){registry.openRecord(navigate,`/training/${id}`,id,programs.map(x=>x.id))}
 // «Report & indicators» sits in the Export menu, so the top bar keeps two buttons.
 // The tables behind print and Excel: the programmes as filtered, and their participants.
 const programmesTable=()=>trainingProgramsExport(sortedPrograms,assignments,{en,statusLabel:v=>labels[v]?.[en?1:0]||v||'',categoryLabel:v=>trainingCategoryLabel(v,language)})
 const participationTable=()=>{const ids=new Set(sortedPrograms.map(p=>p.id));return trainingParticipationExport(assignments.filter(a=>ids.has(a.programId)),state.programs,state.certificates,{en,statusLabel:v=>labels[v]?.[en?1:0]||v||''})}
 const programsWithParticipants=new Set(assignments.map(a=>a.programId))
 const toggleStatus=value=>setStatus(current=>current===value?'all':value)
 const totals=<RegistryTotals label={t('trainingTotals.label')} items={[
  {key:'all',always:true,value:programs.length,label:t('trainingTotals.programmes')},
  {key:'planned',value:programs.filter(x=>x.status==='planned').length,label:t('trainingTotals.planned'),active:status==='planned',onClick:()=>toggleStatus('planned')},
  {key:'active',value:programs.filter(x=>x.status==='active').length,label:t('trainingTotals.active'),active:status==='active',onClick:()=>toggleStatus('active')},
  {key:'completed',value:programs.filter(x=>x.status==='completed').length,label:t('trainingTotals.completed'),active:status==='completed',onClick:()=>toggleStatus('completed')},
  {key:'participations',value:assignments.filter(a=>programs.some(p=>p.id===a.programId)).length,label:t('trainingTotals.participations')},
  {key:'empty',value:programs.filter(p=>!programsWithParticipants.has(p.id)).length,label:t('trainingTotals.withoutParticipants')},
 ]}/>
 const reportItem=canManage&&can(role,CAPABILITIES.VIEW_ANALYSIS,membership?.capabilities??[],membership?.customCapabilities??[])?[{id:'report',kind:'report',label:en?'Report & indicators':'Αναφορά & δείκτες',onClick:()=>navigate('/analysis?tab=training')}]:[]
 return <Page fill title={en?'Training':'Εκπαίδευση'} subtitle={employeeView?(en?'Your assigned training and completion evidence.':'Οι ανατεθειμένες εκπαιδεύσεις και τα τεκμήρια ολοκλήρωσής σας.'):(en?'Training programs, participation and competency monitoring.':'Προγράμματα εκπαίδευσης, συμμετοχές και παρακολούθηση επάρκειας.')} actions={<div className="row-actions">{canManage&&trainingView==='plan'&&<ExportMenu items={[...registryItems('plan',en?`annual plan ${planYear}`:`ετήσιο πλάνο ${planYear}`,()=>annualPlanExport(annualPlan,{en,stateLabel:v=>planStateText(v,en)}),{language,kind:en?'Training':'Εκπαίδευση',disabled:!annualPlan.rows.length&&!annualPlan.needs.length,onBlocked:printBlocked}),...reportItem]}/>}{canManage&&trainingView==='programs'&&<ExportMenu items={[{id:'programmes-print',kind:'print',label:`${en?'Print':'Εκτύπωση'}: ${en?'programmes':'προγράμματα'}`,disabled:!sortedPrograms.length,onClick:()=>{if(!printRegistry(programmesTable(),{language,kind:en?'Training':'Εκπαίδευση',title:en?'Training programmes':'Προγράμματα εκπαίδευσης'}))printBlocked()}},{id:'participation-print',kind:'print',label:`${en?'Print':'Εκτύπωση'}: ${en?'participants':'συμμετέχοντες'}`,disabled:!assignments.length,onClick:()=>{if(!printRegistry(participationTable(),{language,kind:en?'Training':'Εκπαίδευση',title:en?'Training participants':'Συμμετέχοντες εκπαιδεύσεων'}))printBlocked()}},{id:'training-excel',kind:'excel',label:t('exportFields.menuLabel'),disabled:!sortedPrograms.length,onClick:()=>setExcelOpen(true)},...reportItem]}/>}{canManage&&trainingView==='competence'&&competenceExport&&<ExportMenu items={[...competenceExport,...reportItem]}/>}<RecordActions actions={canManage?[UI_ACTIONS.CREATE]:[]} resourceCapability={CAPABILITIES.VIEW_TRAINING} actionCapabilities={{[UI_ACTIONS.CREATE]:CAPABILITIES.MANAGE_TRAINING}} onAction={pageAction}/></div>}>
  {canManage&&<CanonicalTabs value={trainingView} onChange={setTrainingView} ariaLabel={en?'Training view':'Προβολή εκπαίδευσης'} items={[{value:'programs',label:en?'Programmes':'Προγράμματα',icon:BookOpenCheck,count:overdue||null},{value:'plan',label:en?'Annual plan':'Ετήσιο πλάνο',icon:CalendarRange},{value:'competence',label:en?'Competence':'Επάρκεια',icon:Award,count:annualPlan.totals.uncovered||null}]}/>}
  <section className="surface registry-workspace training-registry workspace-column workspace-fill">{canManage&&trainingView==='plan'?<TrainingAnnualPlanPanel plan={annualPlan} year={planYear} onYearChange={setPlanYear} language={language} canManage={canManage} section="programmes" onShowRetraining={()=>setTrainingView('competence')}/>:canManage&&trainingView==='competence'?<TrainingCompetencePanel state={state} employees={employees||[]} departments={departments} language={language} locale={en?'en-GB':'el-GR'} canManage={canManage} busy={busy} onSaveRequirement={saveRequirement} onDeleteRequirement={removeRequirement} onSummaryChange={setCompetence} onExportChange={setCompetenceExport} monthly={<TrainingAnnualPlanPanel plan={annualPlan} year={planYear} onYearChange={setPlanYear} language={language} canManage={canManage} section="retraining" onShowRetraining={()=>setTrainingView('competence')}/>} monthlyCount={annualPlan.totals.uncovered||null}/>:canManage?<><FilterBar query={query} onQueryChange={setQuery} placeholder={en?'Search training program...':'Αναζήτηση προγράμματος εκπαίδευσης...'} end={totals} activeAdvancedCount={(status==='all'?0:1)+(category==='all'?0:1)+(dateFrom?1:0)+(dateTo?1:0)} onClear={()=>{setQuery('');setStatus('all');setCategory('all');setDateFrom('');setDateTo('')}}><FilterSelect label={en?'Status':'Κατάσταση'} value={status} onChange={setStatus}><option value="all">{en?'All':'Όλα'}</option><option value="active">{en?'Active':'Ενεργά'}</option><option value="planned">{en?'Planned':'Προγραμματισμένα'}</option><option value="completed">{en?'Completed':'Ολοκληρωμένα'}</option></FilterSelect><FilterSelect label={en?'Category':'Κατηγορία'} value={category} onChange={setCategory}><option value="all">{en?'All':'Όλες'}</option>{categories.map(x=><option key={x} value={x}>{trainingCategoryLabel(x,language)}</option>)}</FilterSelect><FilterDate label={en?'From':'Από'} value={dateFrom} onChange={setDateFrom}/><FilterDate label={en?'To':'Έως'} value={dateTo} onChange={setDateTo}/></FilterBar><Programs rows={pagedPrograms} counts={participantCounts} filtered={state.programs.length>0} onClearFilters={()=>{setQuery('');setStatus('all');setCategory('all');setDateFrom('');setDateTo('')}} onCreate={canManage?()=>pageAction(UI_ACTIONS.CREATE):null} en={en} language={language} onOpen={openProgram} registry={registry} toggleSort={toggleProgramSort} sort={sort}/><RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={programs.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/></>:<Assignments inactiveCodes={inactiveEmployeeCodes(employees)} rows={assignments} state={state} en={en} employeeView={employeeView}/>}</section>
  {excelOpen&&<ExcelFieldsDialog storageKey="limoxis.training.excel" layouts={[{value:'programmes',label:en?'Programmes':'Προγράμματα'},{value:'participants',label:en?'Participants':'Συμμετέχοντες'}]} fields={layout=>tableFields(layout==='participants'?participationTable():programmesTable())} onClose={()=>setExcelOpen(false)} onConfirm={(keys,layout)=>{exportRegistry(pickColumns(layout==='participants'?participationTable():programmesTable(),keys));setExcelOpen(false)}}/>}
 </Page>
}

function ProgramRecord({en,language,organizationId,program,assignments,state,employees,departments,busy,notify,notifyError,confirm,reload,onBack,onPersist,onDelete}){
 const [tab,setTab]=useState('overview'),[dialog,setDialog]=useState(null),[mailBusy,setMailBusy]=useState(false),[editing,setEditing]=useState(false),[draft,setDraft]=useState(program)
 useEffect(()=>{setDraft(program);setEditing(false)},[program])
 // The active reading time of each participant on the programme's files (only a saved programme has any).
 const [materialSeconds,setMaterialSeconds]=useState(()=>new Map())
 useEffect(()=>{let active=true;if(!program.dbId)return()=>{active=false};loadProgramMaterialTimes(program.dbId).then(rows=>{if(!active)return;const map=new Map();for(const row of rows)map.set(row.assignment_id,(map.get(row.assignment_id)||0)+(row.active_seconds||0));setMaterialSeconds(map)}).catch(()=>{});return()=>{active=false}},[program.dbId,tab])
 const tabs=[{id:'overview',label:en?'Overview':'Σύνοψη',icon:CheckCircle2},{id:'participants',label:en?'Participants':'Συμμετέχοντες',icon:Users},{id:'materials',label:en?'Material':'Υλικό',icon:FileText},{id:'assessment',label:en?'Knowledge test':'Τεστ γνώσεων',icon:ClipboardCheck},{id:'results',label:en?'Results':'Αποτελέσματα',icon:Award}]
 async function sendForms(rows){const recipients=rows.filter(row=>row.email&&row.status!=='completed'&&!row.feedbackSubmittedAt);if(!recipients.length){notify(en?'Select at least one participant with an email who has not submitted the form.':'Επιλέξτε τουλάχιστον έναν συμμετέχοντα με email που δεν έχει ήδη υποβάλει τη φόρμα.','warning');return}setMailBusy(true);try{await sendTrainingInvitationsAsync(recipients.map(row=>row.id),language,organizationId);notify(en?`Evaluation form sent to ${recipients.length} participant${recipients.length===1?'':'s'}.`:`Η φόρμα αξιολόγησης στάλθηκε σε ${recipients.length} συμμετέχον${recipients.length===1?'τα':'τες'}.`,'success');await reload()}catch(error){notifyError(error,'send',{operation:'training_invitation_send'})}finally{setMailBusy(false)}}
 async function saveProgram(){if(!trainingProgramIsValid(draft)||busy)return;const next={...draft,id:program.id,dbId:program.dbId,materials:program.materials||[],assessmentQuestions:program.assessmentQuestions||[],trainerFeedbackTemplate:program.trainerFeedbackTemplate,feedbackResponses:program.feedbackResponses||[],effectiveness:program.effectiveness,createdAt:program.createdAt,updatedAt:new Date().toISOString()};if(await onPersist({...state,programs:state.programs.map(x=>x.id===program.id?next:x)},en?'Training program updated.':'Το πρόγραμμα εκπαίδευσης ενημερώθηκε.'))setEditing(false)}
 async function removeParticipant(row){if(row.status==='completed'){notify(en?'Completed training records are retained for traceability.':'Οι ολοκληρωμένες εκπαιδεύσεις διατηρούνται για ιχνηλασιμότητα.','warning');return}if(!await confirm({title:en?'Remove participant':'Αφαίρεση συμμετέχοντα',message:en?'Remove this participant from the training program?':'Να αφαιρεθεί ο συμμετέχων από το πρόγραμμα εκπαίδευσης;',danger:true}))return;try{await deleteTrainingRecordAsync(organizationId,row.id);notify(en?'Participant removed.':'Ο συμμετέχων αφαιρέθηκε.','success');await reload()}catch(error){notifyError(error,'delete',{operation:'training_participant_delete'})}}
 async function addParticipants({selected,manualEntries}){
  const now=new Date().toISOString(),stamp=Date.now()
  const fromEmployees=selected.map((employee,index)=>({id:`TRA-${stamp}-${index}-${employee.id}`,programId:program.id,employeeId:employee.employeeCode||employee.id,employeeName:`${employee.firstName||''} ${employee.lastName||''}`.trim(),department:employee.department||'',departmentId:employee.departmentId||null,email:employee.email||'',assignedDate:now.slice(0,10),dueDate:program.dueDate,status:'assigned',attendanceResponse:'not_sent',attendance:null,completionConfirmedAt:null,score:null,competent:null,certificateId:null,createdAt:now}))
  const fromManual=(manualEntries||[]).map((manual,index)=>({id:`TRA-MAN-${stamp}-${index}`,programId:program.id,employeeId:'',employeeName:manual.name.trim(),department:manual.department.trim(),email:manual.email.trim(),assignedDate:now.slice(0,10),dueDate:program.dueDate,status:'assigned',attendanceResponse:'not_sent',attendance:null,completionConfirmedAt:null,score:null,competent:null,certificateId:null,createdAt:now,manualEntry:true}))
  const saved=await onPersist({...state,assignments:[...state.assignments,...fromEmployees,...fromManual]},en?'Participants added.':'Οι συμμετέχοντες προστέθηκαν.')
  if(saved)setDialog(null)
 }
 async function cancelProgram(){if(!await confirm({title:en?'Cancel the program':'Ακύρωση προγράμματος',message:en?'The program is marked as cancelled; its participants and results are kept.':'Το πρόγραμμα σημειώνεται ως ακυρωμένο· οι συμμετέχοντες και τα αποτελέσματα διατηρούνται.',confirmLabel:en?'Cancel the program':'Ακύρωση προγράμματος',danger:true}))return;await onPersist({...state,programs:state.programs.map(x=>x.id===program.id?{...x,status:'cancelled'}:x)},en?'The program was cancelled.':'Το πρόγραμμα ακυρώθηκε.')}
 const programMenu=!editing?<OverflowMenu label={en?'Program actions':'Ενέργειες προγράμματος'} items={[
   {id:'edit',label:en?'Edit':'Επεξεργασία',icon:Pencil,onClick:()=>setEditing(true)},
   ...(program.status!=='cancelled'&&program.status!=='completed'?[{id:'cancel',label:en?'Cancel the program':'Ακύρωση προγράμματος',icon:XCircle,disabled:busy,onClick:cancelProgram}]:[]),
   {id:'delete',label:en?'Delete':'Διαγραφή',icon:Trash2,tone:'danger',separatorBefore:true,disabled:busy,onClick:onDelete},
 ]}/>:null
 const activeEmployees=employees.filter(isActiveEmployee),assignedEmployeeIds=new Set(assignments.map(a=>String(a.employeeId||'')).filter(Boolean))
 if(dialog?.type==='participants')return <TrainingParticipantsDialog en={en} departments={departments} employees={activeEmployees} alreadyAssignedIds={[...assignedEmployeeIds]} busy={busy} onClose={()=>setDialog(null)} onSave={addParticipants}/>
 return (
  <Page fill>
   <EntityRecordShell className="training-record-shell" avatar={<BookOpenCheck size={19}/>} eyebrow={program.id} title={program.title} subtitle={[program.category?trainingCategoryLabel(program.category,language):'',trainingMethodLabel(program.method,language),program.owner?`${en?'Organiser':'Διοργανωτής'}: ${program.owner}`:'',`${en?'Trainer':'Εκπαιδευτής'}: ${program.trainer||'—'}`].filter(part=>part&&part!=='—').join(' · ')} status={<Badge status={program.status}/>} tabs={tabs} activeTab={tab} onTabChange={setTab} onBack={onBack} backLabel={en?'Back to programs':'Πίσω στα προγράμματα'}>
     {tab==='overview'&&<section className="record-section training-program-overview"><div className="record-section-header"><div><h3>{en?'Program details':'Στοιχεία προγράμματος'}</h3></div>{programMenu}</div>{editing?<TrainingProgramForm value={draft} onChange={setDraft} language={language} employees={employees} departments={departments}/>:<TrainingProgramDetails value={program} language={language}/>}{!editing&&<TrainingProgramProgress en={en} program={program} assignments={assignments}/>}{editing&&<div className="inline-edit-footer"><Button variant="secondary" onClick={()=>{setDraft(program);setEditing(false)}} disabled={busy}>{en?'Cancel':'Ακύρωση'}</Button><SaveButton loading={busy} disabled={!trainingProgramIsValid(draft)||busy} onClick={saveProgram}>{en?'Save':'Αποθήκευση'}</SaveButton></div>}</section>}
     {tab==='participants'&&<Participants inactiveCodes={inactiveEmployeeCodes(employees)} materialSeconds={materialSeconds} measured={Boolean(program.materials?.length)||materialSeconds.size>0} rows={assignments} en={en} language={language} busy={busy} mailBusy={mailBusy} onInviteAll={sendForms} onRemove={removeParticipant} onAdd={()=>setDialog({type:'participants'})}/>}
     {tab==='materials'&&<RecordTabPanel className="training-content-panel" title={en?'Material':'Υλικό'} subtitle={en?'Upload presentations, procedures, attendance sheets or supporting material.':'Ανεβάστε παρουσιάσεις, διαδικασίες, παρουσιολόγια ή άλλο υποστηρικτικό υλικό.'}>
       <div className="training-content-stack">
         {/* The files of the program are its attachments (below); only external links are listed here, so nothing shows twice. */}
         {(program.materials||[]).some(m=>m.url)&&<ul className="training-material-list" aria-label={en?'Program material':'Υλικό προγράμματος'}>{program.materials.filter(m=>m.url).map(m=><li key={m.id}><strong>{m.title}</strong>{m.type&&<span>{m.type}</span>}{m.url&&<a href={m.url} target="_blank" rel="noreferrer">{en?'Open':'Άνοιγμα'}</a>}</li>)}</ul>}
         <AttachmentField organizationId={organizationId} entityType="training_program" entityId={program.dbId||program.id} value={[]} onChange={()=>{}}/>
       </div>
     </RecordTabPanel>}
     {tab==='assessment'&&<TrainingAssessmentEditor program={program} state={state} onPersist={onPersist} busy={busy} en={en} language={language}/>}
          {tab==='results'&&<TrainingResultsReview program={program} rows={assignments} state={state} onPersist={onPersist} busy={busy} en={en} language={language} organizationId={organizationId} onReviewed={reload}/>}
   </EntityRecordShell>
  </Page>
 )
}

function Participants({inactiveCodes,materialSeconds,measured,rows,en,language,onAdd,busy,mailBusy,onInviteAll,onRemove}){
 const [query,setQuery]=useState(''),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(15),[selectedIds,setSelectedIds]=useState(()=>new Set())
 const sent=rows.filter(x=>x.invitationSentAt).length,confirmed=rows.filter(x=>x.attendanceResponse==='confirmed').length,completed=rows.filter(x=>x.status==='completed').length
 const filtered=useMemo(()=>{const q=query.trim().toLowerCase();if(!q)return rows;return rows.filter(x=>`${x.employeeName||''} ${x.employeeId||''} ${x.department||''} ${x.email||''}`.toLowerCase().includes(q))},[rows,query])
 useEffect(()=>setPage(1),[query,pageSize])
 useEffect(()=>setSelectedIds(current=>new Set([...current].filter(id=>rows.some(row=>row.id===id&&row.email&&row.status!=='completed'&&!row.feedbackSubmittedAt)))),[rows])
 const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize)),safePage=Math.min(page,totalPages),pagedRows=filtered.slice((safePage-1)*pageSize,safePage*pageSize)
 const selectableRows=filtered.filter(row=>row.email&&row.status!=='completed'&&!row.feedbackSubmittedAt),selectedRows=rows.filter(row=>selectedIds.has(row.id)&&row.email&&row.status!=='completed'&&!row.feedbackSubmittedAt),allVisibleSelected=selectableRows.length>0&&selectableRows.every(row=>selectedIds.has(row.id))
 function toggle(id,checked){setSelectedIds(current=>{const next=new Set(current);if(checked)next.add(id);else next.delete(id);return next})}
 function toggleAll(checked){setSelectedIds(current=>{const next=new Set(current);for(const row of selectableRows){if(checked)next.add(row.id);else next.delete(row.id)}return next})}
 const factsText=rows.length?`${sent}/${rows.length} ${en?'forms sent':'φόρμες στάλθηκαν'} · ${confirmed}/${rows.length} ${en?'attendance confirmed':'επιβεβαίωσαν συμμετοχή'} · ${completed}/${rows.length} ${en?'completed':'ολοκλήρωσαν'}`:''
 const actions=<><Button variant="secondary" disabled={busy||mailBusy||selectedRows.length===0} onClick={()=>onInviteAll(selectedRows)}><Send size={14}/>{mailBusy?(en?'Sending…':'Αποστολή…'):(en?`Send evaluation (${selectedRows.length})`:`Αποστολή αξιολόγησης (${selectedRows.length})`)}</Button><Button disabled={busy} onClick={onAdd}><Plus size={15}/>{en?'Add participants':'Προσθήκη συμμετεχόντων'}</Button></>
 return <RecordTabPanel className="training-participants-view" title={en?'Participants':'Συμμετέχοντες'} subtitle={factsText||undefined} actions={actions} footer={<RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/>}>
  <div className="training-participants-registry workspace-column workspace-fill">
   <FilterBar query={query} onQueryChange={setQuery} placeholder={en?'Search participant, department or email...':'Αναζήτηση συμμετέχοντα, τμήματος ή email...'}/>
   <div className="scroll-table"><table className="data-table sticky-table training-participants-table"><thead><tr><th className="training-select-col"><input type="checkbox" aria-label={en?'Select all eligible participants':'Επιλογή όλων των διαθέσιμων συμμετεχόντων'} checked={allVisibleSelected} onChange={e=>toggleAll(e.target.checked)} disabled={!selectableRows.length}/></th><th>{en?'Participant':'Συμμετέχων'}</th><th>{en?'Department':'Τμήμα'}</th><th>{en?'Progress':'Πρόοδος'}</th><th></th></tr></thead><tbody>{pagedRows.map(x=>{const wasSent=Boolean(x.invitationSentAt),done=x.status==='completed',submitted=Boolean(x.feedbackSubmittedAt),reviewPending=x.assessmentReviewStatus==='pending',eligible=Boolean(x.email)&&!done&&!submitted;const inactive=!x.manualEntry&&inactiveCodes?.has(String(x.employeeId||''));return <tr key={x.id} className={inactive?'inactive-employee-row':undefined}><td className="training-select-col"><input type="checkbox" aria-label={`${en?'Select':'Επιλογή'} ${x.employeeName||''}`} checked={selectedIds.has(x.id)} disabled={!eligible} onChange={e=>toggle(x.id,e.target.checked)}/></td><td><strong>{x.employeeName||'—'}</strong><InactiveEmployeeBadge inactive={inactive}/><small>{[x.manualEntry?(en?'Manual entry':'Χειροκίνητη καταχώρηση'):(x.employeeId||''),x.email].filter(Boolean).join(' · ')||'—'}</small></td><td>{x.department||'—'}</td><td>{reviewPending?<span className="status-badge">{en?'Review pending':'Αναμονή ελέγχου'}</span>:done?<span className="status-badge active">{x.score!=null?`${en?'Completed':'Ολοκληρώθηκε'} · ${x.score}%`:(en?'Completed':'Ολοκληρώθηκε')}</span>:submitted?<span className="status-badge active">{en?'Form submitted':'Υποβλήθηκε η φόρμα'}</span>:x.attendanceResponse==='confirmed'?<span className="status-badge active">{en?'Attendance confirmed':'Επιβεβαίωσε συμμετοχή'}</span>:wasSent?<><span className="status-badge">{en?'Form sent':'Στάλθηκε φόρμα'}</span><small>{fmt(x.invitationSentAt)}</small></>:<span className="status-badge">{en?'Not sent':'Δεν στάλθηκε'}</span>}{measured?<small>{en?'Viewing time':'Χρόνος παρακολούθησης'}: {formatActiveTime(materialSeconds.get(x.dbId)||0,en)}</small>:null}</td><td className="open-record-cell">{!done&&!submitted&&<OverflowMenu label={en?'Participant actions':'Ενέργειες συμμετέχοντα'} items={[{id:'remove',label:en?'Remove participant':'Αφαίρεση συμμετέχοντα',icon:Trash2,tone:'danger',onClick:()=>onRemove(x)}]}/>}</td></tr>})}</tbody></table>{!filtered.length&&<div className="registry-empty-state"><strong>{rows.length?(en?'No participants match the search.':'Δεν βρέθηκαν συμμετέχοντες για την αναζήτηση.'):(en?'No participants yet.':'Δεν έχουν προστεθεί συμμετέχοντες.')}</strong></div>}</div>
  </div>
 </RecordTabPanel>
}
// A program overlaps the chosen dates when its start..due span touches [from, to]; programs with no date stay visible only when no date is chosen.
function programInRange(x,from,to){if(!from&&!to)return true;const start=String(x.startDate||x.dueDate||'').slice(0,10),end=String(x.dueDate||x.startDate||'').slice(0,10);if(!start)return false;return (!from||end>=from)&&(!to||start<=to)}
function SortTh({k,label,toggleSort,sort}){const on=sort.key===k;return <th aria-sort={on?(sort.dir==='desc'?'descending':'ascending'):'none'}><button type="button" className="registry-sort" onClick={()=>toggleSort(k)}>{label}<span className="registry-sort-arrows" aria-hidden="true"><i className={on&&sort.dir==='asc'?'on':''}>▲</i><i className={on&&sort.dir==='desc'?'on':''}>▼</i></span></button></th>}
function Programs({rows,counts,filtered,onClearFilters,onCreate,en,language,onOpen,registry,toggleSort,sort}){return <div className="scroll-table" ref={registry.scrollRef}><table className="data-table sticky-table"><thead><tr><SortTh k="title" label={en?'Program':'Πρόγραμμα'} toggleSort={toggleSort} sort={sort}/><SortTh k="trainer" label={en?'Trainer':'Εκπαιδευτής'} toggleSort={toggleSort} sort={sort}/><SortTh k="audience" label={en?'Audience':'Κοινό'} toggleSort={toggleSort} sort={sort}/><SortTh k="period" label={en?'Period':'Περίοδος'} toggleSort={toggleSort} sort={sort}/><SortTh k="participants" label={en?'Participants':'Συμμετέχοντες'} toggleSort={toggleSort} sort={sort}/><SortTh k="status" label={en?'Status':'Κατάσταση'} toggleSort={toggleSort} sort={sort}/></tr></thead><tbody>{rows.map(x=><tr key={x.id} {...registry.rowProps(x.id,()=>onOpen(x.id))}><td><strong>{x.title}</strong><small>{trainingCategoryLabel(x.category,language)} · {trainingMethodLabel(x.method,language)}</small></td><td>{x.trainer||x.owner||'—'}</td><td>{x.audience||'—'}</td><td className="nowrap-cell">{periodText(x.startDate,x.dueDate)}</td><td className="nowrap-cell">{counts.get(x.id)?`${counts.get(x.id).done} / ${counts.get(x.id).total}`:'—'}</td><td><Badge status={shownStatus(x,counts.get(x.id))}/></td></tr>)}</tbody></table>{!rows.length&&(filtered?<RegistryEmptyState filtered onClearFilters={onClearFilters}/>:<RegistryEmptyState icon={BookOpenCheck} title={en?'No training programmes yet':'Δεν υπάρχουν ακόμη προγράμματα εκπαίδευσης'} text={en?'A programme holds the material, the participants, the assessment and the certificates.':'Ένα πρόγραμμα συγκεντρώνει υλικό, συμμετέχοντες, αξιολόγηση και βεβαιώσεις.'} action={onCreate?{label:en?'New programme':'Νέο πρόγραμμα',icon:Plus,onClick:onCreate}:null}/>)}</div>}
function Assignments({inactiveCodes,rows,state,en,employeeView=false}){
 const {notify}=useFeedback()
 const [certBusyId,setCertBusyId]=useState(null)
 async function downloadCertificate(row,program,pdf=false){
  const certificate=row.certificateId?(state.certificates||[]).find(c=>c.id===row.certificateId):null
  if(certBusyId||!certificate)return
  setCertBusyId(row.id)
  try{await downloadCertificatePdf({certificate,program,participantName:row.employeeName,en,pdf})}
  catch(error){notify(error?.message||(en?'Could not export the certificate.':'Δεν ήταν δυνατή η εξαγωγή του πιστοποιητικού.'),'danger')}
  finally{setCertBusyId(null)}
 }
 return <div className="scroll-table"><table className="data-table sticky-table"><thead><tr>{!employeeView&&<><th>{en?'Employee':'Εργαζόμενος'}</th><th>{en?'Department':'Τμήμα'}</th></>}<th>{en?'Training':'Εκπαίδευση'}</th><th>{en?'Due':'Προθεσμία'}</th><th>{en?'Result':'Αποτέλεσμα'}</th><th>{en?'Status':'Κατάσταση'}</th><th>{en?'Certificate':'Πιστοποιητικό'}</th></tr></thead><tbody>{rows.map(x=>{const p=state.programs.find(v=>v.id===x.programId),certificate=x.certificateId?(state.certificates||[]).find(c=>c.id===x.certificateId):null;const inactive=inactiveCodes?.has(String(x.employeeId||''));return <tr key={x.id} className={inactive?'inactive-employee-row':undefined}>{!employeeView&&<><td><strong>{x.employeeName||'—'}</strong><InactiveEmployeeBadge inactive={inactive}/></td><td>{x.department||'—'}</td></>}<td><strong>{p?.title||x.programId}</strong></td><td>{fmt(x.dueDate)}</td><td>{x.assessmentReviewStatus==='pending'?(en?'Review pending':'Αναμονή ελέγχου'):x.score!=null?`${x.score}%`:x.status==='completed'?(en?'Completed':'Ολοκληρώθηκε'):'—'}</td><td><Badge status={x.computedStatus}/></td><td className="open-record-cell">{certificate&&<ExportMenu compact disabled={Boolean(certBusyId)} onPrint={()=>downloadCertificate(x,p)} onPdf={()=>downloadCertificate(x,p,true)}/>}</td></tr>})}</tbody></table></div>
}
// An active programme past its deadline with people still to finish shows as overdue.
const shownStatus=(program,count,today=new Date().toISOString().slice(0,10))=>program.status==='active'&&program.dueDate&&String(program.dueDate).slice(0,10)<today&&(count?.done||0)<(count?.total||0)?'overdue':program.status
function Badge({status}){const {language}=useLanguage(),en=language==='en';return <span className={`status-badge ${status==='active'||status==='completed'?'active':''} ${status==='overdue'||status==='cancelled'?'danger':''}`.trim()}>{labels[status]?.[en?1:0]||status||'—'}</span>}
// The key figures of the open tab, with targets (a completion or a coverage below 90% asks for attention).

// «Progress» on the overview: who finished, the pass rate and when the competence runs out.
function TrainingProgramProgress({en,program,assignments}){
 const rows=assignments.map(x=>({...x,computedStatus:computedAssignmentStatus(x)})),done=rows.filter(x=>x.computedStatus==='completed'),late=rows.filter(x=>x.computedStatus==='overdue')
 if(!rows.length)return <div className="training-program-progress"><h4>{en?'Progress':'Πρόοδος'}</h4><p className="muted">{en?'No participants yet.':'Δεν υπάρχουν ακόμη συμμετέχοντες.'}</p></div>
 const scored=rows.filter(x=>x.score!=null),passed=scored.filter(x=>Number(x.score)>=Number(program.passScore||0))
 const lastDone=done.map(x=>String(x.completedAt||x.completionConfirmedAt||'').slice(0,10)).filter(Boolean).sort().pop()
 const until=lastDone&&Number(program.validMonths)?(()=>{const d=new Date(`${lastDone}T00:00:00`);d.setMonth(d.getMonth()+Number(program.validMonths));return d.toLocaleDateString(en?'en-GB':'el-GR')})():''
 const items=[
  [en?'Completed':'Ολοκλήρωσαν',`${done.length} / ${rows.length}`],
  late.length?[en?'Overdue':'Εκπρόθεσμοι',String(late.length)]:null,
  program.requiresAssessment&&scored.length?[en?'Pass rate':'Ποσοστό επιτυχίας',`${Math.round(passed.length/scored.length*100)}% (${passed.length}/${scored.length})`]:null,
  until?[en?'Latest competence valid until':'Η τελευταία επάρκεια ισχύει έως',until]:null,
 ].filter(Boolean)
 return <div className="training-program-progress"><h4>{en?'Progress':'Πρόοδος'}</h4><dl>{items.map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></div>
}
