import { useMemo,useState } from 'react'
import { CheckCircle2,Plus,Trash2 } from 'lucide-react'
import { demoLibrarySeed } from '../management/managementData'
import { useAuth } from '../../core/auth/AuthContext'
import { controlActorFromAuth } from '../controls/controlActor'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { ManualDateField } from '../../design-system/ManualDateField'
import { TimeField } from '../../design-system/TimeField'

export const WHO_MOMENTS=[
 {id:'moment1',label:'1. Πριν την επαφή με τον ασθενή'},
 {id:'moment2',label:'2. Πριν από καθαρό / άσηπτο χειρισμό'},
 {id:'moment3',label:'3. Μετά από κίνδυνο έκθεσης σε σωματικά υγρά'},
 {id:'moment4',label:'4. Μετά την επαφή με τον ασθενή'},
 {id:'moment5',label:'5. Μετά την επαφή με το περιβάλλον του ασθενούς'},
]
export const WHO_PROFESSIONS=['Ιατρός','Νοσηλευτής / Νοσηλεύτρια','Βοηθός Νοσηλευτή','Φυσικοθεραπευτής','Τεχνολόγος','Βοηθητικό προσωπικό','Άλλο']

const blankObservation=()=>({id:'',professionalsCount:1,professionalCategory:'Νοσηλευτής / Νοσηλεύτρια',moment:'moment1',action:'HR',gloves:false,notes:''})

