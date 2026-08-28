import { useMemo } from 'react'
import { ClipboardCheck,Droplets,Recycle,ShieldCheck,Trash2 } from 'lucide-react'
import { useNavigate,useParams } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { antisepticRows,bundleRows,handHygieneRows,wasteRows } from './preventionDemoData'
import { WHO_MOMENTS } from './WhoHandHygieneModal'
import { useTenant } from '../../core/tenant/TenantContext'
import { CAPABILITIES,can } from '../../core/permissions/roles'
import { wasteCategoryTone } from './wasteVisuals'

const sources={handHygiene:handHygieneRows,waste:wasteRows,antiseptics:antisepticRows,bundles:bundleRows}
const icons={handHygiene:ShieldCheck,waste:Recycle,antiseptics:Droplets,bundles:ClipboardCheck}
const labels={handHygiene:'Υγιεινή Χεριών',waste:'Απόβλητα',antiseptics:'Κατανάλωση αντισηπτικών',bundles:'Bundles πρόληψης'}

export function PreventionRecordPage(){
 const {recordType,recordId}=useParams();const navigate=useNavigate();const {locale,t}=useLanguage();const {notify,confirm}=useFeedback();const {role,membership}=useTenant()
 const record=(sources[recordType]||[]).find(x=>x.id===recordId)
 if(!record)return <Page title="Κέντρο Πρόληψης"><div className="inline-empty">Δεν βρέθηκε η εγγραφή.</div></Page>
 const addOns=membership?.capabilities??[],custom=membership?.customCapabilities??[]
 const cap=recordType==='handHygiene'?CAPABILITIES.RECORD_HAND_HYGIENE:recordType==='waste'?CAPABILITIES.RECORD_WASTE:recordType==='antiseptics'?CAPABILITIES.RECORD_ANTISEPTIC:CAPABILITIES.RECORD_PREVENTION_BUNDLE
 const canDelete=can(role,cap,addOns,custom)
 async function removeRecord(){
  const ok=await confirm({title:'Διαγραφή εγγραφής',message:'Η εγγραφή θα διαγραφεί. Θέλετε να συνεχίσετε;',confirmLabel:'Διαγραφή',danger:true})
  if(!ok)return
  const source=sources[recordType]||[]
  const index=source.findIndex(x=>x.id===recordId)
  if(index>=0)source.splice(index,1)
  notify('Η εγγραφή διαγράφηκε.','success')
  navigate(`/prevention?tab=${recordType}`)
 }
 const Icon=icons[recordType]||ShieldCheck
 const fmtDate=v=>v?new Intl.DateTimeFormat(locale).format(new Date(`${v}T12:00:00`)):'—'
 const isWaste=recordType==='waste'
 const wasteCategory=record.wasteType||record.type
 const recordTitle=recordType==='handHygiene'?`WHO Observation · ${fmtDate(record.date)}`:isWaste?`Μέτρηση αποβλήτων · ${fmtDate(record.date)}`:record.id
 const recordSubtitle=isWaste?`${record.departmentEl||''} · ${wasteCategory||''}`:(record.departmentEl||'')
 return <Page fill><EntityRecordShell className="prevention-record-shell workspace-fill" avatar={<Icon size={19}/>} eyebrow={labels[recordType]||'Πρόληψη'} title={recordTitle} subtitle={recordSubtitle} status={isWaste?<span className={`waste-category-badge ${wasteCategoryTone(wasteCategory)}`}>{wasteCategory}</span>:null} headerActions={canDelete?<button type="button" className="entity-record-icon-button danger" title="Διαγραφή" aria-label="Διαγραφή" onClick={removeRecord}><Trash2 size={15}/></button>:null} tabs={[]} activeTab="" onTabChange={()=>{}}>
   <div className="record-section">
    {recordType==='handHygiene'?<HandHygieneDetails record={record} fmtDate={fmtDate}/>:recordType==='waste'?<WasteDetails record={record} fmtDate={fmtDate} t={t}/>:recordType==='antiseptics'?<AntisepticDetails record={record}/>:<BundleDetails record={record} t={t}/>}
   </div>
  </EntityRecordShell></Page>
}

