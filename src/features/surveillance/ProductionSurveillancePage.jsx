import { useEffect,useMemo,useState } from 'react'
import { Activity,AlertTriangle,Clock3,Microscope,ShieldCheck,Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { RecordActions } from '../../design-system/RecordActions'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { SaveButton } from '../../design-system/SaveButton'
import { ManualDateField } from '../../design-system/ManualDateField'
import { MetricCard } from '../../design-system/MetricCard'
import { UI_ACTIONS } from '../../core/actions/actionPolicy'
import { CAPABILITIES,ROLES } from '../../core/permissions/roles'
import { useTenant } from '../../core/tenant/TenantContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { loadPatients } from '../patients/patientsService'
import { loadLaboratorySamples } from '../laboratory/laboratoryCloudService'
import { createClinicalCase,loadClinicalCases } from './clinicalCloudService'
import { loadEmployeeSurveillanceBatches,loadEmployeeSurveillanceRecords,getEmployeeSurveillanceKpis } from './employeeSurveillanceCloudService'
import { ProductionEmployeeSurveillanceFlow } from './ProductionEmployeeSurveillanceFlow'

const PAGE_SIZE_OPTIONS=[15,25,50]
const today=()=>new Date().toISOString().slice(0,10)
const reviewState=row=>row.status!=='active'?'completed':row.reviewDue&&new Date(`${row.reviewDue}T23:59:59`)<new Date()?'overdue':'inProgress'
const latestOrganism=row=>row.samples?.find(sample=>sample.organism)?.organism||null
const latestResistance=row=>row.samples?.find(sample=>sample.resistance)?.resistance||null
const isEnvironmentalSample=row=>{
  const type=String(row.type||'').toLowerCase()
  return ['water','surface','environment','environmental','νερό','επιφάνεια','επιφανεια'].some(value=>type.includes(value))||!row.patientRecordId
}
const uniqueSorted=values=>[...new Set(values.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'el'))

export function ProductionSurveillancePage(){
  const {tenant,role,canAccessRecord,canSeeSensitiveEmployeeHealth}=useTenant()
  const {t,language,locale}=useLanguage()
  const {notify,notifyError}=useFeedback()
  const navigate=useNavigate()

  const [records,setRecords]=useState([])
  const [patients,setPatients]=useState([])
  const [labSamples,setLabSamples]=useState([])
  const [employeeRecords,setEmployeeRecords]=useState([])
  const [employeeBatches,setEmployeeBatches]=useState([])
  const [loading,setLoading]=useState(true)

  const [query,setQuery]=useState('')
  const [department,setDepartment]=useState('all')
  const [resistance,setResistance]=useState('all')
  const [review,setReview]=useState('all')

  const [environmentQuery,setEnvironmentQuery]=useState('')
  const [environmentType,setEnvironmentType]=useState('all')
  const [environmentDepartment,setEnvironmentDepartment]=useState('all')
  const [environmentStatus,setEnvironmentStatus]=useState('all')

  const [employeeQuery,setEmployeeQuery]=useState('')
  const [employeeDepartment,setEmployeeDepartment]=useState('all')
  const [employeeStatus,setEmployeeStatus]=useState('all')

  const [batchQuery,setBatchQuery]=useState('')
  const [batchDepartment,setBatchDepartment]=useState('all')

  const [registryMode,setRegistryMode]=useState('patients')
  const [page,setPage]=useState(1)
  const [pageSize,setPageSize]=useState(15)
  const [creationMode,setCreationMode]=useState(null)
  const [saving,setSaving]=useState(false)
  const [draft,setDraft]=useState({patientId:'',startedAt:today(),reviewDue:'',room:'',reason:''})

  const canSeeEmployeeSurveillance=Boolean(canSeeSensitiveEmployeeHealth)
  const canSeeEnvironmental=![ROLES.DEPARTMENT_MANAGER,ROLES.DEPARTMENT_USER,ROLES.DOCTOR_REVIEWER].includes(role)

  async function load(){
    if(!tenant?.id){
      setRecords([]);setPatients([]);setLabSamples([]);setEmployeeRecords([]);setEmployeeBatches([]);setLoading(false);return
    }
    setLoading(true)
    try{
      const [casesResult,patientsResult,samplesResult]=await Promise.allSettled([
        loadClinicalCases(tenant.id),
        loadPatients(tenant.id,{isDemo:false}),
        loadLaboratorySamples(tenant.id),
      ])
      if(casesResult.status==='fulfilled')setRecords(casesResult.value)
      else{setRecords([]);notifyError(casesResult.reason,'load',{operation:'surveillance_cases_load'})}
      if(patientsResult.status==='fulfilled')setPatients(patientsResult.value)
      else{setPatients([]);notifyError(patientsResult.reason,'load',{operation:'surveillance_patients_load'})}
      if(samplesResult.status==='fulfilled')setLabSamples(samplesResult.value)
      else{setLabSamples([]);notifyError(samplesResult.reason,'load',{operation:'surveillance_environment_load'})}

      if(canSeeEmployeeSurveillance){
        try{
          const employeeRows=await loadEmployeeSurveillanceRecords(tenant.id)
          const batchRows=await loadEmployeeSurveillanceBatches(tenant.id,employeeRows)
          setEmployeeRecords(employeeRows)
          setEmployeeBatches(batchRows)
        }catch(error){
          setEmployeeRecords([])
          setEmployeeBatches([])
          notifyError(error,'load',{operation:'employee_surveillance_registry_load'})
        }
      }else{
        setEmployeeRecords([])
        setEmployeeBatches([])
      }
    }finally{setLoading(false)}
  }

  useEffect(()=>{void load()},[tenant?.id,canSeeEmployeeSurveillance])
  useEffect(()=>{setPage(1)},[
    registryMode,pageSize,query,department,resistance,review,
    environmentQuery,environmentType,environmentDepartment,environmentStatus,
    employeeQuery,employeeDepartment,employeeStatus,batchQuery,batchDepartment
  ])

  const environmental=useMemo(()=>labSamples.filter(isEnvironmentalSample),[labSamples])
  const departments=useMemo(()=>uniqueSorted(records.map(row=>language==='el'?row.department:row.departmentEn)),[records,language])
  const environmentalTypes=useMemo(()=>uniqueSorted(environmental.map(row=>row.type)),[environmental])
  const environmentalDepartments=useMemo(()=>uniqueSorted(environmental.map(row=>row.department)),[environmental])
  const environmentalStatuses=useMemo(()=>uniqueSorted(environmental.map(row=>row.status)),[environmental])
  const employeeDepartments=useMemo(()=>uniqueSorted(employeeRecords.map(row=>language==='en'?row.departmentEn:row.department)),[employeeRecords,language])
  const employeeStatuses=useMemo(()=>uniqueSorted(employeeRecords.map(row=>row.resultStatus)),[employeeRecords])
  const batchDepartments=useMemo(()=>uniqueSorted(employeeBatches.map(row=>language==='en'?row.departmentEn:row.department)),[employeeBatches,language])

  const patientRows=useMemo(()=>records
    .filter(row=>canAccessRecord(row))
    .filter(row=>`${row.id} ${row.patientId} ${row.patient} ${row.patientEn} ${latestOrganism(row)||''}`.toLowerCase().includes(query.trim().toLowerCase()))
    .filter(row=>department==='all'||(language==='el'?row.department:row.departmentEn)===department)
    .filter(row=>resistance==='all'||(resistance==='resistant'?Boolean(latestResistance(row)):!latestResistance(row)))
    .filter(row=>review==='all'||reviewState(row)===review),[records,canAccessRecord,query,department,resistance,review,language])

  const environmentalRows=useMemo(()=>environmental
    .filter(row=>`${row.id||''} ${row.type||''} ${row.source||''} ${row.department||''} ${row.organism||''}`.toLowerCase().includes(environmentQuery.trim().toLowerCase()))
    .filter(row=>environmentType==='all'||row.type===environmentType)
    .filter(row=>environmentDepartment==='all'||row.department===environmentDepartment)
    .filter(row=>environmentStatus==='all'||row.status===environmentStatus),
    [environmental,environmentQuery,environmentType,environmentDepartment,environmentStatus])

  const employeeRows=useMemo(()=>employeeRecords
    .filter(row=>`${row.id||''} ${row.employeeId||''} ${row.employeeName||''} ${row.employeeNameEn||''}`.toLowerCase().includes(employeeQuery.trim().toLowerCase()))
    .filter(row=>employeeDepartment==='all'||(language==='en'?row.departmentEn:row.department)===employeeDepartment)
    .filter(row=>employeeStatus==='all'||row.resultStatus===employeeStatus),
    [employeeRecords,employeeQuery,employeeDepartment,employeeStatus,language])

  const batchRows=useMemo(()=>employeeBatches
    .filter(row=>`${row.id||''} ${row.department||''} ${row.departmentEn||''} ${(row.screeningTypes||[]).join(' ')}`.toLowerCase().includes(batchQuery.trim().toLowerCase()))
    .filter(row=>batchDepartment==='all'||(language==='en'?row.departmentEn:row.department)===batchDepartment),
    [employeeBatches,batchQuery,batchDepartment,language])

  const active=records.filter(row=>row.status==='active').length
  const due=records.filter(row=>reviewState(row)==='overdue').length
  const isolation=records.filter(row=>row.isolation?.status==='active').length
  const resistant=records.filter(row=>Boolean(latestResistance(row))).length
  const employeeKpis=getEmployeeSurveillanceKpis(employeeRecords)
  const employeeMode=registryMode==='employees'||registryMode==='batches'
  const fmt=value=>value?new Intl.DateTimeFormat(locale).format(new Date(`${String(value).slice(0,10)}T12:00:00`)):'—'

  const activeRows=registryMode==='environmental'?environmentalRows:registryMode==='employees'?employeeRows:registryMode==='batches'?batchRows:patientRows
  const totalPages=Math.max(1,Math.ceil(activeRows.length/pageSize))
  const safePage=Math.min(page,totalPages)
  const pagedRows=activeRows.slice((safePage-1)*pageSize,safePage*pageSize)

  async function createPatientRecord(){
    const patient=patients.find(item=>item.id===draft.patientId)
    if(!patient||!draft.startedAt||!draft.reason.trim()||saving)return
    setSaving(true)
    try{
      const created=await createClinicalCase(tenant.id,patient.recordId,{startedAt:draft.startedAt,reviewDue:draft.reviewDue||null,room:draft.room.trim(),reason:draft.reason.trim(),departmentId:patient.departmentId||null})
      setRecords(current=>[created,...current])
      setCreationMode(null)
      setDraft({patientId:'',startedAt:today(),reviewDue:'',room:'',reason:''})
      notify(t('surveillanceCreated'),'success')
      navigate(`/surveillance/${created.id}`)
    }catch(error){notifyError(error,'save',{operation:'surveillance_create'})}
    finally{setSaving(false)}
  }

  return <Page
    fill
    className="production-surveillance-page"
    title={t('clinicalRecords.surveillanceCenter')}
    subtitle={t('surveillanceSubtitleV051')}
    actions={<RecordActions
      actions={[UI_ACTIONS.CREATE]}
      actionCapabilities={{[UI_ACTIONS.CREATE]:CAPABILITIES.CREATE_SURVEILLANCE}}
      onAction={action=>{if(action===UI_ACTIONS.CREATE)setCreationMode('chooser')}}
    />}
  >
    <div className="workspace-summary surveillance-summary">
      <div className="module-summary-strip">
        {employeeMode?<>
          <SummaryMetric icon={Activity} label={t('clinicalRecords.activeEmployeeScreenings')} value={employeeKpis.active}/>
          <SummaryMetric icon={Microscope} label={t('clinicalRecords.positiveEmployeeScreenings')} value={employeeKpis.positive}/>
          <SummaryMetric icon={AlertTriangle} label={t('clinicalRecords.needsIntervention')} value={employeeKpis.needsIntervention}/>
          <SummaryMetric icon={Clock3} label={t('clinicalRecords.needsRecheck')} value={employeeKpis.needsRecheck}/>
        </>:<>
          <SummaryMetric icon={Activity} label={t('activeSurveillance')} value={active}/>
          <SummaryMetric icon={Clock3} label={t('clinicalRecords.needsReview')} value={due}/>
          <SummaryMetric icon={AlertTriangle} label={t('clinicalRecords.activeIsolation')} value={isolation}/>
          <SummaryMetric icon={Microscope} label={t('clinicalRecords.mdrXdr')} value={resistant}/>
        </>}
      </div>
      <div className="governance-banner compact-governance"><ShieldCheck size={16}/><span>{registryMode==='environmental'?t('clinicalRecords.environmentalSurveillanceGovernance'):t('clinicalRecords.parallelSurveillanceNote')}</span></div>
    </div>

    <nav className="tabs surveillance-domain-tabs canonical-module-tabs" aria-label={t('surveillanceCategoriesAria')}>
      <button className={`tab ${registryMode==='patients'?'active':''}`} onClick={()=>setRegistryMode('patients')}><Activity size={14}/>{t('patients')} <span className="tab-count">{patientRows.length}</span></button>
      {canSeeEmployeeSurveillance&&<>
        <button className={`tab ${registryMode==='employees'?'active':''}`} onClick={()=>setRegistryMode('employees')}><Users size={14}/>{t('employees')} <span className="tab-count">{employeeRows.length}</span></button>
        <button className={`tab ${registryMode==='batches'?'active':''}`} onClick={()=>setRegistryMode('batches')}><Users size={14}/>{t('clinicalRecords.bulkSurveillance')} <span className="tab-count">{batchRows.length}</span></button>
      </>}
      {canSeeEnvironmental&&<button className={`tab ${registryMode==='environmental'?'active':''}`} onClick={()=>setRegistryMode('environmental')}><Microscope size={14}/>{t('clinicalRecords.environment')} <span className="tab-count">{environmentalRows.length}</span></button>}
    </nav>

    <div className="workspace-fill surface surveillance-workspace production-surveillance-workspace">
      {registryMode==='patients'&&<FilterBar
        query={query}
        onQueryChange={setQuery}
        placeholder={t('clinicalRecords.searchSurveillance')}
        activeAdvancedCount={(department!=='all'?1:0)+(resistance!=='all'?1:0)+(review!=='all'?1:0)}
        onClear={()=>{setQuery('');setDepartment('all');setResistance('all');setReview('all')}}
        advanced={<>
          <FilterSelect label={t('department')} value={department} onChange={setDepartment}><option value="all">{t('allDepartments')}</option>{departments.map(value=><option key={value} value={value}>{value}</option>)}</FilterSelect>
          <FilterSelect label={t('clinicalRecords.resistance')} value={resistance} onChange={setResistance}><option value="all">{t('all')}</option><option value="resistant">{t('clinicalRecords.mdrXdr')}</option><option value="none">{t('clinicalRecords.noResistanceFlag')}</option></FilterSelect>
          <FilterSelect label={t('reassessment')} value={review} onChange={setReview}><option value="all">{t('all')}</option><option value="overdue">{t('overdue')}</option><option value="inProgress">{t('inProgress')}</option><option value="completed">{t('completed')}</option></FilterSelect>
        </>}
      />}

      {registryMode==='environmental'&&<FilterBar
        query={environmentQuery}
        onQueryChange={setEnvironmentQuery}
        placeholder={language==='en'?'Search sample, source, department or microorganism…':'Αναζήτηση δείγματος, πηγής, τμήματος ή μικροοργανισμού…'}
        activeAdvancedCount={(environmentType!=='all'?1:0)+(environmentDepartment!=='all'?1:0)+(environmentStatus!=='all'?1:0)}
        onClear={()=>{setEnvironmentQuery('');setEnvironmentType('all');setEnvironmentDepartment('all');setEnvironmentStatus('all')}}
        advanced={<>
          <FilterSelect label={language==='en'?'Type':'Τύπος'} value={environmentType} onChange={setEnvironmentType}><option value="all">{t('all')}</option>{environmentalTypes.map(value=><option key={value} value={value}>{value}</option>)}</FilterSelect>
          <FilterSelect label={t('department')} value={environmentDepartment} onChange={setEnvironmentDepartment}><option value="all">{t('allDepartments')}</option>{environmentalDepartments.map(value=><option key={value} value={value}>{value}</option>)}</FilterSelect>
          <FilterSelect label={t('status')} value={environmentStatus} onChange={setEnvironmentStatus}><option value="all">{t('all')}</option>{environmentalStatuses.map(value=><option key={value} value={value}>{value}</option>)}</FilterSelect>
        </>}
      />}

      {registryMode==='employees'&&canSeeEmployeeSurveillance&&<FilterBar
        query={employeeQuery}
        onQueryChange={setEmployeeQuery}
        placeholder={language==='en'?'Search employee surveillance…':'Αναζήτηση επιτήρησης εργαζομένου…'}
        activeAdvancedCount={(employeeDepartment!=='all'?1:0)+(employeeStatus!=='all'?1:0)}
        onClear={()=>{setEmployeeQuery('');setEmployeeDepartment('all');setEmployeeStatus('all')}}
        advanced={<>
          <FilterSelect label={t('department')} value={employeeDepartment} onChange={setEmployeeDepartment}><option value="all">{t('allDepartments')}</option>{employeeDepartments.map(value=><option key={value} value={value}>{value}</option>)}</FilterSelect>
          <FilterSelect label={t('status')} value={employeeStatus} onChange={setEmployeeStatus}><option value="all">{t('all')}</option>{employeeStatuses.map(value=><option key={value} value={value}>{value}</option>)}</FilterSelect>
        </>}
      />}

      {registryMode==='batches'&&canSeeEmployeeSurveillance&&<FilterBar
        query={batchQuery}
        onQueryChange={setBatchQuery}
        placeholder={language==='en'?'Search bulk surveillance…':'Αναζήτηση μαζικής επιτήρησης…'}
        activeAdvancedCount={batchDepartment!=='all'?1:0}
        onClear={()=>{setBatchQuery('');setBatchDepartment('all')}}
        advanced={<FilterSelect label={t('department')} value={batchDepartment} onChange={setBatchDepartment}><option value="all">{t('allDepartments')}</option>{batchDepartments.map(value=><option key={value} value={value}>{value}</option>)}</FilterSelect>}
      />}

      {loading?<div className="inline-empty">{t('loading')}</div>:<>
        {registryMode==='patients'&&<PatientRegistry rows={pagedRows} totalRows={patientRows.length} t={t} language={language} fmt={fmt} navigate={navigate}/>} 
        {registryMode==='environmental'&&<EnvironmentalRegistry rows={pagedRows} totalRows={environmentalRows.length} language={language} t={t} fmt={fmt} navigate={navigate}/>} 
        {registryMode==='employees'&&canSeeEmployeeSurveillance&&<EmployeeRegistry rows={pagedRows} totalRows={employeeRows.length} language={language} fmt={fmt}/>} 
        {registryMode==='batches'&&canSeeEmployeeSurveillance&&<BatchRegistry rows={pagedRows} totalRows={batchRows.length} language={language} fmt={fmt}/>} 
        <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={activeRows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/>
      </>}
    </div>

    {creationMode==='chooser'&&<SubjectChooser language={language} canEmployee={canSeeEmployeeSurveillance} canEnvironmental={canSeeEnvironmental} onClose={()=>setCreationMode(null)} onPatient={()=>setCreationMode('patient')} onEmployee={()=>setCreationMode('employee')} onBulk={()=>setCreationMode('bulk')} onEnvironmental={()=>{setCreationMode(null);navigate('/laboratory',{state:{returnTo:'/surveillance',createEnvironmental:true}})}}/>}

    {creationMode==='patient'&&<ObserverDialog width="wide" eyebrow={language==='en'?'Patient surveillance':'Επιτήρηση ασθενούς'} title={language==='en'?'Start surveillance':'Έναρξη επιτήρησης'} subtitle={language==='en'?'The record will be stored in the organization database.':'Η εγγραφή θα αποθηκευτεί στη βάση του οργανισμού.'} onClose={()=>!saving&&setCreationMode(null)} footer={<SaveButton loading={saving} disabled={!draft.patientId||!draft.startedAt||!draft.reason.trim()} onClick={createPatientRecord}>{language==='en'?'Create surveillance':'Δημιουργία επιτήρησης'}</SaveButton>}>
      <div className="entry-grid compact"><label className="field entry-span-2"><span>{t('patient')} *</span><select value={draft.patientId} onChange={event=>setDraft(current=>({...current,patientId:event.target.value}))}><option value="">{language==='en'?'Select patient…':'Επιλογή ασθενούς…'}</option>{patients.map(patient=><option key={patient.id} value={patient.id}>{patient.id} · {patient.name} · {patient.department||'—'}</option>)}</select></label><ManualDateField label={`${language==='en'?'Start date':'Ημερομηνία έναρξης'} *`} value={draft.startedAt} onChange={value=>setDraft(current=>({...current,startedAt:value}))}/><ManualDateField label={language==='en'?'Review due':'Επανεκτίμηση έως'} value={draft.reviewDue} onChange={value=>setDraft(current=>({...current,reviewDue:value}))}/><label className="field"><span>{language==='en'?'Room':'Θάλαμος'}</span><input value={draft.room} onChange={event=>setDraft(current=>({...current,room:event.target.value}))}/></label><label className="field"><span>{language==='en'?'Reason / indication':'Αιτία / ένδειξη'} *</span><input value={draft.reason} onChange={event=>setDraft(current=>({...current,reason:event.target.value}))}/></label></div>
    </ObserverDialog>}

    {creationMode==='employee'&&canSeeEmployeeSurveillance&&<ProductionEmployeeSurveillanceFlow mode="single" onClose={()=>setCreationMode(null)} onCreated={load}/>} 
    {creationMode==='bulk'&&canSeeEmployeeSurveillance&&<ProductionEmployeeSurveillanceFlow mode="bulk" onClose={()=>setCreationMode(null)} onCreated={load}/>} 
  </Page>
}

function SubjectChooser({language,canEmployee,canEnvironmental,onClose,onPatient,onEmployee,onBulk,onEnvironmental}){
  const en=language==='en'
  return <div className="modal-backdrop"><div className="entry-card surveillance-subject-chooser"><header><div><span className="eyebrow">{en?'Surveillance':'Επιτήρηση'}</span><h3>{en?'New surveillance':'Νέα επιτήρηση'}</h3><p>{en?'Choose the subject of the surveillance record.':'Επιλέξτε το αντικείμενο της επιτήρησης.'}</p></div><button className="icon-close" onClick={onClose}>×</button></header><div className="subject-choice-grid"><button onClick={onPatient}><span>01</span><strong>{en?'Patient':'Ασθενής'}</strong><small>{en?'Clinical surveillance episode':'Κλινικό επεισόδιο επιτήρησης'}</small></button>{canEmployee&&<button onClick={onEmployee}><span>02</span><strong>{en?'Employee':'Εργαζόμενος'}</strong><small>{en?'Individual employee screening':'Ατομικός έλεγχος εργαζομένου'}</small></button>}{canEmployee&&<button onClick={onBulk}><span>03</span><strong>{en?'Bulk employee surveillance':'Μαζική επιτήρηση εργαζομένων'}</strong><small>{en?'Department or multi-employee screening':'Έλεγχος πολλών εργαζομένων'}</small></button>}{canEnvironmental&&<button onClick={onEnvironmental}><span>04</span><strong>{en?'Environment':'Περιβάλλον'}</strong><small>{en?'Water, surfaces or environmental sample':'Νερό, επιφάνειες ή περιβαλλοντικό δείγμα'}</small></button>}</div></div></div>
}

function PatientRegistry({rows,totalRows,t,language,fmt,navigate}){
  return <div className="surveillance-list surveillance-registry scroll-list"><div className="surveillance-registry-head"><span>{t('surveillance')}</span><span>{t('patient')}</span><span>{t('department')}</span><span>{t('clinicalRecords.startedAt')}</span><span>{t('microbiology')}</span><span>{t('status')}</span><span>{t('reassessment')}</span></div>{totalRows?rows.map(item=>{const state=reviewState(item);return <article key={item.id} className="surveillance-registry-row" tabIndex={0} onClick={()=>navigate(`/surveillance/${item.id}`)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();navigate(`/surveillance/${item.id}`)}}}><div className="surv-main"><strong>{item.id}</strong><small>{item.patientId}</small></div><div className="surv-patient"><strong>{language==='el'?item.patient:item.patientEn}</strong></div><div>{language==='el'?item.department:item.departmentEn}</div><div>{fmt(item.startedAt)}</div><div className="surv-micro"><strong>{latestOrganism(item)||'—'}</strong>{latestResistance(item)&&<span className="risk-badge">{latestResistance(item)}</span>}</div><div className="surv-status"><span className={`status-badge ${item.status==='active'?'active':''}`}>{item.status==='active'?t('clinicalRecords.activeSurveillanceState'):t('completed')}</span>{item.isolation?.status==='active'&&<span className="status-badge active">{t('isolation')}</span>}</div><div className={`surv-review ${state==='overdue'?'overdue':''}`}><strong>{fmt(item.reviewDue)}</strong><small>{t(state)}</small></div></article>}):<RegistryEmpty title={language==='en'?'No surveillance records':'Δεν υπάρχουν καταγραφές επιτήρησης'} text={language==='en'?'No surveillance records have been stored for this organization yet.':'Δεν έχουν καταχωριστεί ακόμη εγγραφές επιτήρησης για τον συγκεκριμένο οργανισμό.'}/>}</div>
}

