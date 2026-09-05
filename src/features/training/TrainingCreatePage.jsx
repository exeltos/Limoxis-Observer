import { useState } from 'react'
import { ArrowLeft,Save } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { ManualDateField } from '../../design-system/ManualDateField'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { loadTrainingStateAsync,saveManagedTrainingStateAsync } from './trainingService'

export function TrainingCreatePage(){
 const navigate=useNavigate();const {language}=useLanguage();const en=language==='en';const {tenant}=useTenant();const {notify,notifyError}=useFeedback();const [saving,setSaving]=useState(false)
 const [v,setV]=useState({title:'',category:'IPC',method:'Δια ζώσης',owner:'',trainer:'',audience:'',startDate:'',dueDate:'',validMonths:'12',requiresAssessment:true,passScore:'80',description:''})
 const set=(k,x)=>setV(s=>({...s,[k]:x}));const valid=v.title.trim()&&v.owner.trim()&&v.trainer.trim()&&v.audience.trim()&&v.dueDate
 async function save(){if(!valid||saving)return;setSaving(true);try{const state=await loadTrainingStateAsync(tenant.id);const now=new Date().toISOString(),program={...v,validMonths:Number(v.validMonths)||null,passScore:v.requiresAssessment?Number(v.passScore)||0:null,id:`TRN-${Date.now()}`,status:'active',materials:[],assessmentQuestions:[],feedbackResponses:[],createdAt:now};await saveManagedTrainingStateAsync(tenant.id,{...state,programs:[program,...state.programs]});notify(en?'Training program created.':'Το πρόγραμμα εκπαίδευσης δημιουργήθηκε.','success');navigate(`/training/${program.id}`,{replace:true})}catch(error){notifyError(error,'save',{operation:'training_create'})}finally{setSaving(false)}}
 return <Page fill title={en?'New training program':'Νέο πρόγραμμα εκπαίδευσης'} subtitle={en?'Create the program, dates, audience and competency requirements.':'Δημιουργία προγράμματος, ημερομηνιών, κοινού και απαιτήσεων επάρκειας.'} actions={<div className="row-actions"><Button variant="secondary" onClick={()=>navigate('/training')}><ArrowLeft size={15}/>{en?'Cancel':'Ακύρωση'}</Button><Button onClick={save} disabled={!valid||saving}><Save size={15}/>{saving?(en?'Saving…':'Αποθήκευση…'):(en?'Save':'Αποθήκευση')}</Button></div>}>
  <div className="workspace-column workspace-fill create-page-form">
   <section className="surface form-page-section"><div className="record-section-header"><div><h3>{en?'Program identity':'Στοιχεία προγράμματος'}</h3><p>{en?'Core information used in invitations, attendance and reporting.':'Βασικά στοιχεία που χρησιμοποιούνται σε προσκλήσεις, παρουσία και αναφορές.'}</p></div></div><div className="entry-grid compact">
    <label className="entry-span-2"><span>{en?'Title':'Τίτλος'} *</span><input value={v.title} onChange={e=>set('title',e.target.value)}/></label>
    <label><span>{en?'Category':'Κατηγορία'}</span><input value={v.category} onChange={e=>set('category',e.target.value)}/></label>
    <label><span>{en?'Method':'Τρόπος'}</span><input value={v.method} onChange={e=>set('method',e.target.value)}/></label>
    <label><span>{en?'Owner':'Υπεύθυνος'} *</span><input value={v.owner} onChange={e=>set('owner',e.target.value)}/></label>
    <label><span>{en?'Trainer':'Εκπαιδευτής'} *</span><input value={v.trainer} onChange={e=>set('trainer',e.target.value)}/></label>
    <label className="entry-span-2"><span>{en?'Audience':'Κοινό'} *</span><input value={v.audience} onChange={e=>set('audience',e.target.value)}/></label>
    <ManualDateField label={en?'Start':'Έναρξη'} value={v.startDate} onChange={x=>set('startDate',x)} optional/>
    <ManualDateField label={en?'Due date':'Προθεσμία'} value={v.dueDate} onChange={x=>set('dueDate',x)}/>
   </div></section>
   <section className="surface form-page-section"><div className="record-section-header"><div><h3>{en?'Competency & validity':'Επάρκεια & ισχύς'}</h3></div></div><div className="entry-grid compact">
    <label><span>{en?'Validity (months)':'Ισχύς (μήνες)'}</span><input type="number" min="1" value={v.validMonths} onChange={e=>set('validMonths',e.target.value)}/></label>
    <label className="check-option"><input type="checkbox" checked={v.requiresAssessment} onChange={e=>set('requiresAssessment',e.target.checked)}/><span>{en?'Knowledge assessment required':'Απαιτείται αξιολόγηση γνώσεων'}</span></label>
    {v.requiresAssessment&&<label><span>{en?'Pass score':'Όριο επιτυχίας'}</span><input type="number" min="0" max="100" value={v.passScore} onChange={e=>set('passScore',e.target.value)}/></label>}
    <label className="entry-span-2"><span>{en?'Description':'Περιγραφή'}</span><textarea rows="4" value={v.description} onChange={e=>set('description',e.target.value)}/></label>
   </div></section>
  </div>
 </Page>
}
