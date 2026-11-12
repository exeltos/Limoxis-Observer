import { ObserverDialog } from '../../design-system/ObserverDialog'
import { Field } from '../../design-system/Field'
import { FormSubmit,useFormValidation } from '../../design-system/FormValidation'
import { ManualDateField } from '../../design-system/ManualDateField'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { PrefilledList } from '../surveillance/forms/PrefilledList'
import '../occupational-health/OccupationalHealthPage.css'

export const EMPTY_EXPOSURE_INCIDENT={employeeId:'',incidentDate:'',exposureType:'',deviceOrSource:'',bodySite:'',sourcePatientStatus:'',pepAdministered:null,pepDetails:'',followUpStatus:'pending',followUpDueAt:'',notes:''}

const EXPOSURE_TYPES=[['needlestick','Τρύπημα βελόνας','Needlestick'],['sharps_object','Άλλο αιχμηρό αντικείμενο','Other sharps object'],['mucocutaneous','Έκθεση βλεννογόνου','Mucocutaneous exposure'],['non_intact_skin','Έκθεση μη ακέραιου δέρματος','Non-intact skin exposure'],['other','Άλλο','Other']]
const SOURCE_STATUSES=[['unknown','Άγνωστη','Unknown'],['negative','Αρνητική','Negative'],['hbv_positive','Θετική HBV','HBV positive'],['hcv_positive','Θετική HCV','HCV positive'],['hiv_positive','Θετική HIV','HIV positive'],['other','Άλλο','Other']]
const FOLLOW_UP_STATUSES=[['pending','Εκκρεμεί','Pending'],['scheduled','Προγραμματισμένη','Scheduled'],['completed','Ολοκληρώθηκε','Completed'],['closed','Έκλεισε','Closed']]

const labelOf=(list,value,en)=>{const row=list.find(item=>item[0]===value);return row?(en?row[2]:row[1]):(value||'')}
export const exposureTypeLabel=(value,en)=>labelOf(EXPOSURE_TYPES,value,en)
export const sourceStatusLabel=(value,en)=>labelOf(SOURCE_STATUSES,value,en)
export const followUpLabel=(value,en)=>labelOf(FOLLOW_UP_STATUSES,value,en)

// Opened from a staff surveillance record: `prefillItems` (employee, record) replace the employee
// picker, and `sourceCaseOptions` (for roles that may read surveillance) let the source patient's
// episode be linked; otherwise the source stays the free-text fields below.
const optionsOf=(list,en)=>list.map(([value,el,enLabel])=>({value,label:en?enLabel:el}))
const growNotes=event=>{event.target.style.height='auto';event.target.style.height=`${event.target.scrollHeight}px`}