function HandHygieneDetails({record,fmtDate}){
 const stats=record.whoStats||{
  opportunities:record.whoObservations?.length||record.observations||0,
  compliant:(record.whoObservations||[]).filter(x=>x.action==='HR'||x.action==='HW').length||record.compliant||0,
  compliance:record.rate||0,
  handRub:(record.whoObservations||[]).filter(x=>x.action==='HR').length,
  handWash:(record.whoObservations||[]).filter(x=>x.action==='HW').length,
  missed:(record.whoObservations||[]).filter(x=>x.action==='MISSED').length,
  professionals:(record.whoObservations||[]).reduce((sum,x)=>sum+(Number(x.professionalsCount)||1),0),
 }
 return <>
  <div className="detail-grid quality-detail-grid">
   <D l="Ημερομηνία" v={fmtDate(record.date)}/><D l="Τμήμα" v={record.departmentEl}/><D l="Παρατηρητής" v={record.observer}/><D l="Ώρα" v={`${record.session?.startTime||'—'} – ${record.session?.endTime||'—'}`}/>
  </div>
  <div className="who-live-summary record-who-summary"><div><span>Ευκαιρίες</span><strong>{stats.opportunities}</strong></div><div><span>Επαγγελματίες</span><strong>{stats.professionals||'—'}</strong></div><div><span>HR</span><strong>{stats.handRub||0}</strong></div><div><span>HW</span><strong>{stats.handWash||0}</strong></div><div><span>Missed</span><strong>{stats.missed||0}</strong></div><div className="who-compliance"><span>Συμμόρφωση</span><strong>{stats.compliance}%</strong></div></div>
  <div className="scroll-table"><table className="data-table sticky-table"><thead><tr><th>#</th><th>Επαγγελματίες</th><th>Κατηγορία</th><th>WHO Moment</th><th>Ενέργεια</th><th>Γάντια</th><th>Σημείωση</th></tr></thead><tbody>{(record.whoObservations||[]).map((x,i)=><tr key={x.id}><td>{i+1}</td><td><strong>{x.professionalsCount||1}</strong></td><td>{x.professionalCategory}</td><td>{WHO_MOMENTS.find(m=>m.id===x.moment)?.label||x.moment}</td><td><span className={`status-badge ${x.action==='MISSED'?'danger':'active'}`}>{x.action}</span></td><td>{x.gloves?'Ναι':'Όχι'}</td><td>{x.notes||'—'}</td></tr>)}</tbody></table></div>
 </>
}
function WasteDetails({record,fmtDate}){
 const category=record.wasteType||record.type
 return <div className="waste-record-view">
  <section className="waste-record-primary">
   <div className="waste-record-section-heading"><div><span>ΜΕΤΡΗΣΗ</span><strong>Στοιχεία καταγραφής</strong></div><span className={`waste-category-badge ${wasteCategoryTone(category)}`}>{category}</span></div>
   <div className="waste-record-measurements">
    <div><span>Βάρος</span><strong>{Number(record.weight).toLocaleString('el-GR')} <small>kg</small></strong></div>
    <div><span>Περιέκτες</span><strong>{record.containers}</strong></div>
    <div><span>Νοσηλευτικές ημέρες</span><strong>{record.patientDays||'—'}</strong></div>
    <div className="waste-record-indicator"><span>Δείκτης</span><strong>{record.indicator!=null?Number(record.indicator).toLocaleString('el-GR'):'—'}</strong><small>kg / 1.000 νοσηλευτικές ημέρες</small></div>
   </div>
   <div className="waste-record-meta-line"><span><b>Ημερομηνία</b>{fmtDate(record.date)}</span><span><b>Τμήμα</b>{record.departmentEl}</span><span><b>Υπεύθυνος</b>{record.responsible||record.createdBy||'—'}</span></div>
  </section>

  <section className="waste-record-trace">
   <div className="waste-record-section-heading"><div><span>ΙΧΝΗΛΑΣΙΜΟΤΗΤΑ</span><strong>Παραστατικό & συλλογή</strong></div></div>
   <div className="waste-trace-grid">
    <div><span>Αριθμός παραστατικού</span><strong>{record.documentNumber||'—'}</strong></div>
    <div><span>Εταιρεία συλλογής</span><strong>{record.collectionCompany||'—'}</strong></div>
    {record.patientDaysSource==='library'&&<div><span>Πηγή νοσηλευτικών ημερών</span><strong>Βιβλιοθήκη</strong></div>}
   </div>
  </section>
  {record.notes&&<div className="record-note-card"><span>ΣΗΜΕΙΩΣΕΙΣ</span><p>{record.notes}</p></div>}
 </div>
}
function AntisepticDetails({record}){return <div className="detail-grid quality-detail-grid"><D l="Περίοδος" v={record.period}/><D l="Τμήμα" v={record.departmentEl}/><D l="Προϊόν" v={record.product}/><D l="Κατανάλωση" v={`${record.litres} L`}/></div>}
function BundleDetails({record,t}){return <div className="detail-grid quality-detail-grid"><D l="Bundle" v={t(record.bundle)}/><D l="Τμήμα" v={record.departmentEl}/><D l="Περίοδος" v={record.period}/><D l="Συμμόρφωση" v={`${record.score}%`}/><D l="Κατάσταση" v={t(record.status)}/></div>}
function D({l,v}){return <div className="detail-item"><span>{l}</span><strong>{v}</strong></div>}
