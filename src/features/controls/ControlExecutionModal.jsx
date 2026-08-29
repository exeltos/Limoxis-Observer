import { useMemo,useState } from 'react'
import { CalendarClock,CheckCircle2,FileWarning,Plus,Printer,Save,Trash2,UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../core/auth/AuthContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { getAssignment,frequencyLabel } from './controlsDemoData'
import { controlActorFromAuth } from './controlActor'
import { emptyStructuredRow,listHasFinding,printControlForm } from './controlStructured'
import { getControlDraft,saveControlDraft,removeControlDraft } from './controlDrafts'
import { ManualDateField } from '../../design-system/ManualDateField'
import { useLanguage } from '../../core/i18n/LanguageContext'

export function ControlExecutionModal({record,department,onClose,onSave,onDraftSaved,initialExecution=null}){
 const {profile,user}=useAuth()
 const {language,locale}=useLanguage(); const en=language==='en'
 const {confirm,notify}=useFeedback()
 const navigate=useNavigate()
 const actor=useMemo(()=>controlActorFromAuth({profile,user}),[profile,user])
 const assignment=getAssignment(record,department)
 const response=record.responseConfig||{mode:'text',label:en?'Result':'Αποτέλεσμα'}
 const isEditing=Boolean(initialExecution)
 const savedDraft=useMemo(()=>isEditing?null:getControlDraft(record.id,department),[isEditing,record.id,department])
 const [value,setValue]=useState(initialExecution?.value||savedDraft?.value||'')
 const [notes,setNotes]=useState(initialExecution?.notes||savedDraft?.notes||'')
 const [rows,setRows]=useState(
   initialExecution?.structuredData?.rows?.length
    ? initialExecution.structuredData.rows
    : savedDraft?.rows?.length
      ? savedDraft.rows
      : [emptyStructuredRow(response.template)]
 )
 const [confirmed,setConfirmed]=useState(false)
 const [draftSaved,setDraftSaved]=useState(Boolean(savedDraft))
 const fmt=v=>v?new Intl.DateTimeFormat(locale,{dateStyle:'short',timeStyle:'short',hour12:false}).format(new Date(v)):'—'
 const numeric=Number(String(value).replace(',','.'))
 const outOfRange=response.mode==='numeric'&&Number.isFinite(numeric)&&((response.min!==''&&response.min!=null&&numeric<Number(response.min))||(response.max!==''&&response.max!=null&&numeric>Number(response.max)))
 const choiceFinding=response.mode==='choice'&&(response.reportOn||['Μη συμμόρφωση','Non-compliant']).includes(value)
 const hasFinding=outOfRange||choiceFinding||(response.mode==='list'&&listHasFinding(rows))
 // Lists are optional: an empty list means "no findings".
 const valid=response.mode==='list'?true:String(value).trim().length>0

 function setRow(index,key,next){setRows(current=>current.map((r,i)=>i===index?{...r,[key]:next}:r))}
 function addRow(){setRows(current=>[...current,emptyStructuredRow(response.template)])}
 async function removeRow(index){
   const ok=await confirm({title:en?'Remove row':'Αφαίρεση γραμμής',message:en?'The row will be removed from this entry. Continue?':'Η γραμμή θα αφαιρεθεί από την καταχώρηση. Θέλετε να συνεχίσετε;',confirmLabel:en?'Remove':'Αφαίρεση',danger:true})
   if(!ok)return
   setRows(current=>current.length===1?[emptyStructuredRow(response.template)]:current.filter((_,i)=>i!==index))
   notify(en?'Row removed.':'Η γραμμή αφαιρέθηκε.','success')
 }
 function saveDraft(){const draft=saveControlDraft(record.id,department,{value,notes,rows});setDraftSaved(true);onDraftSaved?.(draft)}
 function submit(){
   if(!valid||!confirmed)return
   if(!isEditing)removeControlDraft(record.id,department)
   setDraftSaved(false)
   const cleanRows=response.mode==='list'
     ? rows.filter(r=>Object.values(r||{}).some(v=>String(v??'').trim()))
     : null
   onSave({value,notes,structuredData:response.mode==='list'?{template:response.template,rows:cleanRows}:null,hasFinding,actor})
 }
 function report(){
   saveDraft()
   navigate('/quality/incidents/new',{state:{controlSource:{controlId:record.id,controlTitle:record.title,department,scheduledAt:assignment?.nextDueAt,value,notes,hasFinding,rows},limoxisFrom:{path:`/controls/${record.id}?department=${encodeURIComponent(department)}`,label:record.title}}})
 }
 function printDraft(){
   printControlForm({record,department,execution:{at:initialExecution?.at||new Date().toISOString(),value,notes,structuredData:response.mode==='list'?{template:response.template,rows}:null,by:actor.name},actorName:actor.name})
 }

 return <div className="modal-backdrop"><div className={`entry-card control-execution-card ${response.mode==='list'?'control-execution-card-wide':''}`}>
  <header><div><span className="eyebrow">{isEditing?(en?'EDIT ENTRY':'ΕΠΕΞΕΡΓΑΣΙΑ ΚΑΤΑΧΩΡΗΣΗΣ'):(en?'CONTROL ENTRY':'ΚΑΤΑΧΩΡΗΣΗ ΕΛΕΓΧΟΥ')}</span><h3>{en?(record.titleEn||record.title):record.title}</h3><p>{department} · {frequencyLabel(record.frequency,language)}</p></div><button className="icon-close" onClick={onClose}>×</button></header>

  <div className="control-execution-summary">
   <div><CalendarClock size={17}/><span>{isEditing?(en?'Original entry':'Αρχική καταχώρηση'):(en?'Scheduled':'Προγραμματισμένος')}</span><strong>{fmt(isEditing?initialExecution?.at:assignment?.nextDueAt)}</strong></div>
   <div><UserRound size={17}/><span>{isEditing?(en?'Edited by':'Επεξεργασία από'):(en?'Recorded by':'Καταχώρηση από')}</span><strong>{actor.name}</strong><small>{actor.email}</small></div>
  </div>

  {response.mode==='list'
   ? <StructuredList template={response.template} rows={rows} setRow={setRow} addRow={addRow} removeRow={removeRow} language={language}/>
   : <div className="form-grid control-execution-form">
      <label className="field field-span-2"><span>{en&&response.label==='Αποτέλεσμα'?'Result':response.label||(en?'Result / value':'Αποτέλεσμα / τιμή')}{response.unit?` (${response.unit})`:''}</span>
       {response.mode==='choice'
        ? <select autoFocus value={value} onChange={e=>setValue(e.target.value)}><option value="">{en?'Select...':'Επιλέξτε...'}</option>{(response.options||['Συμμορφώνεται','Μη συμμόρφωση']).map(x=><option key={x} value={x}>{en&&x==='Συμμορφώνεται'?'Compliant':en&&x==='Μη συμμόρφωση'?'Non-compliant':x}</option>)}</select>
        : <input autoFocus type={response.mode==='numeric'?'number':'text'} step={response.mode==='numeric'?'any':undefined} value={value} onChange={e=>setValue(e.target.value)} placeholder={response.mode==='numeric'?(en?'Enter value':'Καταχωρήστε τιμή'):(en?'Enter result':'Καταχωρήστε αποτέλεσμα')}/>}
      </label>
      {response.mode==='numeric'&&(response.min!==''||response.max!=='')&&<div className={`control-range-hint field-span-2 ${outOfRange?'danger':''}`}>{en?'Acceptable range: ':'Αποδεκτά όρια: '}{response.min??'—'} {en?'to':'έως'} {response.max??'—'} {response.unit||''}{outOfRange&&<strong> · {en?'Value is out of range':'Η τιμή είναι εκτός ορίων'}</strong>}</div>}
     </div>}

  {response.mode==='list'&&<div className="control-list-optional-hint">{en?'Complete the list only when findings are present. You can finish the control with no rows.':'Η λίστα συμπληρώνεται μόνο αν προκύψουν ευρήματα. Μπορείτε να ολοκληρώσετε τον έλεγχο χωρίς γραμμές.'}</div>}

  <label className="field control-execution-notes"><span>{en?'Notes':'Σημειώσεις'}</span><textarea value={notes} onChange={e=>setNotes(e.target.value)} rows="3" placeholder={en?'Optional notes...':'Προαιρετικές παρατηρήσεις...'}/></label>

  {hasFinding&&<div className="governance-banner warning control-finding-banner"><FileWarning size={17}/><span>{en?'This entry contains a finding or an out-of-range value. You can create a related incident report.':'Η καταχώρηση περιλαμβάνει εύρημα ή τιμή εκτός ορίων. Μπορείτε να δημιουργήσετε σχετική αναφορά.'}</span></div>}

  <label className="control-confirm-execution">
   <input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>
   <CheckCircle2 size={17}/>
   <span>{isEditing?(en?'I confirm that the corrections to this entry are accurate.':'Επιβεβαιώνω ότι οι διορθώσεις της καταχώρησης είναι σωστές.'):(en?'I confirm that the control was performed and the information above is accurate.':'Επιβεβαιώνω ότι ο έλεγχος πραγματοποιήθηκε και τα παραπάνω στοιχεία είναι σωστά.')}</span>
  </label>

  <div className="control-execution-tools">
   {!isEditing&&<><button className="button button-quiet" onClick={saveDraft}><Save size={15}/>{en?' Save draft':' Αποθήκευση προσωρινά'}</button>{draftSaved&&<span className="control-temp-save-state">{en?'Draft saved · it will be restored when you reopen the entry':'Αποθηκευμένο προσωρινά · θα επανέλθει όταν ξανανοίξετε την καταχώρηση'}</span>}</>}
   {response.mode==='list'&&<button type="button" className="entity-record-icon-button" onClick={printDraft} title={en?'Print form':'Εκτύπωση φόρμας'} aria-label={en?'Print form':'Εκτύπωση φόρμας'}><Printer size={15}/></button>}
   {!isEditing&&<button className="button button-quiet" onClick={report}><FileWarning size={15}/>{en?' Create incident report':' Δημιουργία αναφοράς'}</button>}
  </div>

  <footer><button className="button" onClick={onClose}>{en?'Cancel':'Ακύρωση'}</button><button className="button button-primary" disabled={!confirmed||!valid} onClick={submit}>{isEditing?(en?'Save changes':'Αποθήκευση αλλαγών'):(en?'Confirm & save':'Επιβεβαίωση & αποθήκευση')}</button></footer>
 </div></div>
}

function StructuredList({template,rows,setRow,addRow,removeRow,language}){
 const en=language==='en'
 const medication=template==='medication_expiry'
 return (
  <section className="control-structured-form">
   <div className="control-structured-heading">
    <div><strong>{medication?(en?'Near-expiry / expired items':'Καταγραφή κοντόληκτων / ληγμένων'):(en?'Findings list':'Λίστα ευρημάτων')}</strong><small>{en?'Add a row only when there is something to record.':'Προσθέστε γραμμή μόνο όταν υπάρχει κάτι προς καταγραφή.'}</small></div>
    <button type="button" className="button button-quiet" onClick={addRow}><Plus size={15}/>{en?' Add row':' Προσθήκη γραμμής'}</button>
   </div>
   <div className="control-structured-table-wrap">
    <table className="control-structured-table">
     <thead><tr>
      {medication
       ? <><th>{en?'Item / Medicine':'Υλικό / Φάρμακο'}</th><th>{en?'Quantity':'Ποσότητα'}</th><th>{en?'Expiry date':'Ημερομηνία λήξης'}</th><th>{en?'Finding':'Εύρημα'}</th></>
       : <><th>{en?'Item':'Στοιχείο'}</th><th>{en?'Finding':'Εύρημα'}</th><th>{en?'Action':'Ενέργεια'}</th></>}
      <th aria-label={en?'Actions':'Ενέργειες'}></th>
     </tr></thead>
     <tbody>
      {rows.map((r,i)=><tr key={i}>
       {medication
        ? <>
           <td><input value={r.item||''} onChange={e=>setRow(i,'item',e.target.value)} placeholder={en?'Item / Medicine':'Υλικό / Φάρμακο'}/></td>
           <td><input type="number" min="0" value={r.quantity||''} onChange={e=>setRow(i,'quantity',e.target.value)} placeholder={en?'Quantity':'Ποσότητα'}/></td>
           <td><ManualDateField className="table-date-field" value={r.expiry||''} onChange={v=>setRow(i,'expiry',v)}/></td>
           <td><div className="control-finding-cell"><select value={r.finding||''} onChange={e=>setRow(i,'finding',e.target.value)}><option value="">{en?'Select...':'Επιλέξτε...'}</option><option>{en?'Expired':'Ληγμένο'}</option><option>{en?'Near expiry':'Κοντόληκτο'}</option><option>{en?'Other':'Άλλο'}</option></select>{['Άλλο','Other'].includes(r.finding)&&<input className="control-finding-other" value={r.findingOther||''} onChange={e=>setRow(i,'findingOther',e.target.value)} placeholder={en?'Describe the finding':'Συμπληρώστε το εύρημα'}/>}</div></td>
          </>
        : <>
           <td><input value={r.item||''} onChange={e=>setRow(i,'item',e.target.value)} placeholder={en?'Item':'Στοιχείο'}/></td>
           <td><input value={r.finding||''} onChange={e=>setRow(i,'finding',e.target.value)} placeholder={en?'Finding':'Εύρημα'}/></td>
           <td><input value={r.action||''} onChange={e=>setRow(i,'action',e.target.value)} placeholder={en?'Action':'Ενέργεια'}/></td>
          </>}
       <td><button type="button" className="control-row-delete" onClick={()=>removeRow(i)} title={en?'Remove row':'Αφαίρεση γραμμής'}><Trash2 size={14}/></button></td>
      </tr>)}
     </tbody>
    </table>
   </div>
  </section>
 )
}
