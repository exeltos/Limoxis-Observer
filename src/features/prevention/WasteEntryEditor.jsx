import { useEffect,useMemo,useState } from 'react'
import { Box,CalendarRange,FileText,Recycle,Save,Scale,Truck,UserRound,X } from 'lucide-react'
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
 const initialPeriodStart=initialRecord?.periodStart||initialRecord?.date||today
 const initialPeriodEnd=initialRecord?.periodEnd||initialRecord?.date||today
 const [draft,setDraft]=useState(()=>initialRecord?{...JSON.parse(JSON.stringify(initialRecord)),periodStart:initialPeriodStart,periodEnd:initialPeriodEnd}:{
  date:today,periodStart:today,periodEnd:today,departmentEl:initialDepartment,wasteType:initialWasteType,wasteTypeId:wasteTypes.find(x=>x.el===initialWasteType)?.id||'',weight:'',containers:'',patientDays:'',patientDaysSource:'',responsible:actor.name,documentNumber:'',collectionCompany:'',notes:''
 })
 const [suggestedPatientDays,setSuggestedPatientDays]=useState(null)
 const [saving,setSaving]=useState(false)
 const set=(key,value)=>{if(!readOnly)setDraft(state=>({...state,[key]:value}))}
 const departmentInfo=departments.find(item=>item.el===draft.departmentEl)
 const typeInfo=wasteTypes.find(item=>item.id===draft.wasteTypeId||item.el===draft.wasteType)
 const departmentEn=departmentInfo?.en||draft.departmentEl
 const typeEn=typeInfo?.en||draft.wasteType
 const validPeriod=Boolean(draft.periodStart&&draft.periodEnd&&draft.periodEnd>=draft.periodStart)

 useEffect(()=>{
  if(readOnly)return
  let active=true
  async function load(){
   if(!findPatientDays||!departmentInfo?.id||!validPeriod){setSuggestedPatientDays(null);return}
   try{const value=await findPatientDays(departmentInfo.id,draft.periodStart,draft.periodEnd);if(active)setSuggestedPatientDays(value||null)}
   catch{if(active)setSuggestedPatientDays(null)}
  }
  void load()
  return()=>{active=false}
 },[readOnly,findPatientDays,departmentInfo?.id,draft.periodStart,draft.periodEnd,validPeriod])

 const patientDays=Number(draft.patientDays)||0
 const suggestedValue=Number(suggestedPatientDays?.patientDays)||0
 const usingSuggestedPatientDays=Boolean(suggestedValue)&&Number(draft.patientDays)===suggestedValue&&draft.patientDaysSource==='library'
 const weight=Number(draft.weight)||0
 const indicator=patientDays>0?Number((weight/patientDays*1000).toFixed(2)):(draft.indicator??null)
 const valid=Boolean(validPeriod&&draft.departmentEl&&draft.wasteType&&weight>0&&Number(draft.containers)>=0&&departments.length&&wasteTypes.length)

 if(readOnly)return <WasteRecordDetails record={{...draft,indicator}} language={language} locale={locale}/>

 function changeWasteType(value){
  const selected=wasteTypes.find(item=>item.id===value)
  setDraft(state=>({...state,wasteTypeId:value,wasteType:selected?.el||'',type:selected?.el||'',typeEn:selected?.en||''}))
 }
 async function submit(){
  if(!valid||saving)return
  const selectedType=wasteTypes.find(item=>item.id===draft.wasteTypeId||item.el===draft.wasteType)
  const now=new Date().toISOString()
  const record={...draft,date:draft.periodEnd,periodStart:draft.periodStart,periodEnd:draft.periodEnd,wasteTypeId:selectedType?.id||draft.wasteTypeId||'',wasteType:selectedType?.el||draft.wasteType,departmentEn,type:selectedType?.el||draft.wasteType,typeEn:selectedType?.en||typeEn,weight,containers:Number(draft.containers)||0,patientDays:patientDays||null,indicator,responsible:draft.responsible||actor.name,createdAt:initialRecord?.createdAt||now,createdBy:initialRecord?.createdBy||actor.name,createdById:initialRecord?.createdById||actor.id,updatedAt:initialRecord?now:null,updatedBy:initialRecord?actor.name:null,updatedById:initialRecord?actor.id:null,status:'completed',lifecycleStatus:'finalized'}
  try{setSaving(true);await onSave(record)}finally{setSaving(false)}
 }

 const sourceLabel=draft.patientDaysSource==='library'?(en?'Source: Bed-days Library — exact same reporting period':'Πηγή: Βιβλιοθήκη νοσηλευτικών ημερών — ίδια ακριβώς περίοδος'):draft.patientDays?(en?'Source: Manual entry':'Πηγή: Χειροκίνητη καταχώριση'):(en?'No denominator selected':'Δεν έχει επιλεγεί παρονομαστής')

 return <div className="prevention-entry-body waste-page-editor waste-smart-editor">
  <div className="waste-smart-layout">
   <main className="waste-smart-main">
    <section className="waste-form-section waste-smart-section">
     <div className="waste-form-section-title"><strong>{en?'Measurement':'Μέτρηση'}</strong><small>{en?'Record the total waste quantity for one reporting period. The denominator must cover the same period.':'Καταγράψτε τη συνολική ποσότητα αποβλήτων για μία περίοδο αναφοράς. Ο παρονομαστής πρέπει να αφορά την ίδια περίοδο.'}</small></div>
     <div className="entry-grid waste-smart-measurement-grid">
      <ManualDateField label={en?'Period start *':'Έναρξη περιόδου *'} value={draft.periodStart} onChange={value=>set('periodStart',value)}/>
      <ManualDateField label={en?'Period end *':'Λήξη περιόδου *'} value={draft.periodEnd} onChange={value=>set('periodEnd',value)}/>
      <DepartmentField value={draft.departmentEl} onChange={value=>set('departmentEl',value)} departments={departments} fixed={Boolean(fixedDepartment)}/>
      <label><span>{en?'Waste category *':'Κατηγορία αποβλήτου *'}</span><select className="waste-category-select" value={draft.wasteTypeId||typeInfo?.id||''} onChange={event=>changeWasteType(event.target.value)}>{wasteTypes.map(item=><option key={item.id} value={item.id}>{en?(item.en||item.el):item.el}</option>)}</select></label>
      <label><span>{en?'Total weight in period (kg) *':'Συνολικό βάρος περιόδου (kg) *'}</span><input type="number" min="0" step="0.1" value={draft.weight} onChange={event=>set('weight',event.target.value)} placeholder="0,0"/></label>
      <label><span>{en?'Containers':'Περιέκτες'}</span><input type="number" min="0" step="1" value={draft.containers} onChange={event=>set('containers',event.target.value)} placeholder="0"/></label>
     </div>
     {!validPeriod&&<div className="waste-period-warning">{en?'Period end must be the same as or later than period start.':'Η λήξη της περιόδου πρέπει να είναι ίδια ή μεταγενέστερη της έναρξης.'}</div>}
    </section>

    <section className="waste-form-section waste-smart-section">
     <div className="waste-form-section-title"><strong>{en?'Document & collection':'Παραστατικό & παραλαβή'}</strong><small>{en?'Traceability details stay secondary to the measurement.':'Τα στοιχεία ιχνηλασιμότητας παραμένουν διακριτά από τη βασική μέτρηση.'}</small></div>
     <div className="entry-grid"><label><span>{en?'Responsible person':'Υπεύθυνος'}</span><input value={draft.responsible||''} onChange={event=>set('responsible',event.target.value)} placeholder={actor.name}/></label><label><span>{en?'Document number':'Αριθμός παραστατικού'}</span><input value={draft.documentNumber||''} onChange={event=>set('documentNumber',event.target.value)} placeholder={en?'e.g. 112233':'π.χ. 112233'}/></label><label className="entry-span-2"><span>{en?'Collection company':'Εταιρεία συλλογής'}</span><input value={draft.collectionCompany||''} onChange={event=>set('collectionCompany',event.target.value)} placeholder={en?'Company name':'Επωνυμία εταιρείας'}/></label><label className="entry-span-2"><span>{en?'Notes':'Σημειώσεις'}</span><textarea rows="3" value={draft.notes||''} onChange={event=>set('notes',event.target.value)} placeholder={en?'Optional notes':'Προαιρετικές παρατηρήσεις'}/></label></div>
    </section>
   </main>

   <aside className="waste-smart-rail">
    <section className="waste-form-section waste-smart-indicator">
     <div className="waste-form-section-title"><strong>{en?'Indicator':'Δείκτης'}</strong><small>{en?'kg per 1,000 patient-days for the same reporting period':'kg ανά 1.000 νοσηλευτικές ημέρες της ίδιας περιόδου'}</small></div>
     <div className="waste-indicator-hero"><strong>{indicator===null?'—':Number(indicator).toLocaleString(locale)}</strong><span>{en?'kg / 1,000 patient-days':'kg / 1.000 νοσηλευτικές ημέρες'}</span></div>
     <label className="waste-patient-days-control"><span>{en?'Patient-days for this period':'Νοσηλευτικές ημέρες περιόδου'}</span><input type="number" min="0" value={draft.patientDays||''} onChange={event=>setDraft(state=>({...state,patientDays:event.target.value,patientDaysSource:'manual'}))} placeholder={suggestedValue?String(suggestedValue):(en?'No approved matching period':'Δεν βρέθηκε εγκεκριμένη ίδια περίοδος')}/></label>
     {suggestedValue>0&&<button type="button" className={`waste-library-source ${usingSuggestedPatientDays?'applied':''}`} onClick={()=>setDraft(state=>({...state,patientDays:suggestedValue,patientDaysSource:'library'}))}>{usingSuggestedPatientDays?(en?'✓ Using Library value':'✓ Χρήση τιμής Βιβλιοθήκης'):(en?`Use Library value: ${suggestedValue}`:`Χρήση τιμής Βιβλιοθήκης: ${suggestedValue}`)}</button>}
     <div className="waste-source-note"><span>{sourceLabel}</span></div>
    </section>
    <div className="prevention-entry-actor waste-smart-actor"><span>{initialRecord?(en?'Edited by':'Επεξεργασία από'):(en?'Recorded by':'Καταχώρηση από')}</span><strong>{actor.name}</strong>{actor.email&&<small>{actor.email}</small>}</div>
   </aside>
  </div>

  <div className="who-editor-page-actions prevention-editor-page-actions">
   <ActionButton label={en?'Cancel':'Ακύρωση'} tone="neutral" onClick={onCancel}><X size={16}/><span>{en?'Cancel':'Ακύρωση'}</span></ActionButton>
   <ActionButton label={initialRecord?(en?'Save changes':'Αποθήκευση αλλαγών'):(en?'Save measurement':'Αποθήκευση μέτρησης')} tone="primary" disabled={!valid||saving} onClick={submit}><Save size={16}/><span>{saving?(en?'Saving…':'Αποθήκευση…'):initialRecord?(en?'Save changes':'Αποθήκευση αλλαγών'):(en?'Save measurement':'Αποθήκευση μέτρησης')}</span></ActionButton>
  </div>
 </div>
}

