import { useMemo,useState } from 'react'
import { CalendarClock,Search } from 'lucide-react'
import { demoLibrarySeed } from '../management/managementData'
import { TimeField } from '../../design-system/TimeField'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { Page } from '../../design-system/Page'
import { Card } from '../../design-system/Card'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { BackButton } from '../../design-system/BackButton'

export function ControlEditor({initial,onCancel,onSave,departmentOnly=false,fixedDepartment=''}){
 const {language}=useLanguage(); const en=language==='en'
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
 const title=initial?(en?'Edit control':'Επεξεργασία ελέγχου'):(en?'New control':'Νέος έλεγχος')
 const subtitle=en?'Define the control, departments, entry method and execution schedule.':'Ορίστε τον έλεγχο, τα τμήματα, τον τρόπο καταχώρησης και το πρόγραμμα εκτέλεσης.'
 return <Page fill className="control-editor-page" title={title} subtitle={subtitle} navigation={<BackButton onClick={onCancel} label={en?'Back to controls':'Επιστροφή στους ελέγχους'}/>}>
   <div className="control-editor-sheet">
    <div className="control-editor-column control-editor-column-primary">
      <Card className="control-form-section control-form-basic">
        <div className="control-section-title"><span>1</span><div><strong>{en?'Basic details':'Βασικά στοιχεία'}</strong><small>{en?'Name, category and responsible role':'Ονομασία, κατηγορία και υπεύθυνος'}</small></div></div>
        <div className="control-form-grid two-columns">
          <label className="field"><span>{en?'Control name (Greek) *':'Ονομασία ελέγχου *'}</span><input value={draft.title} onChange={e=>set('title',e.target.value)} placeholder="π.χ. Θερμοκρασία ψυγείου"/></label>
          <label className="field"><span>{en?'Control name (English)':'Ονομασία στα Αγγλικά'}</span><input value={draft.titleEn||''} onChange={e=>set('titleEn',e.target.value)} placeholder="e.g. Medication refrigerator temperature"/></label>
          <label className="field"><span>{en?'Category *':'Κατηγορία *'}</span><input list="control-categories" value={draft.category} onChange={e=>set('category',e.target.value)} placeholder={en?'Select or type':'Επιλέξτε ή γράψτε'}/><datalist id="control-categories"><option value="Θερμοκρασίες"/><option value="Φάρμακα / Υλικά"/><option value="Καλλιέργειες"/><option value="Εξοπλισμός"/><option value="Καθαριότητα / Απολύμανση"/></datalist></label>
          <label className="field"><span>{en?'Owner *':'Υπεύθυνος *'}</span><input list="control-owners" value={draft.owner} onChange={e=>set('owner',e.target.value)} placeholder={en?'Select or type':'Επιλέξτε ή γράψτε'}/><datalist id="control-owners"><option value="Υπεύθυνος βάρδιας"/><option value="Προϊστάμενος τμήματος"/><option value="Νοσηλευτής βάρδιας"/><option value="Ομάδα Ελέγχου Λοιμώξεων"/></datalist></label>
        </div>
      </Card>

      <Card className="control-form-section control-form-entry">
        <div className="control-section-title"><span>3</span><div><strong>{en?'Entry type':'Τύπος καταχώρησης'}</strong><small>{en?'Define what users record':'Ορίστε τι θα καταχωρεί ο χρήστης'}</small></div></div>
        <div className="control-form-grid two-columns">
          <label className="field"><span>{en?'Result format *':'Μορφή αποτελέσματος *'}</span><select value={draft.responseConfig?.mode||'text'} onChange={e=>setR('mode',e.target.value)}><option value="text">{en?'Text / simple value':'Κείμενο / απλή τιμή'}</option><option value="numeric">{en?'Numeric value with limits':'Αριθμητική τιμή με όρια'}</option><option value="choice">{en?'Status choice':'Επιλογή κατάστασης'}</option><option value="list">{en?'Findings / items list':'Λίστα ευρημάτων / αντικειμένων'}</option></select></label>
          <label className="field"><span>{en?'Field label':'Ετικέτα πεδίου'}</span><input value={draft.responseConfig?.label||''} onChange={e=>setR('label',e.target.value)} placeholder={en?'e.g. Temperature':'π.χ. Θερμοκρασία'}/></label>
          {draft.responseConfig?.mode==='numeric'&&<><label className="field"><span>{en?'Unit':'Μονάδα μέτρησης'}</span><input value={draft.responseConfig?.unit||''} onChange={e=>setR('unit',e.target.value)} placeholder="°C"/></label><div className="control-inline-limits"><label className="field"><span>{en?'Minimum':'Ελάχιστο όριο'}</span><input type="number" value={draft.responseConfig?.min??''} onChange={e=>setR('min',e.target.value===''?'':Number(e.target.value))}/></label><label className="field"><span>{en?'Maximum':'Μέγιστο όριο'}</span><input type="number" value={draft.responseConfig?.max??''} onChange={e=>setR('max',e.target.value===''?'':Number(e.target.value))}/></label></div></>}
          {draft.responseConfig?.mode==='choice'&&<label className="field control-span-full"><span>{en?'Options (one per line)':'Επιλογές (μία ανά γραμμή)'}</span><textarea rows="4" value={(draft.responseConfig?.options||['Συμμορφώνεται','Μη συμμόρφωση']).join('\n')} onChange={e=>setR('options',e.target.value.split('\n').filter(Boolean))}/></label>}
          {draft.responseConfig?.mode==='list'&&<label className="field control-span-full"><span>{en?'List template':'Πρότυπο λίστας'}</span><select value={draft.responseConfig?.template||'generic_findings'} onChange={e=>setR('template',e.target.value)}><option value="medication_expiry">{en?'Medicines / supplies — near expiry & expired':'Φάρμακα / υλικά — κοντόληκτα & ληγμένα'}</option><option value="generic_findings">{en?'General findings list':'Γενική λίστα ευρημάτων'}</option></select></label>}
        </div>
      </Card>

      <Card className="control-form-section control-form-notes">
        <div className="control-section-title"><span>5</span><div><strong>{en?'Instructions':'Οδηγίες'}</strong><small>{en?'Optional execution guidance':'Προαιρετικές οδηγίες εκτέλεσης'}</small></div></div>
        <label className="field"><textarea rows="3" value={draft.description||''} onChange={e=>set('description',e.target.value)} placeholder={en?'What should be checked, acceptable limits or other instructions...':'Τι πρέπει να ελεγχθεί, αποδεκτά όρια ή άλλες οδηγίες...'}/></label>
      </Card>
    </div>

    <div className="control-editor-column control-editor-column-secondary">
      <Card className="control-form-section control-form-departments">
        <div className="control-section-title"><span>2</span><div><strong>{en?'Applicable departments':'Τμήματα εφαρμογής'}</strong><small>{en?'Choose where this control is active':'Επιλέξτε πού θα είναι ενεργός ο έλεγχος'}</small></div><b>{draft.departments.length}</b></div>
        <div className="control-dept-search"><Search size={16}/><input value={deptQuery} onChange={e=>setDeptQuery(e.target.value)} placeholder={en?'Search department...':'Αναζήτηση τμήματος...'}/></div>
        <div className="control-department-picker">{visibleDepartments.map(d=><label key={d} className={`check-option ${draft.departments.includes(d)?'selected':''}`}><input type="checkbox" checked={draft.departments.includes(d)} disabled={departmentOnly&&draft.departments.includes(d)} onChange={()=>toggleDept(d)}/><span>{d}</span></label>)}</div>
      </Card>

      <Card className="control-form-section control-form-schedule">
        <div className="control-section-title"><span>4</span><div><strong>{en?'Scheduling':'Προγραμματισμός'}</strong><small>{en?'Frequency and execution times':'Συχνότητα και ώρες εκτέλεσης'}</small></div></div>
        <div className="control-form-grid two-columns">
          <label className="field"><span>{en?'Frequency *':'Συχνότητα *'}</span><select value={draft.frequency.kind} onChange={e=>setF('kind',e.target.value)}><option value="daily">{en?'Daily':'Ημερήσια'}</option><option value="weekly">{en?'Weekly':'Εβδομαδιαία'}</option><option value="monthly">{en?'Monthly / every N months':'Μηνιαία / ανά Χ μήνες'}</option><option value="yearly">{en?'Yearly':'Ετήσια'}</option><option value="custom">{en?'Every N days':'Κάθε Χ ημέρες'}</option></select></label>
          {draft.frequency.kind==='daily'?<label className="field"><span>{en?'Times per day *':'Φορές ανά ημέρα *'}</span><input type="number" min="1" max="12" value={count} onChange={e=>setF('timesPerDay',Math.max(1,Math.min(12,Number(e.target.value)||1)))}/></label>:<label className="field"><span>{en?'Interval *':'Διάστημα *'}</span><input type="number" min="1" value={draft.frequency.interval||1} onChange={e=>setF('interval',Math.max(1,Number(e.target.value)||1))}/></label>}
        </div>
        {draft.frequency.kind==='daily'&&<div className="control-times-panel"><div className="control-times-heading"><CalendarClock size={17}/><div><span>{en?'Execution times':'Ώρες εκτέλεσης'}</span><small>{en?'Set the exact time for each expected entry':'Ορίστε την ακριβή ώρα για κάθε αναμενόμενη καταχώρηση'}</small></div></div><div className="control-time-grid">{times.map((time,i)=><TimeField key={i} className="control-time-field" label={en?`Execution ${i+1}`:`${i+1}η εκτέλεση`} value={time} onChange={v=>{const next=[...times];next[i]=v;setF('times',next)}}/>)}</div></div>}
      </Card>
    </div>
   </div>
   <div className="control-editor-actions"><Button variant="secondary" onClick={onCancel}>{en?'Cancel':'Ακύρωση'}</Button><SaveButton disabled={!valid} onClick={submit}>{initial?(en?'Save changes':'Αποθήκευση αλλαγών'):(en?'Create control':'Δημιουργία ελέγχου')}</SaveButton></div>
  </Page>
}
