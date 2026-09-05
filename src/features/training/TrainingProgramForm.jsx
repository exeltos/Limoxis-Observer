import { ManualDateField } from '../../design-system/ManualDateField'

export const TRAINING_PROGRAM_DEFAULTS={title:'',category:'ipc',method:'in_person',owner:'',trainer:'',audience:'',status:'active',startDate:'',dueDate:'',validMonths:'12',requiresAssessment:true,passScore:'80',description:''}
export const TRAINING_CATEGORY_OPTIONS=[['ipc','Πρόληψη & Έλεγχος Λοιμώξεων','Infection Prevention & Control'],['clinical','Κλινική εκπαίδευση','Clinical training'],['quality','Ποιότητα & Ασφάλεια','Quality & Safety'],['occupational_health','Υγεία & Ασφάλεια Εργαζομένων','Occupational Health & Safety'],['mandatory','Υποχρεωτική / Κανονιστική','Mandatory / Regulatory'],['other','Άλλο','Other']]
export const TRAINING_METHOD_OPTIONS=[['in_person','Δια ζώσης','In person'],['online','Διαδικτυακά','Online'],['hybrid','Υβριδικά','Hybrid'],['on_the_job','Εκπαίδευση στο χώρο εργασίας','On-the-job'],['self_study','Αυτοεκπαίδευση','Self-study']]
export function trainingCategoryLabel(value,language='el'){const row=TRAINING_CATEGORY_OPTIONS.find(x=>x[0]===value);return row?(language==='en'?row[2]:row[1]):value||'—'}
export function trainingMethodLabel(value,language='el'){const row=TRAINING_METHOD_OPTIONS.find(x=>x[0]===value);return row?(language==='en'?row[2]:row[1]):value||'—'}
export function normalizeTrainingProgramDraft(value={}){return {...TRAINING_PROGRAM_DEFAULTS,...value}}
export function trainingProgramIsValid(v){return Boolean(v?.title?.trim()&&v?.owner?.trim()&&v?.trainer?.trim()&&v?.audience?.trim()&&v?.dueDate&&(!v.startDate||v.dueDate>=v.startDate)&&(!v.requiresAssessment||Number(v.passScore)>=0&&Number(v.passScore)<=100))}
function unique(values){return [...new Set(values.map(x=>String(x||'').trim()).filter(Boolean))]}

export function TrainingProgramForm({value,onChange,language='el',readOnly=false,employees=[],departments=[]}){
 const en=language==='en',v=normalizeTrainingProgramDraft(value),set=(key,next)=>onChange?.({...v,[key]:next}),datesInvalid=Boolean(v.startDate&&v.dueDate&&v.dueDate<v.startDate)
 const people=unique(employees.map(x=>`${x.firstName||''} ${x.lastName||''}`.trim()))
 const audiences=unique([en?'All staff':'Όλο το προσωπικό',...departments.map(x=>x.name||x.label||x.title),...employees.map(x=>x.department)])
 return <div className="entry-grid">
  <label className="entry-span-2"><span>{en?'Title *':'Τίτλος *'}</span><input autoFocus={!readOnly} disabled={readOnly} value={v.title} onChange={e=>set('title',e.target.value)}/></label>
  <label><span>{en?'Category':'Κατηγορία'}</span><select disabled={readOnly} value={v.category} onChange={e=>set('category',e.target.value)}>{TRAINING_CATEGORY_OPTIONS.map(([key,elLabel,enLabel])=><option key={key} value={key}>{en?enLabel:elLabel}</option>)}</select></label>
  <label><span>{en?'Status':'Κατάσταση'}</span><select disabled={readOnly} value={v.status} onChange={e=>set('status',e.target.value)}><option value="planned">{en?'Planned':'Προγραμματισμένο'}</option><option value="active">{en?'Active':'Ενεργό'}</option><option value="completed">{en?'Completed':'Ολοκληρωμένο'}</option><option value="cancelled">{en?'Cancelled':'Ακυρωμένο'}</option></select></label>
  <label><span>{en?'Method':'Τρόπος'}</span><select disabled={readOnly} value={v.method} onChange={e=>set('method',e.target.value)}>{TRAINING_METHOD_OPTIONS.map(([key,elLabel,enLabel])=><option key={key} value={key}>{en?enLabel:elLabel}</option>)}</select></label>
  <label><span>{en?'Organizer / owner *':'Υπεύθυνος / διοργανωτής *'}</span><input disabled={readOnly} list="training-owner-options" value={v.owner} onChange={e=>set('owner',e.target.value)} placeholder={en?'Select or type a name':'Επιλέξτε ή πληκτρολογήστε όνομα'}/></label>
  <label><span>{en?'Instructor *':'Εκπαιδευτής *'}</span><input disabled={readOnly} list="training-trainer-options" value={v.trainer} onChange={e=>set('trainer',e.target.value)} placeholder={en?'Select or type a name':'Επιλέξτε ή πληκτρολογήστε όνομα'}/></label>
  <datalist id="training-owner-options">{people.map(x=><option key={x} value={x}/>)}</datalist><datalist id="training-trainer-options">{people.map(x=><option key={x} value={x}/>)}</datalist>
  <label><span>{en?'Audience *':'Κοινό *'}</span><input disabled={readOnly} list="training-audience-options" value={v.audience} onChange={e=>set('audience',e.target.value)} placeholder={en?'Select a department or type freely':'Επιλέξτε τμήμα ή πληκτρολογήστε ελεύθερα'}/><datalist id="training-audience-options">{audiences.map(x=><option key={x} value={x}/>)}</datalist></label>
  <ManualDateField label={en?'Start date':'Ημερομηνία έναρξης'} value={v.startDate} onChange={x=>set('startDate',x)} optional disabled={readOnly}/><ManualDateField label={en?'Completion / due date *':'Ημερομηνία ολοκλήρωσης / προθεσμία *'} value={v.dueDate} onChange={x=>set('dueDate',x)} disabled={readOnly}/>
  {datesInvalid&&<div className="source-truth-note entry-span-2">{en?'The due date cannot precede the start date.':'Η προθεσμία δεν μπορεί να προηγείται της ημερομηνίας έναρξης.'}</div>}
  <label><span>{en?'Competency validity (months)':'Ισχύς επάρκειας (μήνες)'}</span><input disabled={readOnly} type="number" min="1" value={v.validMonths} onChange={e=>set('validMonths',e.target.value)}/></label>
  <label className="check-option"><input disabled={readOnly} type="checkbox" checked={Boolean(v.requiresAssessment)} onChange={e=>set('requiresAssessment',e.target.checked)}/><span>{en?'Knowledge assessment required':'Απαιτείται αξιολόγηση γνώσεων'}</span></label>
  {v.requiresAssessment&&<label><span>{en?'Pass score (%)':'Όριο επιτυχίας (%)'}</span><input disabled={readOnly} type="number" min="0" max="100" value={v.passScore} onChange={e=>set('passScore',e.target.value)}/></label>}
  <label className="entry-span-2"><span>{en?'Purpose / description':'Σκοπός / περιγραφή'}</span><textarea disabled={readOnly} rows="4" value={v.description} onChange={e=>set('description',e.target.value)}/></label>
 </div>
}