function EmployeeRegistry({rows,totalRows,language,fmt}){
  const en=language==='en'
  return <div className="surveillance-list surveillance-registry scroll-list"><div className="surveillance-registry-head"><span>{en?'Surveillance':'Επιτήρηση'}</span><span>{en?'Employee':'Εργαζόμενος'}</span><span>{en?'Department':'Τμήμα'}</span><span>{en?'Started':'Έναρξη'}</span><span>{en?'Screening':'Έλεγχος'}</span><span>{en?'Result':'Αποτέλεσμα'}</span><span>{en?'Recheck':'Επανέλεγχος'}</span></div>{totalRows?rows.map(item=><article key={item.recordId||item.id} className="surveillance-registry-row"><div className="surv-main"><strong>{item.id}</strong><small>{item.employeeId}</small></div><div className="surv-patient"><strong>{en?item.employeeNameEn:item.employeeName}</strong></div><div>{en?item.departmentEn:item.department}</div><div>{fmt(item.startedAt)}</div><div>{(item.screeningTypes||[]).join(', ')||'—'}</div><div className="surv-status"><span className={`status-badge ${item.resultStatus==='positive'?'active':''}`}>{item.resultStatus||'pending'}</span></div><div className={`surv-review ${item.recheckDue&&item.status==='active'?'overdue':''}`}><strong>{fmt(item.recheckDue)}</strong><small>{item.interventionStatus||'—'}</small></div></article>):<RegistryEmpty title={en?'No employee surveillance records':'Δεν υπάρχουν καταγραφές επιτήρησης εργαζομένων'} text={en?'No employee surveillance records have been stored for this organization yet.':'Δεν έχουν καταχωριστεί ακόμη επιτηρήσεις εργαζομένων για τον συγκεκριμένο οργανισμό.'}/>}</div>
}

