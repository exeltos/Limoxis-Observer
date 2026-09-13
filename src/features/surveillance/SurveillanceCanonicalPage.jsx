import { useEffect,useMemo,useState } from 'react'
import { Activity,AlertTriangle,Clock3,Microscope,Users } from 'lucide-react'
import { useLocation,useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { RecordActions } from '../../design-system/RecordActions'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { MetricCard } from '../../design-system/MetricCard'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { RegistryTable } from '../../design-system/RegistryTable'
import { UI_ACTIONS } from '../../core/actions/actionPolicy'
import { CAPABILITIES,ROLES } from '../../core/permissions/roles'
import { useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { useTenant } from '../../core/tenant/TenantContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useAuditActor } from '../../core/audit/useAuditActor'
import { loadPatients } from '../patients/patientsService'
import { loadDepartments } from '../management/departmentsService'
import { useLaboratoryRegistry } from '../laboratory/hooks/useLaboratoryRegistry'
import { createLaboratorySample,getEnvironmentalKpis,loadLaboratorySamples } from '../laboratory/laboratoryCloudService'
import { NewSurveillanceFlow } from './NewSurveillanceFlow'
import { createClinicalRepository } from './clinicalRepository'
import { surveillanceDemoData } from './surveillanceDemoData'
import { employeeSurveillanceBatches,employeeSurveillanceRecords,getEmployeeSurveillanceKpis } from './employeeSurveillanceData'
import { loadEmployeeSurveillanceBatches,loadEmployeeSurveillanceRecords } from './employeeSurveillanceCloudService'
import { EmployeeSurveillanceFlow,BulkEmployeeSurveillanceFlow,SurveillanceSubjectChooser } from './EmployeeSurveillanceFlow'
import { ProductionEmployeeSurveillanceFlow } from './ProductionEmployeeSurveillanceFlow'
import { EnvironmentalRegistry,EnvironmentalSurveillanceFlow } from './EnvironmentalSurveillanceFlow'

const latestOrganism=row=>row.samples?.find(x=>x.organism)?.organism||row.organism||null
const latestResistance=row=>row.samples?.find(x=>x.resistance)?.resistance||row.resistance||null
const reviewState=row=>row.status!=='active'?'completed':row.reviewDue&&new Date(`${String(row.reviewDue).slice(0,10)}T23:59:59`)<new Date()?'overdue':'inProgress'
const environmentalTypes=['water','surface','environment','environmental','room','air','νερό','επιφάνεια','επιφανεια']
const isEnvironmental=row=>row.subjectType==='environment'||environmentalTypes.some(x=>String(row.type||'').toLowerCase().includes(x))
const unique=values=>[...new Set(values.filter(Boolean))]

export function SurveillanceCanonicalPage(){
  const actor=useAuditActor(),navigate=useNavigate(),location=useLocation()
  const {tenant,isDemo,role,actualRole,canAccessRecord,canSeeSensitiveEmployeeHealth}=useTenant()
  const {t,language,locale}=useLanguage(),{notify,notifyError}=useFeedback()
  const restored=location.state?.surveillanceView||{}
  const [patients,setPatients]=useState([]),[cases,setCases]=useState([]),[employeeRows,setEmployeeRows]=useState([]),[batchRows,setBatchRows]=useState([]),[environmentRows,setEnvironmentRows]=useState([]),[departments,setDepartments]=useState([]),[loading,setLoading]=useState(true)
  const [mode,setMode]=useState(restored.mode||'patients'),[query,setQuery]=useState(restored.query||''),[department,setDepartment]=useState(restored.department||'all'),[status,setStatus]=useState(restored.status||'all'),[page,setPage]=useState(restored.page||1),[pageSize,setPageSize]=useState(restored.pageSize||15),[creation,setCreation]=useState(null)
  const registry=useRegistryMemory(`surveillance-${mode}`),laboratoryRegistry=useLaboratoryRegistry()
  const clinical=useMemo(()=>createClinicalRepository({isDemo,organizationId:tenant?.id,actor}),[isDemo,tenant?.id,actor.id,actor.name])
  const canEmployees=actualRole===ROLES.PLATFORM_OWNER||isDemo||[ROLES.HOSPITAL_ADMIN,ROLES.INFECTION_CONTROL_LEAD,ROLES.INFECTION_CONTROL_MEMBER,ROLES.OCCUPATIONAL_PHYSICIAN].includes(role)||Boolean(canSeeSensitiveEmployeeHealth)
  const canEnvironment=![ROLES.DEPARTMENT_MANAGER,ROLES.DEPARTMENT_USER,ROLES.DOCTOR_REVIEWER].includes(role)

  async function load(){
    setLoading(true)
    try{
      const roster=await loadPatients(tenant?.id,{isDemo});setPatients(roster)
      if(isDemo){
        setCases(surveillanceDemoData.map(x=>({...x})))
        setEmployeeRows(employeeSurveillanceRecords.map(x=>({...x})))
        setBatchRows(employeeSurveillanceBatches.map(x=>({...x})))
        setEnvironmentRows(laboratoryRegistry.rows.filter(isEnvironmental))
        setDepartments(unique(surveillanceDemoData.map(x=>language==='el'?x.department:x.departmentEn)).map(name=>({id:name,name})))
      }else if(tenant?.id){
        const [{loadClinicalCases},{default:noop}]=await Promise.all([import('./clinicalCloudService'),Promise.resolve({default:null})]);void noop
        const results=await Promise.allSettled([loadClinicalCases(tenant.id),loadEmployeeSurveillanceRecords(tenant.id),loadLaboratorySamples(tenant.id),loadDepartments(tenant.id)])
        setCases(results[0].status==='fulfilled'?results[0].value:[])
        const employees=results[1].status==='fulfilled'?results[1].value:[];setEmployeeRows(employees)
        try{setBatchRows(canEmployees?await loadEmployeeSurveillanceBatches(tenant.id,employees):[])}catch{setBatchRows([])}
        setEnvironmentRows(results[2].status==='fulfilled'?results[2].value.filter(isEnvironmental):[])
        setDepartments(results[3].status==='fulfilled'?results[3].value.filter(x=>x.is_active!==false):[])
        results.filter(x=>x.status==='rejected').forEach(x=>notifyError(x.reason,'load',{operation:'surveillance_canonical_load'}))
      }else{setCases([]);setEmployeeRows([]);setBatchRows([]);setEnvironmentRows([]);setDepartments([])}
    }finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[tenant?.id,isDemo,canEmployees,language])
  useEffect(()=>{setPage(1)},[mode,query,department,status,pageSize])

  const fmt=value=>value?new Intl.DateTimeFormat(locale).format(new Date(`${String(value).slice(0,10)}T12:00:00`)):'—'
  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase()
    if(mode==='patients')return cases.filter(canAccessRecord).filter(x=>`${x.patient||''} ${x.patientEn||''} ${x.patientId||''} ${latestOrganism(x)||''}`.toLowerCase().includes(q)).filter(x=>department==='all'||(language==='el'?x.department:x.departmentEn)===department).filter(x=>status==='all'||x.status===status)
    if(mode==='employees')return employeeRows.filter(x=>`${x.employeeName||''} ${x.employeeNameEn||''} ${x.employeeId||''}`.toLowerCase().includes(q)).filter(x=>department==='all'||(language==='el'?x.department:x.departmentEn)===department).filter(x=>status==='all'||x.resultStatus===status)
    if(mode==='batches')return batchRows.filter(x=>`${x.department||''} ${x.departmentEn||''}`.toLowerCase().includes(q)).filter(x=>department==='all'||(language==='el'?x.department:x.departmentEn)===department)
    return environmentRows.filter(x=>`${x.type||''} ${x.source||''} ${x.department||''} ${x.organism||''}`.toLowerCase().includes(q)).filter(x=>department==='all'||x.department===department).filter(x=>status==='all'||x.status===status)
  },[mode,cases,employeeRows,batchRows,environmentRows,query,department,status,language,canAccessRecord])
  const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize)),safePage=Math.min(page,totalPages),rows=filtered.slice((safePage-1)*pageSize,safePage*pageSize)
  const departmentNames=useMemo(()=>unique(mode==='patients'?cases.map(x=>language==='el'?x.department:x.departmentEn):mode==='employees'?employeeRows.map(x=>language==='el'?x.department:x.departmentEn):mode==='batches'?batchRows.map(x=>language==='el'?x.department:x.departmentEn):environmentRows.map(x=>x.department)),[mode,cases,employeeRows,batchRows,environmentRows,language])
  const active=cases.filter(x=>x.status==='active').length,due=cases.filter(x=>reviewState(x)==='overdue').length,resistant=cases.filter(x=>latestResistance(x)).length,isolation=cases.filter(x=>x.isolation?.status==='active'||x.isolation).length
  const employeeKpis=getEmployeeSurveillanceKpis(employeeRows),environmentKpis=getEnvironmentalKpis(environmentRows)
  const saveView=()=>({mode,page:safePage,pageSize,query,department,status})
  const openCase=item=>registry.openRecord(navigate,`/surveillance/${item.id}`,String(item.id),rows.map(x=>String(x.id)),{returnState:{surveillanceView:saveView()}})

  async function createPatient(draft,patient){const created=await clinical.createCase(patient,draft);await load();notify(t('surveillanceCreated'),'success');return created}
  async function createEnvironment({patientRecordId,draft}){if(isDemo)return laboratoryRegistry.createSample({patientRecordId,draft});return createLaboratorySample(tenant?.id,patientRecordId,draft)}

  return <Page fill title={t('clinicalRecords.surveillanceCenter')} subtitle={t('surveillanceSubtitleV051')} actions={<RecordActions actions={[UI_ACTIONS.CREATE]} actionCapabilities={{[UI_ACTIONS.CREATE]:CAPABILITIES.CREATE_SURVEILLANCE}} onAction={()=>setCreation('chooser')}/>}>
    <div className="workspace-summary surveillance-summary"><div className="module-summary-strip">{mode==='employees'||mode==='batches'?<><SummaryMetric icon={Activity} label={t('clinicalRecords.activeEmployeeScreenings')} value={employeeKpis.active}/><SummaryMetric icon={Microscope} label={t('clinicalRecords.positiveEmployeeScreenings')} value={employeeKpis.positive}/><SummaryMetric icon={AlertTriangle} label={t('clinicalRecords.needsIntervention')} value={employeeKpis.needsIntervention}/><SummaryMetric icon={Clock3} label={t('clinicalRecords.needsRecheck')} value={employeeKpis.needsRecheck}/></>:mode==='environmental'?<><SummaryMetric icon={Activity} label={t('clinicalRecords.activeEnvironmentalSampling')} value={environmentKpis.active}/><SummaryMetric icon={Clock3} label={t('clinicalRecords.pendingEnvironmentalLab')} value={environmentKpis.pendingLab}/><SummaryMetric icon={Microscope} label={t('clinicalRecords.positiveEnvironmentalPoints')} value={environmentKpis.positive}/><SummaryMetric icon={AlertTriangle} label={t('clinicalRecords.criticalEnvironmentalFindings')} value={environmentKpis.critical}/></>:<><SummaryMetric icon={Activity} label={t('activeSurveillance')} value={active}/><SummaryMetric icon={Clock3} label={t('clinicalRecords.needsReview')} value={due}/><SummaryMetric icon={AlertTriangle} label={t('clinicalRecords.activeIsolation')} value={isolation}/><SummaryMetric icon={Microscope} label={t('clinicalRecords.mdrXdr')} value={resistant}/></>}</div></div>
    <nav className="tabs surveillance-domain-tabs canonical-module-tabs" aria-label={t('surveillanceCategoriesAria')}><button type="button" className={`tab ${mode==='patients'?'active':''}`} onClick={()=>setMode('patients')}><Activity size={14}/>{t('patients')}</button>{canEmployees&&<><button type="button" className={`tab ${mode==='employees'?'active':''}`} onClick={()=>setMode('employees')}><Users size={14}/>{t('employees')}</button><button type="button" className={`tab ${mode==='batches'?'active':''}`} onClick={()=>setMode('batches')}><Users size={14}/>{t('clinicalRecords.bulkSurveillance')}</button></>}{canEnvironment&&<button type="button" className={`tab ${mode==='environmental'?'active':''}`} onClick={()=>setMode('environmental')}><Microscope size={14}/>{t('clinicalRecords.environment')}</button>}</nav>
    <div className="surface registry-workspace workspace-fill"><FilterBar query={query} onQueryChange={setQuery} placeholder={t('search')} activeAdvancedCount={(department!=='all'?1:0)+(status!=='all'?1:0)} onClear={()=>{setQuery('');setDepartment('all');setStatus('all')}} advanced={<><FilterSelect label={t('department')} value={department} onChange={setDepartment}><option value="all">{t('allDepartments')}</option>{departmentNames.map(x=><option key={x} value={x}>{x}</option>)}</FilterSelect><FilterSelect label={t('status')} value={status} onChange={setStatus}><option value="all">{t('all')}</option><option value="active">{t('active')}</option><option value="completed">{t('completed')}</option><option value="positive">{t('positive')}</option><option value="negative">{t('negative')}</option></FilterSelect></>}/>{loading?<div className="registry-empty-state">{t('loading')}</div>:mode==='patients'?<PatientRows rows={rows} registry={registry} t={t} language={language} fmt={fmt} onOpen={openCase}/>:mode==='employees'?<EmployeeRows rows={rows} registry={registry} language={language} fmt={fmt}/>:mode==='batches'?<BatchRows rows={rows} registry={registry} language={language} fmt={fmt}/>:<EnvironmentalRegistry rows={rows} summaryRows={filtered} t={t} language={language} fmt={fmt} onOpenSample={id=>navigate(`/laboratory/${id}`,{state:{returnTo:'/surveillance'}})}/>}<RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={size=>{setPageSize(size);setPage(1)}}/></div>
    {creation==='chooser'&&<SurveillanceSubjectChooser onClose={()=>setCreation(null)} onPatient={()=>setCreation('patient')} onEmployee={()=>setCreation('employee')} onBulkEmployee={()=>setCreation('bulk')} onEnvironmental={()=>setCreation('environmental')}/>} 
    {creation==='patient'&&<NewSurveillanceFlow patients={patients} departments={departments} onPatientsChange={setPatients} onClose={()=>setCreation(null)} onCreate={createPatient} onSaveAssessment={(record,draft)=>clinical.saveAssessment(record,draft)} onRequestSample={(record,draft)=>clinical.requestSample(record,draft)} onSaveIsolation={(record,draft)=>draft.required===false?clinical.setIsolationNotRequired(record):clinical.beginIsolation(record,draft)} onRecordChange={()=>{}}/>}
    {creation==='employee'&&(isDemo?<EmployeeSurveillanceFlow onClose={()=>setCreation(null)} onCreated={load}/>:<ProductionEmployeeSurveillanceFlow mode="single" onClose={()=>setCreation(null)} onCreated={load}/>)}
    {creation==='bulk'&&(isDemo?<BulkEmployeeSurveillanceFlow onClose={()=>setCreation(null)} onCreated={load}/>:<ProductionEmployeeSurveillanceFlow mode="bulk" onClose={()=>setCreation(null)} onCreated={load}/>)}
    {creation==='environmental'&&<EnvironmentalSurveillanceFlow isDemo={isDemo} departmentOptions={departments.map(x=>({value:x.id,label:x.name,labelEn:x.nameEn||x.name}))} createSample={createEnvironment} onClose={()=>setCreation(null)} onCreated={async()=>{setCreation(null);await load();setMode('environmental')}}/>}
  </Page>
}

