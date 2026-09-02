import { useEffect, useMemo, useState } from 'react'
import { Activity, ArrowRightLeft, LogOut, UsersRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { RecordActions } from '../../design-system/RecordActions'
import { FilterBar, FilterSelect } from '../../design-system/FilterBar'
import { UI_ACTIONS } from '../../core/actions/actionPolicy'
import { CAPABILITIES } from '../../core/permissions/roles'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { loadPatients, createPatient } from './patientsService'
import { demoLibrarySeed } from '../management/managementData'
import { loadDepartments } from '../management/departmentsService'
import { ManualDateField } from '../../design-system/ManualDateField'
import { downloadCsv } from '../../core/export/csvExport'
import { MetricCard } from '../../design-system/MetricCard'

export function PatientsPage(){
  const {t,language,locale}=useLanguage()
  const {notify}=useFeedback()
  const navigate=useNavigate()
  const {canAccessRecord,tenant,isDemo}=useTenant()
  const registry=useRegistryMemory('patients')
  const saved=registry.loadViewState({query:'',department:'all',status:'all'})
  const [query,setQuery]=useState(saved.query)
  const [patients,setPatients]=useState([])
  const [departmentOptions,setDepartmentOptions]=useState([])
  const [department,setDepartment]=useState(saved.department)
  const [status,setStatus]=useState(saved.status)
  const [newOpen,setNewOpen]=useState(false)
  useEffect(()=>{
    let alive=true
    loadPatients(tenant?.id,{isDemo}).then(list=>{if(alive)setPatients(list)}).catch(error=>{if(alive)notify(error?.message||t('patientsLoadFailed'),'danger')})
    if(isDemo){
      setDepartmentOptions(demoLibrarySeed.departments.map(([el,en],index)=>({id:`demo-department-${index}`,name:el,nameEn:en,is_active:true})))
    }else{
      loadDepartments(tenant?.id).then(list=>{if(alive)setDepartmentOptions((list||[]).filter(item=>item.is_active!==false).map(item=>({...item,nameEn:item.name})))}).catch(error=>{if(alive)notify(error?.message||t('actionFailed'),'danger')})
    }
    return ()=>{alive=false}
  },[tenant?.id,isDemo,notify,t])
  const departments=useMemo(()=>[...new Set(patients.map(p=>language==='el'?p.department:p.departmentEn).filter(Boolean))],[patients,language])
  const rows=useMemo(()=>patients
    .filter(p=>canAccessRecord(p))
    .filter(p=>`${p.id} ${p.name} ${p.nameEn||''} ${p.hospitalRecordNumber||''}`.toLowerCase().includes(query.toLowerCase()))
    .filter(p=>department==='all'||(language==='el'?p.department:p.departmentEn)===department)
    .filter(p=>status==='all'||p.status===status),[query,patients,department,status,language,canAccessRecord])
  const fmt=value=>value?new Intl.DateTimeFormat(locale).format(new Date(`${value}T12:00:00`)):'—'
  const pageCaps={[UI_ACTIONS.CREATE]:CAPABILITIES.CREATE_PATIENT}
  function pageAction(action){
    if(action===UI_ACTIONS.CREATE)setNewOpen(true)
    else if(action===UI_ACTIONS.PRINT)window.print()
    else if(action===UI_ACTIONS.EXPORT){downloadCsv('limoxis-patients.csv',[t('patientId'),t('name'),t('department'),t('admissionDate'),t('status')],rows.map(x=>[x.id,language==='el'?x.name:(x.nameEn||x.name),language==='el'?x.department:x.departmentEn,x.admissionDate,t(x.status)]));notify(t('currentListExported'),'success')}
    else notify(t('actionCompleted'),'success')
  }
  async function savePatient(draft){
    try{
      const {record:patient,list}=await createPatient(tenant?.id,patients,draft,{isDemo})
      setPatients(list)
      setNewOpen(false)
      setQuery('')
      setDepartment('all')
      setStatus('all')
      notify(t('patientCreated'),'success')
      requestAnimationFrame(()=>{
        registry.saveViewState({query:'',department:'all',status:'all'})
        registry.openRecord(navigate,`/patients/${patient.id}`,patient.id,rows.map(x=>x.id))
      })
    }catch(error){
      notify(error?.duplicateCode?t('patientCodeDuplicate'):(error?.message||t('patientSaveFailed')),'danger')
    }
  }
  const activeAdvancedCount=(department!=='all'?1:0)+(status!=='all'?1:0)
  const scopedPatients=patients.filter(p=>canAccessRecord(p))
  const patientSummary={
    total:scopedPatients.length,
    active:scopedPatients.filter(p=>p.status==='active').length,
    discharged:scopedPatients.filter(p=>p.status==='discharged').length,
    transferred:scopedPatients.filter(p=>p.status==='transferred').length,
  }
  return <Page fill title={t('patientRegistry')} subtitle={t('patientRegistrySubtitle')} actions={<RecordActions actions={[UI_ACTIONS.CREATE,UI_ACTIONS.PRINT,UI_ACTIONS.EXPORT]} actionCapabilities={pageCaps} onAction={pageAction}/>}>
    <div className="workspace-summary patient-summary-strip" aria-label={t('patientRegistry')}>
      <PatientSummaryMetric icon={UsersRound} label={t('all')} value={patientSummary.total}/>
      <PatientSummaryMetric icon={Activity} label={t('active')} value={patientSummary.active} kind="active"/>
      <PatientSummaryMetric icon={LogOut} label={t('discharged')} value={patientSummary.discharged}/>
      <PatientSummaryMetric icon={ArrowRightLeft} label={t('transferred')} value={patientSummary.transferred}/>
    </div>
    <div className="surface clinical-surface workspace-fill patient-registry-shell">
      <FilterBar query={query} onQueryChange={setQuery} placeholder={t('searchPatients')} activeAdvancedCount={activeAdvancedCount} onClear={()=>{setQuery('');setDepartment('all');setStatus('all')}}>
        <FilterSelect label={t('department')} value={department} onChange={setDepartment}><option value="all">{t('allDepartments')}</option>{departments.map(x=><option key={x} value={x}>{x}</option>)}</FilterSelect>
        <FilterSelect label={t('status')} value={status} onChange={setStatus}><option value="all">{t('all')}</option><option value="active">{t('active')}</option><option value="discharged">{t('discharged')}</option><option value="transferred">{t('transferred')}</option></FilterSelect>
      </FilterBar>
      <div className="scroll-table" ref={registry.scrollRef}><table className="data-table sticky-table"><thead><tr><th>{t('patientId')}</th><th>{t('name')}</th><th>{t('department')}</th><th>{t('admissionDate')}</th><th>{t('status')}</th></tr></thead><tbody>{rows.map(patient=><tr key={patient.id} {...registry.rowProps(patient.id)} onClick={()=>{registry.saveViewState({query,department,status});registry.openRecord(navigate,`/patients/${patient.id}`,patient.id,rows.map(x=>x.id))}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();registry.saveViewState({query,department,status});registry.openRecord(navigate,`/patients/${patient.id}`,patient.id,rows.map(x=>x.id))}}}><td><strong>{patient.id}</strong>{patient.hospitalRecordNumber&&<small>{patient.hospitalRecordNumber}</small>}</td><td>{language==='el'?patient.name:(patient.nameEn||patient.name)}</td><td>{language==='el'?patient.department:patient.departmentEn}</td><td>{fmt(patient.admissionDate)}</td><td><span className={`status-badge ${patient.status==='active'?'active':''}`}>{t(patient.status)}</span></td></tr>)}</tbody></table></div>
    </div>
    {newOpen&&<NewPatientCard t={t} language={language} departments={departmentOptions} onClose={()=>setNewOpen(false)} onSave={savePatient}/>}
  </Page>
}