function BatchRegistry({rows,totalRows,language,fmt}){
  const en=language==='en'
  return <div className="surveillance-list surveillance-registry scroll-list"><div className="surveillance-registry-head"><span>{en?'Batch':'Μαζική επιτήρηση'}</span><span>{en?'Department':'Τμήμα'}</span><span>{en?'Started':'Έναρξη'}</span><span>{en?'Employees':'Εργαζόμενοι'}</span><span>{en?'Active':'Ενεργές'}</span><span>{en?'Positive':'Θετικές'}</span><span>{en?'Screening':'Έλεγχος'}</span></div>{totalRows?rows.map(item=><article key={item.recordId||item.id} className="surveillance-registry-row"><div className="surv-main"><strong>{item.id}</strong></div><div>{en?item.departmentEn:item.department||'—'}</div><div>{fmt(item.startedAt)}</div><div><strong>{item.employeeCount}</strong></div><div>{item.activeCount}</div><div>{item.positiveCount}</div><div>{(item.screeningTypes||[]).join(', ')||'—'}</div></article>):<RegistryEmpty title={en?'No bulk surveillance records':'Δεν υπάρχουν μαζικές επιτηρήσεις'} text={en?'No bulk employee surveillance records have been stored for this organization yet.':'Δεν έχουν καταχωριστεί ακόμη μαζικές επιτηρήσεις εργαζομένων για τον συγκεκριμένο οργανισμό.'}/>}</div>
}

