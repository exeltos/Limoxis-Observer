import { useEffect,useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { SaveButton } from '../../design-system/SaveButton'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { demoLibrarySeed } from '../management/managementData'
import { loadDepartments } from '../management/departmentsService'
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
  const [departments,setDepartments]=useState([])
  const [saving,setSaving]=useState(false)
  useEffect(()=>{
    let alive=true
    loadPatients(tenant?.id,{isDemo}).then(list=>{if(alive)setPatients(list)}).catch(()=>{})
    if(isDemo)setDepartments(demoLibrarySeed.departments.map(([el,en],index)=>({id:`demo-department-${index}`,name:el,nameEn:en})))
    else loadDepartments(tenant?.id).then(list=>{if(alive)setDepartments((list||[]).filter(item=>item.is_active!==false).map(item=>({...item,nameEn:item.name})))}).catch(error=>{if(alive)notify(error?.message||t('actionFailed'),'danger')})
    return ()=>{alive=false}
  },[tenant?.id,isDemo,notify,t])
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
  return <Page fill><EntityRecordShell className="patient-create-shell workspace-fill" avatar={<UserPlus size={19}/>} eyebrow={t('patients')} title={t('newPatient')} subtitle={t('newPatientHelp')} tabs={[]} activeTab="" onTabChange={()=>{}} onBack={()=>navigate('/patients')}>
    <section className="record-section patient-create-form">
      <PatientFormFields form={form} t={t} language={language} departments={departments}/>
      <div className="inline-edit-footer"><SaveButton loading={saving} disabled={form.invalid||saving} onClick={save}>{t('save')}</SaveButton></div>
    </section>
  </EntityRecordShell></Page>
}