function PatientSummaryMetric({icon,label,value,kind=''}){return <MetricCard icon={icon} value={value} label={label} tone={kind||'neutral'}/>}

function NewPatientCard({t,language,departments,onClose,onSave}){
  const firstDepartment=departments?.[0]||null
  const [draft,setDraft]=useState({
    patientCode:'',firstName:'',lastName:'',fatherName:'',hospitalRecordNumber:'',
    dateOfBirth:'',sex:'',departmentId:firstDepartment?.id||'',department:firstDepartment?.name||'',departmentEn:firstDepartment?.nameEn||firstDepartment?.name||'',
    admissionDate:new Date().toISOString().slice(0,10),status:'active',notes:''
  })
  useEffect(()=>{
    if(draft.departmentId||!departments?.length)return
    const first=departments[0]
    setDraft(current=>({...current,departmentId:first.id,department:first.name,departmentEn:first.nameEn||first.name}))
  },[departments,draft.departmentId])
  const set=(key,value)=>setDraft(d=>({...d,[key]:value}))
  function setDepartment(id){
    const item=departments.find(value=>value.id===id)
    setDraft(d=>({...d,departmentId:id,department:item?.name||'',departmentEn:item?.nameEn||item?.name||''}))
  }
  function save(){
    const first=draft.firstName.trim()
    const last=draft.lastName.trim()
    if(!draft.patientCode.trim()||!first||!last||!draft.admissionDate)return
    onSave({...draft,patientCode:draft.patientCode.trim(),name:`${first} ${last}`.trim(),nameEn:`${first} ${last}`.trim()})
  }
  return <div className="modal-backdrop">
    <div className="entry-card patient-entry-card">
      <header><div><span className="eyebrow">{t('patients')}</span><h3>{t('newPatient')}</h3><p>{t('newPatientHelp')}</p></div><button className="icon-close" onClick={onClose}>×</button></header>
      <div className="entry-grid">
        <label><span>{t('patientId')}</span><input autoFocus value={draft.patientCode} onChange={e=>set('patientCode',e.target.value)}/></label>
        <label><span>{t('firstName')}</span><input value={draft.firstName} onChange={e=>set('firstName',e.target.value)}/></label>
        <label><span>{t('lastName')}</span><input value={draft.lastName} onChange={e=>set('lastName',e.target.value)}/></label>
        <label><span>{t('fatherName')}</span><input value={draft.fatherName} onChange={e=>set('fatherName',e.target.value)}/></label>
        <label><span>{t('hospitalRecordNumber')}</span><input value={draft.hospitalRecordNumber} onChange={e=>set('hospitalRecordNumber',e.target.value)}/></label>
        <ManualDateField label={t('dateOfBirth')} value={draft.dateOfBirth} onChange={v=>set('dateOfBirth',v)}/>
        <label><span>{t('sex')}</span><select value={draft.sex} onChange={e=>set('sex',e.target.value)}><option value="">{t('select')}</option><option value="female">{t('female')}</option><option value="male">{t('male')}</option><option value="other">{t('other')}</option></select></label>
        <label><span>{t('department')}</span><select value={draft.departmentId} onChange={e=>setDepartment(e.target.value)}><option value="">{t('select')}</option>{departments.map(item=><option key={item.id} value={item.id}>{language==='el'?item.name:(item.nameEn||item.name)}</option>)}</select></label>
        <ManualDateField label={t('admissionDate')} value={draft.admissionDate} onChange={v=>set('admissionDate',v)}/>
        <label className="entry-span-2"><span>{t('notes')}</span><textarea rows={3} value={draft.notes} onChange={e=>set('notes',e.target.value)}/></label>
      </div>
      <footer><Button variant="secondary" onClick={onClose}>{t('cancel')}</Button><SaveButton disabled={!draft.patientCode.trim()||!draft.firstName.trim()||!draft.lastName.trim()||!draft.admissionDate} onClick={save}>{t('save')}</SaveButton></footer>
    </div>
  </div>
}
