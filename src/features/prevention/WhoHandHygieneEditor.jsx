import { useEffect,useMemo,useState } from 'react'
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

const normalizeMoments=item=>{
 const values=Array.isArray(item?.moments)?item.moments.filter(Boolean):[]
 if(values.length)return [...new Set(values)]
 return item?.moment?[item.moment]:[]
}
const blankObservation=()=>({id:'',professionalsCount:1,professionalCategory:'Νοσηλευτής / Νοσηλεύτρια',moments:[],action:'',gloves:false,notes:''})
const observationWeight=item=>Math.max(1,Number(item?.professionalsCount)||1)
const calculateStats=(list=[])=>{
 const opportunities=list.reduce((sum,item)=>sum+observationWeight(item),0)
 const professionals=opportunities
 const handRub=list.reduce((sum,item)=>sum+(item.action==='HR'?observationWeight(item):0),0)
 const handWash=list.reduce((sum,item)=>sum+(item.action==='HW'?observationWeight(item):0),0)
 const missed=list.reduce((sum,item)=>sum+(item.action==='MISSED'?observationWeight(item):0),0)
 const compliant=handRub+handWash
 return {opportunities,handRub,handWash,missed,professionals,compliant,compliance:opportunities?Number(((compliant/opportunities)*100).toFixed(1)):0}
}