function WasteRecordDetails({record,language,locale}){
 const en=language==='en'
 const fmtDate=value=>value?new Intl.DateTimeFormat(locale).format(new Date(`${value}T12:00:00`)):'—'
 const fmtNumber=(value,digits=1)=>Number(value||0).toLocaleString(locale,{maximumFractionDigits:digits,minimumFractionDigits:0})
 const start=record.periodStart||record.date
 const end=record.periodEnd||record.date
 const period=start===end?fmtDate(start):`${fmtDate(start)} — ${fmtDate(end)}`
 const patientDays=Number(record.patientDays)||0
 const weight=Number(record.weight)||0
 const indicator=record.indicator!=null?Number(record.indicator):(patientDays>0?weight/patientDays*1000:null)
 const source=record.patientDaysSource==='library'?(en?'Bed-days Library':'Βιβλιοθήκη νοσηλευτικών ημερών'):record.patientDaysSource==='manual'?(en?'Manual entry':'Χειροκίνητη καταχώριση'):'—'
 return <div className="waste-record-view">
  <section className="waste-record-primary">
   <div className="waste-record-heading"><div><Recycle size={18}/><span><strong>{en?'Waste measurement':'Καταγραφή αποβλήτων'}</strong><small>{period}</small></span></div><span className="waste-record-status">{en?'Completed':'Ολοκληρωμένη'}</span></div>
   <div className="waste-record-context">
    <div><CalendarRange size={16}/><span><small>{en?'Reporting period':'Περίοδος αναφοράς'}</small><strong>{period}</strong></span></div>
    <div><span className="waste-record-context-icon">Τ</span><span><small>{en?'Department':'Τμήμα'}</small><strong>{record.departmentEl||'—'}</strong></span></div>
    <div className="waste-record-category"><Recycle size={16}/><span><small>{en?'Waste category':'Κατηγορία αποβλήτου'}</small><strong>{en?(record.typeEn||record.wasteType||record.type):(record.wasteType||record.type)||'—'}</strong></span></div>
   </div>
   <div className="waste-record-kpis">
    <div className="primary"><Scale size={18}/><span>{en?'Total weight':'Συνολικό βάρος'}</span><strong>{fmtNumber(weight)} <small>kg</small></strong></div>
    <div><Box size={18}/><span>{en?'Containers':'Περιέκτες'}</span><strong>{record.containers??'—'}</strong></div>
    <div><span className="waste-kpi-symbol">PD</span><span>{en?'Patient-days':'Νοσηλευτικές ημέρες'}</span><strong>{patientDays||'—'}</strong></div>
    <div className="indicator"><span className="waste-kpi-symbol">‰</span><span>{en?'Waste indicator':'Δείκτης αποβλήτων'}</span><strong>{indicator==null?'—':fmtNumber(indicator,2)} <small>{en?'kg / 1,000 PD':'kg / 1.000 ΝΗ'}</small></strong></div>
   </div>
  </section>

  <div className="waste-record-columns">
   <section className="waste-record-card">
    <div className="waste-record-card-title"><FileText size={17}/><strong>{en?'Document & collection':'Παραστατικό & συλλογή'}</strong></div>
    <div className="waste-record-detail-grid">
     <div><small>{en?'Document number':'Αριθμός παραστατικού'}</small><strong>{record.documentNumber||'—'}</strong></div>
     <div><Truck size={15}/><span><small>{en?'Collection company':'Εταιρεία συλλογής'}</small><strong>{record.collectionCompany||'—'}</strong></span></div>
     <div><UserRound size={15}/><span><small>{en?'Responsible':'Υπεύθυνος'}</small><strong>{record.responsible||'—'}</strong></span></div>
     <div><small>{en?'Denominator source':'Πηγή παρονομαστή'}</small><strong>{source}</strong></div>
    </div>
   </section>
   <section className="waste-record-card waste-record-note-card">
    <div className="waste-record-card-title"><strong>{en?'Notes':'Σημειώσεις'}</strong></div>
    <p>{record.notes|| (en?'No notes were recorded.':'Δεν καταχωρίστηκαν σημειώσεις.')}</p>
   </section>
  </div>

  <section className="waste-record-audit">
   <div><small>{en?'Recorded by':'Καταχώρηση από'}</small><strong>{record.createdBy||record.responsible||'—'}</strong></div>
   <div><small>{en?'Created':'Δημιουργήθηκε'}</small><strong>{record.createdAt?new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(record.createdAt)):'—'}</strong></div>
   {record.updatedAt&&<div><small>{en?'Last update':'Τελευταία ενημέρωση'}</small><strong>{new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(record.updatedAt))}</strong></div>}
  </section>
 </div>
}

function DepartmentField({value,onChange,departments,fixed}){const {language}=useLanguage();return <label><span>{language==='en'?'Department *':'Τμήμα *'}</span><select value={value} disabled={fixed} onChange={event=>onChange(event.target.value)}>{departments.map(item=><option key={item.id||item.el} value={item.el}>{language==='en'?(item.en||item.el):item.el}</option>)}</select></label>}