function PatientRows({rows,registry,t,language,fmt,onOpen}){return <div className="scroll-table" ref={registry.scrollRef}><RegistryTable bare columns={[{key:'patient',label:t('patient')},{key:'department',label:t('department')},{key:'started',label:t('clinicalRecords.startedAt')},{key:'micro',label:t('microbiology')},{key:'status',label:t('status')},{key:'review',label:t('reassessment')}]} rows={rows} rowKey={x=>x.id} rowProps={x=>({...registry.rowProps(String(x.id),()=>onOpen(x)),className:'clickable-row'})} renderRow={x=><><td><strong>{language==='el'?x.patient:x.patientEn}</strong><small>{x.patientId||'—'}</small></td><td>{language==='el'?x.department:x.departmentEn}</td><td>{fmt(x.startedAt)}</td><td><strong>{latestOrganism(x)||'—'}</strong><small>{latestResistance(x)||''}</small></td><td><span className={`status-badge ${x.status==='active'?'active':''}`}>{t(x.status)}</span></td><td>{fmt(x.reviewDue)}</td></>}/></div>}
function EmployeeRows({rows,registry,language,fmt}){return <div className="scroll-table" ref={registry.scrollRef}><RegistryTable bare columns={[{key:'name',label:language==='en'?'Employee':'Εργαζόμενος'},{key:'department',label:language==='en'?'Department':'Τμήμα'},{key:'date',label:language==='en'?'Started':'Έναρξη'},{key:'screening',label:language==='en'?'Screening':'Έλεγχος'},{key:'result',label:language==='en'?'Result':'Αποτέλεσμα'}]} rows={rows} rowKey={x=>x.recordId||x.id} renderRow={x=><><td><strong>{language==='en'?x.employeeNameEn:x.employeeName}</strong><small>{x.employeeId||'—'}</small></td><td>{language==='en'?x.departmentEn:x.department}</td><td>{fmt(x.startedAt)}</td><td>{(x.screeningTypes||[]).join(', ')}</td><td><span className={`status-badge ${x.resultStatus==='positive'?'danger':''}`}>{x.resultStatus||'pending'}</span></td></>}/></div>}
function BatchRows({rows,registry,language,fmt}){return <div className="scroll-table" ref={registry.scrollRef}><RegistryTable bare columns={[{key:'batch',label:language==='en'?'Batch':'Ομάδα'},{key:'department',label:language==='en'?'Department':'Τμήμα'},{key:'date',label:language==='en'?'Started':'Έναρξη'},{key:'count',label:language==='en'?'Employees':'Εργαζόμενοι'},{key:'positive',label:language==='en'?'Positive':'Θετικά'}]} rows={rows} rowKey={x=>x.recordId||x.id} renderRow={x=><><td><strong>{x.id}</strong></td><td>{language==='en'?x.departmentEn:x.department}</td><td>{fmt(x.startedAt)}</td><td>{x.employeeCount??x.records?.length??0}</td><td>{x.positiveCount??0}</td></>}/></div>}
function SummaryMetric({icon:Icon,label,value}){return <MetricCard className="summary-metric" icon={Icon} label={label} value={value}/>}