export function WhoHandHygieneModal({onClose,onSave,fixedDepartment='',initialRecord=null}) {
 const {profile,user}=useAuth()
 const actor=useMemo(()=>controlActorFromAuth({profile,user}),[profile,user])
 const {confirm,notify}=useFeedback()
 const departments=useMemo(()=>demoLibrarySeed.departments.map(([el,en])=>({el,en})),[])
 const today=new Date().toISOString().slice(0,10)
 const [session,setSession]=useState(()=>initialRecord?.session
   ? {...initialRecord.session,department:initialRecord.departmentEl||initialRecord.session.department||fixedDepartment||departments[0]?.el||'',date:initialRecord.date||initialRecord.session.date||today,observer:initialRecord.observer||initialRecord.session.observer||actor.name}
   : {facility:'ΙΑΣΩ Θεσσαλίας',department:fixedDepartment||departments[0]?.el||'',date:today,observer:actor.name,startTime:'',endTime:''})
 const [current,setCurrent]=useState(blankObservation())
 const [items,setItems]=useState(()=>initialRecord?.whoObservations?JSON.parse(JSON.stringify(initialRecord.whoObservations)):[])

 const setS=(k,v)=>setSession(s=>({...s,[k]:v}))
 const setO=(k,v)=>setCurrent(o=>({...o,[k]:v}))
 const stats=useMemo(()=>{
   const total=(filter)=>items.filter(filter).reduce((sum,x)=>sum+(Number(x.professionalsCount)||1),0)
   const professionals=items.reduce((sum,x)=>sum+(Number(x.professionalsCount)||1),0)
   const opportunities=professionals
   const handRub=total(x=>x.action==='HR')
   const handWash=total(x=>x.action==='HW')
   const missed=total(x=>x.action==='MISSED')
   const compliant=handRub+handWash
   return {opportunities,handRub,handWash,missed,professionals,compliant,compliance:opportunities?Number(((compliant/opportunities)*100).toFixed(1)):0}
 },[items])

 function add(){
   if(Number(current.professionalsCount)<1)return
   setItems(list=>[...list,{...current,id:`WHO-OBS-${Date.now()}-${list.length}`}])
   setCurrent(blankObservation())
 }
 async function removeObservation(id){
   const ok=await confirm({title:'Αφαίρεση παρατήρησης',message:'Η συγκεκριμένη παρατήρηση θα αφαιρεθεί από τη συνεδρία. Θέλετε να συνεχίσετε;',confirmLabel:'Αφαίρεση',danger:true})
   if(!ok)return
   setItems(list=>list.filter(y=>y.id!==id))
   notify('Η παρατήρηση αφαιρέθηκε.','success')
 }
 function save(){
   if(!session.date||!session.department||!session.observer||!items.length)return
   const profession=items[0]?.professionalCategory?.startsWith('Ιατ')?'medical':'nursing'
   onSave({
     date:session.date,
     departmentEl:session.department,
     departmentEn:departments.find(d=>d.el===session.department)?.en||session.department,
     profession,
     observations:stats.opportunities,
     compliant:stats.compliant,
     rate:stats.compliance,
     observer:session.observer,
     session,
     whoObservations:items,
     whoStats:stats,
     createdAt:new Date().toISOString(),
     createdBy:actor.name,
     createdById:actor.id,
   })
 }

 const valid=session.date&&session.department&&session.observer&&items.length>0
 return <div className="modal-backdrop"><div className="entry-card who-observation-card">
  <header><div><span className="eyebrow">WHO HAND HYGIENE</span><h3>{initialRecord?'Επεξεργασία συνεδρίας':'Νέα συνεδρία παρατήρησης'}</h3><p>Καταγραφή ευκαιριών σύμφωνα με τα 5 Moments του WHO.</p></div><button className="icon-close" onClick={onClose}>×</button></header>
  <div className="who-observation-body">
   <section className="who-session-grid">
    <ManualDateField label="Ημερομηνία *" value={session.date} onChange={v=>setS('date',v)}/>
    <label><span>Τμήμα *</span><select value={session.department} disabled={Boolean(fixedDepartment)} onChange={e=>setS('department',e.target.value)}>{departments.map(d=><option key={d.el} value={d.el}>{d.el}</option>)}</select></label>
    <label><span>Παρατηρητής</span><input value={session.observer} readOnly/></label>
    <TimeField label="Έναρξη" value={session.startTime} onChange={v=>setS('startTime',v)}/>
    <TimeField label="Λήξη" value={session.endTime} onChange={v=>setS('endTime',v)}/>
   </section>

   <section className="who-opportunity-editor">
    <div className="who-section-title"><div><strong>Νέα ευκαιρία</strong><small>Κάθε γραμμή αντιστοιχεί σε μία παρατηρούμενη ευκαιρία υγιεινής χεριών.</small></div></div>
    <div className="who-opportunity-grid">
     <label><span>Αριθμός επαγγελματιών *</span><input type="number" min="1" step="1" value={current.professionalsCount} onChange={e=>setO('professionalsCount',Math.max(1,Number(e.target.value)||1))}/></label>
     <label><span>Επαγγελματική κατηγορία</span><select value={current.professionalCategory} onChange={e=>setO('professionalCategory',e.target.value)}>{WHO_PROFESSIONS.map(x=><option key={x}>{x}</option>)}</select></label>
     <label className="who-span-2"><span>WHO Moment</span><select value={current.moment} onChange={e=>setO('moment',e.target.value)}>{WHO_MOMENTS.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></label>

     <div className="who-span-2 who-action-field">
      <span>Ενέργεια *</span>
      <div className="who-action-options" role="radiogroup" aria-label="Ενέργεια υγιεινής χεριών">
       <button type="button" className={`who-action-option ${current.action==='HR'?'selected':''}`} onClick={()=>setO('action','HR')} role="radio" aria-checked={current.action==='HR'}>
        <span className="who-action-check">{current.action==='HR'?'✓':''}</span>
        <span><strong>Αλκοολούχο αντισηπτικό</strong><small>Hand Rub (HR)</small></span>
       </button>
       <button type="button" className={`who-action-option ${current.action==='HW'?'selected':''}`} onClick={()=>setO('action','HW')} role="radio" aria-checked={current.action==='HW'}>
        <span className="who-action-check">{current.action==='HW'?'✓':''}</span>
        <span><strong>Πλύσιμο με σαπούνι & νερό</strong><small>Hand Wash (HW)</small></span>
       </button>
       <button type="button" className={`who-action-option ${current.action==='MISSED'?'selected danger':''}`} onClick={()=>setO('action','MISSED')} role="radio" aria-checked={current.action==='MISSED'}>
        <span className="who-action-check">{current.action==='MISSED'?'✓':''}</span>
        <span><strong>Δεν πραγματοποιήθηκε</strong><small>Missed</small></span>
       </button>
      </div>
     </div>

     <label className="who-gloves-card"><input type="checkbox" checked={current.gloves} onChange={e=>setO('gloves',e.target.checked)}/><span><strong>Χρήση γαντιών</strong><small>Gloves</small></span></label>
     <label className="who-note-field"><span>Σημείωση</span><input value={current.notes} onChange={e=>setO('notes',e.target.value)} placeholder="Προαιρετικά"/></label>
    </div>
    <div className="who-add-row"><button className="button button-quiet" disabled={Number(current.professionalsCount)<1} onClick={add}><Plus size={15}/> Προσθήκη παρατήρησης</button></div>
   </section>

   <section className="who-live-summary">
    <div><span>Ευκαιρίες</span><strong>{stats.opportunities}</strong></div>
    <div><span>Επαγγελματίες</span><strong>{stats.professionals}</strong></div>
    <div><span>HR</span><strong>{stats.handRub}</strong></div>
    <div><span>HW</span><strong>{stats.handWash}</strong></div>
    <div><span>Missed</span><strong>{stats.missed}</strong></div>
    <div className="who-compliance"><span>Συμμόρφωση</span><strong>{stats.compliance}%</strong></div>
   </section>

   <section className="who-opportunity-list">
    <table><thead><tr><th>#</th><th>Επαγγελματίες</th><th>Κατηγορία</th><th>WHO Moment</th><th>Ενέργεια</th><th>Γάντια</th><th></th></tr></thead>
     <tbody>{items.map((x,i)=><tr key={x.id}><td>{i+1}</td><td><strong>{x.professionalsCount||1}</strong></td><td>{x.professionalCategory}</td><td>{WHO_MOMENTS.find(m=>m.id===x.moment)?.label}</td><td><span className={`status-badge ${x.action==='MISSED'?'danger':'active'}`}>{x.action}</span></td><td>{x.gloves?'Ναι':'Όχι'}</td><td><button className="control-row-delete" onClick={()=>removeObservation(x.id)}><Trash2 size={14}/></button></td></tr>)}</tbody>
    </table>
   </section>
  </div>
  <footer><button className="button" onClick={onClose}>Ακύρωση</button><button className="button button-primary" disabled={!valid} onClick={save}><CheckCircle2 size={15}/> {initialRecord?'Αποθήκευση αλλαγών':'Αποθήκευση συνεδρίας'}</button></footer>
 </div></div>
}
