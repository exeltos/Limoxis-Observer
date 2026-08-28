import { useMemo,useState } from 'react'
import { Recycle } from 'lucide-react'
import { demoLibrarySeed,demoPatientDayPeriods } from '../management/managementData'
import { useAuth } from '../../core/auth/AuthContext'
import { controlActorFromAuth } from '../controls/controlActor'
import { wasteCategoryTone } from './wasteVisuals'

export function WasteEntryModal({onClose,onSave,fixedDepartment='',initialRecord=null}){
 const {profile,user}=useAuth()
 const actor=useMemo(()=>controlActorFromAuth({profile,user}),[profile,user])
 const departments=useMemo(()=>demoLibrarySeed.departments.map(([el,en])=>({el,en})),[])
 const wasteTypes=useMemo(()=>demoLibrarySeed.wasteTypes.map(([el,en])=>({el,en})),[])
 const today=new Date().toISOString().slice(0,10)
 const [draft,setDraft]=useState(()=>initialRecord?JSON.parse(JSON.stringify(initialRecord)):{
  date:today,departmentEl:fixedDepartment||departments[0]?.el||'',wasteType:wasteTypes[0]?.el||'',weight:'',containers:'',
  patientDays:'',patientDaysSource:'',responsible:actor.name,documentNumber:'',collectionCompany:'',notes:''
 })
 const set=(k,v)=>setDraft(d=>({...d,[k]:v}))
 const departmentEn=departments.find(d=>d.el===draft.departmentEl)?.en||draft.departmentEl
 const typeEn=wasteTypes.find(d=>d.el===draft.wasteType)?.en||draft.wasteType
 const suggestedPatientDays=useMemo(()=>{
   const date=draft.date
   const hit=demoPatientDayPeriods.find(x=>date>=x.from&&date<=x.to&&x.departmentEl===draft.departmentEl)
   return hit?.value||''
 },[draft.date,draft.departmentEl])
 const patientDays=Number(draft.patientDays)||0
 const usingSuggestedPatientDays=Boolean(suggestedPatientDays)&&Number(draft.patientDays)===Number(suggestedPatientDays)&&draft.patientDaysSource==='library'
 const weight=Number(draft.weight)||0
 const indicator=patientDays>0?Number((weight/patientDays*1000).toFixed(2)):null
 const valid=Boolean(draft.date&&draft.departmentEl&&draft.wasteType&&weight>0&&Number(draft.containers)>=0)
 function submit(){
  if(!valid)return
  onSave({...draft,departmentEn,type:draft.wasteType,typeEn,weight,containers:Number(draft.containers)||0,patientDays:patientDays||null,indicator,
   responsible:draft.responsible||actor.name,createdAt:initialRecord?.createdAt||new Date().toISOString(),createdBy:initialRecord?.createdBy||actor.name,createdById:initialRecord?.createdById||actor.id,
   updatedAt:initialRecord?new Date().toISOString():null,updatedBy:initialRecord?actor.name:null,status:'completed'})
 }
 return <div className="modal-backdrop"><div className="entry-card prevention-entry-card waste-entry-card">
  <header><div className="prevention-entry-title"><Recycle size={20}/><div><span className="eyebrow">ΚΕΝΤΡΟ ΠΡΟΛΗΨΗΣ</span><h3>{initialRecord?'Επεξεργασία μέτρησης αποβλήτων':'Νέα μέτρηση αποβλήτων'}</h3><p>Καταγραφή βάρους, περιεκτών και δείκτη ανά 1.000 νοσηλευτικές ημέρες.</p></div></div><button className="icon-close" onClick={onClose}>×</button></header>
  <div className="prevention-entry-body">
   <div className="prevention-entry-actor"><span>{initialRecord?'Επεξεργασία από':'Καταχώρηση από'}</span><strong>{actor.name}</strong><small>{actor.email}</small></div>
   <section className="waste-form-section"><div className="waste-form-section-title"><strong>Μέτρηση</strong><small>Η κατηγορία αποβλήτου προέρχεται από τη Βιβλιοθήκη.</small></div>
    <div className="entry-grid">
     <label><span>Ημερομηνία *</span><input type="date" value={draft.date} onChange={e=>set('date',e.target.value)}/></label>
     <DepartmentField value={draft.departmentEl} onChange={v=>set('departmentEl',v)} departments={departments} fixed={Boolean(fixedDepartment)}/>
     <label className="entry-span-2"><span>Κατηγορία αποβλήτου *</span><div className="waste-category-field"><select value={draft.wasteType} onChange={e=>set('wasteType',e.target.value)}>{wasteTypes.map(x=><option key={x.el} value={x.el}>{x.el} — {x.en}</option>)}</select><span className={`waste-category-badge ${wasteCategoryTone(draft.wasteType)}`}>{draft.wasteType}</span></div></label>
     <label><span>Βάρος (kg) *</span><input type="number" min="0" step="0.1" value={draft.weight} onChange={e=>set('weight',e.target.value)} placeholder="0,0"/></label>
     <label><span>Περιέκτες</span><input type="number" min="0" step="1" value={draft.containers} onChange={e=>set('containers',e.target.value)} placeholder="0"/></label>
    </div>
   </section>
   <section className="waste-form-section"><div className="waste-form-section-title"><strong>Δείκτης</strong><small>kg ανά 1.000 νοσηλευτικές ημέρες.</small></div>
    <div className="entry-grid waste-indicator-grid">
     <label><span>Νοσηλευτικές ημέρες</span>
      <div className="waste-patient-days-field">
       <input type="number" min="0" value={draft.patientDays} onChange={e=>setDraft(d=>({...d,patientDays:e.target.value,patientDaysSource:'manual'}))} placeholder={suggestedPatientDays?String(suggestedPatientDays):'Δεν υπάρχει διαθέσιμη περίοδος'}/>
       {suggestedPatientDays&&<button type="button" className={usingSuggestedPatientDays?'applied':''} onClick={()=>setDraft(d=>({...d,patientDays:suggestedPatientDays,patientDaysSource:'library'}))}>{usingSuggestedPatientDays?'✓ Από βιβλιοθήκη':'Χρήση '+suggestedPatientDays}</button>}
      </div>
      {usingSuggestedPatientDays&&<small className="waste-patient-days-source">Χρησιμοποιούνται {suggestedPatientDays} νοσηλευτικές ημέρες από τη Βιβλιοθήκη.</small>}
     </label>
     <div className="waste-indicator-card"><span>Δείκτης</span><strong>{indicator===null?'—':indicator.toLocaleString('el-GR')}</strong><small>kg / 1.000 νοσηλευτικές ημέρες</small></div>
    </div>
   </section>
   <section className="waste-form-section"><div className="waste-form-section-title"><strong>Παραστατικό & παραλαβή</strong><small>Προαιρετικά στοιχεία ιχνηλασιμότητας.</small></div>
    <div className="entry-grid">
     <label><span>Υπεύθυνος</span><input value={draft.responsible} onChange={e=>set('responsible',e.target.value)} placeholder={actor.name}/></label>
     <label><span>Αριθμός παραστατικού</span><input value={draft.documentNumber||''} onChange={e=>set('documentNumber',e.target.value)} placeholder="π.χ. 112233"/></label>
     <label className="entry-span-2"><span>Εταιρεία συλλογής</span><input value={draft.collectionCompany||''} onChange={e=>set('collectionCompany',e.target.value)} placeholder="Επωνυμία εταιρείας"/></label>
     <label className="entry-span-2"><span>Σημειώσεις</span><textarea rows="3" value={draft.notes||''} onChange={e=>set('notes',e.target.value)} placeholder="Προαιρετικές παρατηρήσεις"/></label>
    </div>
   </section>
  </div>
  <footer><button className="button" onClick={onClose}>Ακύρωση</button><button className="button button-primary" disabled={!valid} onClick={submit}>{initialRecord?'Αποθήκευση αλλαγών':'Αποθήκευση μέτρησης'}</button></footer>
 </div></div>
}
function DepartmentField({value,onChange,departments,fixed}){return <label><span>Τμήμα *</span><select value={value} disabled={fixed} onChange={e=>onChange(e.target.value)}>{departments.map(d=><option key={d.el} value={d.el}>{d.el}</option>)}</select></label>}
