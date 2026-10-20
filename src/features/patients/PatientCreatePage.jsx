import { useEffect,useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { FormSubmit } from '../../design-system/FormValidation'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useDepartments } from '../management/useLibraries'
import { signalDemoScenario } from '../demo/demoScenarioSignals'
import { createPatient,loadPatients } from './patientsService'
import { PatientFormFields,usePatientForm } from './PatientsPage'

// «New patient» is a page of its own (like «New employee»), not a window over
// the registry: Back returns to the list, Save opens the new patient's record.
export function PatientCreatePage(){
  const {t,language}=useLanguage()
  const {notify}=useFeedback()
  const navigate=useNavigate()
  const {tenant,isDemo}=useTenant()
  const [patients,setPatients]=useState([])
  const {departments,error:departmentsError}=useDepartments()
  const [saving,setSaving]=useState(false)
  useEffect(()=>{
    let alive=true
    loadPatients(tenant?.id,{isDemo}).then(list=>{if(alive)setPatients(list)}).catch(()=>{})
    return ()=>{alive=false}
  },[tenant?.id,isDemo])
  useEffect(()=>{if(departmentsError)notify(departmentsError==='load_failed'?t('actionFailed'):departmentsError,'danger')},[departmentsError,notify,t])
  const form=usePatientForm({departments,existingPatients:patients})
  async function save(){
    if(form.invalid||saving)return
    setSaving(true)
    try{
      const {record}=await createPatient(tenant?.id,patients,form.payload(),{isDemo})
      notify(t('patientCreated'),'success')
      signalDemoScenario('patient_admission')
      navigate(`/patients/${record.id}`,{replace:true})
    }catch(error){
      notify(error?.duplicateCode?t('patientCodeDuplicate'):(error?.message||t('patientSaveFailed')),'danger')
    }finally{setSaving(false)}
  }
  return <Page fill><EntityRecordShell className="patient-create-shell workspace-fill" avatar={<UserPlus size={19}/>} eyebrow={t('patients')} title={t('newPatient')} subtitle={t('newPatientHelp')} tabs={[]} activeTab="" onTabChange={()=>{}} onBack={()=>navigate('/surveillance?tab=registry')}>
    <section className="record-section patient-create-form">
      <PatientFormFields form={form} t={t} language={language} departments={departments}/>
      <div className="inline-edit-footer"><FormSubmit form={form.validation} loading={saving} onSubmit={save}>{t('save')}</FormSubmit></div>
    </section>
  </EntityRecordShell></Page>
}
