import { useMemo,useState } from 'react'
import { Droplets } from 'lucide-react'
import { demoLibrarySeed,demoPatientDayPeriods } from '../management/managementData'
import { useAuth } from '../../core/auth/AuthContext'
import { controlActorFromAuth } from '../controls/controlActor'
import { useLanguage } from '../../core/i18n/LanguageContext'

export const ANTISEPTIC_METHODS=[
 {id:'pharmacy_issue',label:'Χορήγηση / διάθεση από Φαρμακείο',labelEn:'Issue / supply from Pharmacy'},
 {id:'warehouse_issue',label:'Διάθεση από Αποθήκη',labelEn:'Issue from Warehouse'},
 {id:'stock_difference',label:'Διαφορά αποθέματος',labelEn:'Stock difference'},
 {id:'direct_measurement',label:'Άμεση μέτρηση κατανάλωσης',labelEn:'Direct consumption measurement'},
 {id:'other',label:'Άλλη τεκμηριωμένη πηγή',labelEn:'Other documented source'},
]

export function isAbhrProduct(product=''){
 const value=String(product).toLowerCase()
 return value.includes('αλκοολ')||value.includes('alcohol')
}

export function antisepticMethodLabel(id){
 return ANTISEPTIC_METHODS.find(x=>x.id===id)?.label||id||'—'
}

function monthRange(period){
 if(!period)return null
 const [y,m]=period.split('-').map(Number)
 if(!y||!m)return null
 const from=`${y}-${String(m).padStart(2,'0')}-01`
 const last=new Date(y,m,0).getDate()
 const to=`${y}-${String(m).padStart(2,'0')}-${String(last).padStart(2,'0')}`
 return {from,to}
}

