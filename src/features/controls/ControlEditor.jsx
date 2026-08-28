import { useMemo,useState } from 'react'
import { CalendarClock,Search } from 'lucide-react'
import { demoLibrarySeed } from '../management/managementData'
import { TimeField } from '../../design-system/TimeField'

export function ControlEditor({initial,onCancel,onSave,departmentOnly=false,fixedDepartment=''}){
 const departments=useMemo(()=>demoLibrarySeed.departments.map(x=>x[0]),[])
 const [deptQuery,setDeptQuery]=useState('')
 const [draft,setDraft]=useState(()=>initial?JSON.parse(JSON.stringify(initial)):{title:'',titleEn:'',category:'',departments:departmentOnly&&fixedDepartment?[fixedDepartment]:[],owner:'',description:'',createdByScope:departmentOnly?'department':'infection_control',lastCompletedAt:null,responseConfig:{mode:'text',label:'Αποτέλεσμα'},frequency:{kind:'daily',timesPerDay:1,times:['09:00'],interval:1}})
 const set=(k,v)=>setDraft(d=>({...d,[k]:v})),setF=(k,v)=>setDraft(d=>({...d,frequency:{...d.frequency,[k]:v}})),setR=(k,v)=>setDraft(d=>({...d,responseConfig:{...(d.responseConfig||{mode:'text',label:'Αποτέλεσμα'}),[k]:v}}))
 const toggleDept=d=>set('departments',draft.departments.includes(d)?draft.departments.filter(x=>x!==d):[...draft.departments,d])
 const count=Math.max(1,Number(draft.frequency.timesPerDay)||1)
 const times=Array.from({length:count},(_,i)=>draft.frequency.times?.[i]||`${String(Math.min(23,8+i*4)).padStart(2,'0')}:00`)
 const visibleDepartments=(departmentOnly&&fixedDepartment?[fixedDepartment]:departments).filter(d=>d.toLowerCase().includes(deptQuery.toLowerCase()))
 const valid=draft.title.trim()&&draft.category.trim()&&draft.departments.length>0&&draft.owner.trim()&&(draft.frequency.kind!=='daily'||times.every(Boolean))
 function submit(){if(!valid)return;onSave({...draft,frequency:{...draft.frequency,timesPerDay:count,times:draft.frequency.kind==='daily'?times:[]}})}
 return <div className="modal-backdrop"><div className="entry-card control-editor-card">
  <header className="control-editor-header"><div><span className="eyebrow">{initial?'ΕΠΕΞΕΡΓΑΣΙΑ ΕΛΕΓΧΟΥ':'ΝΕΟΣ ΕΛΕΓΧΟΣ'}</span><h3>{initial?'Επεξεργασία προγράμματος':'Δημιουργία προγραμματισμένου ελέγχου'}</h3><p>Ορίστε τι ελέγχεται, πού εφαρμόζεται και πότε πρέπει να εκτελείται.</p></div><button className="icon-close" onClick={onCancel}>×</button></header>
  <div className="control-editor-body">
   <section className="control-form-section"><div className="control-section-title"><span>1</span><div><strong>Βασικά στοιχεία</strong><small>Ονομασία, κατηγορία και υπεύθυνος</small></div></div>
    <div className="control-two-col">
     <label className="field control-span-2"><span>Ονομασία ελέγχου *</span><input value={draft.title} onChange={e=>set('title',e.target.value)} placeholder="π.χ. Θερμοκρασία ψυγείου"/></label>
     <label className="field"><span>Κατηγορία *</span><input list="control-categories" value={draft.category} onChange={e=>set('category',e.target.value)} placeholder="Επιλέξτε ή γράψτε"/><datalist id="control-categories"><option value="Θερμοκρασίες"/><option value="Φάρμακα / Υλικά"/><option value="Καλλιέργειες"/><option value="Εξοπλισμός"/><option value="Καθαριότητα / Απολύμανση"/></datalist></label>
     <label className="field"><span>Υπεύθυνος *</span><input list="control-owners" value={draft.owner} onChange={e=>set('owner',e.target.value)} placeholder="Επιλέξτε ή γράψτε"/><datalist id="control-owners"><option value="Υπεύθυνος βάρδιας"/><option value="Προϊστάμενος τμήματος"/><option value="Νοσηλευτής βάρδιας"/><option value="Ομάδα Ελέγχου Λοιμώξεων"/></datalist></label>
    </div>
   </section>
   <section className="control-form-section"><div className="control-section-title"><span>2</span><div><strong>Τμήματα εφαρμογής</strong><small>Ο έλεγχος θα εμφανίζεται μόνο στα επιλεγμένα τμήματα</small></div><b>{draft.departments.length} επιλεγμένα</b></div>
    <div className="control-dept-search"><Search size={16}/><input value={deptQuery} onChange={e=>setDeptQuery(e.target.value)} placeholder="Αναζήτηση τμήματος..."/></div>
    <div className="control-department-picker">{visibleDepartments.map(d=><label key={d} className={`check-option ${draft.departments.includes(d)?'selected':''}`}><input type="checkbox" checked={draft.departments.includes(d)} disabled={departmentOnly&&draft.departments.includes(d)} onChange={()=>toggleDept(d)}/><span>{d}</span></label>)}</div>
   </section>
   <section className="control-form-section"><div className="control-section-title"><span>3</span><div><strong>Τύπος καταχώρησης</strong><small>Τι θα συμπληρώνει ο χρήστης κατά την εκτέλεση</small></div></div>
    <div className="control-two-col">
     <label className="field"><span>Μορφή αποτελέσματος *</span><select value={draft.responseConfig?.mode||'text'} onChange={e=>setR('mode',e.target.value)}><option value="text">Κείμενο / απλή τιμή</option><option value="numeric">Αριθμητική τιμή με όρια</option><option value="choice">Επιλογή κατάστασης</option><option value="list">Λίστα ευρημάτων / αντικειμένων</option></select></label>
     <label className="field"><span>Ετικέτα πεδίου</span><input value={draft.responseConfig?.label||''} onChange={e=>setR('label',e.target.value)} placeholder="π.χ. Θερμοκρασία / Αποτέλεσμα"/></label>
     {draft.responseConfig?.mode==='numeric'&&<><label className="field"><span>Μονάδα μέτρησης</span><input value={draft.responseConfig?.unit||''} onChange={e=>setR('unit',e.target.value)} placeholder="π.χ. °C"/></label><div className="control-two-mini"><label className="field"><span>Ελάχιστο αποδεκτό όριο</span><input type="number" value={draft.responseConfig?.min??''} onChange={e=>setR('min',e.target.value===''?'':Number(e.target.value))}/></label><label className="field"><span>Μέγιστο αποδεκτό όριο</span><input type="number" value={draft.responseConfig?.max??''} onChange={e=>setR('max',e.target.value===''?'':Number(e.target.value))}/></label></div></>} {draft.responseConfig?.mode==='numeric'&&<div className="control-limits-help control-span-2">Τα όρια ανήκουν στον συγκεκριμένο έλεγχο. Τιμή εκτός ορίων επισημαίνεται αυτόματα ως εύρημα και μπορεί να οδηγήσει σε αναφορά.</div>}
     {draft.responseConfig?.mode==='choice'&&<label className="field control-span-2"><span>Επιλογές (μία ανά γραμμή)</span><textarea rows="3" value={(draft.responseConfig?.options||['Συμμορφώνεται','Μη συμμόρφωση']).join('\n')} onChange={e=>setR('options',e.target.value.split('\n').filter(Boolean))}/></label>}
     {draft.responseConfig?.mode==='list'&&<label className="field control-span-2"><span>Πρότυπο λίστας</span><select value={draft.responseConfig?.template||'generic_findings'} onChange={e=>setR('template',e.target.value)}><option value="medication_expiry">Φάρμακα / υλικά — κοντόληκτα & ληγμένα</option><option value="generic_findings">Γενική λίστα ευρημάτων</option></select></label>}
    </div>
   </section>
   <section className="control-form-section"><div className="control-section-title"><span>4</span><div><strong>Προγραμματισμός</strong><small>Συχνότητα και αναμενόμενες εκτελέσεις</small></div></div>
    <div className="control-schedule-grid">
     <label className="field"><span>Συχνότητα *</span><select value={draft.frequency.kind} onChange={e=>setF('kind',e.target.value)}><option value="daily">Ημερήσια</option><option value="weekly">Εβδομαδιαία</option><option value="monthly">Μηνιαία / ανά Χ μήνες</option><option value="yearly">Ετήσια</option><option value="custom">Κάθε Χ ημέρες</option></select></label>
     {draft.frequency.kind==='daily'?<label className="field"><span>Φορές ανά ημέρα *</span><input type="number" min="1" max="12" value={count} onChange={e=>setF('timesPerDay',Math.max(1,Math.min(12,Number(e.target.value)||1)))}/></label>:<label className="field"><span>Κάθε πόσες {draft.frequency.kind==='monthly'?'μήνες':draft.frequency.kind==='weekly'?'εβδομάδες':draft.frequency.kind==='yearly'?'έτη':'ημέρες'}</span><input type="number" min="1" value={draft.frequency.interval||1} onChange={e=>setF('interval',Math.max(1,Number(e.target.value)||1))}/></label>}
    </div>
    {draft.frequency.kind==='daily'&&<div className="control-times-panel"><div className="control-times-heading"><CalendarClock size={17}/><span>Ώρες εκτέλεσης</span><small>{count===1?'1 καταχώρηση την ημέρα':`${count} ξεχωριστές καταχωρήσεις την ημέρα`}</small></div><div className="control-time-grid">{times.map((time,i)=><TimeField key={i} label={`${i+1}η εκτέλεση`} value={time} onChange={v=>{const next=[...times];next[i]=v;setF('times',next)}}/>)}</div></div>}
   </section>
   <section className="control-form-section control-notes-section"><div className="control-section-title"><span>5</span><div><strong>Οδηγίες</strong><small>Προαιρετικές πληροφορίες για την εκτέλεση</small></div></div><label className="field"><textarea rows="3" value={draft.description||''} onChange={e=>set('description',e.target.value)} placeholder="Τι πρέπει να ελεγχθεί, αποδεκτά όρια ή άλλες οδηγίες..."/></label></section>
  </div>
  <footer className="control-editor-footer"><button className="button" onClick={onCancel}>Ακύρωση</button><button className="button button-primary" disabled={!valid} onClick={submit}>{initial?'Αποθήκευση αλλαγών':'Δημιουργία ελέγχου'}</button></footer>
 </div></div>
}
