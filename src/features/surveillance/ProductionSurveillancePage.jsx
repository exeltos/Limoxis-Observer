import { useEffect,useMemo,useState } from 'react'
import { Activity,AlertTriangle,Clock3,LockKeyhole,Microscope,ShieldCheck,Users } from 'lucide-react'
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
import { createClinicalCase,loadClinicalCases } from './clinicalCloudService'
import { downloadRecordJson } from '../../core/export/recordExport'

const today=()=>new Date().toISOString().slice(0,10)
const reviewState=row=>row.status!=='active'?'completed':row.reviewDue&&new Date(`${row.reviewDue}T23:59:59`)<new Date()?'overdue':'inProgress'
const latestOrganism=row=>row.samples?.find(sample=>sample.organism)?.organism||null
const latestResistance=row=>row.samples?.find(sample=>sample.resistance)?.resistance||null

export function ProductionSurveillancePage(){
  const {tenant,role,canAccessRecord,canSeeSensitiveEmployeeHealth}=useTenant()
  const {t,language,locale}=useLanguage()
  const {notify,notifyError}=useFeedback()
  const navigate=useNavigate()
  const [records,setRecords]=useState([])
  const [patients,setPatients]=useState([])
  const [loading,setLoading]=useState(true)
  const [query,setQuery]=useState('')
  const [department,setDepartment]=useState('all')
  const [resistance,setResistance]=useState('all')
  const [review,setReview]=useState('all')
  const [registryMode,setRegistryMode]=useState('patients')
  const [createOpen,setCreateOpen]=useState(false)
  const [saving,setSaving]=useState(false)
  const [draft,setDraft]=useState({patientId:'',startedAt:today(),reviewDue:'',room:'',reason:''})
  const canSeeEmployeeSurveillance=Boolean(canSeeSensitiveEmployeeHealth)
  const canSeeEnvironmental=![ROLES.DEPARTMENT_MANAGER,ROLES.DEPARTMENT_USER,ROLES.DOCTOR_REVIEWER].includes(role)

  async function load(){
    if(!tenant?.id){setRecords([]);setPatients([]);setLoading(false);return}
    setLoading(true)
    try{const [caseRows,patientRows]=await Promise.all([loadClinicalCases(tenant.id),loadPatients(tenant.id,{isDemo:false})]);setRecords(caseRows);setPatients(patientRows)}
    catch(error){notifyError(error,'load',{operation:'surveillance_registry_load'});setRecords([])}
    finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[tenant?.id])

  const departments=useMemo(()=>[...new Set(records.map(row=>language==='el'?row.department:row.departmentEn).filter(Boolean))].sort(),[records,language])
  const rows=useMemo(()=>records.filter(row=>canAccessRecord(row)).filter(row=>`${row.id} ${row.patientId} ${row.patient} ${row.patientEn} ${latestOrganism(row)||''}`.toLowerCase().includes(query.trim().toLowerCase())).filter(row=>department==='all'||(language==='el'?row.department:row.departmentEn)===department).filter(row=>resistance==='all'||(resistance==='resistant'?Boolean(latestResistance(row)):!latestResistance(row))).filter(row=>review==='all'||reviewState(row)===review),[records,canAccessRecord,query,department,resistance,review,language])
  const active=records.filter(row=>row.status==='active').length
  const due=records.filter(row=>reviewState(row)==='overdue').length
  const isolation=records.filter(row=>row.isolation?.status==='active').length
  const resistant=records.filter(row=>Boolean(latestResistance(row))).length
  const fmt=value=>value?new Intl.DateTimeFormat(locale).format(new Date(`${String(value).slice(0,10)}T12:00:00`)):'—'

  async function createRecord(){
    const patient=patients.find(item=>item.id===draft.patientId)
    if(!patient||!draft.startedAt||!draft.reason.trim()||saving)return
    setSaving(true)
    try{const created=await createClinicalCase(tenant.id,patient.recordId,{startedAt:draft.startedAt,reviewDue:draft.reviewDue||null,room:draft.room.trim(),reason:draft.reason.trim(),departmentId:patient.departmentId||null});setRecords(current=>[created,...current]);setCreateOpen(false);setDraft({patientId:'',startedAt:today(),reviewDue:'',room:'',reason:''});notify(t('surveillanceCreated'),'success');navigate(`/surveillance/${created.id}`)}
    catch(error){notifyError(error,'save',{operation:'surveillance_create'})}
    finally{setSaving(false)}
  }

  return <Page fill title={t('clinicalRecords.surveillanceCenter')} subtitle={t('surveillanceSubtitleV051')} actions={<RecordActions actions={[UI_ACTIONS.CREATE,UI_ACTIONS.PRINT,UI_ACTIONS.EXPORT]} actionCapabilities={{[UI_ACTIONS.CREATE]:CAPABILITIES.CREATE_SURVEILLANCE}} onAction={action=>{if(action===UI_ACTIONS.CREATE){setCreateOpen(true);return}if(action===UI_ACTIONS.PRINT){window.print();return}if(action===UI_ACTIONS.EXPORT){downloadRecordJson(rows,{filename:'surveillance-production'});notify(t('currentListExported'),'success')}}}/>}>
    <div className="workspace-summary surveillance-summary"><div className="module-summary-strip"><SummaryMetric icon={Activity} label={t('activeSurveillance')} value={active}/><SummaryMetric icon={Clock3} label={t('clinicalRecords.needsReview')} value={due}/><SummaryMetric icon={AlertTriangle} label={t('clinicalRecords.activeIsolation')} value={isolation}/><SummaryMetric icon={Microscope} label={t('clinicalRecords.mdrXdr')} value={resistant}/></div><div className="governance-banner compact-governance"><ShieldCheck size={16}/><span>{t('clinicalRecords.parallelSurveillanceNote')}</span></div></div>

    <nav className="tabs surveillance-domain-tabs canonical-module-tabs" aria-label={t('surveillanceCategoriesAria')}>
      <button className={`tab ${registryMode==='patients'?'active':''}`} onClick={()=>setRegistryMode('patients')}><Activity size={14}/>{t('patients')} <span className="tab-count">{records.length}</span></button>
      <button className={`tab ${registryMode==='employees'?'active':''}`} disabled={!canSeeEmployeeSurveillance} title={!canSeeEmployeeSurveillance?t('sensitiveEmployeeHealthPermissionRequired'):''} onClick={()=>canSeeEmployeeSurveillance&&setRegistryMode('employees')}><Users size={14}/>{t('employees')} {canSeeEmployeeSurveillance?<span className="tab-count">0</span>:<LockKeyhole size={12}/>}</button>
      <button className={`tab ${registryMode==='batches'?'active':''}`} disabled={!canSeeEmployeeSurveillance} title={!canSeeEmployeeSurveillance?t('sensitiveEmployeeHealthPermissionRequired'):''} onClick={()=>canSeeEmployeeSurveillance&&setRegistryMode('batches')}><Users size={14}/>{t('clinicalRecords.bulkSurveillance')} {canSeeEmployeeSurveillance?<span className="tab-count">0</span>:<LockKeyhole size={12}/>}</button>
      <button className={`tab ${registryMode==='environmental'?'active':''}`} disabled={!canSeeEnvironmental} onClick={()=>canSeeEnvironmental&&setRegistryMode('environmental')}><Microscope size={14}/>{t('clinicalRecords.environment')} <span className="tab-count">0</span></button>
    </nav>

    {registryMode==='patients'&&<div className="workspace-fill surface surveillance-workspace"><FilterBar query={query} onQueryChange={setQuery} placeholder={t('clinicalRecords.searchSurveillance')} activeAdvancedCount={(department!=='all'?1:0)+(resistance!=='all'?1:0)+(review!=='all'?1:0)} onClear={()=>{setQuery('');setDepartment('all');setResistance('all');setReview('all')}} advanced={<><FilterSelect label={t('clinicalRecords.resistance')} value={resistance} onChange={setResistance}><option value="all">{t('all')}</option><option value="resistant">{t('clinicalRecords.mdrXdr')}</option><option value="none">{t('clinicalRecords.noResistanceFlag')}</option></FilterSelect><FilterSelect label={t('reassessment')} value={review} onChange={setReview}><option value="all">{t('all')}</option><option value="overdue">{t('overdue')}</option><option value="inProgress">{t('inProgress')}</option><option value="completed">{t('completed')}</option></FilterSelect></>}><FilterSelect label={t('department')} value={department} onChange={setDepartment}><option value="all">{t('allDepartments')}</option>{departments.map(value=><option key={value} value={value}>{value}</option>)}</FilterSelect></FilterBar>{loading?<div className="inline-empty">{t('loading')}</div>:rows.length?<div className="surveillance-list surveillance-registry scroll-list"><div className="surveillance-registry-head"><span>{t('surveillance')}</span><span>{t('patient')}</span><span>{t('department')}</span><span>{t('clinicalRecords.startedAt')}</span><span>{t('microbiology')}</span><span>{t('status')}</span><span>{t('reassessment')}</span></div>{rows.map(item=>{const state=reviewState(item);return <article key={item.id} className="surveillance-registry-row" tabIndex={0} onClick={()=>navigate(`/surveillance/${item.id}`)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();navigate(`/surveillance/${item.id}`)}}}><div className="surv-main"><strong>{item.id}</strong><small>{item.patientId}</small></div><div className="surv-patient"><strong>{language==='el'?item.patient:item.patientEn}</strong></div><div><span>{language==='el'?item.department:item.departmentEn}</span></div><div><span>{fmt(item.startedAt)}</span></div><div className="surv-micro"><strong>{latestOrganism(item)||'—'}</strong>{latestResistance(item)&&<span className="risk-badge">{latestResistance(item)}</span>}</div><div className="surv-status"><span className={`status-badge ${item.status==='active'?'active':''}`}>{item.status==='active'?t('clinicalRecords.activeSurveillanceState'):t('completed')}</span>{item.isolation?.status==='active'&&<span className="status-badge active">{t('isolation')}</span>}</div><div className={`surv-review ${state==='overdue'?'overdue':''}`}><strong>{fmt(item.reviewDue)}</strong><small>{t(state)}</small></div></article>})}</div>:<div className="empty-state"><strong>{language==='en'?'No surveillance records':'Δεν υπάρχουν καταγραφές επιτήρησης'}</strong><span>{language==='en'?'No surveillance records have been stored for this organization yet.':'Δεν έχουν καταχωριστεί ακόμη εγγραφές επιτήρησης για τον συγκεκριμένο οργανισμό.'}</span></div>}</div>}

    {registryMode==='employees'&&<ProductionUnavailable title={t('employees')} text={language==='en'?'Employee surveillance will appear here when organization-backed records are available.':'Η επιτήρηση εργαζομένων θα εμφανίζεται εδώ όταν υπάρχουν καταχωρίσεις του οργανισμού.'}/>} 
    {registryMode==='batches'&&<ProductionUnavailable title={t('clinicalRecords.bulkSurveillance')} text={language==='en'?'Organization-backed bulk surveillance is not populated yet.':'Δεν υπάρχουν ακόμη μαζικές καταχωρίσεις επιτήρησης για τον οργανισμό.'}/>} 
    {registryMode==='environmental'&&<ProductionUnavailable title={t('clinicalRecords.environment')} text={language==='en'?'Environmental surveillance will use organization laboratory and environmental records.':'Η περιβαλλοντική επιτήρηση θα εμφανίζει τις εργαστηριακές και περιβαλλοντικές καταχωρίσεις του οργανισμού.'}/>} 

    {createOpen&&<ObserverDialog width="wide" eyebrow={language==='en'?'Surveillance':'Επιτήρηση'} title={language==='en'?'Start surveillance':'Έναρξη επιτήρησης'} subtitle={language==='en'?'The record will be stored in the organization database.':'Η εγγραφή θα αποθηκευτεί στη βάση του οργανισμού.'} onClose={()=>!saving&&setCreateOpen(false)} footer={<SaveButton loading={saving} disabled={!draft.patientId||!draft.startedAt||!draft.reason.trim()} onClick={createRecord}>{language==='en'?'Create surveillance':'Δημιουργία επιτήρησης'}</SaveButton>}><div className="entry-grid compact"><label className="field entry-span-2"><span>{t('patient')} *</span><select value={draft.patientId} onChange={event=>setDraft(current=>({...current,patientId:event.target.value}))}><option value="">{language==='en'?'Select patient…':'Επιλογή ασθενούς…'}</option>{patients.map(patient=><option key={patient.id} value={patient.id}>{patient.id} · {patient.name} · {patient.department||'—'}</option>)}</select></label><ManualDateField label={`${language==='en'?'Start date':'Ημερομηνία έναρξης'} *`} value={draft.startedAt} onChange={value=>setDraft(current=>({...current,startedAt:value}))}/><ManualDateField label={language==='en'?'Review due':'Επανεκτίμηση έως'} value={draft.reviewDue} onChange={value=>setDraft(current=>({...current,reviewDue:value}))}/><label className="field"><span>{language==='en'?'Room':'Θάλαμος'}</span><input value={draft.room} onChange={event=>setDraft(current=>({...current,room:event.target.value}))}/></label><label className="field"><span>{language==='en'?'Reason / indication':'Αιτία / ένδειξη'} *</span><input value={draft.reason} onChange={event=>setDraft(current=>({...current,reason:event.target.value}))}/></label></div></ObserverDialog>}
  </Page>
}
function ProductionUnavailable({title,text}){return <div className="workspace-fill surface surveillance-workspace"><div className="empty-state"><strong>{title}</strong><span>{text}</span></div></div>}
function SummaryMetric({icon:Icon,label,value}){return <MetricCard className="summary-metric" icon={Icon} label={label} value={value}/>}