import { ManualDateField } from '../../design-system/ManualDateField'

export const TRAINING_PROGRAM_DEFAULTS={
 title:'',category:'ipc',method:'in_person',owner:'',trainer:'',audience:'',status:'active',startDate:'',dueDate:'',validMonths:'12',requiresAssessment:true,passScore:'80',description:''
}

const categoryOptions=[
 ['ipc','Πρόληψη & Έλεγχος Λοιμώξεων','Infection Prevention & Control'],
 ['clinical','Κλινική εκπαίδευση','Clinical training'],
 ['quality','Ποιότητα & Ασφάλεια','Quality & Safety'],
 ['occupational_health','Υγεία & Ασφάλεια Εργαζομένων','Occupational Health & Safety'],
 ['mandatory','Υποχρεωτική / Κανονιστική','Mandatory / Regulatory'],
 ['other','Άλλο','Other'],
]
const methodOptions=[
 ['in_person','Δια ζώσης','In person'],
 ['online','Διαδικτυακά','Online'],
 ['hybrid','Υβριδικά','Hybrid'],
 ['on_the_job','Εκπαίδευση στο χώρο εργασίας','On-the-job'],
 ['self_study','Αυτοεκπαίδευση','Self-study'],
]

export function normalizeTrainingProgramDraft(value={}){
 return {...TRAINING_PROGRAM_DEFAULTS,...value}
}

export function trainingProgramIsValid(v){
 return Boolean(v?.title?.trim()&&v?.owner?.trim()&&v?.trainer?.trim()&&v?.audience?.trim()&&v?.dueDate&&(!v.startDate||v.dueDate>=v.startDate)&&(!v.requiresAssessment||Number(v.passScore)>=0&&Number(v.passScore)<=100))
}

export function TrainingProgramForm({value,onChange,language='el',readOnly=false}){
 const en=language==='en',v=normalizeTrainingProgramDraft(value)
 const set=(key,next)=>onChange?.({...v,[key]:next})
 const datesInvalid=Boolean(v.startDate&&v.dueDate&&v.dueDate<v.startDate)
 return <div className="entry-grid">
  <label className="entry-span-2"><span>{en?'Title *':'Τίτλος *'}</span><input autoFocus={!readOnly} disabled={readOnly} value={v.title} onChange={e=>set('title',e.target.value)}/></label>
  <label><span>{en?'Category':'Κατηγορία'}</span><select disabled={readOnly} value={v.category} onChange={e=>set('category',e.target.value)}>{categoryOptions.map(([key,elLabel,enLabel])=><option key={key} value={key}>{en?enLabel:elLabel}</option>)}</select></label>
  <label><span>{en?'Status':'Κατάσταση'}</span><select disabled={readOnly} value={v.status} onChange={e=>set('status',e.target.value)}><option value="planned">{en?'Planned':'Προγραμματισμένο'}</option><option value="active">{en?'Active':'Ενεργό'}</option><option value="completed">{en?'Completed':'Ολοκληρωμένο'}</option><option value="cancelled">{en?'Cancelled':'Ακυρωμένο'}</option></select></label>
  <label><span>{en?'Method':'Τρόπος'}</span><select disabled={readOnly} value={v.method} onChange={e=>set('method',e.target.value)}>{methodOptions.map(([key,elLabel,enLabel])=><option key={key} value={key}>{en?enLabel:elLabel}</option>)}</select></label>
  <label><span>{en?'Organizer / owner *':'Υπεύθυνος / διοργανωτής *'}</span><input disabled={readOnly} value={v.owner} onChange={e=>set('owner',e.target.value)}/></label>
  <label><span>{en?'Instructor *':'Εκπαιδευτής *'}</span><input disabled={readOnly} value={v.trainer} onChange={e=>set('trainer',e.target.value)}/></label>
  <label><span>{en?'Audience *':'Κοινό *'}</span><input disabled={readOnly} value={v.audience} onChange={e=>set('audience',e.target.value)} placeholder={en?'e.g. ICU nurses, all staff':'π.χ. Νοσηλευτές ΜΕΘ, όλο το προσωπικό'}/></label>
  <ManualDateField label={en?'Start date':'Ημερομηνία έναρξης'} value={v.startDate} onChange={x=>set('startDate',x)} optional disabled={readOnly}/>
  <ManualDateField label={en?'Completion / due date *':'Ημερομηνία ολοκλήρωσης / προθεσμία *'} value={v.dueDate} onChange={x=>set('dueDate',x)} disabled={readOnly}/>
  {datesInvalid&&<div className="source-truth-note entry-span-2">{en?'The due date cannot precede the start date.':'Η προθεσμία δεν μπορεί να προηγείται της ημερομηνίας έναρξης.'}</div>}
  <label><span>{en?'Competency validity (months)':'Ισχύς επάρκειας (μήνες)'}</span><input disabled={readOnly} type="number" min="1" value={v.validMonths} onChange={e=>set('validMonths',e.target.value)}/></label>
  <label className="check-option"><input disabled={readOnly} type="checkbox" checked={Boolean(v.requiresAssessment)} onChange={e=>set('requiresAssessment',e.target.checked)}/><span>{en?'Knowledge assessment required':'Απαιτείται αξιολόγηση γνώσεων'}</span></label>
  {v.requiresAssessment&&<label><span>{en?'Pass score (%)':'Όριο επιτυχίας (%)'}</span><input disabled={readOnly} type="number" min="0" max="100" value={v.passScore} onChange={e=>set('passScore',e.target.value)}/></label>}
  <label className="entry-span-2"><span>{en?'Purpose / description':'Σκοπός / περιγραφή'}</span><textarea disabled={readOnly} rows="4" value={v.description} onChange={e=>set('description',e.target.value)}/></label>
 </div>
}
