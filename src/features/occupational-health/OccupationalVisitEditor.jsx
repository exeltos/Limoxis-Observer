import { ObserverDialog,DialogActions } from '../../design-system/ObserverDialog'
import { ManualDateField } from '../../design-system/ManualDateField'
import '../occupational-health/OccupationalHealthPage.css'

export const EMPTY_OCCUPATIONAL_VISIT={employeeId:'',date:'',type:'periodic',status:'scheduled',fitStatus:'pending',followUpDate:'',clinicalNotes:''}
const VISIT_TYPES=[['periodic','Περιοδική εξέταση','Periodic examination'],['followUp','Επανέλεγχος','Follow-up'],['vaccinationReview','Έλεγχος εμβολιασμού','Vaccination review']]
export const visitSavedMessage=language=>language==='en'?'Visit saved.':'Η επίσκεψη αποθηκεύτηκε.'
export const FITNESS=[['fit','Κατάλληλος','Fit'],['fit_with_restrictions','Κατάλληλος με περιορισμούς','Fit with restrictions'],['unfit','Μη κατάλληλος','Unfit'],['pending','Εκκρεμεί','Pending']]

// A visit is planned (date, type) or recorded as done with its fitness outcome
// and the date of the next check.
export function OccupationalVisitEditor({language,employees,draft,onChange,onClose,onSave}){
 const en=language==='en',done=draft.status==='completed'
 const valid=Boolean(draft.employeeId&&draft.date&&draft.type&&(!done||draft.fitStatus))
 const patch=next=>onChange({...draft,...next})
 return <ObserverDialog width="workspace" eyebrow={en?'Occupational health':'Ιατρός Εργασίας'} title={en?'New occupational health visit':'Νέα επίσκεψη Ιατρού Εργασίας'} subtitle={en?'Schedule a visit, or record one that took place with its fitness outcome.':'Προγραμματίστε επίσκεψη ή καταγράψτε επίσκεψη που έγινε, με το αποτέλεσμα καταλληλότητας.'} onClose={onClose} footer={<DialogActions onCancel={onClose} onSave={onSave} disabled={!valid} showCancel/>}>
  <div className="vaccination-editor">
   <section className="vaccination-editor-card vaccination-employee-picker"><h4>{en?'Employee':'Εργαζόμενος'}</h4><label><span>{en?'Select employee *':'Επιλέξτε εργαζόμενο *'}</span><select value={draft.employeeId} onChange={e=>patch({employeeId:e.target.value})}><option value="">{en?'Select employee':'Επιλέξτε εργαζόμενο'}</option>{employees.map(e=><option key={e.id} value={e.id}>{`${e.lastName} ${e.firstName}`} · {e.department}</option>)}</select></label></section>
   <section className="vaccination-editor-card"><h4>{en?'Visit':'Επίσκεψη'}</h4><div className="vaccination-fields">
    <label><span>{en?'Status *':'Κατάσταση *'}</span><select value={draft.status} onChange={e=>patch({status:e.target.value})}><option value="scheduled">{en?'Scheduled':'Προγραμματισμένη'}</option><option value="completed">{en?'Completed':'Ολοκληρώθηκε'}</option></select></label>
    <ManualDateField label={en?'Date *':'Ημερομηνία *'} value={draft.date} onChange={date=>patch({date})}/>
    <label><span>{en?'Visit type *':'Τύπος επίσκεψης *'}</span><select value={draft.type} onChange={e=>patch({type:e.target.value})}>{VISIT_TYPES.map(([value,el,enLabel])=><option key={value} value={value}>{en?enLabel:el}</option>)}</select></label>
    {done&&<label><span>{en?'Fitness for work *':'Καταλληλότητα *'}</span><select value={draft.fitStatus} onChange={e=>patch({fitStatus:e.target.value})}>{FITNESS.map(([value,el,enLabel])=><option key={value} value={value}>{en?enLabel:el}</option>)}</select></label>}
    {done&&<ManualDateField label={en?'Next check':'Επανέλεγχος'} value={draft.followUpDate} onChange={followUpDate=>patch({followUpDate})} optional/>}
    <label className="vaccination-notes"><span>{en?'Clinical notes':'Κλινικές σημειώσεις'}</span><input value={draft.clinicalNotes} onChange={e=>patch({clinicalNotes:e.target.value})}/></label>
   </div></section>
  </div>
 </ObserverDialog>
}
