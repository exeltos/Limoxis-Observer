import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { SaveButton } from '../../design-system/SaveButton'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { can, CAPABILITIES } from '../../core/permissions/roles'
import { signalDemoScenario } from '../demo/demoScenarioSignals'
import { demoLibrarySeed } from '../management/managementData'
import { loadDepartments } from '../management/departmentsService'
import { createPatient, loadPatients } from './patientsService'
import { usePatientForm } from './PatientForm'

// New patient opens as its own page, like New employee: the back button
// returns to the registry and saving opens the new patient's record.
export function PatientCreatePage(){
  const {t,language}=useLanguage()
  const {notify}=useFeedback()
  const navigate=useNavigate()
  const {tenant,isDemo,role,membership}=useTenant()
  const [patients,setPatients]=useState([])
  const [departments,setDepartments]=useState([])
  const [saving,setSaving]=useState(false)
  const canCreate=can(role,CAPABILITIES.CREATE_PATIENT,membership?.capabilities??[],membership?.customCapabilities??[])
  const form=usePatientForm({t,language,departments,existingPatients:patients})
  useEffect(()=>{
    let alive=true
    loadPatients(tenant?.id,{isDemo}).then(list=>{if(alive)setPatients(list)}).catch(()=>{if(alive)setPatients([])})
    if(isDemo){
      setDepartments(demoLibrarySeed.departments.map(([el,en],index)=>({id:`demo-department-${index}`,name:el,nameEn:en,is_active:true})))
    }else{
      loadDepartments(tenant?.id).then(list=>{if(alive)setDepartments((list||[]).filter(item=>item.is_active!==false).map(item=>({...item,nameEn:item.name})))}).catch(error=>{if(alive)notify(error?.message||t('actionFailed'),'danger')})
    }
    return ()=>{alive=false}
  },[tenant?.id,isDemo,notify,t])
  async function save(){
    const draft=form.payload()
    if(!draft||saving)return
    setSaving(true)
    try{
      const {record}=await createPatient(tenant?.id,patients,draft,{isDemo})
      notify(t('patientCreated'),'success')
      signalDemoScenario('patient_admission')
      navigate(`/patients/${encodeURIComponent(record.id)}`,{replace:true})
    }catch(error){
      notify(error?.duplicateCode?t('patientCodeDuplicate'):(error?.message||t('patientSaveFailed')),'danger')
    }finally{setSaving(false)}
  }
  if(!canCreate)return <Navigate to="/patients" replace/>
  return <Page fill><EntityRecordShell className="employee-create-shell patient-create-shell workspace-fill" avatar={<UserPlus size={19}/>} eyebrow={t('patients')} title={t('newPatient')} subtitle={t('newPatientHelp')} tabs={[]} activeTab="" onTabChange={()=>{}} onBack={()=>navigate('/patients')} backLabel={t('clinicalRecords.backToPatients')}>
    <div className="record-section employee-create-form">
      {form.fields}
      <div className="inline-edit-footer"><SaveButton loading={saving} disabled={form.disabled||saving} onClick={save}>{t('save')}</SaveButton></div>
    </div>
  </EntityRecordShell></Page>
}
