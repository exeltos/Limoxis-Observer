import { useEffect,useMemo,useState } from 'react'
import { CalendarClock,ClipboardCheck,Search } from 'lucide-react'
import { TimeField } from '../../design-system/TimeField'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { useTenant } from '../../core/tenant/TenantContext'
import { loadDepartments } from '../management/departmentsService'

const CATEGORY_PRESETS={
  'Θερμοκρασίες':{mode:'numeric',label:'Θερμοκρασία',unit:'°C',min:'',max:''},
  'Φάρμακα / Υλικά':{mode:'list',label:'Ευρήματα',template:'medication_expiry'},
  'Καλλιέργειες':{mode:'list',label:'Δείγματα / ευρήματα',template:'generic_findings'},
  'Εξοπλισμός':{mode:'choice',label:'Κατάσταση',options:['Συμμορφώνεται','Μη συμμόρφωση']},
  'Καθαριότητα / Απολύμανση':{mode:'choice',label:'Κατάσταση',options:['Συμμορφώνεται','Μη συμμόρφωση']},
}

export function ControlEditor({initial,onCancel,onSave,departmentOnly=false,fixedDepartment=''}){
 const {language}=useLanguage();const en=language==='en'
 const {membership}=useTenant()
 const organizationId=membership?.organization?.id||membership?.organization_id||membership?.organizationId||''
 const [departmentRows,setDepartmentRows]=useState([])
 const [deptQuery,setDeptQuery]=useState('')
 const [draft,setDraft]=useState(()=>initial?JSON.parse(JSON.stringify(initial)):{title:'',category:'',departments:departmentOnly&&fixedDepartment?[fixedDepartment]:[],owner:'',description:'',createdByScope:departmentOnly?'department':'infection_control',lastCompletedAt:null,responseConfig:{mode:'text',label:'Αποτέλεσμα'},frequency:{kind:'daily',timesPerDay:1,times:['09:00'],interval:1}})
 useEffect(()=>{let active=true;if(departmentOnly&&fixedDepartment){setDepartmentRows([{name:fixedDepartment}]);return()=>{active=false}};(async()=>{try{const rows=await loadDepartments(organizationId);if(active)setDepartmentRows((rows||[]).filter(x=>x.is_active!==false))}catch{if(active)setDepartmentRows([])}})();return()=>{active=false}},[organizationId,departmentOnly,fixedDepartment])
 const departments=useMemo(()=>departmentRows.map(x=>x.name).filter(Boolean),[departmentRows])
 const set=(k,v)=>setDraft(d=>({...d,[k]:v})),setF=(k,v)=>setDraft(d=>({...d,frequency:{...d.frequency,[k]:v}})),setR=(k,v)=>setDraft(d=>({...d,responseConfig:{...(d.responseConfig||{mode:'text',label:'Αποτέλεσμα'}),[k]:v}}))
 const toggleDept=d=>set('departments',draft.departments.includes(d)?draft.departments.filter(x=>x!==d):[...draft.departments,d])
 const count=Math.max(1,Number(draft.frequency.timesPerDay)||1)
 const times=Array.from({length:count},(_,i)=>draft.frequency.times?.[i]||`${String(Math.min(23,8+i*4)).padStart(2,'0')}:00`)
 const visibleDepartments=(departmentOnly&&fixedDepartment?[fixedDepartment]:departments).filter(d=>d.toLowerCase().includes(deptQuery.toLowerCase()))
 const valid=draft.title.trim()&&draft.category.trim()&&draft.departments.length>0&&draft.owner.trim()&&(draft.frequency.kind!=='daily'||times.every(Boolean))
 function changeCategory(value){setDraft(d=>({...d,category:value,responseConfig:CATEGORY_PRESETS[value]?{...CATEGORY_PRESETS[value]}:(d.category===value?d.responseConfig:{mode:'text',label:'Αποτέλεσμα'})}))}
 function submit(){if(!valid)return;onSave({...draft,titleEn:draft.titleEn||draft.title,frequency:{...draft.frequency,timesPerDay:count,times:draft.frequency.kind==='daily'?times:[]}})}
 const title=initial?(en?'Edit control':'Επεξεργασία ελέγχου'):(en?'New control':'Νέος έλεγχος')
 return <Page fill className="control-editor-page">
  <EntityRecordShell className="control-create-shell workspace-fill" avatar={<ClipboardCheck size={19}/>} eyebrow={en?'CONTROLS':'ΕΛΕΓΧΟΙ'} title={title} subtitle={en?'Define what is checked, how it is recorded, where and when it runs.':'Ορίστε τι ελέγχεται, πώς καταχωρείται, πού εφαρμόζεται και πότε εκτελείται.'} tabs={[]} activeTab="" onTabChange={()=>{}} onBack={onCancel}>
   <div className="record-section control-create-form">
    <div className="control-form-block">
     <div className="control-form-block-title"><strong>{en?'Control identity':'Στοιχεία ελέγχου'}</strong><span>{en?'Core definition and responsible role':'Βασικός ορισμός και υπεύθυνος'}</span></div>
     <div className="entry-grid control-entry-grid">
      <label className="entry-span-2"><span>{en?'Control name *':'Ονομασία ελέγχου *'}</span><input autoFocus value={draft.title} onChange={e=>set('title',e.target.value)} placeholder={en?'e.g. Medication refrigerator temperature':'π.χ. Θερμοκρασία ψυγείου φαρμάκων'}/></label>
      <label><span>{en?'Category *':'Κατηγορία *'}</span><input list="control-categories" value={draft.category} onChange={e=>changeCategory(e.target.value)} placeholder={en?'Select or type':'Επιλέξτε ή γράψτε'}/><datalist id="control-categories"><option value="Θερμοκρασίες"/><option value="Φάρμακα / Υλικά"/><option value="Καλλιέργειες"/><option value="Εξοπλισμός"/><option value="Καθαριότητα / Απολύμανση"/><option value="Άλλο"/></datalist></label>
      <label><span>{en?'Responsible *':'Υπεύθυνος *'}</span><input list="control-owners" value={draft.owner} onChange={e=>set('owner',e.target.value)} placeholder={en?'Select or type':'Επιλέξτε ή γράψτε'}/><datalist id="control-owners"><option value="Υπεύθυνος βάρδιας"/><option value="Προϊστάμενος τμήματος"/><option value="Νοσηλευτής βάρδιας"/><option value="Ομάδα Ελέγχου Λοιμώξεων"/></datalist></label>
     </div>
    </div>

    <div className="control-form-split">
     <div className="control-form-block">
      <div className="control-form-block-title"><strong>{en?'Entry configuration':'Τρόπος καταχώρησης'}</strong><span>{en?'Fields shown during execution':'Πεδία που εμφανίζονται κατά την εκτέλεση'}</span></div>
      <div className="entry-grid control-entry-grid">
       <label><span>{en?'Result format *':'Μορφή αποτελέσματος *'}</span><select value={draft.responseConfig?.mode||'text'} onChange={e=>setR('mode',e.target.value)}><option value="text">{en?'Text / simple value':'Κείμενο / απλή τιμή'}</option><option value="numeric">{en?'Numeric value with limits':'Αριθμητική τιμή με όρια'}</option><option value="choice">{en?'Status choice':'Επιλογή κατάστασης'}</option><option value="list">{en?'Findings / items list':'Λίστα ευρημάτων / αντικειμένων'}</option></select></label>
       <label><span>{en?'Field label':'Ετικέτα πεδίου'}</span><input value={draft.responseConfig?.label||''} onChange={e=>setR('label',e.target.value)} placeholder={en?'e.g. Temperature':'π.χ. Θερμοκρασία'}/></label>
       {draft.responseConfig?.mode==='numeric'&&<><label><span>{en?'Unit':'Μονάδα μέτρησης'}</span><input value={draft.responseConfig?.unit||''} onChange={e=>setR('unit',e.target.value)} placeholder="°C"/></label><div className="control-inline-limits"><label><span>{en?'Minimum acceptable':'Ελάχιστο αποδεκτό'}</span><input type="number" value={draft.responseConfig?.min??''} onChange={e=>setR('min',e.target.value===''?'':Number(e.target.value))}/></label><label><span>{en?'Maximum acceptable':'Μέγιστο αποδεκτό'}</span><input type="number" value={draft.responseConfig?.max??''} onChange={e=>setR('max',e.target.value===''?'':Number(e.target.value))}/></label></div></>}
       {draft.responseConfig?.mode==='choice'&&<label className="entry-span-2"><span>{en?'Available choices':'Διαθέσιμες επιλογές'}</span><textarea rows="3" value={(draft.responseConfig?.options||['Συμμορφώνεται','Μη συμμόρφωση']).join('\n')} onChange={e=>setR('options',e.target.value.split('\n').filter(Boolean))}/></label>}
       {draft.responseConfig?.mode==='list'&&<label className="entry-span-2"><span>{en?'List template':'Πρότυπο λίστας'}</span><select value={draft.responseConfig?.template||'generic_findings'} onChange={e=>setR('template',e.target.value)}><option value="medication_expiry">{en?'Medicines / supplies — expiry findings':'Φάρμακα / υλικά — λήξεις και ευρήματα'}</option><option value="generic_findings">{en?'General findings list':'Γενική λίστα ευρημάτων'}</option></select></label>}
      </div>
     </div>

     <div className="control-form-block">
      <div className="control-form-block-title"><strong>{en?'Schedule':'Προγραμματισμός'}</strong><span>{en?'Frequency and exact execution times':'Συχνότητα και ακριβείς ώρες εκτέλεσης'}</span></div>
      <div className="control-schedule-row">
       <label><span>{en?'Frequency *':'Συχνότητα *'}</span><select value={draft.frequency.kind} onChange={e=>setF('kind',e.target.value)}><option value="daily">{en?'Daily':'Ημερήσια'}</option><option value="weekly">{en?'Weekly':'Εβδομαδιαία'}</option><option value="monthly">{en?'Monthly / every N months':'Μηνιαία / ανά Χ μήνες'}</option><option value="yearly">{en?'Yearly':'Ετήσια'}</option><option value="custom">{en?'Every N days':'Κάθε Χ ημέρες'}</option></select></label>
       {draft.frequency.kind==='daily'?<label><span>{en?'Times per day *':'Φορές ανά ημέρα *'}</span><input type="number" min="1" max="12" value={count} onChange={e=>setF('timesPerDay',Math.max(1,Math.min(12,Number(e.target.value)||1)))}/></label>:<label><span>{en?'Interval *':'Διάστημα *'}</span><input type="number" min="1" value={draft.frequency.interval||1} onChange={e=>setF('interval',Math.max(1,Number(e.target.value)||1))}/></label>}
      </div>
      {draft.frequency.kind==='daily'&&<div className="control-times-compact"><div className="control-times-compact-title"><CalendarClock size={16}/><span>{en?'Execution times':'Ώρες εκτέλεσης'}</span></div><div className="control-time-grid">{times.map((time,i)=><TimeField key={i} className="control-time-field" label={count>1?(en?`Execution ${i+1}`:`${i+1}η εκτέλεση`):''} value={time} onChange={v=>{const next=[...times];next[i]=v;setF('times',next)}}/>)}</div></div>}
     </div>
    </div>

    <div className="control-form-block">
     <div className="control-form-block-title"><strong>{en?'Applicable departments':'Τμήματα εφαρμογής'}</strong><span>{draft.departments.length?`${draft.departments.length} ${en?'selected':'επιλεγμένα'}`:(en?'Select at least one department':'Επιλέξτε τουλάχιστον ένα τμήμα')}</span></div>
     <div className="control-dept-search"><Search size={16}/><input value={deptQuery} onChange={e=>setDeptQuery(e.target.value)} placeholder={en?'Search department...':'Αναζήτηση τμήματος...'}/></div>
     <div className="control-department-picker">{visibleDepartments.map(d=><label key={d} className={`check-option ${draft.departments.includes(d)?'selected':''}`}><input type="checkbox" checked={draft.departments.includes(d)} disabled={departmentOnly&&draft.departments.includes(d)} onChange={()=>toggleDept(d)}/><span>{d}</span></label>)}{!visibleDepartments.length&&<div className="inline-empty">{en?'No active departments found.':'Δεν βρέθηκαν ενεργά τμήματα.'}</div>}</div>
    </div>

    <div className="control-form-block control-guidance-block">
     <div className="control-form-block-title"><strong>{en?'Instructions':'Οδηγίες'}</strong><span>{en?'Optional guidance shown during execution':'Προαιρετικές οδηγίες που εμφανίζονται κατά την εκτέλεση'}</span></div>
     <label><textarea rows="3" value={draft.description||''} onChange={e=>set('description',e.target.value)} placeholder={en?'What should be checked, acceptable limits or other instructions...':'Τι πρέπει να ελεγχθεί, αποδεκτά όρια ή άλλες οδηγίες...'}/></label>
    </div>

    <div className="inline-edit-footer control-create-footer"><Button variant="secondary" onClick={onCancel}>{en?'Cancel':'Ακύρωση'}</Button><SaveButton disabled={!valid} onClick={submit}>{initial?(en?'Save changes':'Αποθήκευση αλλαγών'):(en?'Create control':'Δημιουργία ελέγχου')}</SaveButton></div>
   </div>
  </EntityRecordShell>
 </Page>
}