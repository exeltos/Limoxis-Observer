import { ManualDateField } from '../../design-system/ManualDateField'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { TimeField } from '../../design-system/TimeField'
import { YesNoField } from '../../design-system/YesNoField'

export const TRAINING_PROGRAM_DEFAULTS={title:'',category:'ipc',method:'in_person',owner:'',trainer:'',audience:'',deliveryKind:'',startTime:'',durationHours:'',location:'',cost:'',status:'active',startDate:'',dueDate:'',validMonths:'12',requiresAssessment:true,passScore:'80',description:''}
const TRAINING_CATEGORY_OPTIONS=[['ipc','Πρόληψη & Έλεγχος Λοιμώξεων','Infection Prevention & Control'],['clinical','Κλινική εκπαίδευση','Clinical training'],['quality','Ποιότητα & Ασφάλεια','Quality & Safety'],['occupational_health','Υγεία & Ασφάλεια Εργαζομένων','Occupational Health & Safety'],['mandatory','Υποχρεωτική / Κανονιστική','Mandatory / Regulatory'],['other','Άλλο','Other']]
const TRAINING_DELIVERY_KIND_OPTIONS=[['internal','Εσωτερική','Internal'],['external','Εξωτερική','External'],['intra_department','Ενδοτμηματική','Intra-departmental']]
const TRAINING_METHOD_OPTIONS=[['in_person','Δια ζώσης','In person'],['online','Διαδικτυακά','Online'],['hybrid','Υβριδικά','Hybrid'],['on_the_job','Εκπαίδευση στο χώρο εργασίας','On-the-job'],['self_study','Αυτοεκπαίδευση','Self-study']]
export function trainingCategoryLabel(value,language='el'){const row=TRAINING_CATEGORY_OPTIONS.find(x=>x[0]===value);return row?(language==='en'?row[2]:row[1]):value||'—'}
export function trainingDeliveryKindLabel(value,language='el'){const row=TRAINING_DELIVERY_KIND_OPTIONS.find(x=>x[0]===value);return row?(language==='en'?row[2]:row[1]):value||'—'}
export function trainingMethodLabel(value,language='el'){const row=TRAINING_METHOD_OPTIONS.find(x=>x[0]===value);return row?(language==='en'?row[2]:row[1]):value||'—'}
function normalizeTrainingProgramDraft(value={}){return {...TRAINING_PROGRAM_DEFAULTS,...value}}
export function trainingProgramIsValid(v){return Boolean(v?.title?.trim()&&v?.owner?.trim()&&v?.trainer?.trim()&&v?.audience?.trim()&&v?.dueDate&&(!v.startDate||v.dueDate>=v.startDate)&&(!v.requiresAssessment||Number(v.passScore)>=0&&Number(v.passScore)<=100))}
function unique(values){return [...new Set(values.map(x=>String(x||'').trim()).filter(Boolean))]}

