import { useEffect, useMemo, useState } from 'react'
import { Activity, ArrowRightLeft, LogOut, Plus, UsersRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { Page } from '../../design-system/Page'
import { RecordActions } from '../../design-system/RecordActions'
import { FilterBar, FilterSelect } from '../../design-system/FilterBar'
import { UI_ACTIONS } from '../../core/actions/actionPolicy'
import { CAPABILITIES, can } from '../../core/permissions/roles'
import { useLanguage,translate} from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { loadPatients } from './patientsService'
import { ManualDateField } from '../../design-system/ManualDateField'
import { MetricCard } from '../../design-system/MetricCard'
import { RegistryTable } from '../../design-system/RegistryTable'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { formatDay } from '../../core/i18n/formatDay'
import { Field } from '../../design-system/Field'
import { useFormValidation } from '../../design-system/FormValidation'
import { PERIOD_DAYS,departmentOptions,inPeriod,listTexts } from '../surveillance/surveillanceOptions'
import {ClinicalRiskText} from '../clinical-scales/ClinicalRiskFlags'
import {PatientInfectionFlags} from './PatientInfectionFlags'
import {loadPatientInfectionFlags} from './patientInfectionFlagsService'
import {loadLatestPatientRiskFlags} from '../clinical-scales/patientRiskFlagsService'

export function PatientsPage(){
  const {t,language}=useLanguage()
  const {notify}=useFeedback()
  const navigate=useNavigate()
  const {canAccessRecord,tenant,isDemo,role,membership}=useTenant()
  const registry=useRegistryMemory('patients')
  const saved=registry.loadViewState({query:'',department:'all',status:'all',period:'all'})
  const [query,setQuery]=useState(saved.query)
  // null until the first load ends: the registry shows placeholders, not «no patients».
  const [loadedPatients,setPatients]=useState(null)
  const patients=useMemo(()=>loadedPatients||[],[loadedPatients])
  const loading=loadedPatients===null
  const [department,setDepartment]=useState(saved.department)
  const [status,setStatus]=useState(saved.status)
  const [period,setPeriod]=useState(saved.period||'all')
  const [page,setPage]=useState(1)
  const [pageSize,setPageSize]=useState(15)
  const [riskFlags,setRiskFlags]=useState({})
  const [infectionFlags,setInfectionFlags]=useState({})
  useEffect(()=>{
    let alive=true
    loadPatients(tenant?.id,{isDemo}).then(list=>{if(alive)setPatients(list)}).catch(error=>{if(alive){setPatients([]);notify(error?.message||t('patientsLoadFailed'),'danger')}})
    loadLatestPatientRiskFlags(tenant?.id,{isDemo}).then(value=>{if(alive)setRiskFlags(value)}).catch(()=>{})
    loadPatientInfectionFlags(tenant?.id,{isDemo}).then(value=>{if(alive)setInfectionFlags(value)}).catch(()=>{})
    return ()=>{alive=false}
  },[tenant?.id,isDemo,notify,t])
  useEffect(()=>{setPage(1)},[query,department,status,period,pageSize])
  const departments=useMemo(()=>[...new Set(patients.map(p=>language==='el'?p.department:p.departmentEn).filter(Boolean))],[patients,language])
  const rows=useMemo(()=>patients
    .filter(p=>canAccessRecord(p))
    .filter(p=>`${p.id} ${p.name} ${p.nameEn||''} ${p.hospitalRecordNumber||''}`.toLowerCase().includes(query.toLowerCase()))
    .filter(p=>department==='all'||(language==='el'?p.department:p.departmentEn)===department)
    .filter(p=>inPeriod(p.admissionDate,period))
    .filter(p=>status==='all'||p.status===status),[query,patients,department,status,period,language,canAccessRecord])
  const totalPages=Math.max(1,Math.ceil(rows.length/pageSize))
  const safePage=Math.min(page,totalPages)
  const pagedRows=rows.slice((safePage-1)*pageSize,safePage*pageSize)
  const fmt=value=>formatDay(value,language)
  const pageCaps={[UI_ACTIONS.CREATE]:CAPABILITIES.CREATE_PATIENT}
  const canCreate=can(role,CAPABILITIES.CREATE_PATIENT,membership?.capabilities??[],membership?.customCapabilities??[])
  function pageAction(action){
    if(action===UI_ACTIONS.CREATE)navigate('/patients/new')
  }
  const activeAdvancedCount=(department!=='all'?1:0)+(status!=='all'?1:0)+(period!=='all'?1:0)
  const scopedPatients=patients.filter(p=>canAccessRecord(p))
  const patientSummary={
    total:scopedPatients.length,
    active:scopedPatients.filter(p=>p.status==='active').length,
    discharged:scopedPatients.filter(p=>p.status==='discharged').length,
    transferred:scopedPatients.filter(p=>p.status==='transferred').length,
  }
  return <Page fill title={t('patientRegistry')} subtitle={t('patientRegistrySubtitle')} actions={<RecordActions actions={[UI_ACTIONS.CREATE]} actionCapabilities={pageCaps} onAction={pageAction}/>}>
    <div className="workspace-summary patient-summary-strip" aria-label={t('patientRegistry')}>
      <PatientSummaryMetric loading={loading} icon={UsersRound} label={t('patientsCountAll')} value={patientSummary.total} filter="all" current={status} onFilter={setStatus}/>
      <PatientSummaryMetric loading={loading} icon={Activity} label={t('patientsCountActive')} value={patientSummary.active} kind="active" filter="active" current={status} onFilter={setStatus}/>
      <PatientSummaryMetric loading={loading} icon={LogOut} label={t('patientsCountDischarged')} value={patientSummary.discharged} filter="discharged" current={status} onFilter={setStatus}/>
      <PatientSummaryMetric loading={loading} icon={ArrowRightLeft} label={t('patientsCountTransferred')} value={patientSummary.transferred} filter="transferred" current={status} onFilter={setStatus}/>
    </div>
    <div className="surface clinical-surface workspace-fill patient-registry-shell">
      <FilterBar query={query} onQueryChange={setQuery} placeholder={t('searchPatients')} activeAdvancedCount={activeAdvancedCount} onClear={()=>{setQuery('');setDepartment('all');setStatus('all');setPeriod('all')}}>
        <FilterSelect label={t('department')} value={department} onChange={setDepartment}><option value="all">{t('allDepartments')}</option>{departments.map(x=><option key={x} value={x}>{x}</option>)}</FilterSelect>
        <FilterSelect label={t('status')} value={status} onChange={setStatus}><option value="all">{t('all')}</option><option value="active">{t('active')}</option><option value="discharged">{t('discharged')}</option><option value="transferred">{t('transferred')}</option></FilterSelect>
      <FilterSelect label={t('svPeriod')} value={period} onChange={setPeriod}><option value="all">{t('svPeriodAll')}</option>{PERIOD_DAYS.map(days=><option key={days} value={String(days)}>{t(`svPeriod${days}`)}</option>)}</FilterSelect>
      </FilterBar>
      <RegistryTable
        wrapperClassName="scroll-table"
        wrapperRef={registry.scrollRef}
        columns={[{key:'id',label:t('patientId')},{key:'name',label:t('name')},{key:'department',label:t('department')},{key:'admission',label:t('admissionDate')},{key:'status',label:t('status')},{key:'alerts',label:t('clinicalAlerts')}]}
        rows={pagedRows}
        loading={loading}
        rowKey={patient=>patient.id}
        rowProps={patient=>registry.rowProps(patient.id,()=>{registry.saveViewState({query,department,status,period});registry.openRecord(navigate,`/patients/${patient.id}`,patient.id,rows.map(x=>x.id))})}
        renderRow={patient=><><td><strong>{patient.id}</strong>{patient.hospitalRecordNumber&&<small>{patient.hospitalRecordNumber}</small>}</td><td>{language==='el'?patient.name:(patient.nameEn||patient.name)}</td><td>{language==='el'?patient.department:patient.departmentEn}</td><td>{fmt(patient.admissionDate)}</td><td>{t(patient.status)}</td><td><span className="patient-flags-cell"><PatientInfectionFlags flags={infectionFlags[patient.recordId]||infectionFlags[patient.id]} t={t} fmtDate={value=>fmt(String(value).slice(0,10))}/><ClinicalRiskText rows={riskFlags[patient.recordId]||riskFlags[patient.id]||[]} language={language}/></span></td></>}
        emptyTitle={t('patientRegistryEmptyTitle')}
        emptyText={t('patientRegistryEmptyDescription')}
        emptyFiltered={scopedPatients.length>0}
        onClearFilters={()=>{setQuery('');setDepartment('all');setStatus('all');setPeriod('all')}}
        emptyIcon={UsersRound}
        emptyAction={canCreate?{label:t('create'),icon:Plus,onClick:()=>pageAction(UI_ACTIONS.CREATE)}:null}
      />
      {rows.length>0&&<RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={rows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/>}
    </div>
  </Page>
}

// A summary card filters the registry by its status; clicking it again shows everyone.
function PatientSummaryMetric({icon,label,value,kind='',filter,current,onFilter,loading=false}){const active=filter!=='all'&&current===filter;return <MetricCard loading={loading} icon={icon} value={value} label={label} tone={kind||'neutral'} active={active} onClick={onFilter?()=>onFilter(active?'all':filter):undefined}/>}

// The patient form's state and checks, shared by the «New patient» page and the
// in-place edit of the patient record.
export function usePatientForm({patient=null,departments=[],existingPatients=[]}){
  const {t,language}=useLanguage()
  const editing=Boolean(patient)
  const [draft,setDraft]=useState(()=>({
    patientCode:patient?.id||'',firstName:patient?.firstName||'',lastName:patient?.lastName||'',fatherName:patient?.fatherName||'',hospitalRecordNumber:patient?.hospitalRecordNumber||'',
    dateOfBirth:patient?.dateOfBirth||'',birthWeightGrams:patient?.birthWeightGrams||'',gestationalAgeWeeks:patient?.gestationalAgeWeeks||'',sex:patient?.sex||'',departmentId:patient?.departmentId||'',department:patient?.department||'',departmentEn:patient?.departmentEn||patient?.department||'',
    admissionDate:patient?.admissionDate||'',status:patient?.status||'active',notes:patient?.notes||''
  }))
  const set=(key,value)=>setDraft(d=>({...d,[key]:value}))
  function setDepartment(id){
    const item=departments.find(value=>value.id===id)
    setDraft(d=>({...d,departmentId:id,department:item?.name||'',departmentEn:item?.nameEn||item?.name||''}))
  }
  const today=new Date();today.setHours(23,59,59,999)
  const birthDate=draft.dateOfBirth?new Date(`${draft.dateOfBirth}T12:00:00`):null
  const birthInvalid=Boolean(birthDate&&(Number.isNaN(birthDate.getTime())||birthDate>today||birthDate.getFullYear()<1900))
  const birthWeightInvalid=Boolean(draft.birthWeightGrams&&(Number(draft.birthWeightGrams)<300||Number(draft.birthWeightGrams)>7000))
  const gestationInvalid=Boolean(draft.gestationalAgeWeeks&&(Number(draft.gestationalAgeWeeks)<20||Number(draft.gestationalAgeWeeks)>45))
  const ageDays=birthDate&&!birthInvalid?Math.max(0,Math.floor((Date.now()-birthDate.getTime())/86400000)):null
  const ageYears=ageDays==null?null:Math.floor(ageDays/365.2425)
  // Neonatal fields only for a baby under 1 year, or when they already hold a value.
  const showNeonatal=(ageYears!=null&&ageYears<1)||Boolean(draft.birthWeightGrams||draft.gestationalAgeWeeks)
  // Warn while typing when the code is already taken, instead of failing on save.
  const codeKey=draft.patientCode.trim().toLowerCase()
  const duplicate=!editing&&codeKey?existingPatients.find(item=>String(item.id||item.patientCode||'').trim().toLowerCase()===codeKey):null
  const invalid=Boolean(duplicate)||!draft.patientCode.trim()||!draft.firstName.trim()||!draft.lastName.trim()||!draft.sex||(!editing&&!draft.admissionDate)||birthInvalid||birthWeightInvalid||gestationInvalid
  // The shared form rule: required marks, the missing-fields line, the first missing field focused.
  const validation=useFormValidation([
    {key:'patientCode',label:t('patientId'),valid:Boolean(draft.patientCode.trim())&&!duplicate,message:duplicate?`${t('patientCodeDuplicate')}${duplicate.name?` (${duplicate.name})`:''}`:undefined},
    {key:'firstName',label:t('firstName'),valid:Boolean(draft.firstName.trim())},
    {key:'lastName',label:t('lastName'),valid:Boolean(draft.lastName.trim())},
    {key:'sex',label:t('sex'),valid:Boolean(draft.sex)},
    !editing&&{key:'admissionDate',label:t('admissionDate'),valid:Boolean(draft.admissionDate)},
    {key:'dateOfBirth',label:t('dateOfBirth'),valid:!birthInvalid,message:t('invalidDateOfBirth')},
    {key:'birthWeightGrams',label:translate('copy.patientsCopy.birthWeightG',language==='el'?'el':'en'),valid:!birthWeightInvalid,message:t('invalidBirthWeight')},
    {key:'gestationalAgeWeeks',label:translate('copy.patientsCopy.gestationalAgeWeeks',language==='el'?'el':'en'),valid:!gestationInvalid,message:t('invalidGestationalAge')},
  ])
  function payload(){
    const first=draft.firstName.trim(),last=draft.lastName.trim()
    return {...draft,patientCode:draft.patientCode.trim(),name:`${first} ${last}`.trim(),nameEn:`${first} ${last}`.trim(),birthWeightGrams:draft.birthWeightGrams?Number(draft.birthWeightGrams):null,gestationalAgeWeeks:draft.gestationalAgeWeeks?Number(draft.gestationalAgeWeeks):null}
  }
  return {editing,draft,set,setDepartment,validation,birthInvalid,birthWeightInvalid,gestationInvalid,ageDays,ageYears,showNeonatal,duplicate,invalid,payload}
}

export function PatientFormFields({form,t,language,departments=[],className=''}){
  const {editing,draft,set,setDepartment,validation,birthInvalid,birthWeightInvalid,gestationInvalid,ageDays,ageYears,showNeonatal,duplicate}=form
  const lang=language==='el'?'el':'en'
  // Calculated age: the helper text under the date of birth.
  const ageHint=ageYears!=null&&!birthInvalid?(ageDays<28?t('calculatedAgeDays').replace('{age}',String(ageDays)):ageDays<730?t('calculatedAgeMonthsDays').replace('{months}',String(Math.floor(ageDays/30.4375))).replace('{days}',String(Math.floor(ageDays%30.4375))):t('calculatedAge').replace('{age}',String(ageYears))):''
  // Optional fields with a wrong value: the message shows at once, not only after a submit.
  const optionalError=(key,invalid,message)=>invalid?{fieldKey:key,error:message}:{fieldKey:key}
  return <div ref={validation.scopeRef} className={`entry-grid patient-entry-grid ${className}`.trim()}>
      <Field label={t('patientId')} {...validation.field('patientCode')} error={duplicate?`${t('patientCodeDuplicate')}${duplicate.name?` (${duplicate.name})`:''}`:validation.errorFor('patientCode')}><input autoFocus={!editing} disabled={editing} value={draft.patientCode} onChange={e=>set('patientCode',e.target.value)} aria-invalid={Boolean(duplicate)}/></Field>
      <Field label={t('hospitalRecordNumber')}><input value={draft.hospitalRecordNumber} onChange={e=>set('hospitalRecordNumber',e.target.value)}/></Field>
      <Field label={t('firstName')} {...validation.field('firstName')}><input autoFocus={editing} value={draft.firstName} onChange={e=>set('firstName',e.target.value)}/></Field>
      <Field label={t('lastName')} {...validation.field('lastName')}><input value={draft.lastName} onChange={e=>set('lastName',e.target.value)}/></Field>
      <Field label={t('fatherName')}><input value={draft.fatherName} onChange={e=>set('fatherName',e.target.value)}/></Field>
      <ManualDateField label={t('dateOfBirth')} value={draft.dateOfBirth} onChange={v=>set('dateOfBirth',v)} hint={ageHint} {...optionalError('dateOfBirth',birthInvalid,t('invalidDateOfBirth'))}/>
      {showNeonatal?<>
      <Field label={translate('copy.patientsCopy.birthWeightG',lang)} {...optionalError('birthWeightGrams',birthWeightInvalid,t('invalidBirthWeight'))}><input type="number" min="1" value={draft.birthWeightGrams} onChange={e=>set('birthWeightGrams',e.target.value)}/></Field>
      <Field label={translate('copy.patientsCopy.gestationalAgeWeeks',lang)} {...optionalError('gestationalAgeWeeks',gestationInvalid,t('invalidGestationalAge'))}><input type="number" min="20" max="45" value={draft.gestationalAgeWeeks} onChange={e=>set('gestationalAgeWeeks',e.target.value)}/></Field>
      </>:null}
      {!editing&&<><SearchableSelect label={t('department')} value={draft.departmentId} options={departmentOptions(departments,language)} placeholder={t('select')} emptyLabel={listTexts(language).emptyLabel} clearLabel={listTexts(language).clearLabel} onChange={setDepartment}/>
      <ManualDateField label={t('admissionDate')} value={draft.admissionDate} onChange={v=>set('admissionDate',v)} {...validation.field('admissionDate')}/></>}
      <SearchableSelect label={t('sex')} value={draft.sex} options={['female','male','other'].map(value=>({value,label:t(value)}))} placeholder={t('select')} clearLabel="" onChange={v=>set('sex',v)} {...validation.field('sex')}/>
      <Field label={t('notes')} className="entry-span-2"><textarea rows={3} value={draft.notes} onChange={e=>set('notes',e.target.value)}/></Field>
    </div>
}