export function ExposureIncidentEditor({language,employees,draft,onChange,onClose,onSave,prefillItems=null,sourceCaseOptions=[]}){
 const en=language==='en'
 const patch=next=>onChange({...draft,...next})
 // Employee, incident date and exposure type are required (draft.employeeId&&draft.incidentDate&&draft.exposureType).
 const form=useFormValidation([
  !prefillItems&&{key:'employeeId',label:en?'Employee':'Εργαζόμενος',valid:Boolean(draft.employeeId)},
  {key:'incidentDate',label:en?'Incident date':'Ημερομηνία περιστατικού',valid:Boolean(draft.incidentDate)},
  {key:'exposureType',label:en?'Exposure type':'Τύπος έκθεσης',valid:Boolean(draft.exposureType)},
 ])
 const followUpOpen=!['completed','closed'].includes(draft.followUpStatus)
 const employeeOptions=employees.map(e=>({value:e.id,label:`${en?`${e.firstNameEn||e.firstName} ${e.lastNameEn||e.lastName}`:`${e.lastName} ${e.firstName}`} · ${en?e.departmentEn:e.department}`}))
 return <ObserverDialog width="workspace" title={en?'Report an exposure incident':'Καταγραφή περιστατικού έκθεσης'} subtitle={en?'Record a needlestick, sharps or mucocutaneous exposure and its follow-up.':'Καταγράψτε τρύπημα βελόνας, αιχμηρό αντικείμενο ή έκθεση βλεννογόνου και την παρακολούθησή της.'} onClose={onClose} footer={<FormSubmit form={form} onSubmit={()=>onSave(draft)}>{en?'Save':'Αποθήκευση'}</FormSubmit>}>
  <div className="vaccination-editor" ref={form.scopeRef}>
   {prefillItems?<PrefilledList items={prefillItems}/>:<section className="vaccination-editor-card vaccination-employee-picker"><h4>{en?'Employee':'Εργαζόμενος'}</h4><SearchableSelect label={en?'Employee':'Εργαζόμενος'} {...form.field('employeeId')} value={draft.employeeId} options={employeeOptions} placeholder={en?'Select employee':'Επιλέξτε εργαζόμενο'} clearLabel="" onChange={employeeId=>patch({employeeId:employeeId||''})}/></section>}
   <section className="vaccination-editor-card"><h4>{en?'Incident':'Περιστατικό'}</h4><div className="vaccination-fields exposure-fields">
    <ManualDateField label={en?'Incident date':'Ημερομηνία περιστατικού'} {...form.field('incidentDate')} value={draft.incidentDate} onChange={incidentDate=>patch({incidentDate})}/>
    <SearchableSelect label={en?'Exposure type':'Τύπος έκθεσης'} {...form.field('exposureType')} value={draft.exposureType} options={optionsOf(EXPOSURE_TYPES,en)} placeholder={en?'Select type':'Επιλέξτε τύπο'} clearLabel="" onChange={exposureType=>patch({exposureType:exposureType||''})}/>
    <Field label={en?'Device / source':'Συσκευή / πηγή'}><input value={draft.deviceOrSource} onChange={e=>patch({deviceOrSource:e.target.value})} placeholder={en?'e.g. IV catheter needle':'π.χ. βελόνα ενδοφλέβιας γραμμής'}/></Field>
    <Field label={en?'Body site':'Σημείο έκθεσης'}><input value={draft.bodySite} onChange={e=>patch({bodySite:e.target.value})} placeholder={en?'e.g. left index finger':'π.χ. αριστερός δείκτης'}/></Field>
   </div></section>
   <section className="vaccination-editor-card"><h4>{en?'Source':'Πηγή'}</h4><div className="vaccination-fields exposure-fields">
    {sourceCaseOptions.length>0&&<SearchableSelect label={en?'Source patient (surveillance episode)':'Ασθενής-πηγή (επεισόδιο επιτήρησης)'} value={draft.sourceCaseId||''} options={sourceCaseOptions} placeholder={en?'Select episode (optional)':'Επιλέξτε επεισόδιο (προαιρετικό)'} clearLabel={en?'No linked episode':'Χωρίς συνδεδεμένο επεισόδιο'} onChange={sourceCaseId=>patch({sourceCaseId:sourceCaseId||''})}/>}
    <SearchableSelect label={en?'Source patient status':'Κατάσταση πηγής (ασθενής)'} value={draft.sourcePatientStatus} options={optionsOf(SOURCE_STATUSES,en)} placeholder={en?'Select status':'Επιλέξτε κατάσταση'} clearLabel={en?'Not specified':'Δεν έχει καθοριστεί'} onChange={sourcePatientStatus=>patch({sourcePatientStatus:sourcePatientStatus||''})}/>
   </div></section>
   <section className="vaccination-editor-card"><h4>{en?'Prophylaxis and follow-up':'Προφύλαξη και παρακολούθηση'}</h4><div className="vaccination-fields exposure-fields">
    <SearchableSelect label={en?'Post-exposure prophylaxis (PEP)':'Προφύλαξη μετά την έκθεση (PEP)'} value={draft.pepAdministered==null?'':String(draft.pepAdministered)} options={[{value:'true',label:en?'Administered':'Χορηγήθηκε'},{value:'false',label:en?'Not administered':'Δεν χορηγήθηκε'}]} placeholder={en?'Not specified':'Δεν έχει καθοριστεί'} clearLabel={en?'Not specified':'Δεν έχει καθοριστεί'} onChange={value=>patch({pepAdministered:value?value==='true':null,...(value==='true'?{}:{pepDetails:''})})}/>
    {draft.pepAdministered===true&&<Field label={en?'PEP details':'Στοιχεία PEP'}><input value={draft.pepDetails} onChange={e=>patch({pepDetails:e.target.value})}/></Field>}
    <SearchableSelect label={en?'Follow-up status':'Κατάσταση παρακολούθησης'} value={draft.followUpStatus} options={optionsOf(FOLLOW_UP_STATUSES,en)} clearLabel="" onChange={followUpStatus=>followUpStatus&&patch({followUpStatus})}/>
    {followUpOpen&&<ManualDateField label={en?'Follow-up due':'Επόμενος επανέλεγχος'} value={draft.followUpDueAt} onChange={followUpDueAt=>patch({followUpDueAt})} optional/>}
    <Field label={en?'Notes':'Σημειώσεις'} className="exposure-notes"><textarea rows={2} value={draft.notes} onChange={e=>patch({notes:e.target.value})} onInput={growNotes}/></Field>
   </div></section>
  </div>
 </ObserverDialog>
}
