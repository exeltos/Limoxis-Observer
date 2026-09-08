import { useMemo,useState } from 'react'
import { Plus,Save,Trash2,X } from 'lucide-react'
import { useAuth } from '../../core/auth/AuthContext'
import { controlActorFromAuth } from '../controls/controlActor'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { ManualDateField } from '../../design-system/ManualDateField'
import { TimeField } from '../../design-system/TimeField'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { ActionButton } from '../../design-system/ActionButton'

export const WHO_MOMENTS=[
 {id:'moment1',label:'1. Πριν την επαφή με τον ασθενή',labelEn:'1. Before touching a patient'},
 {id:'moment2',label:'2. Πριν από καθαρό / άσηπτο χειρισμό',labelEn:'2. Before clean / aseptic procedure'},
 {id:'moment3',label:'3. Μετά από κίνδυνο έκθεσης σε σωματικά υγρά',labelEn:'3. After body fluid exposure risk'},
 {id:'moment4',label:'4. Μετά την επαφή με τον ασθενή',labelEn:'4. After touching a patient'},
 {id:'moment5',label:'5. Μετά την επαφή με το περιβάλλον του ασθενούς',labelEn:'5. After touching patient surroundings'},
]

export const WHO_PROFESSIONS=[
 ['Ιατρός','Physician'],['Νοσηλευτής / Νοσηλεύτρια','Nurse'],['Βοηθός Νοσηλευτή','Nursing assistant'],
 ['Φυσικοθεραπευτής','Physiotherapist'],['Τεχνολόγος','Technologist'],['Βοηθητικό προσωπικό','Support staff'],['Άλλο','Other'],
]

const blankObservation=()=>({id:'',professionalsCount:1,professionalCategory:'Νοσηλευτής / Νοσηλεύτρια',moment:'moment1',action:'HR',gloves:false,notes:''})

