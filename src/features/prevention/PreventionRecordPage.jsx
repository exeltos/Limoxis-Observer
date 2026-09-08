import { useEffect,useState } from 'react'
import { ClipboardCheck,Droplets,History,Pencil,Recycle,ShieldCheck,Trash2 } from 'lucide-react'
import { useNavigate,useParams } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { ActionButton } from '../../design-system/ActionButton'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { WHO_MOMENTS } from './WhoHandHygieneModal'
import { deleteHandHygieneSession,loadHandHygieneSessions } from './handHygieneCloudService'
import { deleteWasteMeasurement,loadWasteMeasurements } from './wasteCloudService'
import { deleteAntisepticRecord,loadAntisepticRecords } from './antisepticCloudService'
import { deleteBundleAssessment,loadBundleAssessments } from './bundleCloudService'
import { useTenant } from '../../core/tenant/TenantContext'
import { useRecordSequenceNavigation } from '../../core/navigation/useRecordSequenceNavigation'
import { wasteCategoryTone } from './wasteVisuals'
import { antisepticMethodLabel,isAbhrProduct } from './AntisepticEntryModal'
import { PrintExportActions } from '../../design-system/PrintExportActions'
import { downloadRecordJson } from '../../core/export/recordExport'

const icons={handHygiene:ShieldCheck,waste:Recycle,antiseptics:Droplets,bundles:ClipboardCheck}
const labels={handHygiene:['Υγιεινή Χεριών','Hand Hygiene'],waste:['Απόβλητα','Waste'],antiseptics:['Κατανάλωση αντισηπτικών','Antiseptic consumption'],bundles:['Bundles πρόληψης','Prevention Bundles']}
const loaders={handHygiene:loadHandHygieneSessions,waste:loadWasteMeasurements,antiseptics:loadAntisepticRecords,bundles:loadBundleAssessments}
const deleters={handHygiene:deleteHandHygieneSession,waste:deleteWasteMeasurement,antiseptics:deleteAntisepticRecord,bundles:deleteBundleAssessment}

