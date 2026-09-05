import { useEffect,useMemo,useState } from 'react'
import { Recycle } from 'lucide-react'
import { useAuth } from '../../core/auth/AuthContext'
import { controlActorFromAuth } from '../controls/controlActor'
import { wasteCategoryTone } from './wasteVisuals'
import { ManualDateField } from '../../design-system/ManualDateField'
import { useLanguage } from '../../core/i18n/LanguageContext'

export function WasteEntryModal({onClose,onSave,fixedDepartment='',initialRecord=null,departments=[],wasteTypes=[],findPatientDays}){
 const {profile,user}=useAuth()
 const {language,locale}=useLanguage(); const en=language==='en'
 const actor=useMemo(()=>controlActorFromAuth({profile,user}),[profile,user])
 const today=new Date().toISOString().slice(0,10)
 const initialDepartment=initialRecord?.departmentEl||fixedDepartment||departments[0]?.el||''
 const initialWasteType=initialRecord?.wasteType||initialRecord?.type||wasteTypes[0]?.el||''
 const [draft,setDraft]=useState(()=>initialRecord?JSON.parse(JSON.stringify(initialRecord)):{
  date:today,departmentEl:initialDepartment,wasteType:initialWasteType,wasteTypeId:wasteTypes.find(x=>x.el===initialWasteType)?.id||'',weight:'',containers:'',
  patientDays:'',patientDaysSource:'',responsible:actor.name,documentNumber:'',collectionCompany:'',notes:''
 })
 const [suggestedPatientDays,setSuggestedPatientDays]=useState('')
 const set=(k,v)=>setDraft(d=>({...d,[k]:v}))
 const departmentInfo=departments.find(d=>d.el===draft.departmentEl)
 const typeInfo=wasteTypes.find(d=>d.id===draft.wasteTypeId||d.el===draft.wasteType)
 const departmentEn=departmentInfo?.en||draft.departmentEl
 const typeEn=typeInfo?.en||draft.wasteType

 useEffect(()=>{
  let active=true
  async function load(){
   if(!findPatientDays||!departmentInfo?.id||!draft.date){setSuggestedPatientDays('');return}
   try{const value=await findPatientDays(departmentInfo.id,draft.date);if(active)setSuggestedPatientDays(value||'')}
   catch{if(active)setSuggestedPatientDays('')}
  }
  void load()
  return()=>{active=false}
 },[findPatientDays,departmentInfo?.id,draft.date])

 const patientDays=Number(draft.patientDays)||0
 const usingSuggestedPatientDays=Boolean(suggestedPatientDays)&&Number(draft.patientDays)===Number(suggestedPatientDays)&&draft.patientDaysSource==='library'
 const weight=Number(draft.weight)||0
 const indicator=patientDays>0?Number((weight/patientDays*1000).toFixed(2)):null
 const valid=Boolean(draft.date&&draft.departmentEl&&draft.wasteType&&weight>0&&Number(draft.containers)>=0)
 function submit(){
  if(!valid)return
  const selectedType=wasteTypes.find(x=>x.id===draft.wasteTypeId||x.el===draft.wasteType)
  const now=new Date().toISOString()
  onSave({...draft,wasteTypeId:selectedType?.id||draft.wasteTypeId||'',wasteType:selectedType?.el||draft.wasteType,departmentEn,type:selectedType?.el||draft.wasteType,typeEn:selectedType?.en||typeEn,weight,containers:Number(draft.containers)||0,patientDays:patientDays||null,indicator,
   responsible:draft.responsible||actor.name,createdAt:initialRecord?.createdAt||now,createdBy:initialRecord?.createdBy||actor.name,createdById:initialRecord?.createdById||actor.id,
   updatedAt:initialRecord?now:null,updatedBy:initialRecord?actor.name:null,updatedById:initialRecord?actor.id:null,status:'completed',lifecycleStatus:'finalized'})
 }
 function changeWasteType(value){const selected=wasteTypes.find(x=>x.id===value);setDraft(d=>({...d,wasteTypeId:value,wasteType:selected?.el||'',type:selected?.el||'',typeEn:selected?.en||''}))}
 return <div className="modal-backdrop"><div className="entry-card prevention-entry-card waste-entry-card">
  <header><div className="prevention-entry-title"><Recycle size={20}/><div><span className="eyebrow">{en?'PREVENTION CENTER':'ΚΕΝΤΡΟ ΠΡΟΛΗΨΗΣ'}</span><h3>{initialRecord?(en?'Edit waste measurement':'Επεξεργασία μέτρησης αποβλήτων'):(en?'New waste measurement':'Νέα μέτρηση αποβλήτων')}</h3><p>{en?'Record weight, containers and indicator per 1,000 patient-days.':'Καταγραφή βάρους, περιεκτών και δείκτη ανά 1.000 νοσηλευτικές ημέρες.'}</p></div></div><button className="icon-close" onClick={onClose}>×</button></header>
  <div className="prevention-entry-body">
   <div className="prevention-entry-actor"><span>{initialRecord?(en?'Edited by':'Επεξεργασία από'):(en?'Recorded by':'Καταχώρηση από')}</span><strong>{actor.name}</strong><small>{actor.email}</small></div>
   <section className="waste-form-section"><div className="waste-form-section-title"><strong>{en?'Measurement':'Μέτρηση'}</strong><small>{en?'Waste category comes from the central Library.':'Η κατηγορία αποβλήτου προέρχεται από τη Βιβλιοθήκη.'}</small></div>
    <div className="entry-grid">
     <ManualDateField label={en?'Date *':'Ημερομηνία *'} value={draft.date} onChange={v=>set('date',v)}/>
     <DepartmentField value={draft.departmentEl} onChange={v=>set('departmentEl',v)} departments={departments} fixed={Boolean(fixedDepartment)}/>
     <label className="entry-span-2"><span>{en?'Waste category *':'Κατηγορία αποβλήτου *'}</span><div className="waste-category-field"><select value={draft.wasteTypeId||typeInfo?.id||''} onChange={e=>changeWasteType(e.target.value)}>{wasteTypes.map(x=><option key={x.id} value={x.id}>{en?(x.en||x.el):x.el}</option>)}</select><span className={`waste-category-badge ${wasteCategoryTone(draft.wasteType)}`}>{en?(typeInfo?.en||draft.wasteType):draft.wasteType}</span></div></label>
     <label><span>{en?'Weight (kg) *':'Βάρος (kg) *'}</span><input type="number" min="0" step="0.1" value={draft.weight} onChange={e=>set('weight',e.target.value)} placeholder="0,0"/></label>
     <label><span>{en?'Containers':'Περιέκτες'}</span><input type="number" min="0" step="1" value={draft.containers} onChange={e=>set('containers',e.target.value)} placeholder="0"/></label>
    </div>
   </section>
   <section className="waste-form-section"><div className="waste-form-section-title"><strong>{en?'Indicator':'Δείκτης'}</strong><small>{en?'kg per 1,000 patient-days.':'kg ανά 1.000 νοσηλευτικές ημέρες.'}</small></div>
    <div className="entry-grid waste-indicator-grid">
     <label><span>{en?'Patient-days':'Νοσηλευτικές ημέρες'}</span><div className="waste-patient-days-field"><input type="number" min="0" value={draft.patientDays||''} onChange={e=>setDraft(d=>({...d,patientDays:e.target.value,patientDaysSource:'manual'}))} placeholder={suggestedPatientDays?String(suggestedPatientDays):(en?'No available period':'Δεν υπάρχει διαθέσιμη περίοδος')}/>{suggestedPatientDays&&<button type="button" className={usingSuggestedPatientDays?'applied':''} onClick={()=>setDraft(d=>({...d,patientDays:suggestedPatientDays,patientDaysSource:'library'}))}>{usingSuggestedPatientDays?(en?'✓ From library':'✓ Από βιβλιοθήκη'):(en?'Use ':'Χρήση ')+suggestedPatientDays}</button>}</div>{usingSuggestedPatientDays&&<small className="waste-patient-days-source">{en?`${suggestedPatientDays} patient-days from the Library are used.`:`Χρησιμοποιούνται ${suggestedPatientDays} νοσηλευτικές ημέρες από τη Βιβλιοθήκη.`}</small>}</label>
     <div className="waste-indicator-card"><span>{en?'Indicator':'Δείκτης'}</span><strong>{indicator===null?'—':indicator.toLocaleString(locale)}</strong><small>{en?'kg / 1,000 patient-days':'kg / 1.000 νοσηλευτικές ημέρες'}</small></div>
    </div>
   </section>
   <section className="waste-form-section"><div className="waste-form-section-title"><strong>{en?'Document & collection':'Παραστατικό & παραλαβή'}</strong><small>{en?'Optional traceability information.':'Προαιρετικά στοιχεία ιχνηλασιμότητας.'}</small></div>
    <div className="entry-grid"><label><span>{en?'Responsible person':'Υπεύθυνος'}</span><input value={draft.responsible||''} onChange={e=>set('responsible',e.target.value)} placeholder={actor.name}/></label><label><span>{en?'Document number':'Αριθμός παραστατικού'}</span><input value={draft.documentNumber||''} onChange={e=>set('documentNumber',e.target.value)} placeholder={en?'e.g. 112233':'π.χ. 112233'}/></label><label className="entry-span-2"><span>{en?'Collection company':'Εταιρεία συλλογής'}</span><input value={draft.collectionCompany||''} onChange={e=>set('collectionCompany',e.target.value)} placeholder={en?'Company name':'Επωνυμία εταιρείας'}/></label><label className="entry-span-2"><span>{en?'Notes':'Σημειώσεις'}</span><textarea rows="3" value={draft.notes||''} onChange={e=>set('notes',e.target.value)} placeholder={en?'Optional notes':'Προαιρετικές παρατηρήσεις'}/></label></div>
   </section>
  </div>
  <footer><button className="button" onClick={onClose}>{en?'Cancel':'Ακύρωση'}</button><button className="button button-primary" disabled={!valid||!departments.length||!wasteTypes.length} onClick={submit}>{initialRecord?(en?'Save changes':'Αποθήκευση αλλαγών'):(en?'Save measurement':'Αποθήκευση μέτρησης')}</button></footer>
 </div></div>
}
function DepartmentField({value,onChange,departments,fixed}){const {language}=useLanguage();return <label><span>{language==='en'?'Department *':'Τμήμα *'}</span><select value={value} disabled={fixed} onChange={e=>onChange(e.target.value)}>{departments.map(d=><option key={d.id||d.el} value={d.el}>{language==='en'?(d.en||d.el):d.el}</option>)}</select></label>}
