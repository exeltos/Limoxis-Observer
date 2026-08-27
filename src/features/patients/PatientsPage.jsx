import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { RecordActions } from '../../design-system/RecordActions'
import { FilterBar, FilterSelect } from '../../design-system/FilterBar'
import { UI_ACTIONS } from '../../core/actions/actionPolicy'
import { CAPABILITIES } from '../../core/permissions/roles'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { patientDemoData, createDemoPatient } from './patientDemoData'
import { demoLibrarySeed } from '../management/managementData'
import { ManualDateField } from '../../design-system/ManualDateField'

export function PatientsPage(){
  const {t,language,locale}=useLanguage()
  const {notify}=useFeedback()
  const navigate=useNavigate()
  const {canAccessRecord}=useTenant()
  const registry=useRegistryMemory('patients')
  const saved=registry.loadViewState({query:'',department:'all',status:'all'})
  const [query,setQuery]=useState(saved.query)
  const [patients,setPatients]=useState([...patientDemoData])
  const [department,setDepartment]=useState(saved.department)
  const [status,setStatus]=useState(saved.status)
  const [newOpen,setNewOpen]=useState(false)
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
    else notify(t('actionCompleted'),'success')
  }
  function savePatient(draft){
    const patient=createDemoPatient(draft)
    setPatients([...patientDemoData])
    setNewOpen(false)
    setQuery('')
    setDepartment('all')
    setStatus('all')
    notify(t('patientCreated'),'success')
    requestAnimationFrame(()=>{
      registry.saveViewState({query:'',department:'all',status:'all'})
      registry.openRecord(navigate,`/patients/${patient.id}`,patient.id)
    })
  }
  const activeAdvancedCount=(department!=='all'?1:0)+(status!=='all'?1:0)
  return <Page fill title={t('patientRegistry')} subtitle={t('patientRegistrySubtitle')} actions={<RecordActions actions={[UI_ACTIONS.CREATE,UI_ACTIONS.PRINT,UI_ACTIONS.EXPORT]} actionCapabilities={pageCaps} onAction={pageAction}/>}>
    <div className="surface clinical-surface workspace-fill patient-registry-shell">
      <FilterBar query={query} onQueryChange={setQuery} placeholder={t('searchPatients')} activeAdvancedCount={activeAdvancedCount} onClear={()=>{setQuery('');setDepartment('all');setStatus('all')}}>
        <FilterSelect label={t('department')} value={department} onChange={setDepartment}><option value="all">{t('allDepartments')}</option>{departments.map(x=><option key={x} value={x}>{x}</option>)}</FilterSelect>
        <FilterSelect label={t('status')} value={status} onChange={setStatus}><option value="all">{t('all')}</option><option value="active">{t('active')}</option><option value="discharged">{t('discharged')}</option><option value="transferred">{t('transferred')}</option></FilterSelect>
      </FilterBar>
      <div className="scroll-table" ref={registry.scrollRef}><table className="data-table sticky-table"><thead><tr><th>{t('patientId')}</th><th>{t('name')}</th><th>{t('department')}</th><th>{t('admissionDate')}</th><th>{t('status')}</th></tr></thead><tbody>{rows.map(patient=><tr key={patient.id} {...registry.rowProps(patient.id)} onClick={()=>{registry.saveViewState({query,department,status});registry.openRecord(navigate,`/patients/${patient.id}`,patient.id)}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();registry.saveViewState({query,department,status});registry.openRecord(navigate,`/patients/${patient.id}`,patient.id)}}}><td><strong>{patient.id}</strong>{patient.hospitalRecordNumber&&<small>{patient.hospitalRecordNumber}</small>}</td><td>{language==='el'?patient.name:(patient.nameEn||patient.name)}</td><td>{language==='el'?patient.department:patient.departmentEn}</td><td>{fmt(patient.admissionDate)}</td><td><span className={`status-badge ${patient.status==='active'?'active':''}`}>{t(patient.status)}</span></td></tr>)}</tbody></table></div>
    </div>
    {newOpen&&<NewPatientCard t={t} language={language} onClose={()=>setNewOpen(false)} onSave={savePatient}/>}
  </Page>
}

function NewPatientCard({t,language,onClose,onSave}){
  const firstDepartment=demoLibrarySeed.departments?.[0]||['','']
  const [draft,setDraft]=useState({
    firstName:'',lastName:'',fatherName:'',hospitalRecordNumber:'',
    dateOfBirth:'',sex:'',department:firstDepartment[0],departmentEn:firstDepartment[1],
    admissionDate:new Date().toISOString().slice(0,10),status:'active',notes:''
  })
  const set=(key,value)=>setDraft(d=>({...d,[key]:value}))
  function setDepartment(el){
    const pair=demoLibrarySeed.departments.find(([value])=>value===el)||[el,el]
    setDraft(d=>({...d,department:pair[0],departmentEn:pair[1]}))
  }
  function save(){
    const first=draft.firstName.trim()
    const last=draft.lastName.trim()
    if(!first||!last||!draft.admissionDate)return
    onSave({
      ...draft,
      name:`${first} ${last}`.trim(),
      nameEn:`${first} ${last}`.trim(),
    })
  }
  return <div className="modal-backdrop">
    <div className="entry-card patient-entry-card">
      <header><div><span className="eyebrow">{t('patients')}</span><h3>{t('newPatient')}</h3><p>{t('newPatientHelp')}</p></div><button className="icon-close" onClick={onClose}>×</button></header>
      <div className="entry-grid">
        <label><span>{t('firstName')}</span><input autoFocus value={draft.firstName} onChange={e=>set('firstName',e.target.value)}/></label>
        <label><span>{t('lastName')}</span><input value={draft.lastName} onChange={e=>set('lastName',e.target.value)}/></label>
        <label><span>{t('fatherName')}</span><input value={draft.fatherName} onChange={e=>set('fatherName',e.target.value)}/></label>
        <label><span>{t('hospitalRecordNumber')}</span><input value={draft.hospitalRecordNumber} onChange={e=>set('hospitalRecordNumber',e.target.value)}/></label>
        <ManualDateField label={t('dateOfBirth')} value={draft.dateOfBirth} onChange={v=>set('dateOfBirth',v)}/>
        <label><span>{t('sex')}</span><select value={draft.sex} onChange={e=>set('sex',e.target.value)}><option value="">{t('select')}</option><option value="female">{t('female')}</option><option value="male">{t('male')}</option><option value="other">{t('other')}</option></select></label>
        <label><span>{t('department')}</span><select value={draft.department} onChange={e=>setDepartment(e.target.value)}>{demoLibrarySeed.departments.map(([el,en])=><option key={el} value={el}>{language==='el'?el:en}</option>)}</select></label>
        <ManualDateField label={t('admissionDate')} value={draft.admissionDate} onChange={v=>set('admissionDate',v)}/>
        <label className="entry-span-2"><span>{t('notes')}</span><textarea rows={3} value={draft.notes} onChange={e=>set('notes',e.target.value)}/></label>
      </div>
      <footer><Button variant="secondary" onClick={onClose}>{t('cancel')}</Button><Button disabled={!draft.firstName.trim()||!draft.lastName.trim()||!draft.admissionDate} onClick={save}>{t('save')}</Button></footer>
    </div>
  </div>
}