export function AntisepticEntryModal({onClose,onSave,fixedDepartment='',initialRecord=null}){
 const {profile,user}=useAuth()
 const {language,locale}=useLanguage(); const en=language==='en'
 const actor=useMemo(()=>controlActorFromAuth({profile,user}),[profile,user])
 const departments=useMemo(()=>demoLibrarySeed.departments.map(([el,en])=>({el,en})),[])
 const products=useMemo(()=>demoLibrarySeed.antiseptics.map(([el,en])=>({el,en})),[])
 const today=new Date().toISOString().slice(0,10)
 const currentMonth=today.slice(0,7)
 const [draft,setDraft]=useState(()=>initialRecord?JSON.parse(JSON.stringify(initialRecord)):{
  period:currentMonth,departmentEl:fixedDepartment||departments[0]?.el||'',product:products[0]?.el||'',
  litres:'',patientDays:'',patientDaysSource:'',method:'pharmacy_issue',referenceNumber:'',
  responsible:actor.name,notes:'',status:'completed'
 })
 const set=(k,v)=>setDraft(d=>({...d,[k]:v}))
 const departmentEn=departments.find(d=>d.el===draft.departmentEl)?.en||draft.departmentEl
 const productEn=products.find(d=>d.el===draft.product)?.en||draft.product
 const range=useMemo(()=>monthRange(draft.period),[draft.period])
 const suggestedPatientDays=useMemo(()=>{
  if(!range)return ''
  const exact=demoPatientDayPeriods.find(x=>x.departmentEl===draft.departmentEl&&range.from>=x.from&&range.to<=x.to)
  return exact?.value||''
 },[range,draft.departmentEl])
 const patientDays=Number(draft.patientDays)||0
 const litres=Number(draft.litres)||0
 const abhr=isAbhrProduct(draft.product)
 const indicator=abhr&&patientDays>0?Number((litres/patientDays*1000).toFixed(2)):null
 const usingLibraryDays=Boolean(suggestedPatientDays)&&Number(draft.patientDays)===Number(suggestedPatientDays)&&draft.patientDaysSource==='library'
 const valid=Boolean(draft.period&&draft.departmentEl&&draft.product&&litres>=0&&draft.method)

 function submit(){
  if(!valid)return
  const now=new Date().toISOString()
  onSave({...draft,departmentEn,productEn,litres,patientDays:patientDays||null,indicator,
   indicatorEligible:abhr,responsible:draft.responsible||actor.name,
   createdAt:initialRecord?.createdAt||now,createdBy:initialRecord?.createdBy||actor.name,createdById:initialRecord?.createdById||actor.id,
   updatedAt:initialRecord?now:null,updatedBy:initialRecord?actor.name:null,status:'completed'})
 }

 return <div className="modal-backdrop"><div className="entry-card prevention-entry-card antiseptic-entry-card">
  <header>
   <div className="prevention-entry-title"><Droplets size={20}/><div><span className="eyebrow">{en?'PREVENTION CENTER':'ΚΕΝΤΡΟ ΠΡΟΛΗΨΗΣ'}</span><h3>{initialRecord?(en?'Edit antiseptic consumption':'Επεξεργασία κατανάλωσης αντισηπτικού'):(en?'New antiseptic consumption entry':'Νέα καταγραφή κατανάλωσης αντισηπτικού')}</h3><p>{en?'Documented consumption and automatic ABHR indicator per 1,000 patient-days.':'Τεκμηριωμένη κατανάλωση και αυτόματος δείκτης ABHR ανά 1.000 νοσηλευτικές ημέρες.'}</p></div></div>
   <button className="icon-close" onClick={onClose}>×</button>
  </header>
  <div className="prevention-entry-body">
   <div className="prevention-entry-actor"><span>{initialRecord?(en?'Edited by':'Επεξεργασία από'):(en?'Recorded by':'Καταχώρηση από')}</span><strong>{actor.name}</strong><small>{actor.email}</small></div>

   <section className="antiseptic-form-section">
    <div className="antiseptic-form-heading"><strong>{en?'Consumption':'Κατανάλωση'}</strong><small>{en?'Product is selected from the central antiseptic Library.':'Το προϊόν επιλέγεται από την κεντρική Βιβλιοθήκη αντισηπτικών.'}</small></div>
    <div className="entry-grid">
     <label><span>{en?'Period *':'Περίοδος *'}</span><input type="month" value={draft.period} onChange={e=>set('period',e.target.value)}/></label>
     <DepartmentField value={draft.departmentEl} onChange={v=>set('departmentEl',v)} departments={departments} fixed={Boolean(fixedDepartment)}/>
     <label className="entry-span-2"><span>{en?'Product *':'Προϊόν *'}</span><select value={draft.product} onChange={e=>set('product',e.target.value)}>{products.map(x=><option key={x.el} value={x.el}>{x.el} — {x.en}</option>)}</select></label>
     <label><span>{en?'Consumption *':'Κατανάλωση *'}</span><div className="field-with-unit"><input type="number" min="0" step="0.1" value={draft.litres} onChange={e=>set('litres',e.target.value)} placeholder="0,0"/><span>L</span></div></label>
     <label><span>{en?'Data source / method *':'Πηγή / μέθοδος δεδομένων *'}</span><select value={draft.method} onChange={e=>set('method',e.target.value)}>{ANTISEPTIC_METHODS.map(x=><option key={x.id} value={x.id}>{en?x.labelEn:x.label}</option>)}</select></label>
    </div>
    <div className={`antiseptic-eligibility ${abhr?'eligible':'informative'}`}>
     <strong>{abhr?(en?'ABHR · Indicator active':'ABHR · Δείκτης ενεργός'):(en?'Non-ABHR product':'Μη ABHR προϊόν')}</strong>
     <span>{abhr?(en?'Consumption contributes to the L / 1,000 patient-days indicator.':'Η κατανάλωση προσμετράται στον δείκτη L / 1.000 νοσηλευτικές ημέρες.'):(en?'Consumption is stored and analysed but does not contribute to the alcohol-based hand rub consumption indicator.':'Η κατανάλωση αποθηκεύεται και αναλύεται, αλλά δεν προσμετράται στον δείκτη κατανάλωσης αλκοολούχου αντισηπτικού.')}</span>
    </div>
   </section>

   <section className="antiseptic-form-section">
    <div className="antiseptic-form-heading"><strong>{en?'Denominator & indicator':'Παρονομαστής & δείκτης'}</strong><small>{en?'The denominator retains its source for traceability.':'Ο παρονομαστής διατηρεί την προέλευσή του για ιχνηλασιμότητα.'}</small></div>
    <div className="entry-grid antiseptic-indicator-grid">
     <label><span>{en?'Patient-days':'Νοσηλευτικές ημέρες'}</span>
      <div className="antiseptic-patient-days-field">
       <input type="number" min="0" value={draft.patientDays||''} onChange={e=>setDraft(d=>({...d,patientDays:e.target.value,patientDaysSource:'manual'}))} placeholder={suggestedPatientDays?String(suggestedPatientDays):(en?'No available period':'Δεν υπάρχει διαθέσιμη περίοδος')}/>
       {suggestedPatientDays&&<button type="button" className={usingLibraryDays?'applied':''} onClick={()=>setDraft(d=>({...d,patientDays:suggestedPatientDays,patientDaysSource:'library'}))}>{usingLibraryDays?(en?'✓ From library':'✓ Από βιβλιοθήκη'):(en?'Use ':'Χρήση ')+suggestedPatientDays}</button>}
      </div>
      {usingLibraryDays&&<small className="antiseptic-source-note">{en?`${suggestedPatientDays} patient-days from the Library are used.`:`Χρησιμοποιούνται ${suggestedPatientDays} νοσηλευτικές ημέρες από τη Βιβλιοθήκη.`}</small>}
     </label>
     <div className={`antiseptic-indicator-card ${abhr?'active':''}`}><span>{en?'ABHR indicator':'Δείκτης ABHR'}</span><strong>{indicator===null?'—':indicator.toLocaleString(locale)}</strong><small>{en?'L / 1,000 patient-days':'L / 1.000 νοσηλευτικές ημέρες'}</small></div>
    </div>
   </section>

   <section className="antiseptic-form-section">
    <div className="antiseptic-form-heading"><strong>{en?'Traceability':'Ιχνηλασιμότητα'}</strong><small>{en?'Link the value to its source and responsible recorder.':'Σύνδεση της τιμής με την πηγή και τον υπεύθυνο καταχώρησης.'}</small></div>
    <div className="entry-grid">
     <label><span>{en?'Responsible person':'Υπεύθυνος'}</span><input value={draft.responsible||''} onChange={e=>set('responsible',e.target.value)} placeholder={actor.name}/></label>
     <label><span>{en?'Reference / document':'Αναφορά / παραστατικό'}</span><input value={draft.referenceNumber||''} onChange={e=>set('referenceNumber',e.target.value)} placeholder={en?'e.g. PHARM-2026-08':'π.χ. ΦΑΡΜ-2026-08'}/></label>
     <label className="entry-span-2"><span>{en?'Notes':'Σημειώσεις'}</span><textarea rows="3" value={draft.notes||''} onChange={e=>set('notes',e.target.value)} placeholder={en?'Optional notes or clarifications about the data source':'Προαιρετικές παρατηρήσεις ή διευκρινίσεις για την πηγή των δεδομένων'}/></label>
    </div>
   </section>
  </div>
  <footer><button className="button" onClick={onClose}>{en?'Cancel':'Ακύρωση'}</button><button className="button button-primary" disabled={!valid} onClick={submit}>{initialRecord?(en?'Save changes':'Αποθήκευση αλλαγών'):(en?'Save entry':'Αποθήκευση καταγραφής')}</button></footer>
 </div></div>
}

function DepartmentField({value,onChange,departments,fixed}){
 const {language}=useLanguage()
 return <label><span>{language==='en'?'Department *':'Τμήμα *'}</span><select value={value} disabled={fixed} onChange={e=>onChange(e.target.value)}>{departments.map(d=><option key={d.el} value={d.el}>{language==='en'?(d.en||d.el):d.el}</option>)}</select></label>
}
