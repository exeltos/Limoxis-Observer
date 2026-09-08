import { useEffect,useMemo,useState } from 'react'
import { Save,X } from 'lucide-react'
import { useAuth } from '../../core/auth/AuthContext'
import { controlActorFromAuth } from '../controls/controlActor'
import { wasteCategoryTone } from './wasteVisuals'
import { ManualDateField } from '../../design-system/ManualDateField'
import { ActionButton } from '../../design-system/ActionButton'
import { useLanguage } from '../../core/i18n/LanguageContext'

export function WasteEntryEditor({onCancel,onSave,fixedDepartment='',initialRecord=null,departments=[],wasteTypes=[],findPatientDays}){
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
 const set=(key,value)=>setDraft(state=>({...state,[key]:value}))
 const departmentInfo=departments.find(item=>item.el===draft.departmentEl)
 const typeInfo=wasteTypes.find(item=>item.id===draft.wasteTypeId||item.el===draft.wasteType)
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
 const valid=Boolean(draft.date&&draft.departmentEl&&draft.wasteType&&weight>0&&Number(draft.containers)>=0&&departments.length&&wasteTypes.length)

 function changeWasteType(value){const selected=wasteTypes.find(item=>item.id===value);setDraft(state=>({...state,wasteTypeId:value,wasteType:selected?.el||'',type:selected?.el||'',typeEn:selected?.en||''}))}
 async function submit(){
  if(!valid||saving)return
  const selectedType=wasteTypes.find(item=>item.id===draft.wasteTypeId||item.el===draft.wasteType)
  const now=new Date().toISOString()
  const record={...draft,wasteTypeId:selectedType?.id||draft.wasteTypeId||'',wasteType:selectedType?.el||draft.wasteType,departmentEn,type:selectedType?.el||draft.wasteType,typeEn:selectedType?.en||typeEn,weight,containers:Number(draft.containers)||0,patientDays:patientDays||null,indicator,responsible:draft.responsible||actor.name,createdAt:initialRecord?.createdAt||now,createdBy:initialRecord?.createdBy||actor.name,createdById:initialRecord?.createdById||actor.id,updatedAt:initialRecord?now:null,updatedBy:initialRecord?actor.name:null,updatedById:initialRecord?actor.id:null,status:'completed',lifecycleStatus:'finalized'}
  try{setSaving(true);await onSave(record)}finally{setSaving(false)}
 }

 return <div className="prevention-entry-body waste-page-editor">
  <div className="prevention-entry-actor"><span>{initialRecord?(en?'Edited by':'Επεξεργασία από'):(en?'Recorded by':'Καταχώρηση από')}</span><strong>{actor.name}</strong><small>{actor.email}</small></div>
  <section className="waste-form-section"><div className="waste-form-section-title"><strong>{en?'Measurement':'Μέτρηση'}</strong><small>{en?'Waste category comes from the central Library.':'Η κατηγορία αποβλήτου προέρχεται από τη Βιβλιοθήκη.'}</small></div>
   <div className="entry-grid">
    <ManualDateField label={en?'Date *':'Ημερομηνία *'} value={draft.date} onChange={value=>set('date',value)}/>
    <DepartmentField value={draft.departmentEl} onChange={value=>set('departmentEl',value)} departments={departments} fixed={Boolean(fixedDepartment)}/>
    <label className="entry-span-2"><span>{en?'Waste category *':'Κατηγορία αποβλήτου *'}</span><div className="waste-category-field"><select value={draft.wasteTypeId||typeInfo?.id||''} onChange={event=>changeWasteType(event.target.value)}>{wasteTypes.map(item=><option key={item.id} value={item.id}>{en?(item.en||item.el):item.el}</option>)}</select><span className={`waste-category-badge ${wasteCategoryTone(draft.wasteType)}`}>{en?(typeInfo?.en||draft.wasteType):draft.wasteType}</span></div></label>
    <label><span>{en?'Weight (kg) *':'Βάρος (kg) *'}</span><input type="number" min="0" step="0.1" value={draft.weight} onChange={event=>set('weight',event.target.value)} placeholder="0,0"/></label>
    <label><span>{en?'Containers':'Περιέκτες'}</span><input type="number" min="0" step="1" value={draft.containers} onChange={event=>set('containers',event.target.value)} placeholder="0"/></label>
   </div>
  </section>
  <section className="waste-form-section"><div className="waste-form-section-title"><strong>{en?'Indicator':'Δείκτης'}</strong><small>{en?'kg per 1,000 patient-days.':'kg ανά 1.000 νοσηλευτικές ημέρες.'}</small></div>
   <div className="entry-grid waste-indicator-grid">
    <label><span>{en?'Patient-days':'Νοσηλευτικές ημέρες'}</span><div className="waste-patient-days-field"><input type="number" min="0" value={draft.patientDays||''} onChange={event=>setDraft(state=>({...state,patientDays:event.target.value,patientDaysSource:'manual'}))} placeholder={suggestedPatientDays?String(suggestedPatientDays):(en?'No available period':'Δεν υπάρχει διαθέσιμη περίοδος')}/>{suggestedPatientDays&&<button type="button" className={usingSuggestedPatientDays?'applied':''} onClick={()=>setDraft(state=>({...state,patientDays:suggestedPatientDays,patientDaysSource:'library'}))}>{usingSuggestedPatientDays?(en?'✓ From library':'✓ Από βιβλιοθήκη'):(en?'Use ':'Χρήση ')+suggestedPatientDays}</button>}</div>{usingSuggestedPatientDays&&<small className="waste-patient-days-source">{en?`${suggestedPatientDays} patient-days from the Library are used.`:`Χρησιμοποιούνται ${suggestedPatientDays} νοσηλευτικές ημέρες από τη Βιβλιοθήκη.`}</small>}</label>
    <div className="waste-indicator-card"><span>{en?'Indicator':'Δείκτης'}</span><strong>{indicator===null?'—':indicator.toLocaleString(locale)}</strong><small>{en?'kg / 1,000 patient-days':'kg / 1.000 νοσηλευτικές ημέρες'}</small></div>
   </div>
  </section>
  <section className="waste-form-section"><div className="waste-form-section-title"><strong>{en?'Document & collection':'Παραστατικό & παραλαβή'}</strong><small>{en?'Optional traceability information.':'Προαιρετικά στοιχεία ιχνηλασιμότητας.'}</small></div>
   <div className="entry-grid"><label><span>{en?'Responsible person':'Υπεύθυνος'}</span><input value={draft.responsible||''} onChange={event=>set('responsible',event.target.value)} placeholder={actor.name}/></label><label><span>{en?'Document number':'Αριθμός παραστατικού'}</span><input value={draft.documentNumber||''} onChange={event=>set('documentNumber',event.target.value)} placeholder={en?'e.g. 112233':'π.χ. 112233'}/></label><label className="entry-span-2"><span>{en?'Collection company':'Εταιρεία συλλογής'}</span><input value={draft.collectionCompany||''} onChange={event=>set('collectionCompany',event.target.value)} placeholder={en?'Company name':'Επωνυμία εταιρείας'}/></label><label className="entry-span-2"><span>{en?'Notes':'Σημειώσεις'}</span><textarea rows="3" value={draft.notes||''} onChange={event=>set('notes',event.target.value)} placeholder={en?'Optional notes':'Προαιρετικές παρατηρήσεις'}/></label></div>
  </section>
  <div className="who-editor-page-actions prevention-editor-page-actions">
   <ActionButton label={en?'Cancel':'Ακύρωση'} tone="neutral" onClick={onCancel}><X size={16}/><span>{en?'Cancel':'Ακύρωση'}</span></ActionButton>
   <ActionButton label={initialRecord?(en?'Save changes':'Αποθήκευση αλλαγών'):(en?'Save measurement':'Αποθήκευση μέτρησης')} tone="primary" disabled={!valid||saving} onClick={submit}><Save size={16}/><span>{saving?(en?'Saving…':'Αποθήκευση…'):initialRecord?(en?'Save changes':'Αποθήκευση αλλαγών'):(en?'Save measurement':'Αποθήκευση μέτρησης')}</span></ActionButton>
  </div>
 </div>
}

function DepartmentField({value,onChange,departments,fixed}){const {language}=useLanguage();return <label><span>{language==='en'?'Department *':'Τμήμα *'}</span><select value={value} disabled={fixed} onChange={event=>onChange(event.target.value)}>{departments.map(item=><option key={item.id||item.el} value={item.el}>{language==='en'?(item.en||item.el):item.el}</option>)}</select></label>}