function EnvironmentalRegistry({rows,totalRows,language,t,fmt,navigate}){
  const en=language==='en'
  return <div className="surveillance-list surveillance-registry scroll-list"><div className="surveillance-registry-head"><span>{en?'Sample':'Δείγμα'}</span><span>{en?'Type / source':'Τύπος / πηγή'}</span><span>{t('department')}</span><span>{en?'Collected':'Συλλογή'}</span><span>{t('microbiology')}</span><span>{t('status')}</span><span>{en?'Priority':'Προτεραιότητα'}</span></div>{totalRows?rows.map(item=><article key={item.recordId||item.id} className="surveillance-registry-row" tabIndex={0} onClick={()=>navigate(`/laboratory/${item.id}`,{state:{returnTo:'/surveillance'}})} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();navigate(`/laboratory/${item.id}`,{state:{returnTo:'/surveillance'}})}}><div className="surv-main"><strong>{item.id}</strong></div><div><strong>{item.type||'—'}</strong><small>{item.source||'—'}</small></div><div>{item.department||'—'}</div><div>{fmt(item.collectedAt||item.requestedAt)}</div><div className="surv-micro"><strong>{item.organism||'—'}</strong>{item.resistance&&<span className="risk-badge">{item.resistance}</span>}</div><div className="surv-status"><span className={`status-badge ${item.status==='completed'?'':'active'}`}>{item.status||'—'}</span></div><div>{item.priority||'—'}</div></article>):<RegistryEmpty title={en?'No environmental surveillance records':'Δεν υπάρχουν περιβαλλοντικές καταγραφές'} text={en?'Water, surface and environmental laboratory samples for this organization will appear here.':'Τα δείγματα νερού, επιφανειών και περιβάλλοντος του συγκεκριμένου οργανισμού θα εμφανίζονται εδώ.'}/>}</div>
}

