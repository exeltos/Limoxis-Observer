import { useEffect,useState } from 'react'
import { ArrowDown,ArrowUp,ClipboardCheck,ListChecks,Pencil,Plus,Trash2 } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { RegistryTable } from '../../design-system/RegistryTable'
import { ObserverDialog,DialogActions } from '../../design-system/ObserverDialog'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { loadTrainerFeedbackTemplateAsync,saveTrainerFeedbackTemplateAsync } from '../training/trainingService'
import { DEFAULT_TRAINER_FEEDBACK_TEMPLATE,normalizeTrainerFeedbackTemplate } from '../training/trainingFeedbackTemplate'

const newQuestion=()=>({id:`feedback-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,labelEl:'',labelEn:''})

export function TrainingFeedbackTemplatePanel(){
 const {language}=useLanguage(),en=language==='en', {tenant}=useTenant(),{notify,notifyError,confirm}=useFeedback()
 const [value,setValue]=useState(()=>normalizeTrainerFeedbackTemplate(DEFAULT_TRAINER_FEEDBACK_TEMPLATE)),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[editor,setEditor]=useState(null)
 useEffect(()=>{let active=true;if(!tenant?.id){setLoading(false);return};setLoading(true);loadTrainerFeedbackTemplateAsync(tenant.id).then(data=>{if(active)setValue(data)}).catch(error=>{if(active)notifyError(error,'load',{operation:'training_feedback_template_load'})}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[tenant?.id,notifyError])
 async function removeQuestion(id){if(value.questions.length<=1)return;const ok=await confirm({title:en?'Delete question':'Διαγραφή ερώτησης',message:en?'Remove this question from the template?':'Να αφαιρεθεί η ερώτηση από το πρότυπο;',confirmLabel:en?'Delete':'Διαγραφή',danger:true});if(ok)setValue(current=>({...current,questions:current.questions.filter(q=>q.id!==id)}))}
 function move(index,direction){const target=index+direction;if(target<0||target>=value.questions.length)return;setValue(current=>{const questions=[...current.questions];[questions[index],questions[target]]=[questions[target],questions[index]];return {...current,questions}})}
 function addQuestion(){setEditor({mode:'new',question:newQuestion()})}
 function editQuestion(question){setEditor({mode:'edit',question:{...question}})}
 function saveQuestion(question){const normalized={...question,labelEl:question.labelEl.trim(),labelEn:(question.labelEn||question.labelEl).trim()};if(!normalized.labelEl)return;setValue(current=>({...current,questions:editor.mode==='new'?[...current.questions,normalized]:current.questions.map(q=>q.id===normalized.id?normalized:q)}));setEditor(null)}
 async function save(){if(!tenant?.id||saving||!value.questions.length||value.questions.some(q=>!q.labelEl.trim()))return;setSaving(true);try{const saved=await saveTrainerFeedbackTemplateAsync(tenant.id,value);setValue(saved);notify(en?'Question template saved.':'Το πρότυπο ερωτήσεων αποθηκεύτηκε.','success')}catch(error){notifyError(error,'save',{operation:'training_feedback_template_save'})}finally{setSaving(false)}}
 return <div className="workspace-column workspace-fill training-feedback-template-panel">
  <div className="section-toolbar training-template-toolbar"><div><h2>{en?'Training evaluation questions':'Ερωτήσεις αξιολόγησης εκπαίδευσης'}</h2><p>{en?'These questions are copied into every new training program. Existing evaluations remain unchanged.':'Οι ερωτήσεις αυτές αντιγράφονται σε κάθε νέο πρόγραμμα εκπαίδευσης. Οι υπάρχουσες αξιολογήσεις δεν αλλάζουν.'}</p></div><Button onClick={addQuestion}><Plus size={15}/>{en?'New question':'Νέα ερώτηση'}</Button></div>
  {loading?<div className="inline-empty">{en?'Loading template...':'Φόρτωση προτύπου...'}</div>:<><div className="training-template-summary"><div><span className="training-template-summary-icon"><ListChecks size={17}/></span><span><strong>{value.questions.length}</strong><small>{en?'questions':'ερωτήσεις'}</small></span></div><div><span><strong>1–5</strong><small>{en?'rating scale':'κλίμακα αξιολόγησης'}</small></span></div><div><span><strong>{en?'Free comment':'Ελεύθερο σχόλιο'}</strong><small>{en?'included automatically':'περιλαμβάνεται αυτόματα'}</small></span></div></div>
  <RegistryTable
    wrapperClassName="scroll-table training-feedback-table-wrap"
    className="training-feedback-table"
    columns={[{key:'index',label:'#'},{key:'labelEl',label:en?'Question (EL)':'Ερώτηση (EL)'},{key:'labelEn',label:en?'Question (EN)':'Ερώτηση (EN)'},{key:'scale',label:en?'Scale':'Κλίμακα'},{key:'actions',label:en?'Actions':'Ενέργειες'}]}
    rows={value.questions}
    rowKey={q=>q.id}
    renderRow={(q,index)=><><td className="training-index-cell">{index+1}</td><td><strong>{q.labelEl||'—'}</strong></td><td>{q.labelEn||'—'}</td><td><span className="training-scale-badge">1–5</span></td><td className="open-record-cell"><OverflowMenu items={[
      {id:'up',label:en?'Move up':'Μετακίνηση πάνω',icon:ArrowUp,disabled:index===0,onClick:()=>move(index,-1)},
      {id:'down',label:en?'Move down':'Μετακίνηση κάτω',icon:ArrowDown,disabled:index===value.questions.length-1,onClick:()=>move(index,1)},
      {id:'edit',label:en?'Edit':'Επεξεργασία',icon:Pencil,onClick:()=>editQuestion(q)},
      {id:'delete',label:en?'Delete':'Διαγραφή',icon:Trash2,tone:'danger',disabled:value.questions.length<=1,separatorBefore:true,onClick:()=>removeQuestion(q.id)},
    ]}/></td></>}
  />
  <div className="inline-edit-footer training-template-footer"><div className="source-truth-note"><ClipboardCheck size={15}/><span>{en?'Changes apply only to new training programs after saving.':'Οι αλλαγές εφαρμόζονται μόνο στα νέα προγράμματα εκπαίδευσης μετά την αποθήκευση.'}</span></div><SaveButton loading={saving} disabled={saving||!value.questions.length||value.questions.some(q=>!q.labelEl.trim())} onClick={save}>{en?'Save questions':'Αποθήκευση ερωτήσεων'}</SaveButton></div></>}
  {editor&&<FeedbackQuestionDialog en={en} value={editor.question} onClose={()=>setEditor(null)} onSave={saveQuestion}/>} 
 </div>
}

function FeedbackQuestionDialog({en,value,onClose,onSave}){const [draft,setDraft]=useState(value);return <ObserverDialog width="standard" title={en?'Evaluation question':'Ερώτηση αξιολόγησης'} subtitle={en?'Greek is required. English is optional.':'Το ελληνικό κείμενο είναι υποχρεωτικό. Το αγγλικό είναι προαιρετικό.'} onClose={onClose} footer={<DialogActions onCancel={onClose} onSave={()=>onSave(draft)} disabled={!draft.labelEl.trim()}/>}><div className="entry-grid"><label><span>{en?'Question EL *':'Ερώτηση EL *'}</span><input autoFocus value={draft.labelEl} onChange={e=>setDraft(x=>({...x,labelEl:e.target.value}))}/></label><label><span>{en?'Question EN':'Ερώτηση EN'}</span><input value={draft.labelEn} onChange={e=>setDraft(x=>({...x,labelEn:e.target.value}))}/></label></div></ObserverDialog>}
