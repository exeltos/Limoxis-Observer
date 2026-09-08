import { useEffect,useMemo,useState } from 'react'
import { Save,X } from 'lucide-react'
import { useAuth } from '../../core/auth/AuthContext'
import { controlActorFromAuth } from '../controls/controlActor'
import { ActionButton } from '../../design-system/ActionButton'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { ANTISEPTIC_METHODS,isAbhrProduct } from './AntisepticEntryModal'

function monthRange(period){
 if(!period)return null
 const [y,m]=period.split('-').map(Number)
 if(!y||!m)return null
 const from=`${y}-${String(m).padStart(2,'0')}-01`
 const last=new Date(y,m,0).getDate()
 const to=`${y}-${String(m).padStart(2,'0')}-${String(last).padStart(2,'0')}`
 return {from,to}
}

export function AntisepticEntryEditor({onCancel,onSave,fixedDepartment='',initialRecord=null,departments=[],products=[],findPatientDays}){
 const {profile,user}=useAuth()
 const {language,locale}=useLanguage();const en=language==='en'
 const actor=useMemo(()=>controlActorFromAuth({profile,user}),[profile,user])
 const today=new Date().toISOString().slice(0,10)
 const currentMonth=today.slice(0,7)
 const initialDepartment=initialRecord?.departmentEl||fixedDepartment||departments[0]?.el||''
 const initialProduct=initialRecord?.product||products[0]?.el||''
 const [draft,setDraft]=useState(()=>initialRecord?JSON.parse(JSON.stringify(initialRecord)):{period:currentMonth,departmentEl:initialDepartment,product:initialProduct,antisepticItemId:products.find(x=>x.el===initialProduct)?.id||'',litres:'',patientDays:'',patientDaysSource:'',method:'pharmacy_issue',referenceNumber:'',responsible:actor.name,notes:'',status:'completed'})
 const [suggestedPatientDays,setSuggestedPatientDays]=useState('')
 const [saving,setSaving]=useState(false)
 const set=(key,value)=>setDraft(state=>({...state,[key]:value}))
 const departmentInfo=departments.find(item=>item.el===draft.departmentEl)
 const productInfo=products.find(item=>item.id===draft.antisepticItemId||item.el===draft.product)
 const departmentEn=departmentInfo?.en||draft.departmentEl
 const productEn=productInfo?.en||draft.product
 const range=useMemo(()=>monthRange(draft.period),[draft.period])

 useEffect(()=>{
  let active=true
  async function load(){
   if(!findPatientDays||!departmentInfo?.id||!range){setSuggestedPatientDays('');return}
   try{const value=await findPatientDays(departmentInfo.id,range.from,range.to);if(active)setSuggestedPatientDays(value||'')}
   catch{if(active)setSuggestedPatientDays('')}
  }
  void load()
  return()=>{active=false}
 },[findPatientDays,departmentInfo?.id,range?.from,range?.to])

 const patientDays=Number(draft.patientDays)||0
 const litres=Number(draft.litres)||0
 const abhr=isAbhrProduct(productInfo)
 const indicator=abhr&&patientDays>0?Number((litres/patientDays*1000).toFixed(2)):null
 const usingLibraryDays=Boolean(suggestedPatientDays)&&Number(draft.patientDays)===Number(suggestedPatientDays)&&draft.patientDaysSource==='library'
 const valid=Boolean(draft.period&&draft.departmentEl&&draft.product&&Number.isFinite(litres)&&litres>=0&&draft.method&&departments.length&&products.length)

 function changeProduct(value){
  const selected=products.find(item=>item.id===value)
  setDraft(state=>({...state,antisepticItemId:value,product:selected?.el||'',productEn:selected?.en||'',productCode:selected?.code||''}))
 }
 async function submit(){
  if(!valid||saving)return
  const selectedProduct=products.find(item=>item.id===draft.antisepticItemId||item.el===draft.product)
  const now=new Date().toISOString()
  const record={...draft,antisepticItemId:selectedProduct?.id||draft.antisepticItemId||'',productCode:selectedProduct?.code||'',departmentEn,product:selectedProduct?.el||draft.product,productEn:selectedProduct?.en||productEn,litres,patientDays:patientDays||null,indicator,indicatorEligible:isAbhrProduct(selectedProduct),responsible:draft.responsible||actor.name,createdAt:initialRecord?.createdAt||now,createdBy:initialRecord?.createdBy||actor.name,createdById:initialRecord?.createdById||actor.id,updatedAt:initialRecord?now:null,updatedBy:initialRecord?actor.name:null,updatedById:initialRecord?actor.id:null,status:'completed',lifecycleStatus:'finalized'}
  try{setSaving(true);await onSave(record)}finally{setSaving(false)}
 }

 return <div className="antiseptic-page-editor antiseptic-entry-card">
  <div className="prevention-entry-actor"><span>{initialRecord?(en?'Edited by':'Επεξεργασία από'):(en?'Recorded by':'Καταχώρηση από')}</span><strong>{actor.name}</strong><small>{actor.email}</small></div>
  <div className="antiseptic-entry-workspace">
   <main className="antiseptic-entry-main">
    <section className="antiseptic-form-section">
     <div className="antiseptic-form-heading"><strong>{en?'Monthly consumption':'Μηνιαία κατανάλωση'}</strong><small>{en?'Product is selected from the central antiseptic Library.':'Το προϊόν επιλέγεται από την κεντρική Βιβλιοθήκη αντισηπτικών.'}</small></div>
     <div className="entry-grid">
      <label><span>{en?'Reporting month *':'Μήνας αναφοράς *'}</span><input type="month" value={String(draft.period||'').slice(0,7)} onChange={event=>set('period',event.target.value)}/></label>
      <DepartmentField value={draft.departmentEl} onChange={value=>set('departmentEl',value)} departments={departments} fixed={Boolean(fixedDepartment)}/>
      <label className="entry-span-2"><span>{en?'Product *':'Προϊόν *'}</span><select value={draft.antisepticItemId||productInfo?.id||''} onChange={event=>changeProduct(event.target.value)}>{products.map(item=><option key={item.id} value={item.id}>{en?(item.en||item.el):item.el}</option>)}</select></label>
      <label><span>{en?'Consumption *':'Κατανάλωση *'}</span><div className="field-with-unit"><input type="number" min="0" step="0.1" value={draft.litres} onChange={event=>set('litres',event.target.value)} placeholder="0,0"/><span>L</span></div></label>
      <label><span>{en?'Data source / method *':'Πηγή / μέθοδος δεδομένων *'}</span><select value={draft.method} onChange={event=>set('method',event.target.value)}>{ANTISEPTIC_METHODS.map(item=><option key={item.id} value={item.id}>{en?item.labelEn:item.label}</option>)}</select></label>
     </div>
     <div className={`antiseptic-eligibility ${abhr?'eligible':'informative'}`}><strong>{abhr?(en?'ABHR · Indicator active':'ABHR · Δείκτης ενεργός'):(en?'Non-ABHR product':'Μη ABHR προϊόν')}</strong><span>{abhr?(en?'Consumption contributes to the L / 1,000 patient-days indicator.':'Η κατανάλωση προσμετράται στον δείκτη L / 1.000 νοσηλευτικές ημέρες.'):(en?'Consumption is stored and analysed but does not contribute to the alcohol-based hand rub consumption indicator.':'Η κατανάλωση αποθηκεύεται και αναλύεται, αλλά δεν προσμετράται στον δείκτη κατανάλωσης αλκοολούχου αντισηπτικού.')}</span></div>
    </section>
    <section className="antiseptic-form-section">
     <div className="antiseptic-form-heading"><strong>{en?'Traceability':'Ιχνηλασιμότητα'}</strong><small>{en?'Link the value to its source and responsible recorder.':'Σύνδεση της τιμής με την πηγή και τον υπεύθυνο καταχώρησης.'}</small></div>
     <div className="entry-grid"><label><span>{en?'Responsible person':'Υπεύθυνος'}</span><input value={draft.responsible||''} onChange={event=>set('responsible',event.target.value)} placeholder={actor.name}/></label><label><span>{en?'Reference / document':'Αναφορά / παραστατικό'}</span><input value={draft.referenceNumber||''} onChange={event=>set('referenceNumber',event.target.value)} placeholder={en?'e.g. PHARM-2026-08':'π.χ. ΦΑΡΜ-2026-08'}/></label><label className="entry-span-2"><span>{en?'Notes':'Σημειώσεις'}</span><textarea rows="4" value={draft.notes||''} onChange={event=>set('notes',event.target.value)} placeholder={en?'Optional notes or clarifications about the data source':'Προαιρετικές παρατηρήσεις ή διευκρινίσεις για την πηγή των δεδομένων'}/></label></div>
    </section>
   </main>
   <aside className="antiseptic-entry-rail">
    <section className="antiseptic-form-section antiseptic-indicator-panel">
     <div className="antiseptic-form-heading"><strong>{en?'Denominator & indicator':'Παρονομαστής & δείκτης'}</strong><small>{en?'Library patient-days are offered only for the exact approved reporting month.':'Οι νοσηλευτικές ημέρες προτείνονται μόνο για τον ίδιο ακριβώς εγκεκριμένο μήνα.'}</small></div>
     <label><span>{en?'Patient-days for reporting month':'Νοσηλευτικές ημέρες μήνα αναφοράς'}</span><div className="antiseptic-patient-days-field"><input type="number" min="0" value={draft.patientDays||''} onChange={event=>setDraft(state=>({...state,patientDays:event.target.value,patientDaysSource:'manual'}))} placeholder={suggestedPatientDays?String(suggestedPatientDays):(en?'No approved matching month':'Δεν βρέθηκε εγκεκριμένος ίδιος μήνας')}/>{suggestedPatientDays&&<button type="button" className={usingLibraryDays?'applied':''} onClick={()=>setDraft(state=>({...state,patientDays:suggestedPatientDays,patientDaysSource:'library'}))}>{usingLibraryDays?(en?'✓ From Library':'✓ Από Βιβλιοθήκη'):(en?'Use ':'Χρήση ')+suggestedPatientDays}</button>}</div></label>
     <div className={`antiseptic-indicator-card ${abhr?'active':''}`}><span>{en?'ABHR indicator':'Δείκτης ABHR'}</span><strong>{indicator===null?'—':indicator.toLocaleString(locale)}</strong><small>{en?'L / 1,000 patient-days':'L / 1.000 νοσηλευτικές ημέρες'}</small></div>
     {usingLibraryDays&&<small className="antiseptic-source-note">{en?`${suggestedPatientDays} patient-days from the approved matching month are used.`:`Χρησιμοποιούνται ${suggestedPatientDays} νοσηλευτικές ημέρες από τον εγκεκριμένο ίδιο μήνα.`}</small>}
    </section>
   </aside>
  </div>
  <div className="prevention-editor-page-actions"><ActionButton label={en?'Cancel':'Ακύρωση'} tone="neutral" onClick={onCancel}><X size={16}/><span>{en?'Cancel':'Ακύρωση'}</span></ActionButton><ActionButton label={initialRecord?(en?'Save changes':'Αποθήκευση αλλαγών'):(en?'Save consumption':'Αποθήκευση κατανάλωσης')} tone="primary" disabled={!valid||saving} onClick={submit}><Save size={16}/><span>{saving?(en?'Saving…':'Αποθήκευση…'):initialRecord?(en?'Save changes':'Αποθήκευση αλλαγών'):(en?'Save consumption':'Αποθήκευση κατανάλωσης')}</span></ActionButton></div>
 </div>
}

function DepartmentField({value,onChange,departments,fixed}){const {language}=useLanguage();return <label><span>{language==='en'?'Department *':'Τμήμα *'}</span><select value={value} disabled={fixed} onChange={event=>onChange(event.target.value)}>{departments.map(item=><option key={item.id||item.el} value={item.el}>{language==='en'?(item.en||item.el):item.el}</option>)}</select></label>}
