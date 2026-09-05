import { useEffect,useState } from 'react'
import { GraduationCap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useEmployeesData } from '../employees/useEmployeesData'
import { loadDepartments } from '../management/departmentsService'
import { createTrainingProgramAsync } from './trainingService'
import { TrainingProgramForm,TRAINING_PROGRAM_DEFAULTS,trainingProgramIsValid } from './TrainingProgramForm'

export function TrainingCreatePage(){
 const navigate=useNavigate(),{language}=useLanguage(),en=language==='en',{tenant}=useTenant(),{notify,notifyError}=useFeedback(),{data:employees}=useEmployeesData();const [saving,setSaving]=useState(false),[departments,setDepartments]=useState([]),[v,setV]=useState({...TRAINING_PROGRAM_DEFAULTS})
 useEffect(()=>{let active=true;if(!tenant?.id)return;loadDepartments(tenant.id).then(rows=>{if(active)setDepartments((rows||[]).filter(x=>x.is_active!==false))}).catch(()=>{if(active)setDepartments([])});return()=>{active=false}},[tenant?.id])
 const valid=trainingProgramIsValid(v)
 async function save(){if(!valid||saving)return;setSaving(true);try{const program=await createTrainingProgramAsync(tenant.id,v);notify(en?'Training program created.':'Το πρόγραμμα εκπαίδευσης δημιουργήθηκε.','success');navigate(`/training/${program.id}`,{replace:true})}catch(error){notifyError(error,'save',{operation:'training_create'})}finally{setSaving(false)}}
 return <Page fill><EntityRecordShell className="training-create-shell workspace-fill" avatar={<GraduationCap size={19}/>} eyebrow={en?'Training':'Εκπαίδευση'} title={en?'New training program':'Νέο πρόγραμμα εκπαίδευσης'} subtitle={en?'Create training program':'Δημιουργία προγράμματος εκπαίδευσης'} tabs={[]} activeTab="" onTabChange={()=>{}} onBack={()=>navigate('/training')}>
  <div className="record-section training-create-form"><TrainingProgramForm value={v} onChange={setV} language={language} employees={employees||[]} departments={departments}/><div className="inline-edit-footer"><Button variant="secondary" onClick={()=>navigate('/training')} disabled={saving}>{en?'Cancel':'Ακύρωση'}</Button><SaveButton loading={saving} disabled={!valid||saving} onClick={save}>{en?'Save':'Αποθήκευση'}</SaveButton></div></div>
 </EntityRecordShell></Page>
}