function RegistryPagination({language,page,totalPages,totalItems,pageSize,onPageChange,onPageSizeChange}){
  const en=language==='en'
  const start=totalItems?((page-1)*pageSize)+1:0
  const end=Math.min(page*pageSize,totalItems)
  return <div className="registry-pagination"><div className="registry-pagination-summary">{totalItems?`${start}–${end} ${en?'of':'από'} ${totalItems}`:(en?'0 records':'0 εγγραφές')}</div><div className="registry-pagination-controls"><label><span>{en?'Rows':'Γραμμές'}</span><select value={pageSize} onChange={event=>onPageSizeChange(Number(event.target.value))}>{PAGE_SIZE_OPTIONS.map(value=><option key={value} value={value}>{value}</option>)}</select></label><button type="button" disabled={page<=1} onClick={()=>onPageChange(page-1)} aria-label={en?'Previous page':'Προηγούμενη σελίδα'}>‹</button><span>{en?'Page':'Σελίδα'} {page} / {totalPages}</span><button type="button" disabled={page>=totalPages} onClick={()=>onPageChange(page+1)} aria-label={en?'Next page':'Επόμενη σελίδα'}>›</button></div></div>
}

function RegistryEmpty({title,text}){return <div className="empty-state surveillance-registry-empty"><strong>{title}</strong><span>{text}</span></div>}
function SummaryMetric({icon:Icon,label,value}){return <MetricCard className="summary-metric" icon={Icon} label={label} value={value}/>}