export function WhoHandHygieneEditor({onCancel,onSave,fixedDepartment='',initialRecord=null,departments=[]}){
 const {profile,user}=useAuth()
 const {language}=useLanguage();const en=language==='en'
 const actor=useMemo(()=>controlActorFromAuth({profile,user}),[profile,user])
 const {confirm,notify}=useFeedback()
 const today=new Date().toISOString().slice(0,10)
 const firstDepartment=fixedDepartment||initialRecord?.departmentEl||departments[0]?.el||''
 const [session,setSession]=useState(()=>initialRecord?.session
  ? {...initialRecord.session,department:initialRecord.departmentEl||initialRecord.session.department||firstDepartment,date:initialRecord.date||initialRecord.session.date||today,observer:initialRecord.observer||initialRecord.session.observer||actor.name}
  : {facility:'',department:firstDepartment,date:today,observer:actor.name,startTime:'',endTime:''})
 const [current,setCurrent]=useState(blankObservation())
 const [items,setItems]=useState(()=>initialRecord?.whoObservations?JSON.parse(JSON.stringify(initialRecord.whoObservations)):[])
 const [saving,setSaving]=useState(false)

 const setS=(key,value)=>setSession(state=>({...state,[key]:value}))
 const setO=(key,value)=>setCurrent(state=>({...state,[key]:value}))
 const stats=useMemo(()=>{
  const opportunities=items.length
  const professionals=items.reduce((sum,item)=>sum+(Number(item.professionalsCount)||1),0)
  const handRub=items.filter(item=>item.action==='HR').length
  const handWash=items.filter(item=>item.action==='HW').length
  const missed=items.filter(item=>item.action==='MISSED').length
  const compliant=handRub+handWash
  return {opportunities,handRub,handWash,missed,professionals,compliant,compliance:opportunities?Number(((compliant/opportunities)*100).toFixed(1)):0}
 },[items])

 function add(){
  if(Number(current.professionalsCount)<1)return
  setItems(list=>[...list,{...current,id:`WHO-OBS-${Date.now()}-${list.length}`}])
  setCurrent(blankObservation())
 }

 async function removeObservation(id){
  const ok=await confirm({title:en?'Remove observation':'Αφαίρεση παρατήρησης',message:en?'This observation will be removed from the session. Continue?':'Η συγκεκριμένη παρατήρηση θα αφαιρεθεί από τη συνεδρία. Θέλετε να συνεχίσετε;',confirmLabel:en?'Remove':'Αφαίρεση',danger:true})
  if(!ok)return
  setItems(list=>list.filter(item=>item.id!==id))
  notify(en?'Observation removed.':'Η παρατήρηση αφαιρέθηκε.','success')
 }

 const valid=Boolean(session.date&&session.department&&session.observer&&items.length)
 async function save(){
  if(!valid||saving)return
  const profession=items[0]?.professionalCategory?.startsWith('Ιατ')?'medical':'nursing'
  const record={date:session.date,departmentEl:session.department,departmentEn:departments.find(d=>d.el===session.department)?.en||session.department,profession,observations:stats.opportunities,compliant:stats.compliant,rate:stats.compliance,observer:session.observer,session,whoObservations:items,whoStats:stats,createdAt:initialRecord?.createdAt||new Date().toISOString(),createdBy:initialRecord?.createdBy||actor.name,createdById:initialRecord?.createdById||actor.id,updatedAt:new Date().toISOString(),updatedBy:actor.name,updatedById:actor.id}
  try{setSaving(true);await onSave(record)}finally{setSaving(false)}
 }

 return <div className="who-observation-body who-page-editor">
  <section className="who-session-grid">
   <ManualDateField label={en?'Date *':'Ημερομηνία *'} value={session.date} onChange={value=>setS('date',value)}/>
   <label><span>{en?'Department *':'Τμήμα *'}</span><select value={session.department} disabled={Boolean(fixedDepartment)} onChange={event=>setS('department',event.target.value)}>{departments.map(department=><option key={department.id||department.el} value={department.el}>{en?(department.en||department.el):department.el}</option>)}</select></label>
   <label><span>{en?'Observer':'Παρατηρητής'}</span><input value={session.observer} readOnly/></label>
   <TimeField label={en?'Start':'Έναρξη'} value={session.startTime} onChange={value=>setS('startTime',value)}/>
   <TimeField label={en?'End':'Λήξη'} value={session.endTime} onChange={value=>setS('endTime',value)}/>
  </section>

  <section className="who-opportunity-editor">
   <div className="who-section-title"><div><strong>{en?'New opportunity':'Νέα ευκαιρία'}</strong><small>{en?'Each saved row is one observed hand-hygiene opportunity.':'Κάθε αποθηκευμένη γραμμή είναι μία παρατηρούμενη ευκαιρία υγιεινής χεριών.'}</small></div></div>
   <div className="who-opportunity-grid">
    <label><span>{en?'Professionals observed':'Παρατηρούμενοι επαγγελματίες'}</span><input type="number" min="1" step="1" value={current.professionalsCount} onChange={event=>setO('professionalsCount',Math.max(1,Number(event.target.value)||1))}/></label>
    <label><span>{en?'Professional category':'Επαγγελματική κατηγορία'}</span><select value={current.professionalCategory} onChange={event=>setO('professionalCategory',event.target.value)}>{WHO_PROFESSIONS.map(([el,enLabel])=><option key={el} value={el}>{en?enLabel:el}</option>)}</select></label>
    <label className="who-span-2"><span>WHO Moment</span><select value={current.moment} onChange={event=>setO('moment',event.target.value)}>{WHO_MOMENTS.map(moment=><option key={moment.id} value={moment.id}>{en?moment.labelEn:moment.label}</option>)}</select></label>
    <div className="who-span-2 who-action-field"><span>{en?'Action *':'Ενέργεια *'}</span><div className="who-action-options who-action-options-with-gloves" role="radiogroup" aria-label={en?'Hand hygiene action':'Ενέργεια υγιεινής χεριών'}>
     <button type="button" className={`who-action-option ${current.action==='HR'?'selected':''}`} onClick={()=>setO('action','HR')} role="radio" aria-checked={current.action==='HR'}><span className="who-action-check">{current.action==='HR'?'✓':''}</span><span><strong>{en?'Alcohol-based hand rub':'Αλκοολούχο αντισηπτικό'}</strong><small>Hand Rub (HR)</small></span></button>
     <button type="button" className={`who-action-option ${current.action==='HW'?'selected':''}`} onClick={()=>setO('action','HW')} role="radio" aria-checked={current.action==='HW'}><span className="who-action-check">{current.action==='HW'?'✓':''}</span><span><strong>{en?'Hand wash with soap & water':'Πλύσιμο με σαπούνι & νερό'}</strong><small>Hand Wash (HW)</small></span></button>
     <button type="button" className={`who-action-option ${current.action==='MISSED'?'selected danger':''}`} onClick={()=>setO('action','MISSED')} role="radio" aria-checked={current.action==='MISSED'}><span className="who-action-check">{current.action==='MISSED'?'✓':''}</span><span><strong>{en?'Not performed':'Δεν πραγματοποιήθηκε'}</strong><small>Missed</small></span></button>
     <label className={`who-gloves-inline ${current.gloves?'selected':''}`}><input type="checkbox" checked={current.gloves} onChange={event=>setO('gloves',event.target.checked)}/><span><strong>{en?'Glove use':'Χρήση γαντιών'}</strong><small>Gloves</small></span></label>
    </div></div>
    <label className="who-note-field who-span-2"><span>{en?'Note':'Σημείωση'}</span><input value={current.notes} onChange={event=>setO('notes',event.target.value)} placeholder={en?'Optional':'Προαιρετικά'}/></label>
   </div>
   <div className="who-add-row"><ActionButton label={en?'Add opportunity':'Προσθήκη ευκαιρίας'} tone="neutral" disabled={Number(current.professionalsCount)<1} onClick={add}><Plus size={16}/><span>{en?'Add opportunity':'Προσθήκη ευκαιρίας'}</span></ActionButton></div>
  </section>

  <section className="who-live-summary">
   <div><span>{en?'Opportunities':'Ευκαιρίες'}</span><strong>{stats.opportunities}</strong></div>
   <div><span>{en?'Professionals observed':'Παρατηρούμενοι επαγγελματίες'}</span><strong>{stats.professionals}</strong></div>
   <div><span>HR</span><strong>{stats.handRub}</strong></div>
   <div><span>HW</span><strong>{stats.handWash}</strong></div>
   <div><span>Missed</span><strong>{stats.missed}</strong></div>
   <div className="who-compliance"><span>{en?'Compliance':'Συμμόρφωση'}</span><strong>{stats.compliance}%</strong></div>
  </section>

  <section className="who-opportunity-list"><table className="who-opportunity-table"><thead><tr><th>#</th><th>{en?'Professionals':'Επαγγελματίες'}</th><th>{en?'Category':'Κατηγορία'}</th><th>WHO Moment</th><th>{en?'Action':'Ενέργεια'}</th><th>{en?'Gloves':'Γάντια'}</th><th></th></tr></thead><tbody>{items.map((item,index)=><tr key={item.id}><td>{index+1}</td><td><strong>{item.professionalsCount||1}</strong></td><td>{en?(WHO_PROFESSIONS.find(([el])=>el===item.professionalCategory)?.[1]||item.professionalCategory):item.professionalCategory}</td><td>{en?WHO_MOMENTS.find(moment=>moment.id===item.moment)?.labelEn:WHO_MOMENTS.find(moment=>moment.id===item.moment)?.label}</td><td><span className={`status-badge ${item.action==='MISSED'?'danger':'active'}`}>{item.action}</span></td><td>{item.gloves?(en?'Yes':'Ναι'):(en?'No':'Όχι')}</td><td><ActionButton iconOnly label={en?'Remove opportunity':'Αφαίρεση ευκαιρίας'} tone="danger" onClick={()=>removeObservation(item.id)}><Trash2 size={15}/></ActionButton></td></tr>)}</tbody></table></section>

  <div className="who-editor-page-actions">
   <ActionButton label={en?'Cancel':'Ακύρωση'} tone="neutral" onClick={onCancel}><X size={16}/><span>{en?'Cancel':'Ακύρωση'}</span></ActionButton>
   <ActionButton label={initialRecord?(en?'Save changes':'Αποθήκευση αλλαγών'):(en?'Save session':'Αποθήκευση συνεδρίας')} tone="primary" disabled={!valid||saving} onClick={save}><Save size={16}/><span>{saving?(en?'Saving…':'Αποθήκευση…'):initialRecord?(en?'Save changes':'Αποθήκευση αλλαγών'):(en?'Save session':'Αποθήκευση συνεδρίας')}</span></ActionButton>
  </div>
 </div>
}
