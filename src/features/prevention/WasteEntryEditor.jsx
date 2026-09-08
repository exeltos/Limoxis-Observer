import { useEffect,useMemo,useState } from 'react'
import { Save,X } from 'lucide-react'
import { useAuth } from '../../core/auth/AuthContext'
import { controlActorFromAuth } from '../controls/controlActor'
import { ManualDateField } from '../../design-system/ManualDateField'
import { ActionButton } from '../../design-system/ActionButton'
import { useLanguage } from '../../core/i18n/LanguageContext'

export function WasteEntryEditor({onCancel,onSave,fixedDepartment='',initialRecord=null,departments=[],wasteTypes=[],findPatientDays,readOnly=false}){
 const {profile,user}=useAuth()
 const {language,locale}=useLanguage();const en=language==='en'
 const actor=useMemo(()=>controlActorFromAuth({profile,user}),[profile,user])
 const today=new Date().toISOString().slice(0,10)
 const initialDepartment=initialRecord?.departmentEl||fixedDepartment||departments[0]?.el||''
 const initialWasteType=initialRecord?.wasteType||initialRecord?.type||wasteTypes[0]?.el||''
 const [draft,setDraft]=useState(()=>initialRecord?JSON.parse(JSON.stringify(initialRecord)):{
  date:today,departmentEl:initialDepartment,wasteType:initialWasteType,wasteTypeId:wasteTypes.find(x=>x.el===initialWasteType)?.id||'',weight:'',containers:'',patientDays:'',patientDaysSource:'',responsible:actor.name,documentNumber:'',collectionCompany:'',notes:''
 })
 const [suggestedPatientDays,setSuggestedPatientDays]=useState('')
 const [saving,setSaving]=useState(false)
 const set=(key,value)=>{if(!readOnly)setDraft(state=>({...state,[key]:value}))}
 const departmentInfo=departments.find(item=>item.el===draft.departmentEl)
 const typeInfo=wasteTypes.find(item=>item.id===draft.wasteTypeId||item.el===draft.wasteType)
 const departmentEn=departmentInfo?.en||draft.departmentEl
 const typeEn=typeInfo?.en||draft.wasteType

 useEffect(()=>{
  if(readOnly)return
  let active=true
  async function load(){
   if(!findPatientDays||!departmentInfo?.id||!draft.date){setSuggestedPatientDays('');return}
   try{const value=await findPatientDays(departmentInfo.id,draft.date);if(active)setSuggestedPatientDays(value||'')}
   catch{if(active)setSuggestedPatientDays('')}
  }
  void load()
  return()=>{active=false}
 },[readOnly,findPatientDays,departmentInfo?.id,draft.date])

 const patientDays=Number(draft.patientDays)||0
 const usingSuggestedPatientDays=Boolean(suggestedPatientDays)&&Number(draft.patientDays)===Number(suggestedPatientDays)&&draft.patientDaysSource==='library'
 const weight=Number(draft.weight)||0
 const indicator=patientDays>0?Number((weight/patientDays*1000).toFixed(2)):(draft.indicator??null)
 const valid=Boolean(draft.date&&draft.departmentEl&&draft.wasteType&&weight>0&&Number(draft.containers)>=0&&departments.length&&wasteTypes.length)

 function changeWasteType(value){
  if(readOnly)return
  const selected=wasteTypes.find(item=>item.id===value)
  setDraft(state=>({...state,wasteTypeId:value,wasteType:selected?.el||'',type:selected?.el||'',typeEn:selected?.en||''}))
 }
 async function submit(){
  if(readOnly||!valid||saving)return
  const selectedType=wasteTypes.find(item=>item.id===draft.wasteTypeId||item.el===draft.wasteType)
  const now=new Date().toISOString()
  const record={...draft,wasteTypeId:selectedType?.id||draft.wasteTypeId||'',wasteType:selectedType?.el||draft.wasteType,departmentEn,type:selectedType?.el||draft.wasteType,typeEn:selectedType?.en||typeEn,weight,containers:Number(draft.containers)||0,patientDays:patientDays||null,indicator,responsible:draft.responsible||actor.name,createdAt:initialRecord?.createdAt||now,createdBy:initialRecord?.createdBy||actor.name,createdById:initialRecord?.createdById||actor.id,updatedAt:initialRecord?now:null,updatedBy:initialRecord?actor.name:null,updatedById:initialRecord?actor.id:null,status:'completed',lifecycleStatus:'finalized'}
  try{setSaving(true);await onSave(record)}finally{setSaving(false)}
 }

 const sourceLabel=draft.patientDaysSource==='library'?(en?'Source: Bed-days Library':'Πηγή: Βιβλιοθήκη νοσηλευτικών ημερών'):draft.patientDays?(en?'Source: Manual entry':'Πηγή: Χειροκίνητη καταχώριση'):(en?'No denominator selected':'Δεν έχει επιλεγεί παρονομαστής')
 const actorName=readOnly?(draft.createdBy||draft.responsible||actor.name):actor.name
 const actorEmail=readOnly?'':actor.email

 return <div className={`prevention-entry-body waste-page-editor waste-smart-editor ${readOnly?'waste-smart-readonly':''}`}>
  <div className="waste-smart-layout">
   <main className="waste-smart-main">
    <section className="waste-form-section waste-smart-section">
     <div className="waste-form-section-title"><strong>{en?'Measurement':'Μέτρηση'}</strong><small>{en?'Record the waste category and measured quantity.':'Καταγράψτε την κατηγορία και τη μετρημένη ποσότητα αποβλήτου.'}</small></div>
     <div className="entry-grid waste-smart-measurement-grid">
      <ManualDateField label={en?'Date *':'Ημερομηνία *'} value={draft.date} disabled={readOnly} onChange={value=>set('date',value)}/>
      <DepartmentField value={draft.departmentEl} onChange={value=>set('departmentEl',value)} departments={departments} fixed={readOnly||Boolean(fixedDepartment)}/>
      <label className="entry-span-2 waste-category-row"><span>{en?'Waste category *':'Κατηγορία αποβλήτου *'}</span><select className="waste-category-select" value={draft.wasteTypeId||typeInfo?.id||''} disabled={readOnly} onChange={event=>changeWasteType(event.target.value)}>{wasteTypes.map(item=><option key={item.id} value={item.id}>{en?(item.en||item.el):item.el}</option>)}</select></label>
      <label><span>{en?'Weight (kg) *':'Βάρος (kg) *'}</span><input type="number" min="0" step="0.1" value={draft.weight} readOnly={readOnly} onChange={event=>set('weight',event.target.value)} placeholder="0,0"/></label>
      <label><span>{en?'Containers':'Περιέκτες'}</span><input type="number" min="0" step="1" value={draft.containers} readOnly={readOnly} onChange={event=>set('containers',event.target.value)} placeholder="0"/></label>
     </div>
    </section>

    <section className="waste-form-section waste-smart-section">
     <div className="waste-form-section-title"><strong>{en?'Document & collection':'Παραστατικό & παραλαβή'}</strong><small>{en?'Traceability details stay secondary to the measurement.':'Τα στοιχεία ιχνηλασιμότητας παραμένουν διακριτά από τη βασική μέτρηση.'}</small></div>
     <div className="entry-grid"><label><span>{en?'Responsible person':'Υπεύθυνος'}</span><input value={draft.responsible||''} readOnly={readOnly} onChange={event=>set('responsible',event.target.value)} placeholder={actor.name}/></label><label><span>{en?'Document number':'Αριθμός παραστατικού'}</span><input value={draft.documentNumber||''} readOnly={readOnly} onChange={event=>set('documentNumber',event.target.value)} placeholder={en?'e.g. 112233':'π.χ. 112233'}/></label><label className="entry-span-2"><span>{en?'Collection company':'Εταιρεία συλλογής'}</span><input value={draft.collectionCompany||''} readOnly={readOnly} onChange={event=>set('collectionCompany',event.target.value)} placeholder={en?'Company name':'Επωνυμία εταιρείας'}/></label><label className="entry-span-2"><span>{en?'Notes':'Σημειώσεις'}</span><textarea rows="3" value={draft.notes||''} readOnly={readOnly} onChange={event=>set('notes',event.target.value)} placeholder={en?'Optional notes':'Προαιρετικές παρατηρήσεις'}/></label></div>
    </section>
   </main>

   <aside className="waste-smart-rail">
    <section className="waste-form-section waste-smart-indicator">
     <div className="waste-form-section-title"><strong>{en?'Indicator':'Δείκτης'}</strong><small>{en?'kg per 1,000 patient-days':'kg ανά 1.000 νοσηλευτικές ημέρες'}</small></div>
     <div className="waste-indicator-hero"><strong>{indicator===null?'—':Number(indicator).toLocaleString(locale)}</strong><span>{en?'kg / 1,000 patient-days':'kg / 1.000 νοσηλευτικές ημέρες'}</span></div>
     <label className="waste-patient-days-control"><span>{en?'Patient-days':'Νοσηλευτικές ημέρες'}</span><input type="number" min="0" value={draft.patientDays||''} readOnly={readOnly} onChange={event=>!readOnly&&setDraft(state=>({...state,patientDays:event.target.value,patientDaysSource:'manual'}))} placeholder={suggestedPatientDays?String(suggestedPatientDays):(en?'No available period':'Δεν υπάρχει διαθέσιμη περίοδος')}/></label>
     {!readOnly&&suggestedPatientDays&&<button type="button" className={`waste-library-source ${usingSuggestedPatientDays?'applied':''}`} onClick={()=>setDraft(state=>({...state,patientDays:suggestedPatientDays,patientDaysSource:'library'}))}>{usingSuggestedPatientDays?(en?'✓ Using Library value':'✓ Χρήση τιμής Βιβλιοθήκης'):(en?`Use Library value: ${suggestedPatientDays}`:`Χρήση τιμής Βιβλιοθήκης: ${suggestedPatientDays}`)}</button>}
     <div className="waste-source-note"><span>{sourceLabel}</span></div>
    </section>
    <div className="prevention-entry-actor waste-smart-actor"><span>{readOnly?(en?'Recorded by':'Καταχώρηση από'):initialRecord?(en?'Edited by':'Επεξεργασία από'):(en?'Recorded by':'Καταχώρηση από')}</span><strong>{actorName}</strong>{actorEmail&&<small>{actorEmail}</small>}</div>
   </aside>
  </div>

  {!readOnly&&<div className="who-editor-page-actions prevention-editor-page-actions">
   <ActionButton label={en?'Cancel':'Ακύρωση'} tone="neutral" onClick={onCancel}><X size={16}/><span>{en?'Cancel':'Ακύρωση'}</span></ActionButton>
   <ActionButton label={initialRecord?(en?'Save changes':'Αποθήκευση αλλαγών'):(en?'Save measurement':'Αποθήκευση μέτρησης')} tone="primary" disabled={!valid||saving} onClick={submit}><Save size={16}/><span>{saving?(en?'Saving…':'Αποθήκευση…'):initialRecord?(en?'Save changes':'Αποθήκευση αλλαγών'):(en?'Save measurement':'Αποθήκευση μέτρησης')}</span></ActionButton>
  </div>}
 </div>
}

function DepartmentField({value,onChange,departments,fixed}){const {language}=useLanguage();return <label><span>{language==='en'?'Department *':'Τμήμα *'}</span><select value={value} disabled={fixed} onChange={event=>onChange(event.target.value)}>{departments.map(item=><option key={item.id||item.el} value={item.el}>{language==='en'?(item.en||item.el):item.el}</option>)}</select></label>}
