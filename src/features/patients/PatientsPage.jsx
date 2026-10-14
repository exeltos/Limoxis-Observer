import { useEffect, useMemo, useState } from 'react'
import { Activity, ArrowRightLeft, LogOut, UsersRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { Page } from '../../design-system/Page'
import { RecordActions } from '../../design-system/RecordActions'
import { FilterBar, FilterSelect } from '../../design-system/FilterBar'
import { UI_ACTIONS, canPerform } from '../../core/actions/actionPolicy'
import { CAPABILITIES } from '../../core/permissions/roles'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { loadPatients } from './patientsService'
import { MetricCard } from '../../design-system/MetricCard'
import { RegistryTable } from '../../design-system/RegistryTable'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { listEmptyCopy } from '../../design-system/ListEmptyState'
import {ClinicalRiskFlags,ClinicalRiskLegendItems,clinicalRiskKinds} from '../clinical-scales/ClinicalRiskFlags'
import {PatientInfectionFlags} from './PatientInfectionFlags'
import {loadPatientInfectionFlags} from './patientInfectionFlagsService'
import {loadLatestPatientRiskFlags} from '../clinical-scales/patientRiskFlagsService'

export function PatientsPage(){
  const {t,language,locale}=useLanguage()
  const {notify}=useFeedback()
  const navigate=useNavigate()
  const {canAccessRecord,tenant,isDemo,role,actualRole,membership}=useTenant()
  const registry=useRegistryMemory('patients')
  const saved=registry.loadViewState({query:'',department:'all',status:'all'})
  const [query,setQuery]=useState(saved.query)
  const [patients,setPatients]=useState([])
  const [department,setDepartment]=useState(saved.department)
  const [status,setStatus]=useState(saved.status)
  const [page,setPage]=useState(1)
  const [pageSize,setPageSize]=useState(15)
  const [riskFlags,setRiskFlags]=useState({})
  const [infectionFlags,setInfectionFlags]=useState({})
  const [flagsReady,setFlagsReady]=useState(false)
  useEffect(()=>{
    let alive=true
    loadPatients(tenant?.id,{isDemo}).then(list=>{if(alive)setPatients(list)}).catch(error=>{if(alive)notify(error?.message||t('patientsLoadFailed'),'danger')})
    // The legend waits for both flag sets, so it appears once and complete.
    setFlagsReady(false)
    Promise.allSettled([
      loadLatestPatientRiskFlags(tenant?.id,{isDemo}).then(value=>{if(alive)setRiskFlags(value)}),
      loadPatientInfectionFlags(tenant?.id,{isDemo}).then(value=>{if(alive)setInfectionFlags(value)}),
    ]).then(()=>{if(alive)setFlagsReady(true)})
    return ()=>{alive=false}
  },[tenant?.id,isDemo,notify,t])
  useEffect(()=>{setPage(1)},[query,department,status,pageSize])
  const departments=useMemo(()=>[...new Set(patients.map(p=>language==='el'?p.department:p.departmentEn).filter(Boolean))],[patients,language])
  const rows=useMemo(()=>patients
    .filter(p=>canAccessRecord(p))
    .filter(p=>`${p.id} ${p.name} ${p.nameEn||''} ${p.hospitalRecordNumber||''}`.toLowerCase().includes(query.toLowerCase()))
    .filter(p=>department==='all'||(language==='el'?p.department:p.departmentEn)===department)
    .filter(p=>status==='all'||p.status===status),[query,patients,department,status,language,canAccessRecord])
  const totalPages=Math.max(1,Math.ceil(rows.length/pageSize))
  const safePage=Math.min(page,totalPages)
  const pagedRows=rows.slice((safePage-1)*pageSize,safePage*pageSize)
  const fmt=value=>value?new Intl.DateTimeFormat(locale).format(new Date(`${value}T12:00:00`)):'—'
  const pageCaps={[UI_ACTIONS.CREATE]:CAPABILITIES.CREATE_PATIENT}
  const canCreate=canPerform({role:role||actualRole,addOns:membership?.capabilities??[],customCapabilities:membership?.customCapabilities??[],action:UI_ACTIONS.CREATE,resourceCapability:CAPABILITIES.CREATE_PATIENT})
  function pageAction(action){
    if(action===UI_ACTIONS.CREATE){registry.saveViewState({query,department,status});navigate('/patients/new')}
  }
  const activeAdvancedCount=(department!=='all'?1:0)+(status!=='all'?1:0)
  const scopedPatients=patients.filter(p=>canAccessRecord(p))
  const patientSummary={
    total:scopedPatients.length,
    active:scopedPatients.filter(p=>p.status==='active').length,
    discharged:scopedPatients.filter(p=>p.status==='discharged').length,
    transferred:scopedPatients.filter(p=>p.status==='transferred').length,
  }
  const empty=listEmptyCopy({t,filtered:scopedPatients.length>0,title:t('patientRegistryEmptyTitle'),text:t('patientRegistryEmptyDescription'),hint:t('patientRegistryEmptyHint'),canCreate})
  return <Page fill title={t('patientRegistry')} subtitle={t('patientRegistrySubtitle')} actions={<RecordActions actions={[UI_ACTIONS.CREATE]} actionCapabilities={pageCaps} onAction={pageAction}/>}>
    <div className="workspace-summary patient-summary-strip" aria-label={t('patientRegistry')}>
      <PatientSummaryMetric icon={UsersRound} label={t('patientsCountAll')} value={patientSummary.total} filter="all" current={status} onFilter={setStatus}/>
      <PatientSummaryMetric icon={Activity} label={t('patientsCountActive')} value={patientSummary.active} kind="active" filter="active" current={status} onFilter={setStatus}/>
      <PatientSummaryMetric icon={LogOut} label={t('patientsCountDischarged')} value={patientSummary.discharged} filter="discharged" current={status} onFilter={setStatus}/>
      <PatientSummaryMetric icon={ArrowRightLeft} label={t('patientsCountTransferred')} value={patientSummary.transferred} filter="transferred" current={status} onFilter={setStatus}/>
    </div>
    <div className="surface clinical-surface workspace-fill patient-registry-shell">
      <FilterBar query={query} onQueryChange={setQuery} placeholder={t('searchPatients')} activeAdvancedCount={activeAdvancedCount} onClear={()=>{setQuery('');setDepartment('all');setStatus('all')}}>
        <FilterSelect label={t('department')} value={department} onChange={setDepartment}><option value="all">{t('allDepartments')}</option>{departments.map(x=><option key={x} value={x}>{x}</option>)}</FilterSelect>
        <FilterSelect label={t('status')} value={status} onChange={setStatus}><option value="all">{t('all')}</option><option value="active">{t('active')}</option><option value="discharged">{t('discharged')}</option><option value="transferred">{t('transferred')}</option></FilterSelect>
      </FilterBar>
      <PatientsLegend t={t} language={language} rows={patients} ready={flagsReady} riskFlags={riskFlags} infectionFlags={infectionFlags}/>
      <RegistryTable
        wrapperClassName="scroll-table"
        wrapperRef={registry.scrollRef}
        columns={[{key:'id',label:t('patientId')},{key:'name',label:t('name')},{key:'alerts',label:t('clinicalAlerts')},{key:'department',label:t('department')},{key:'admission',label:t('admissionDate')},{key:'status',label:t('status')}]}
        rows={pagedRows}
        rowKey={patient=>patient.id}
        rowProps={patient=>registry.rowProps(patient.id,()=>{registry.saveViewState({query,department,status});registry.openRecord(navigate,`/patients/${patient.id}`,patient.id,rows.map(x=>x.id))})}
        renderRow={patient=><><td><strong>{patient.id}</strong>{patient.hospitalRecordNumber&&<small>{patient.hospitalRecordNumber}</small>}</td><td>{language==='el'?patient.name:(patient.nameEn||patient.name)}</td><td><span className="patient-flags-cell"><PatientInfectionFlags flags={infectionFlags[patient.recordId]||infectionFlags[patient.id]} t={t} fmtDate={value=>fmt(String(value).slice(0,10))}/><ClinicalRiskFlags rows={riskFlags[patient.recordId]||riskFlags[patient.id]||[]} language={language} compact/></span></td><td>{language==='el'?patient.department:patient.departmentEn}</td><td>{fmt(patient.admissionDate)}</td><td><span className={`status-badge ${patient.status==='active'?'active':''}`}>{t(patient.status)}</span></td></>}
        emptyTitle={empty.title}
        emptyText={empty.text}
      />
      {rows.length>0&&<RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={rows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/>}
    </div>
  </Page>
}

// A summary card filters the registry by its status; clicking it again shows everyone.
function PatientSummaryMetric({icon,label,value,kind='',filter,current,onFilter}){const active=filter!=='all'&&current===filter;return <MetricCard icon={icon} value={value} label={label} tone={kind||'neutral'} active={active} onClick={onFilter?()=>onFilter(active?'all':filter):undefined}/>}

// One-line key for the alert badges in the registry. Built from all the
// organization's patients (not the current page or filter) so it stays the
// same while paging; while the flags load its line is held empty, so the table
// does not jump when it appears.
function PatientsLegend({t,language,rows,ready,riskFlags,infectionFlags}){
  if(!ready)return rows.length?<div className="patient-legend patient-legend-pending" aria-hidden="true"/>:null
  const kinds=[...new Set(rows.flatMap(p=>clinicalRiskKinds(riskFlags[p.recordId]||riskFlags[p.id]||[])))]
  const infection=rows.map(p=>infectionFlags[p.recordId]||infectionFlags[p.id]).filter(Boolean)
  const mdr=infection.some(f=>f.resistance),isolation=infection.some(f=>f.isolation)
  if(!kinds.length&&!mdr&&!isolation)return null
  return <div className="patient-legend" aria-label={t('patientsLegend')}>
    <strong>{t('patientsLegend')}:</strong>
    {mdr&&<span className="patient-legend-item"><span className="status-badge danger">MDR</span>{t('patientsLegendMdr')}</span>}
    {isolation&&<span className="patient-legend-item"><span className="status-badge temporary patient-isolation-flag">{t('infectionFlags.isolation')}</span></span>}
    <ClinicalRiskLegendItems kinds={kinds} language={language}/>
    {kinds.length>0&&<span className="patient-legend-tones"><i className="tone-danger"/>{t('patientsLegendHigh')}<i className="tone-warning"/>{t('patientsLegendModerate')}<i className="tone-active"/>{t('patientsLegendLow')}</span>}
  </div>
}