export function TrainingProgramForm({value,onChange,language='el',readOnly=false,employees=[],departments=[]}){
 const en=language==='en',v=normalizeTrainingProgramDraft(value),set=(key,next)=>onChange?.({...v,[key]:next}),datesInvalid=Boolean(v.startDate&&v.dueDate&&v.dueDate<v.startDate)
 const people=unique(employees.map(x=>`${x.firstName||''} ${x.lastName||''}`.trim()))
 const personOptions=people.map(x=>({value:x,label:x}))
 const audiences=unique([en?'All staff':'Όλο το προσωπικό',...departments.map(x=>x.name||x.label||x.title),...employees.map(x=>x.department)])
 return <div className="entry-grid">
  <label className="entry-span-2"><span>{en?'Title *':'Τίτλος *'}</span><input autoFocus={!readOnly} disabled={readOnly} value={v.title} onChange={e=>set('title',e.target.value)}/></label>
  <SearchableSelect label={en?'Category':'Κατηγορία'} disabled={readOnly} value={v.category} onChange={x=>set('category',x||'ipc')} options={TRAINING_CATEGORY_OPTIONS.map(([key,elLabel,enLabel])=>({value:key,label:en?enLabel:elLabel}))}/>
  <SearchableSelect label={en?'Status':'Κατάσταση'} disabled={readOnly} value={v.status} onChange={x=>set('status',x||'active')} options={[{value:'planned',label:en?'Planned':'Προγραμματισμένο'},{value:'active',label:en?'Active':'Ενεργό'},{value:'completed',label:en?'Completed':'Ολοκληρωμένο'},{value:'cancelled',label:en?'Cancelled':'Ακυρωμένο'}]}/>
  <SearchableSelect label={en?'Method':'Τρόπος'} disabled={readOnly} value={v.method} onChange={x=>set('method',x||'in_person')} options={TRAINING_METHOD_OPTIONS.map(([key,elLabel,enLabel])=>({value:key,label:en?enLabel:elLabel}))}/>
  <SearchableSelect label={en?'Training type':'Είδος εκπαίδευσης'} value={v.deliveryKind||''} options={TRAINING_DELIVERY_KIND_OPTIONS.map(([key,elLabel,enLabel])=>({value:key,label:en?enLabel:elLabel}))} onChange={x=>set('deliveryKind',x||'')} placeholder={en?'Choose a type':'Επιλέξτε είδος'} emptyLabel={en?'No match':'Δεν βρέθηκε'} clearLabel={en?'Clear':'Καθαρισμός'} disabled={readOnly}/>
  <SearchableSelect label={en?'Organizer / owner *':'Υπεύθυνος / διοργανωτής *'} disabled={readOnly} value={v.owner} onChange={x=>set('owner',x||'')} options={personOptions} allowCustom placeholder={en?'Select or type a name':'Επιλέξτε ή πληκτρολογήστε όνομα'}/>
  <SearchableSelect label={en?'Instructor *':'Εκπαιδευτής *'} disabled={readOnly} value={v.trainer} onChange={x=>set('trainer',x||'')} options={personOptions} allowCustom placeholder={en?'Select or type a name':'Επιλέξτε ή πληκτρολογήστε όνομα'}/>
  <SearchableSelect label={en?'Audience *':'Κοινό *'} disabled={readOnly} value={v.audience} onChange={x=>set('audience',x||'')} options={audiences.map(x=>({value:x,label:x}))} allowCustom placeholder={en?'Select a department or type freely':'Επιλέξτε τμήμα ή πληκτρολογήστε ελεύθερα'}/>
  <ManualDateField label={en?'Start date':'Ημερομηνία έναρξης'} value={v.startDate} onChange={x=>set('startDate',x)} optional disabled={readOnly}/><ManualDateField label={en?'Completion / due date *':'Ημερομηνία ολοκλήρωσης / προθεσμία *'} value={v.dueDate} onChange={x=>set('dueDate',x)} disabled={readOnly}/>
  <TimeField label={en?'Start time':'Ώρα έναρξης'} value={v.startTime||''} onChange={x=>set('startTime',x)} disabled={readOnly}/>
  <label><span>{en?'Duration (hours)':'Διάρκεια (ώρες)'}</span><input disabled={readOnly} type="number" min="0.5" step="0.5" value={v.durationHours??''} onChange={e=>set('durationHours',e.target.value)}/></label>
  <label><span>{en?'Location':'Τόπος'}</span><input disabled={readOnly} value={v.location||''} onChange={e=>set('location',e.target.value)}/></label>
  <label><span>{en?'Cost (€)':'Κόστος (€)'}</span><input disabled={readOnly} type="number" min="0" step="0.01" value={v.cost??''} onChange={e=>set('cost',e.target.value)}/></label>
  {datesInvalid&&<div className="source-truth-note entry-span-2">{en?'The due date cannot precede the start date.':'Η προθεσμία δεν μπορεί να προηγείται της ημερομηνίας έναρξης.'}</div>}
  <label><span>{en?'Competency validity (months)':'Ισχύς επάρκειας (μήνες)'}</span><input disabled={readOnly} type="number" min="1" value={v.validMonths} onChange={e=>set('validMonths',e.target.value)}/></label>
  <YesNoField label={en?'Knowledge assessment required':'Απαιτείται αξιολόγηση γνώσεων'} value={Boolean(v.requiresAssessment)} onChange={x=>!readOnly&&set('requiresAssessment',x)}/>
  {v.requiresAssessment&&<label><span>{en?'Pass score (%)':'Όριο επιτυχίας (%)'}</span><input disabled={readOnly} type="number" min="0" max="100" value={v.passScore} onChange={e=>set('passScore',e.target.value)}/></label>}
  <label className="entry-span-2"><span>{en?'Purpose / description':'Σκοπός / περιγραφή'}</span><textarea disabled={readOnly} rows="4" value={v.description} onChange={e=>set('description',e.target.value)}/></label>
 </div>
}
