import { ObserverDialog,DialogActions } from '../../design-system/ObserverDialog'
import { ManualDateField } from '../../design-system/ManualDateField'
import '../occupational-health/OccupationalHealthPage.css'

export const EMPTY_EXPOSURE_INCIDENT={employeeId:'',incidentDate:'',exposureType:'',deviceOrSource:'',bodySite:'',sourcePatientStatus:'',pepAdministered:null,pepDetails:'',followUpStatus:'pending',followUpDueAt:'',notes:''}

const EXPOSURE_TYPES=[['needlestick','Τρύπημα βελόνας','Needlestick'],['sharps_object','Άλλο αιχμηρό αντικείμενο','Other sharps object'],['mucocutaneous','Έκθεση βλεννογόνου','Mucocutaneous exposure'],['non_intact_skin','Έκθεση μη ακέραιου δέρματος','Non-intact skin exposure'],['other','Άλλο','Other']]
const SOURCE_STATUSES=[['unknown','Άγνωστη','Unknown'],['negative','Αρνητική','Negative'],['hbv_positive','Θετική HBV','HBV positive'],['hcv_positive','Θετική HCV','HCV positive'],['hiv_positive','Θετική HIV','HIV positive'],['other','Άλλο','Other']]
const FOLLOW_UP_STATUSES=[['pending','Εκκρεμεί','Pending'],['scheduled','Προγραμματισμένη','Scheduled'],['completed','Ολοκληρώθηκε','Completed'],['closed','Έκλεισε','Closed']]

export function ExposureIncidentEditor({language,employees,draft,onChange,onClose,onSave}){
 const en=language==='en'
 const valid=Boolean(draft.employeeId&&draft.incidentDate&&draft.exposureType)
 const patch=next=>onChange({...draft,...next})
 return <ObserverDialog width="workspace" eyebrow={en?'Occupational exposure':'Επαγγελματική έκθεση'} title={en?'Report an exposure incident':'Καταγραφή περιστατικού έκθεσης'} subtitle={en?'Record a needlestick, sharps or mucocutaneous exposure and its follow-up.':'Καταγράψτε τρύπημα βελόνας, αιχμηρό αντικείμενο ή έκθεση βλεννογόνου και την παρακολούθησή της.'} onClose={onClose} footer={<DialogActions showCancel onCancel={onClose} onSave={()=>onSave(draft)} disabled={!valid} saveLabel={en?'Save incident':'Αποθήκευση περιστατικού'}/>}>
  <div className="vaccination-editor">
   <section className="vaccination-editor-card vaccination-employee-picker"><h4>{en?'Employee':'Εργαζόμενος'}</h4><label><span>{en?'Select employee *':'Επιλέξτε εργαζόμενο *'}</span><select value={draft.employeeId} onChange={e=>patch({employeeId:e.target.value})}><option value="">{en?'Select employee':'Επιλέξτε εργαζόμενο'}</option>{employees.map(e=><option key={e.id} value={e.id}>{en?`${e.firstNameEn||e.firstName} ${e.lastNameEn||e.lastName}`:`${e.lastName} ${e.firstName}`} · {en?e.departmentEn:e.department}</option>)}</select></label></section>
   <section className="vaccination-editor-card"><h4>{en?'Incident details':'Στοιχεία περιστατικού'}</h4><div className="vaccination-fields">
    <ManualDateField label={en?'Incident date *':'Ημερομηνία περιστατικού *'} value={draft.incidentDate} onChange={incidentDate=>patch({incidentDate})}/>
    <label><span>{en?'Exposure type *':'Τύπος έκθεσης *'}</span><select value={draft.exposureType} onChange={e=>patch({exposureType:e.target.value})}><option value="">{en?'Select type':'Επιλέξτε τύπο'}</option>{EXPOSURE_TYPES.map(([value,el,enLabel])=><option key={value} value={value}>{en?enLabel:el}</option>)}</select></label>
    <label><span>{en?'Device / source':'Συσκευή / πηγή'}</span><input value={draft.deviceOrSource} onChange={e=>patch({deviceOrSource:e.target.value})} placeholder={en?'e.g. IV catheter needle':'π.χ. βελόνα ενδοφλέβιας γραμμής'}/></label>
    <label><span>{en?'Body site':'Σημείο έκθεσης'}</span><input value={draft.bodySite} onChange={e=>patch({bodySite:e.target.value})} placeholder={en?'e.g. left index finger':'π.χ. αριστερός δείκτης'}/></label>
    <label><span>{en?'Source patient status':'Κατάσταση πηγής (ασθενής)'}</span><select value={draft.sourcePatientStatus} onChange={e=>patch({sourcePatientStatus:e.target.value})}><option value="">{en?'Select status':'Επιλέξτε κατάσταση'}</option>{SOURCE_STATUSES.map(([value,el,enLabel])=><option key={value} value={value}>{en?enLabel:el}</option>)}</select></label>
    <label><span>{en?'Post-exposure prophylaxis (PEP)':'Προφύλαξη μετά την έκθεση (PEP)'}</span><select value={draft.pepAdministered==null?'':String(draft.pepAdministered)} onChange={e=>patch({pepAdministered:e.target.value===''?null:e.target.value==='true'})}><option value="">{en?'Not specified':'Δεν έχει καθοριστεί'}</option><option value="true">{en?'Administered':'Χορηγήθηκε'}</option><option value="false">{en?'Not administered':'Δεν χορηγήθηκε'}</option></select></label>
    <label className="vaccination-notes"><span>{en?'PEP details':'Στοιχεία PEP'}</span><input value={draft.pepDetails} onChange={e=>patch({pepDetails:e.target.value})}/></label>
    <label><span>{en?'Follow-up status':'Κατάσταση παρακολούθησης'}</span><select value={draft.followUpStatus} onChange={e=>patch({followUpStatus:e.target.value})}>{FOLLOW_UP_STATUSES.map(([value,el,enLabel])=><option key={value} value={value}>{en?enLabel:el}</option>)}</select></label>
    <ManualDateField label={en?'Follow-up due':'Επόμενος επανέλεγχος'} value={draft.followUpDueAt} onChange={followUpDueAt=>patch({followUpDueAt})} optional/>
    <label className="vaccination-notes"><span>{en?'Notes':'Σημειώσεις'}</span><input value={draft.notes} onChange={e=>patch({notes:e.target.value})}/></label>
   </div></section>
  </div>
 </ObserverDialog>
}
