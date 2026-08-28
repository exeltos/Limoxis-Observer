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

export function ControlExecutionModal({record,department,onClose,onSave,onDraftSaved,initialExecution=null}){
 const {profile,user}=useAuth()
 const {confirm,notify}=useFeedback()
 const navigate=useNavigate()
 const actor=useMemo(()=>controlActorFromAuth({profile,user}),[profile,user])
 const assignment=getAssignment(record,department)
 const response=record.responseConfig||{mode:'text',label:'Αποτέλεσμα'}
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
 const fmt=v=>v?new Intl.DateTimeFormat('el-GR',{dateStyle:'short',timeStyle:'short',hour12:false}).format(new Date(v)):'—'
 const numeric=Number(String(value).replace(',','.'))
 const outOfRange=response.mode==='numeric'&&Number.isFinite(numeric)&&((response.min!==''&&response.min!=null&&numeric<Number(response.min))||(response.max!==''&&response.max!=null&&numeric>Number(response.max)))
 const choiceFinding=response.mode==='choice'&&(response.reportOn||['Μη συμμόρφωση']).includes(value)
 const hasFinding=outOfRange||choiceFinding||(response.mode==='list'&&listHasFinding(rows))
 // Lists are optional: an empty list means "no findings".
 const valid=response.mode==='list'?true:String(value).trim().length>0

 function setRow(index,key,next){setRows(current=>current.map((r,i)=>i===index?{...r,[key]:next}:r))}
 function addRow(){setRows(current=>[...current,emptyStructuredRow(response.template)])}
 async function removeRow(index){
   const ok=await confirm({title:'Αφαίρεση γραμμής',message:'Η γραμμή θα αφαιρεθεί από την καταχώρηση. Θέλετε να συνεχίσετε;',confirmLabel:'Αφαίρεση',danger:true})
   if(!ok)return
   setRows(current=>current.length===1?[emptyStructuredRow(response.template)]:current.filter((_,i)=>i!==index))
   notify('Η γραμμή αφαιρέθηκε.','success')
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
  <header><div><span className="eyebrow">{isEditing?'ΕΠΕΞΕΡΓΑΣΙΑ ΚΑΤΑΧΩΡΗΣΗΣ':'ΚΑΤΑΧΩΡΗΣΗ ΕΛΕΓΧΟΥ'}</span><h3>{record.title}</h3><p>{department} · {frequencyLabel(record.frequency)}</p></div><button className="icon-close" onClick={onClose}>×</button></header>

  <div className="control-execution-summary">
   <div><CalendarClock size={17}/><span>{isEditing?'Αρχική καταχώρηση':'Προγραμματισμένος'}</span><strong>{fmt(isEditing?initialExecution?.at:assignment?.nextDueAt)}</strong></div>
   <div><UserRound size={17}/><span>{isEditing?'Επεξεργασία από':'Καταχώρηση από'}</span><strong>{actor.name}</strong><small>{actor.email}</small></div>
  </div>

  {response.mode==='list'
   ? <StructuredList template={response.template} rows={rows} setRow={setRow} addRow={addRow} removeRow={removeRow}/>
   : <div className="form-grid control-execution-form">
      <label className="field field-span-2"><span>{response.label||'Αποτέλεσμα / τιμή'}{response.unit?` (${response.unit})`:''}</span>
       {response.mode==='choice'
        ? <select autoFocus value={value} onChange={e=>setValue(e.target.value)}><option value="">Επιλέξτε...</option>{(response.options||['Συμμορφώνεται','Μη συμμόρφωση']).map(x=><option key={x}>{x}</option>)}</select>
        : <input autoFocus type={response.mode==='numeric'?'number':'text'} step={response.mode==='numeric'?'any':undefined} value={value} onChange={e=>setValue(e.target.value)} placeholder={response.mode==='numeric'?'Καταχωρήστε τιμή':'Καταχωρήστε αποτέλεσμα'}/>}
      </label>
      {response.mode==='numeric'&&(response.min!==''||response.max!=='')&&<div className={`control-range-hint field-span-2 ${outOfRange?'danger':''}`}>Αποδεκτά όρια: {response.min??'—'} έως {response.max??'—'} {response.unit||''}{outOfRange&&<strong> · Η τιμή είναι εκτός ορίων</strong>}</div>}
     </div>}

  {response.mode==='list'&&<div className="control-list-optional-hint">Η λίστα συμπληρώνεται μόνο αν προκύψουν ευρήματα. Μπορείτε να ολοκληρώσετε τον έλεγχο χωρίς γραμμές.</div>}

  <label className="field control-execution-notes"><span>Σημειώσεις</span><textarea value={notes} onChange={e=>setNotes(e.target.value)} rows="3" placeholder="Προαιρετικές παρατηρήσεις..."/></label>

  {hasFinding&&<div className="governance-banner warning control-finding-banner"><FileWarning size={17}/><span>Η καταχώρηση περιλαμβάνει εύρημα ή τιμή εκτός ορίων. Μπορείτε να δημιουργήσετε σχετική αναφορά.</span></div>}

  <label className="control-confirm-execution">
   <input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>
   <CheckCircle2 size={17}/>
   <span>{isEditing?'Επιβεβαιώνω ότι οι διορθώσεις της καταχώρησης είναι σωστές.':'Επιβεβαιώνω ότι ο έλεγχος πραγματοποιήθηκε και τα παραπάνω στοιχεία είναι σωστά.'}</span>
  </label>

  <div className="control-execution-tools">
   {!isEditing&&<><button className="button button-quiet" onClick={saveDraft}><Save size={15}/> Αποθήκευση προσωρινά</button>{draftSaved&&<span className="control-temp-save-state">Αποθηκευμένο προσωρινά · θα επανέλθει όταν ξανανοίξετε την καταχώρηση</span>}</>}
   {response.mode==='list'&&<button type="button" className="entity-record-icon-button" onClick={printDraft} title="Εκτύπωση φόρμας" aria-label="Εκτύπωση φόρμας"><Printer size={15}/></button>}
   {!isEditing&&<button className="button button-quiet" onClick={report}><FileWarning size={15}/> Δημιουργία αναφοράς</button>}
  </div>

  <footer><button className="button" onClick={onClose}>Ακύρωση</button><button className="button button-primary" disabled={!confirmed||!valid} onClick={submit}>{isEditing?'Αποθήκευση αλλαγών':'Επιβεβαίωση & αποθήκευση'}</button></footer>
 </div></div>
}

function StructuredList({template,rows,setRow,addRow,removeRow}){
 const medication=template==='medication_expiry'
 return (
  <section className="control-structured-form">
   <div className="control-structured-heading">
    <div><strong>{medication?'Καταγραφή κοντόληκτων / ληγμένων':'Λίστα ευρημάτων'}</strong><small>Προσθέστε γραμμή μόνο όταν υπάρχει κάτι προς καταγραφή.</small></div>
    <button type="button" className="button button-quiet" onClick={addRow}><Plus size={15}/> Προσθήκη γραμμής</button>
   </div>
   <div className="control-structured-table-wrap">
    <table className="control-structured-table">
     <thead><tr>
      {medication
       ? <><th>Υλικό / Φάρμακο</th><th>Ποσότητα</th><th>Ημερομηνία λήξης</th><th>Εύρημα</th></>
       : <><th>Στοιχείο</th><th>Εύρημα</th><th>Ενέργεια</th></>}
      <th aria-label="Ενέργειες"></th>
     </tr></thead>
     <tbody>
      {rows.map((r,i)=><tr key={i}>
       {medication
        ? <>
           <td><input value={r.item||''} onChange={e=>setRow(i,'item',e.target.value)} placeholder="Υλικό / Φάρμακο"/></td>
           <td><input type="number" min="0" value={r.quantity||''} onChange={e=>setRow(i,'quantity',e.target.value)} placeholder="Ποσότητα"/></td>
           <td><ManualDateField className="table-date-field" value={r.expiry||''} onChange={v=>setRow(i,'expiry',v)}/></td>
           <td><div className="control-finding-cell"><select value={r.finding||''} onChange={e=>setRow(i,'finding',e.target.value)}><option value="">Επιλέξτε...</option><option>Ληγμένο</option><option>Κοντόληκτο</option><option>Άλλο</option></select>{r.finding==='Άλλο'&&<input className="control-finding-other" value={r.findingOther||''} onChange={e=>setRow(i,'findingOther',e.target.value)} placeholder="Συμπληρώστε το εύρημα"/>}</div></td>
          </>
        : <>
           <td><input value={r.item||''} onChange={e=>setRow(i,'item',e.target.value)} placeholder="Στοιχείο"/></td>
           <td><input value={r.finding||''} onChange={e=>setRow(i,'finding',e.target.value)} placeholder="Εύρημα"/></td>
           <td><input value={r.action||''} onChange={e=>setRow(i,'action',e.target.value)} placeholder="Ενέργεια"/></td>
          </>}
       <td><button type="button" className="control-row-delete" onClick={()=>removeRow(i)} title="Αφαίρεση γραμμής"><Trash2 size={14}/></button></td>
      </tr>)}
     </tbody>
    </table>
   </div>
  </section>
 )
}
