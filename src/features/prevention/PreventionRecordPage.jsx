import { useMemo,useState } from 'react'
import { ClipboardCheck,Droplets,Recycle,ShieldCheck,Trash2 } from 'lucide-react'
import { useNavigate,useParams } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { antisepticRows,bundleRows,handHygieneRows,wasteRows } from './preventionDemoData'
import { WHO_MOMENTS } from './WhoHandHygieneModal'
import { useTenant } from '../../core/tenant/TenantContext'
import { useRecordSequenceNavigation } from '../../core/navigation/useRecordSequenceNavigation'
import { CAPABILITIES,can } from '../../core/permissions/roles'
import { wasteCategoryTone } from './wasteVisuals'
import { antisepticMethodLabel,isAbhrProduct } from './AntisepticEntryModal'
import { getBundleTemplate } from './bundleTemplates'
import { GovernedReasonDialog } from '../../design-system/GovernedReasonDialog'
import { useAuth } from '../../core/auth/AuthContext'
import { auditActorFromAuth,auditEvent } from '../../core/audit/actor'

const sources={handHygiene:handHygieneRows,waste:wasteRows,antiseptics:antisepticRows,bundles:bundleRows}
const icons={handHygiene:ShieldCheck,waste:Recycle,antiseptics:Droplets,bundles:ClipboardCheck}
const labels={handHygiene:'Υγιεινή Χεριών',waste:'Απόβλητα',antiseptics:'Κατανάλωση αντισηπτικών',bundles:'Bundles πρόληψης'}