const actionLabel=(action,en)=>!action?(en?'Select action':'Επιλέξτε ενέργεια'):action==='HR'?(en?'Hand rub':'Αντισηπτικό'):action==='HW'?(en?'Hand wash':'Πλύσιμο'):(en?'Missed':'Δεν έγινε')
const momentLabels=(moments,en)=>normalizeMoments({moments}).map(id=>WHO_MOMENTS.find(moment=>moment.id===id)).filter(Boolean).map(moment=>en?moment.labelEn:moment.label)

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
 const [currentTouched,setCurrentTouched]=useState(false)
 const [items,setItems]=useState(()=>initialRecord?.whoObservations?JSON.parse(JSON.stringify(initialRecord.whoObservations)).map(item=>({...item,moments:normalizeMoments(item)})):[])
 const [saving,setSaving]=useState(false)

 useEffect(()=>{
  if(session.department)return
  const nextDepartment=fixedDepartment||initialRecord?.departmentEl||departments[0]?.el||''
  if(nextDepartment)setSession(state=>state.department?state:{...state,department:nextDepartment})
 },[departments,fixedDepartment,initialRecord?.departmentEl,session.department])

 const setS=(key,value)=>setSession(state=>({...state,[key]:value}))
 const setO=(key,value)=>{setCurrentTouched(true);setCurrent(state=>({...state,[key]:value}))}
 const toggleMoment=id=>{setCurrentTouched(true);setCurrent(state=>{const selected=normalizeMoments(state);return {...state,moments:selected.includes(id)?selected.filter(value=>value!==id):[...selected,id]}})}
 const currentMoments=normalizeMoments(current)
 const currentValid=Boolean(Number(current.professionalsCount)>=1&&current.professionalCategory&&currentMoments.length&&current.action)
 const previewItems=useMemo(()=>currentTouched&&currentValid?[...items,current]:items,[items,current,currentTouched,currentValid])
 const stats=useMemo(()=>calculateStats(previewItems),[previewItems])
 const sessionValid=Boolean(session.date?.trim?.()&&session.department?.trim?.()&&session.observer?.trim?.())
 const valid=Boolean(sessionValid&&previewItems.length>0)
 const selectedMomentLabels=momentLabels(currentMoments,en)

 function add(){
  if(!currentValid)return
  setItems(list=>[...list,{...current,moments:currentMoments,id:`WHO-OBS-${Date.now()}-${list.length}`}])
  setCurrent(blankObservation())
  setCurrentTouched(false)
 }

 async function removeObservation(id){
  const ok=await confirm({title:en?'Remove observation':'Αφαίρεση παρατήρησης',message:en?'This observation will be removed from the session. Continue?':'Η συγκεκριμένη παρατήρηση θα αφαιρεθεί από τη συνεδρία. Θέλετε να συνεχίσετε;',confirmLabel:en?'Remove':'Αφαίρεση',danger:true})
  if(!ok)return
  setItems(list=>list.filter(item=>item.id!==id))
  notify(en?'Observation removed.':'Η παρατήρηση αφαιρέθηκε.','success')
 }

 async function save(){
  if(!valid||saving)return
  const finalItems=currentTouched&&currentValid
   ? [...items,{...current,moments:currentMoments,id:current.id||`WHO-OBS-${Date.now()}-${items.length}`}]
   : items
  if(!finalItems.length)return
  const finalStats=calculateStats(finalItems)
  const profession=finalItems[0]?.professionalCategory?.startsWith('Ιατ')?'medical':'nursing'
  const normalizedItems=finalItems.map(item=>({...item,moments:normalizeMoments(item)}))
  const record={date:session.date,departmentEl:session.department,departmentEn:departments.find(d=>d.el===session.department)?.en||session.department,profession,observations:finalStats.opportunities,compliant:finalStats.compliant,rate:finalStats.compliance,observer:session.observer,session,whoObservations:normalizedItems,whoStats:finalStats,createdAt:initialRecord?.createdAt||new Date().toISOString(),createdBy:initialRecord?.createdBy||actor.name,createdById:initialRecord?.createdById||actor.id,updatedAt:new Date().toISOString(),updatedBy:actor.name,updatedById:actor.id}
  try{setSaving(true);await onSave(record)}finally{setSaving(false)}
 }

 return <div className="who-observation-body who-page-editor who-smart-editor">
  <section className="who-session-panel who-smart-session">
   <div className="who-panel-heading"><div><strong>{en?'WHO hand hygiene observation':'Παρατήρηση Υγιεινής Χεριών WHO'}</strong><small>{en?'5 Moments · session context':'5 Στιγμές · στοιχεία συνεδρίας'}</small></div><span className={`who-session-ready ${sessionValid?'ready':''}`}>{sessionValid?(en?'Ready':'Έτοιμη'):(en?'Complete session details':'Συμπληρώστε τα στοιχεία')}</span></div>
   <div className="who-session-grid who-session-strip">
    <ManualDateField label={en?'Date *':'Ημερομηνία *'} value={session.date} onChange={value=>setS('date',value)}/>
    <label><span>{en?'Department *':'Τμήμα *'}</span><select value={session.department} disabled={Boolean(fixedDepartment)} onChange={event=>setS('department',event.target.value)}>{departments.map(department=><option key={department.id||department.el} value={department.el}>{en?(department.en||department.el):department.el}</option>)}</select></label>
    <label><span>{en?'Observer':'Παρατηρητής'}</span><input value={session.observer} readOnly/></label>
    <TimeField label={en?'Start':'Έναρξη'} value={session.startTime} onChange={value=>setS('startTime',value)}/>
    <TimeField label={en?'End':'Λήξη'} value={session.endTime} onChange={value=>setS('endTime',value)}/>
   </div>
  </section>

  <div className="who-smart-layout">
   <div className="who-entry-column">
    <section className="who-opportunity-editor who-opportunity-entry who-smart-builder">
     <div className="who-section-title"><div><strong>{en?'Record opportunity':'Καταγραφή ευκαιρίας'}</strong><small>{en?'Select the observed professional, WHO indication(s) and action.':'Επιλέξτε επαγγελματία, ένδειξη ή ενδείξεις WHO και ενέργεια.'}</small></div><span className="who-step-badge">{en?'Live entry':'Άμεση καταγραφή'}</span></div>

     <div className="who-professional-row">
      <label><span>{en?'Number of professionals':'Αριθμός επαγγελματιών'}</span><input type="number" min="1" step="1" value={current.professionalsCount} onChange={event=>setO('professionalsCount',Math.max(1,Number(event.target.value)||1))}/></label>
      <label><span>{en?'Professional category':'Επαγγελματική κατηγορία'}</span><select value={current.professionalCategory} onChange={event=>setO('professionalCategory',event.target.value)}>{WHO_PROFESSIONS.map(([el,enLabel])=><option key={el} value={el}>{en?enLabel:el}</option>)}</select></label>
     </div>

     <div className="who-choice-block">
      <div className="who-choice-heading"><span>WHO 5 Moments</span><small>{en?'Select one or more indications observed in this opportunity':'Επιλέξτε μία ή περισσότερες ενδείξεις που συνυπάρχουν στην ίδια ευκαιρία'}</small></div>
      <div className="who-moment-picker" role="group" aria-label="WHO 5 Moments">
       {WHO_MOMENTS.map(moment=>{const selected=currentMoments.includes(moment.id);return <button key={moment.id} type="button" aria-pressed={selected} className={`who-moment-option ${selected?'selected':''}`} onClick={()=>toggleMoment(moment.id)}><span className="who-moment-number">{moment.id.replace('moment','')}</span><span>{en?moment.labelEn.replace(/^\d+\.\s*/,''):moment.label.replace(/^\d+\.\s*/,'')}</span></button>})}
      </div>
     </div>

     <div className="who-choice-block who-action-section">
      <div className="who-choice-heading"><span>{en?'Observed action':'Παρατηρούμενη ενέργεια'}</span><small>{en?'One action per opportunity':'Μία ενέργεια ανά ευκαιρία'}</small></div>
      <div className="who-action-options who-smart-actions" role="radiogroup" aria-label={en?'Hand hygiene action':'Ενέργεια υγιεινής χεριών'}>
       <button type="button" className={`who-action-option ${current.action==='HR'?'selected':''}`} onClick={()=>setO('action','HR')} role="radio" aria-checked={current.action==='HR'}><span className="who-action-check">{current.action==='HR'?'✓':''}</span><span><strong>{en?'Alcohol-based hand rub':'Αλκοολούχο αντισηπτικό'}</strong><small>{en?'Hand Rub · HR':'Αντισηπτικό · HR'}</small></span></button>
       <button type="button" className={`who-action-option ${current.action==='HW'?'selected':''}`} onClick={()=>setO('action','HW')} role="radio" aria-checked={current.action==='HW'}><span className="who-action-check">{current.action==='HW'?'✓':''}</span><span><strong>{en?'Hand wash with soap & water':'Πλύσιμο με σαπούνι & νερό'}</strong><small>{en?'Hand Wash · HW':'Πλύσιμο · HW'}</small></span></button>
       <button type="button" className={`who-action-option ${current.action==='MISSED'?'selected danger':''}`} onClick={()=>setO('action','MISSED')} role="radio" aria-checked={current.action==='MISSED'}><span className="who-action-check">{current.action==='MISSED'?'✓':''}</span><span><strong>{en?'Not performed':'Δεν πραγματοποιήθηκε'}</strong><small>{en?'Missed':'Παράλειψη'}</small></span></button>
      </div>
      <label className={`who-gloves-toggle who-smart-gloves ${current.gloves?'checked':''}`}><input type="checkbox" checked={current.gloves} onChange={event=>setO('gloves',event.target.checked)}/><span><strong>{en?'Gloves used':'Χρήση γαντιών'}</strong><small>{current.gloves?(en?'Recorded as Yes':'Καταγράφηκε Ναι'):(en?'Recorded as No':'Καταγράφηκε Όχι')}</small></span></label>
     </div>

     <label className="who-note-field who-smart-note"><span>{en?'Optional note':'Προαιρετική σημείωση'}</span><input value={current.notes} onChange={event=>setO('notes',event.target.value)} placeholder={en?'Add context only when useful':'Προσθέστε πληροφορία μόνο όταν χρειάζεται'}/></label>

     <div className="who-current-preview">
      <div><small>{en?'Current selection':'Τρέχουσα επιλογή'}</small><strong>{selectedMomentLabels.length?selectedMomentLabels.join(' · '):(en?'Choose at least one WHO indication':'Επιλέξτε τουλάχιστον μία ένδειξη WHO')}</strong><span>{actionLabel(current.action,en)} · {current.professionalsCount||1} {en?'professional(s)':'επαγγελματίας/ες'} · {current.gloves?(en?'gloves':'γάντια'):(en?'no gloves':'χωρίς γάντια')}</span></div>
      <ActionButton label={en?'Add opportunity':'Προσθήκη ευκαιρίας'} tone="primary" disabled={!currentValid} onClick={add}><Plus size={16}/><span>{en?'Add opportunity':'Προσθήκη ευκαιρίας'}</span></ActionButton>
     </div>
    </section>
   </div>

   <aside className="who-insight-rail">
    <section className="who-summary-panel who-smart-summary">
     <div className="who-panel-heading"><div><strong>{en?'Live session':'Ζωντανή σύνοψη'}</strong><small>{currentTouched&&currentValid?(en?'Includes the current unsaved opportunity':'Περιλαμβάνει και την τρέχουσα μη προστεθειμένη ευκαιρία'):(en?'Calculated from recorded opportunities':'Υπολογισμός από τις καταγεγραμμένες ευκαιρίες')}</small></div></div>
     <div className="who-compliance-hero"><strong>{stats.compliance}%</strong><span>{en?'Compliance':'Συμμόρφωση'}</span><div className="who-compliance-track"><i style={{width:`${Math.min(100,Math.max(0,stats.compliance))}%`}}/></div></div>
     <div className="who-live-summary who-smart-kpis">
      <div><span>{en?'Opportunities':'Ευκαιρίες'}</span><strong>{stats.opportunities}</strong></div>
      <div><span>{en?'Professionals':'Επαγγελματίες'}</span><strong>{stats.professionals}</strong></div>
      <div><span>{en?'HR':'Αντισηπτικό'}</span><strong>{stats.handRub}</strong></div>
      <div><span>{en?'HW':'Πλύσιμο'}</span><strong>{stats.handWash}</strong></div>
      <div className={stats.missed?'has-missed':''}><span>{en?'Missed':'Παραλείψεις'}</span><strong>{stats.missed}</strong></div>
     </div>
    </section>

    <section className="who-opportunity-list-panel who-smart-list-panel">
     <div className="who-panel-heading"><div><strong>{en?'Recorded opportunities':'Καταγεγραμμένες ευκαιρίες'}</strong><small>{en?'Compact review before final save':'Γρήγορος έλεγχος πριν την τελική αποθήκευση'}</small></div><span className="who-count-badge">{items.length}</span></div>
     <div className="who-opportunity-cards">
      {items.map((item,index)=>{
       const labels=momentLabels(normalizeMoments(item),en)
       const professionLabel=en?(WHO_PROFESSIONS.find(([el])=>el===item.professionalCategory)?.[1]||item.professionalCategory):item.professionalCategory
       return <article className="who-opportunity-card" key={item.id}>
        <span className="who-opportunity-index">{index+1}</span>
        <div className="who-opportunity-copy"><strong>{labels.join(' · ')||'—'}</strong><span>{professionLabel} · {item.professionalsCount||1}</span><small><b className={`who-action-mini ${item.action==='MISSED'?'missed':''}`}>{actionLabel(item.action,en)}</b>{item.gloves?` · ${en?'Gloves':'Γάντια'}`:''}{item.notes?` · ${item.notes}`:''}</small></div>
        <ActionButton iconOnly label={en?'Remove opportunity':'Αφαίρεση ευκαιρίας'} tone="danger" onClick={()=>removeObservation(item.id)}><Trash2 size={15}/></ActionButton>
       </article>
      })}
      {!items.length&&<div className="who-list-empty who-smart-empty"><strong>{en?'Start with the first opportunity':'Ξεκινήστε με την πρώτη ευκαιρία'}</strong><span>{en?'Your entries will appear here for quick review.':'Οι καταγραφές θα εμφανίζονται εδώ για γρήγορο έλεγχο.'}</span></div>}
     </div>
    </section>
   </aside>
  </div>

  <div className="who-editor-page-actions who-smart-footer">
   <div className="who-save-state"><strong>{stats.opportunities}</strong><span>{en?'opportunities ready to save':'ευκαιρίες έτοιμες για αποθήκευση'}</span>{currentTouched&&currentValid&&<small>{en?'Current entry will also be saved.':'Η τρέχουσα καταγραφή θα αποθηκευτεί επίσης.'}</small>}</div>
   <div className="who-footer-buttons"><ActionButton label={en?'Cancel':'Ακύρωση'} tone="neutral" onClick={onCancel}><X size={16}/><span>{en?'Cancel':'Ακύρωση'}</span></ActionButton><ActionButton label={initialRecord?(en?'Save changes':'Αποθήκευση αλλαγών'):(en?'Save session':'Αποθήκευση συνεδρίας')} tone="primary" disabled={!valid||saving} onClick={save}><Save size={16}/><span>{saving?(en?'Saving…':'Αποθήκευση…'):initialRecord?(en?'Save changes':'Αποθήκευση αλλαγών'):(en?'Save session':'Αποθήκευση συνεδρίας')}</span></ActionButton></div>
  </div>
 </div>
}