export function PreventionRecordPage(){
 const {recordType,recordId}=useParams()
 const navigate=useNavigate()
 const {locale,t,language}=useLanguage()
 const en=language==='en'
 const {notifyError,notify,confirm}=useFeedback()
 const {canAccessRecord,tenant}=useTenant()
 const [record,setRecord]=useState(null)
 const [loading,setLoading]=useState(true)
 const [activeTab,setActiveTab]=useState('details')
 const recordNavigation=useRecordSequenceNavigation({registry:`prevention-${recordType}`,currentId:recordId,pathForId:id=>`/prevention/${recordType}/${id}?fromTab=${recordType}`})

 useEffect(()=>{
  const loader=loaders[recordType]
  if(!loader||!tenant?.id){setRecord(null);setLoading(false);return}
  let active=true
  setLoading(true)
  loader(tenant.id)
   .then(rows=>{if(active)setRecord(rows.find(x=>x.id===recordId)||null)})
   .catch(error=>{if(active){setRecord(null);notifyError(error,'load',{operation:`${recordType}_record_load`})}})
   .finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[recordType,recordId,tenant?.id])

 const recordInScope=!record||canAccessRecord({...record,department:record.departmentEl||record.department})
 if(loading)return <Page title={en?'Prevention Center':'Κέντρο Πρόληψης'}><div className="inline-empty">{en?'Loading record…':'Φόρτωση εγγραφής…'}</div></Page>
 if(!record)return <Page title={en?'Prevention Center':'Κέντρο Πρόληψης'}><div className="inline-empty">{en?'Record not found.':'Δεν βρέθηκε η εγγραφή.'}</div></Page>
 if(!recordInScope)return <Page title={en?'Prevention Center':'Κέντρο Πρόληψης'}><div className="inline-empty">{en?'You do not have access to this record.':'Δεν έχετε πρόσβαση σε αυτή την εγγραφή.'}</div></Page>

 const Icon=icons[recordType]||ShieldCheck
 const fmtDate=v=>v?new Intl.DateTimeFormat(locale).format(new Date(`${v}T12:00:00`)):'—'
 const isWaste=recordType==='waste'
 const isAntiseptic=recordType==='antiseptics'
 const wasteCategory=record.wasteType||record.type
 const recordTitle=recordType==='handHygiene'?`${en?'WHO hand hygiene observation':'Παρατήρηση Υγιεινής Χεριών WHO'} · ${fmtDate(record.date)}`:isWaste?`${en?'Waste measurement':'Μέτρηση αποβλήτων'} · ${fmtDate(record.date)}`:isAntiseptic?`${en?'Antiseptic consumption':'Κατανάλωση αντισηπτικού'} · ${record.period||''}`:`${record.templateName||record.bundle} · ${record.date||record.period||''}`
 const recordStatus=isWaste?<span className={`waste-category-badge ${wasteCategoryTone(wasteCategory)}`}>{en?(record.typeEn||wasteCategory):wasteCategory}</span>:isAntiseptic?<span className={`antiseptic-abhr-badge ${record.indicatorEligible!==false&&isAbhrProduct(`${record.product} ${record.productEn||''}`)?'active':'informative'}`}>{record.indicatorEligible!==false&&isAbhrProduct(`${record.product} ${record.productEn||''}`)?(en?'ABHR · included in indicator':'ABHR · στον δείκτη'):(en?'Outside ABHR indicator':'Εκτός δείκτη ABHR')}</span>:recordType==='bundles'?<span className={`bundle-all-badge ${record.allOrNone?'passed':'failed'}`}>{record.allOrNone?'All-or-none ✓':'All-or-none ✕'}</span>:null
 const tabs=[{id:'details',label:en?'Details':'Στοιχεία',icon:Icon},{id:'history',label:en?'History':'Ιστορικό',icon:History}]

 async function deleteCurrent(){
  const ok=await confirm({title:en?'Delete record':'Διαγραφή εγγραφής',message:en?'The record will be permanently deleted. Continue?':'Η εγγραφή θα διαγραφεί οριστικά. Θέλετε να συνεχίσετε;',confirmLabel:en?'Delete':'Διαγραφή',danger:true})
  if(!ok)return
  try{
   await deleters[recordType]?.(tenant.id,record.id)
   notify(en?'Record deleted.':'Η εγγραφή διαγράφηκε.','success')
   navigate(`/prevention?tab=${recordType}`,{replace:true})
  }catch(error){notifyError(error,'delete',{operation:`${recordType}_record_delete`})}
 }

 return <Page fill><EntityRecordShell className="prevention-record-shell workspace-fill" avatar={<Icon size={19}/>} title={recordTitle} status={recordStatus} recordNavigation={recordNavigation} headerActions={<><PrintExportActions onExport={()=>downloadRecordJson(record,{filename:record.id})}/><ActionButton label={en?'Delete':'Διαγραφή'} tone="danger" onClick={deleteCurrent}><Trash2 size={16}/><span>{en?'Delete':'Διαγραφή'}</span></ActionButton></>} tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
   {activeTab==='details'?<div className="record-section prevention-record-card">{recordType==='handHygiene'?<HandHygieneDetails record={record} fmtDate={fmtDate} language={language}/>:recordType==='waste'?<WasteDetails record={record} fmtDate={fmtDate} language={language} locale={locale}/>:recordType==='antiseptics'?<AntisepticDetails record={record} language={language} locale={locale}/>:<BundleDetails record={record} t={t} language={language}/>}</div>:<RecordHistory record={record} language={language} locale={locale}/>} 
  </EntityRecordShell></Page>
}

function RecordHistory({record,language,locale}){
 const en=language==='en'
 const fmt=v=>v?new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'—'
 return <div className="record-section"><h3>{en?'History':'Ιστορικό'}</h3><div className="detail-grid quality-detail-grid"><D l={en?'Created':'Δημιουργήθηκε'} v={fmt(record.createdAt)}/><D l={en?'Last updated':'Τελευταία ενημέρωση'} v={fmt(record.updatedAt)}/><D l={en?'Department':'Τμήμα'} v={record.departmentEl||'—'}/><D l={en?'Record type':'Τύπος εγγραφής'} v={en?'Prevention record':'Καταγραφή πρόληψης'}/></div></div>
}

function HandHygieneDetails({record,fmtDate,language}){
 const en=language==='en'
 const stats=record.whoStats||{opportunities:record.whoObservations?.length||record.observations||0,compliant:(record.whoObservations||[]).filter(x=>x.action==='HR'||x.action==='HW').length||record.compliant||0,compliance:record.rate||0,handRub:(record.whoObservations||[]).filter(x=>x.action==='HR').length,handWash:(record.whoObservations||[]).filter(x=>x.action==='HW').length,missed:(record.whoObservations||[]).filter(x=>x.action==='MISSED').length,professionals:(record.whoObservations||[]).reduce((sum,x)=>sum+(Number(x.professionalsCount)||1),0)}
 return <><section className="record-info-card"><h3>{en?'Session details':'Στοιχεία συνεδρίας'}</h3><div className="detail-grid quality-detail-grid"><D l={en?'Date':'Ημερομηνία'} v={fmtDate(record.date)}/><D l={en?'Department':'Τμήμα'} v={record.departmentEl}/><D l={en?'Observer':'Παρατηρητής'} v={record.observer}/><D l={en?'Time':'Ώρα'} v={`${record.session?.startTime||'—'} – ${record.session?.endTime||'—'}`}/></div></section><section className="record-info-card"><h3>{en?'Compliance summary':'Σύνοψη συμμόρφωσης'}</h3><div className="who-live-summary record-who-summary"><div><span>{en?'Opportunities':'Ευκαιρίες'}</span><strong>{stats.opportunities}</strong></div><div><span>{en?'Professionals':'Επαγγελματίες'}</span><strong>{stats.professionals||'—'}</strong></div><div><span>HR</span><strong>{stats.handRub||0}</strong></div><div><span>HW</span><strong>{stats.handWash||0}</strong></div><div><span>Missed</span><strong>{stats.missed||0}</strong></div><div className="who-compliance"><span>{en?'Compliance':'Συμμόρφωση'}</span><strong>{stats.compliance}%</strong></div></div></section><section className="record-info-card"><h3>{en?'Observed opportunities':'Καταγεγραμμένες ευκαιρίες'}</h3><div className="scroll-table"><table className="data-table sticky-table"><thead><tr><th>#</th><th>{en?'Professionals':'Επαγγελματίες'}</th><th>{en?'Category':'Κατηγορία'}</th><th>WHO Moment</th><th>{en?'Action':'Ενέργεια'}</th><th>{en?'Gloves':'Γάντια'}</th><th>{en?'Note':'Σημείωση'}</th></tr></thead><tbody>{(record.whoObservations||[]).map((x,i)=><tr key={x.id}><td>{i+1}</td><td><strong>{x.professionalsCount||1}</strong></td><td>{x.professionalCategory}</td><td>{(en?WHO_MOMENTS.find(m=>m.id===x.moment)?.labelEn:WHO_MOMENTS.find(m=>m.id===x.moment)?.label)||x.moment}</td><td><span className={`status-badge ${x.action==='MISSED'?'danger':'active'}`}>{x.action}</span></td><td>{x.gloves?(en?'Yes':'Ναι'):(en?'No':'Όχι')}</td><td>{x.notes||'—'}</td></tr>)}</tbody></table></div></section></>
}

function WasteDetails({record,fmtDate,language,locale}){
 const en=language==='en';const category=en?(record.typeEn||record.wasteType||record.type):(record.wasteType||record.type)
 return <div className="waste-record-view"><section className="waste-record-primary"><div className="waste-record-section-heading"><div><strong>{en?'Record details':'Στοιχεία καταγραφής'}</strong></div><span className={`waste-category-badge ${wasteCategoryTone(record.wasteType||record.type)}`}>{category}</span></div><div className="waste-record-measurements"><div><span>{en?'Weight':'Βάρος'}</span><strong>{Number(record.weight).toLocaleString(locale)} <small>kg</small></strong></div><div><span>{en?'Containers':'Περιέκτες'}</span><strong>{record.containers}</strong></div><div><span>{en?'Patient-days':'Νοσηλευτικές ημέρες'}</span><strong>{record.patientDays||'—'}</strong></div><div className="waste-record-indicator"><span>{en?'Indicator':'Δείκτης'}</span><strong>{record.indicator!=null?Number(record.indicator).toLocaleString(locale):'—'}</strong><small>{en?'kg / 1,000 patient-days':'kg / 1.000 νοσηλευτικές ημέρες'}</small></div></div><div className="waste-record-meta-line"><span><b>{en?'Date':'Ημερομηνία'}</b>{fmtDate(record.date)}</span><span><b>{en?'Department':'Τμήμα'}</b>{record.departmentEl}</span><span><b>{en?'Responsible':'Υπεύθυνος'}</b>{record.responsible||'—'}</span></div></section><section className="waste-record-trace"><div className="waste-record-section-heading"><div><strong>{en?'Document & collection':'Παραστατικό & συλλογή'}</strong></div></div><div className="waste-trace-grid"><div><span>{en?'Document number':'Αριθμός παραστατικού'}</span><strong>{record.documentNumber||'—'}</strong></div><div><span>{en?'Collection company':'Εταιρεία συλλογής'}</span><strong>{record.collectionCompany||'—'}</strong></div>{record.patientDaysSource==='library'&&<div><span>{en?'Patient-days source':'Πηγή νοσηλευτικών ημερών'}</span><strong>{en?'Library':'Βιβλιοθήκη'}</strong></div>}</div></section>{record.notes&&<div className="record-note-card"><p>{record.notes}</p></div>}</div>
}

function AntisepticDetails({record,language,locale}){
 const en=language==='en';const eligible=record.indicatorEligible!==false&&isAbhrProduct(`${record.product} ${record.productEn||''}`)
 return <div className="antiseptic-record-view"><section className="antiseptic-record-primary"><div className="antiseptic-record-heading"><div><strong>{en?'Period details':'Στοιχεία περιόδου'}</strong></div><span className={`antiseptic-abhr-badge ${eligible?'active':'informative'}`}>{eligible?(en?'ABHR · Indicator active':'ABHR · Δείκτης ενεργός'):(en?'Outside ABHR indicator':'Εκτός δείκτη ABHR')}</span></div><div className="antiseptic-record-measurements"><div><span>{en?'Consumption':'Κατανάλωση'}</span><strong>{Number(record.litres).toLocaleString(locale)} <small>L</small></strong></div><div><span>{en?'Patient-days':'Νοσηλευτικές ημέρες'}</span><strong>{record.patientDays||'—'}</strong>{record.patientDaysSource==='library'&&<small>{en?'from Library':'από Βιβλιοθήκη'}</small>}</div><div className="antiseptic-record-indicator"><span>{en?'ABHR indicator':'Δείκτης ABHR'}</span><strong>{record.indicator!=null?Number(record.indicator).toLocaleString(locale):'—'}</strong><small>{en?'L / 1,000 patient-days':'L / 1.000 νοσηλευτικές ημέρες'}</small></div></div><div className="antiseptic-record-meta-line"><span><b>{en?'Period':'Περίοδος'}</b>{record.period||'—'}</span><span><b>{en?'Department':'Τμήμα'}</b>{record.departmentEl||'—'}</span><span><b>{en?'Product':'Προϊόν'}</b>{en?(record.productEn||record.product):record.product}</span></div></section><section className="antiseptic-record-trace"><div className="antiseptic-record-heading"><div><strong>{en?'Data source & traceability':'Πηγή δεδομένων & ιχνηλασιμότητα'}</strong></div></div><div className="antiseptic-trace-grid"><div><span>{en?'Source / method':'Πηγή / μέθοδος'}</span><strong>{antisepticMethodLabel(record.method,language)}</strong></div><div><span>{en?'Reference / document':'Αναφορά / παραστατικό'}</span><strong>{record.referenceNumber||'—'}</strong></div><div><span>{en?'Responsible':'Υπεύθυνος'}</span><strong>{record.responsible||'—'}</strong></div></div><div className="antiseptic-governance-note"><strong>{eligible?(en?'Prevention indicator':'Δείκτης πρόληψης'):(en?'Consumption monitoring':'Παρακολούθηση κατανάλωσης')}</strong><span>{eligible?(en?'The value can be compared by period and department and correlated with hand-hygiene compliance.':'Η τιμή μπορεί να χρησιμοποιηθεί σε συγκρίσεις ανά περίοδο/τμήμα και σε συσχέτιση με τη συμμόρφωση Υγιεινής Χεριών.'):(en?'The value remains available for operational monitoring without being mixed into the ABHR indicator.':'Η τιμή παραμένει διαθέσιμη για λειτουργική παρακολούθηση, χωρίς να αναμιγνύεται με τον δείκτη ABHR.')}</span></div></section>{record.notes&&<div className="record-note-card"><p>{record.notes}</p></div>}</div>
}

function BundleDetails({record,language}){
 const en=language==='en';const template=record.templateSnapshot||{};const elements=template.elements||[];const findings=record.findings||elements.filter(([id])=>record.answers?.[id]==='no').map(([id,label])=>({id,label,note:record.answerNotes?.[id]||''}))
 return <div className="bundle-record-view"><section className="bundle-record-summary"><div className="bundle-record-heading"><div><strong>{record.templateName||template.name||record.bundle} · {record.templateTitle||template.title||''}</strong><small>{record.templateSource||template.source||''} · template v{record.templateVersion||template.version||'1.0'}</small></div><span className={`bundle-all-badge ${record.allOrNone?'passed':'failed'}`}>{record.allOrNone?'All-or-none ✓':'All-or-none ✕'}</span></div><div className="bundle-record-kpis"><div><span>Score</span><strong>{record.score==null?'—':`${record.score}%`}</strong></div><div><span>{en?'Applicable':'Εφαρμόσιμα'}</span><strong>{record.applicableCount??'—'}</strong></div><div><span>{en?'Deviations':'Αποκλίσεις'}</span><strong>{record.failedCount??findings.length}</strong></div><div><span>{en?'Date':'Ημερομηνία'}</span><strong>{record.date||record.period||'—'}</strong></div></div><div className="bundle-record-meta"><span><b>{en?'Department':'Τμήμα'}</b>{record.departmentEl||'—'}</span><span><b>{en?'Shift':'Βάρδια'}</b>{record.shift||'—'}</span><span><b>{en?'Patient':'Ασθενής'}</b>{record.patientRef||'—'}</span><span><b>{en?'Device':'Συσκευή'}</b>{record.deviceRef||'—'}</span><span><b>{en?'Responsible':'Υπεύθυνος'}</b>{record.owner||'—'}</span></div></section><section className="bundle-record-elements"><div className="bundle-record-heading"><div><strong>{en?'Bundle results':'Αποτελέσματα Bundle'}</strong></div></div><div className="bundle-detail-list">{elements.map(([id,label],i)=>{const value=record.answers?.[id];return <div className={`bundle-detail-row ${value==='no'?'failed':value==='yes'?'passed':'na'}`} key={id}><span className="bundle-detail-index">{i+1}</span><strong>{label}</strong><span className="bundle-detail-answer">{value==='yes'?(en?'Yes':'Ναι'):value==='no'?(en?'No':'Όχι'):value==='na'?(en?'N/A':'Μ/Ε'):'—'}</span>{value==='no'&&record.answerNotes?.[id]&&<small>{record.answerNotes[id]}</small>}</div>})}</div></section>{findings.length>0&&<section className="bundle-record-findings"><div className="bundle-record-heading"><div><strong>{en?'Items for follow-up':'Σημεία για follow-up'}</strong></div></div>{findings.map(x=><div className="bundle-record-finding" key={x.id}><strong>{x.label}</strong><span>{x.note||(en?'Investigation / corrective action required.':'Απαιτείται διερεύνηση / διορθωτική ενέργεια.')}</span></div>)}</section>}{record.generalNotes&&<div className="record-note-card"><p>{record.generalNotes}</p></div>}</div>
}
function D({l,v}){return <div className="detail-item"><span>{l}</span><strong>{v}</strong></div>}