export function PreventionRecordPage(){
 const {recordType,recordId}=useParams();const navigate=useNavigate();const {locale,t}=useLanguage();const {notify}=useFeedback();const {role,membership,canAccessRecord}=useTenant();const {profile,user}=useAuth();const actor=useMemo(()=>auditActorFromAuth({profile,user}),[profile,user]);const [voidOpen,setVoidOpen]=useState(false)
 const record=(sources[recordType]||[]).find(x=>x.id===recordId)
 const recordNavigation=useRecordSequenceNavigation({registry:`prevention-${recordType}`,currentId:recordId,pathForId:id=>`/prevention/${recordType}/${id}?fromTab=${recordType}`})
 const recordInScope=!record||canAccessRecord({...record,department:record.departmentEl||record.department})
 if(!record)return <Page title="Κέντρο Πρόληψης"><div className="inline-empty">Δεν βρέθηκε η εγγραφή.</div></Page>
 if(!recordInScope)return <Page title="Κέντρο Πρόληψης"><div className="inline-empty">Δεν έχετε πρόσβαση σε αυτή την εγγραφή.</div></Page>
 const addOns=membership?.capabilities??[],custom=membership?.customCapabilities??[]
 const cap=recordType==='handHygiene'?CAPABILITIES.RECORD_HAND_HYGIENE:recordType==='waste'?CAPABILITIES.RECORD_WASTE:recordType==='antiseptics'?CAPABILITIES.RECORD_ANTISEPTIC:CAPABILITIES.RECORD_PREVENTION_BUNDLE
 const canDelete=can(role,cap,addOns,custom)
 function voidRecord(reason){
  const source=sources[recordType]||[]
  const index=source.findIndex(x=>x.id===recordId)
  if(index<0)return
  const now=new Date().toISOString()
  const event=auditEvent('preventionRecordVoided',{actor,reason})
  source[index]={...source[index],lifecycleStatus:'voided',voidedAt:now,voidedBy:actor.name,voidedById:actor.id,voidReason:reason,revisionHistory:[event,...(source[index].revisionHistory||[])]}
  setVoidOpen(false)
  notify('Η εγγραφή ακυρώθηκε και διατηρήθηκε στο ιστορικό.','success')
  navigate(`/prevention?tab=${recordType}`)
 }
 const Icon=icons[recordType]||ShieldCheck
 const fmtDate=v=>v?new Intl.DateTimeFormat(locale).format(new Date(`${v}T12:00:00`)):'—'
 const isWaste=recordType==='waste'
 const isAntiseptic=recordType==='antiseptics'
 const wasteCategory=record.wasteType||record.type
 const recordTitle=recordType==='handHygiene'?`WHO Observation · ${fmtDate(record.date)}`:isWaste?`Μέτρηση αποβλήτων · ${fmtDate(record.date)}`:isAntiseptic?`Κατανάλωση αντισηπτικού · ${record.period||''}`:recordType==='bundles'?`${record.templateName||record.bundle} · ${record.date||record.period||''}`:record.id
 const recordSubtitle=isWaste?`${record.departmentEl||''} · ${wasteCategory||''}`:isAntiseptic?`${record.departmentEl||''} · ${record.product||''}`:recordType==='bundles'?`${record.departmentEl||''} · v${record.templateVersion||'1.0'}`:(record.departmentEl||'')
 const recordStatus=isWaste?<span className={`waste-category-badge ${wasteCategoryTone(wasteCategory)}`}>{wasteCategory}</span>:isAntiseptic?<span className={`antiseptic-abhr-badge ${record.indicatorEligible!==false&&isAbhrProduct(record.product)?'active':'informative'}`}>{record.indicatorEligible!==false&&isAbhrProduct(record.product)?'ABHR · στον δείκτη':'Εκτός δείκτη ABHR'}</span>:null
 return <Page fill><EntityRecordShell className="prevention-record-shell workspace-fill" avatar={<Icon size={19}/>} eyebrow={labels[recordType]||'Πρόληψη'} title={recordTitle} subtitle={recordSubtitle} status={recordStatus} recordNavigation={recordNavigation} headerActions={canDelete?<button type="button" className="entity-record-icon-button danger" title="Ακύρωση εγγραφής" aria-label="Ακύρωση εγγραφής" onClick={()=>setVoidOpen(true)}><Trash2 size={15}/></button>:null} tabs={[]} activeTab="" onTabChange={()=>{}}>
   <div className="record-section">
    {recordType==='handHygiene'?<HandHygieneDetails record={record} fmtDate={fmtDate}/>:recordType==='waste'?<WasteDetails record={record} fmtDate={fmtDate} t={t}/>:recordType==='antiseptics'?<AntisepticDetails record={record}/>:<BundleDetails record={record} t={t}/>}
   </div>
  <GovernedReasonDialog open={voidOpen} title="Ακύρωση εγγραφής" description="Η εγγραφή δεν θα διαγραφεί φυσικά. Θα διατηρηθεί για ιχνηλασιμότητα και θα αφαιρεθεί από την ενεργή λίστα." confirmLabel="Ακύρωση εγγραφής" danger onCancel={()=>setVoidOpen(false)} onConfirm={voidRecord}/>
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
function AntisepticDetails({record}){
 const eligible=record.indicatorEligible!==false&&isAbhrProduct(record.product)
 return <div className="antiseptic-record-view">
  <section className="antiseptic-record-primary">
   <div className="antiseptic-record-heading"><div><span>ΚΑΤΑΝΑΛΩΣΗ</span><strong>Στοιχεία περιόδου</strong></div><span className={`antiseptic-abhr-badge ${eligible?'active':'informative'}`}>{eligible?'ABHR · Δείκτης ενεργός':'Εκτός δείκτη ABHR'}</span></div>
   <div className="antiseptic-record-measurements">
    <div><span>Κατανάλωση</span><strong>{Number(record.litres).toLocaleString('el-GR')} <small>L</small></strong></div>
    <div><span>Νοσηλευτικές ημέρες</span><strong>{record.patientDays||'—'}</strong>{record.patientDaysSource==='library'&&<small>από Βιβλιοθήκη</small>}</div>
    <div className="antiseptic-record-indicator"><span>Δείκτης ABHR</span><strong>{record.indicator!=null?Number(record.indicator).toLocaleString('el-GR'):'—'}</strong><small>L / 1.000 νοσηλευτικές ημέρες</small></div>
   </div>
   <div className="antiseptic-record-meta-line"><span><b>Περίοδος</b>{record.period||'—'}</span><span><b>Τμήμα</b>{record.departmentEl||'—'}</span><span><b>Προϊόν</b>{record.product||'—'}</span></div>
  </section>
  <section className="antiseptic-record-trace">
   <div className="antiseptic-record-heading"><div><span>ΤΕΚΜΗΡΙΩΣΗ</span><strong>Πηγή δεδομένων & ιχνηλασιμότητα</strong></div></div>
   <div className="antiseptic-trace-grid">
    <div><span>Πηγή / μέθοδος</span><strong>{antisepticMethodLabel(record.method)}</strong></div>
    <div><span>Αναφορά / παραστατικό</span><strong>{record.referenceNumber||'—'}</strong></div>
    <div><span>Υπεύθυνος</span><strong>{record.responsible||record.createdBy||'—'}</strong></div>
   </div>
   <div className="antiseptic-governance-note"><strong>{eligible?'Δείκτης πρόληψης':'Παρακολούθηση κατανάλωσης'}</strong><span>{eligible?'Η τιμή μπορεί να χρησιμοποιηθεί σε συγκρίσεις ανά περίοδο/τμήμα και σε συσχέτιση με τη συμμόρφωση Υγιεινής Χεριών.':'Η τιμή παραμένει διαθέσιμη για λειτουργική παρακολούθηση, χωρίς να αναμιγνύεται με τον δείκτη ABHR.'}</span></div>
  </section>
  {record.notes&&<div className="record-note-card"><span>ΣΗΜΕΙΩΣΕΙΣ</span><p>{record.notes}</p></div>}
 </div>
}
function BundleDetails({record}){
 const template=record.templateSnapshot||getBundleTemplate(record.templateId||record.bundle)
 const findings=record.findings||template.elements.filter(([id])=>record.answers?.[id]==='no').map(([id,label])=>({id,label,note:record.answerNotes?.[id]||''}))
 return <div className="bundle-record-view">
  <section className="bundle-record-summary">
   <div className="bundle-record-heading"><div><span>BUNDLE EXECUTION</span><strong>{record.templateName||template.name} · {record.templateTitle||template.title}</strong><small>{record.templateSource||template.source} · template v{record.templateVersion||template.version}</small></div><span className={`bundle-all-badge ${record.allOrNone?'passed':'failed'}`}>{record.allOrNone?'All-or-none ✓':'All-or-none ✕'}</span></div>
   <div className="bundle-record-kpis"><div><span>Score</span><strong>{record.score}%</strong></div><div><span>Εφαρμόσιμα</span><strong>{record.applicableCount??'—'}</strong></div><div><span>Αποκλίσεις</span><strong>{record.failedCount??findings.length}</strong></div><div><span>Ημερομηνία</span><strong>{record.date||record.period||'—'}</strong></div></div>
   <div className="bundle-record-meta"><span><b>Τμήμα</b>{record.departmentEl||'—'}</span><span><b>Βάρδια</b>{record.shift||'—'}</span><span><b>Ασθενής</b>{record.patientRef||'—'}</span><span><b>Συσκευή</b>{record.deviceRef||'—'}</span><span><b>Υπεύθυνος</b>{record.owner||record.createdBy||'—'}</span></div>
  </section>
  <section className="bundle-record-elements">
   <div className="bundle-record-heading"><div><span>ΣΤΟΙΧΕΙΑ</span><strong>Αποτελέσματα Bundle</strong></div></div>
   <div className="bundle-detail-list">{template.elements.map(([id,label],i)=>{const value=record.answers?.[id];return <div className={`bundle-detail-row ${value==='no'?'failed':value==='yes'?'passed':'na'}`} key={id}><span className="bundle-detail-index">{i+1}</span><strong>{label}</strong><span className="bundle-detail-answer">{value==='yes'?'Ναι':value==='no'?'Όχι':value==='na'?'Μ/Ε':'—'}</span>{value==='no'&&record.answerNotes?.[id]&&<small>{record.answerNotes[id]}</small>}</div>})}</div>
  </section>
  {findings.length>0&&<section className="bundle-record-findings"><div className="bundle-record-heading"><div><span>ΑΠΟΚΛΙΣΕΙΣ</span><strong>Σημεία για follow-up</strong></div></div>{findings.map(x=><div className="bundle-record-finding" key={x.id}><strong>{x.label}</strong><span>{x.note||'Απαιτείται διερεύνηση / διορθωτική ενέργεια.'}</span></div>)}</section>}
  {record.generalNotes&&<div className="record-note-card"><span>ΣΗΜΕΙΩΣΕΙΣ</span><p>{record.generalNotes}</p></div>}
 </div>
}
function D({l,v}){return <div className="detail-item"><span>{l}</span><strong>{v}</strong></div>}
