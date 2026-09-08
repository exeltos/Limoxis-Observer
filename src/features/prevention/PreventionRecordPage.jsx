import { useEffect,useState } from 'react'
import { ClipboardCheck,Droplets,Pencil,Recycle,ShieldCheck,Trash2 } from 'lucide-react'
import { useNavigate,useParams,useSearchParams } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { ActionButton } from '../../design-system/ActionButton'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { WHO_MOMENTS,WHO_PROFESSIONS,WhoHandHygieneEditor } from './WhoHandHygieneEditor'
import { WasteEntryEditor } from './WasteEntryEditor'
import { deleteHandHygieneSession,loadHandHygieneDepartments,loadHandHygieneSessions,saveHandHygieneSession } from './handHygieneCloudService'
import { deleteWasteMeasurement,findWastePatientDays,loadWasteMeasurements,loadWasteSupportData,saveWasteMeasurement } from './wasteCloudService'
import { deleteAntisepticRecord,loadAntisepticRecords } from './antisepticCloudService'
import { deleteBundleAssessment,loadBundleAssessments } from './bundleCloudService'
import { useTenant } from '../../core/tenant/TenantContext'
import { useRecordSequenceNavigation } from '../../core/navigation/useRecordSequenceNavigation'
import { wasteCategoryTone } from './wasteVisuals'
import { antisepticMethodLabel,isAbhrProduct } from './AntisepticEntryModal'
import { PrintExportActions } from '../../design-system/PrintExportActions'
import { downloadRecordJson } from '../../core/export/recordExport'
import { CAPABILITIES,ROLES,can } from '../../core/permissions/roles'

const icons={handHygiene:ShieldCheck,waste:Recycle,antiseptics:Droplets,bundles:ClipboardCheck}
const loaders={handHygiene:loadHandHygieneSessions,waste:loadWasteMeasurements,antiseptics:loadAntisepticRecords,bundles:loadBundleAssessments}
const deleters={handHygiene:deleteHandHygieneSession,waste:deleteWasteMeasurement,antiseptics:deleteAntisepticRecord,bundles:deleteBundleAssessment}
const editCapabilities={handHygiene:CAPABILITIES.RECORD_HAND_HYGIENE,waste:CAPABILITIES.RECORD_WASTE,antiseptics:CAPABILITIES.RECORD_ANTISEPTIC,bundles:CAPABILITIES.RECORD_PREVENTION_BUNDLE}

export function PreventionRecordPage(){
 const {recordType,recordId}=useParams()
 const navigate=useNavigate()
 const [searchParams]=useSearchParams()
 const {locale,language}=useLanguage()
 const en=language==='en'
 const {notifyError,notify,confirm}=useFeedback()
 const {canAccessRecord,tenant,role,membership}=useTenant()
 const supportsPageEditor=['handHygiene','waste'].includes(recordType)
 const creating=supportsPageEditor&&recordId==='new'
 const editing=supportsPageEditor&&!creating&&searchParams.get('edit')==='1'
 const [record,setRecord]=useState(null)
 const [loading,setLoading]=useState(!creating)
 const [handDepartments,setHandDepartments]=useState([])
 const [wasteSupport,setWasteSupport]=useState({departments:[],wasteTypes:[]})
 const recordNavigation=useRecordSequenceNavigation({registry:`prevention-${recordType}`,currentId:recordId,pathForId:id=>`/prevention/${recordType}/${id}?fromTab=${recordType}`})
 const addOns=membership?.capabilities??[]
 const custom=membership?.customCapabilities??[]
 const ownDepartment=membership?.previewDepartment||membership?.departmentName||membership?.department||''
 const departmentScoped=[ROLES.DEPARTMENT_MANAGER,ROLES.DEPARTMENT_USER,ROLES.LINK_NURSE].includes(role)
 const canEditRecord=role!==ROLES.HOSPITAL_ADMIN&&can(role,editCapabilities[recordType],addOns,custom)

 useEffect(()=>{
  if(creating){setLoading(false);setRecord(null);return}
  const loader=loaders[recordType]
  if(!loader||!tenant?.id){setRecord(null);setLoading(false);return}
  let active=true
  setLoading(true)
  loader(tenant.id)
   .then(rows=>{if(active)setRecord(rows.find(row=>row.id===recordId)||null)})
   .catch(error=>{if(active){setRecord(null);notifyError(error,'load',{operation:`${recordType}_record_load`})}})
   .finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[creating,editing,recordType,recordId,tenant?.id])

 useEffect(()=>{
  if(!tenant?.id)return
  let active=true
  if(recordType==='handHygiene'){
   loadHandHygieneDepartments(tenant.id).then(rows=>{if(active)setHandDepartments(rows)}).catch(error=>notifyError(error,'load',{operation:'hand_hygiene_departments_load'}))
  }
  if(recordType==='waste'){
   loadWasteSupportData(tenant.id).then(data=>{if(active)setWasteSupport(data)}).catch(error=>notifyError(error,'load',{operation:'waste_support_load'}))
  }
  return()=>{active=false}
 },[recordType,tenant?.id])

 const recordInScope=creating||!record||canAccessRecord({...record,department:record.departmentEl||record.department})
 if(loading)return <Page title={en?'Prevention Center':'Κέντρο Πρόληψης'}><div className="inline-empty">{en?'Loading record…':'Φόρτωση εγγραφής…'}</div></Page>
 if(!creating&&!record)return <Page title={en?'Prevention Center':'Κέντρο Πρόληψης'}><div className="inline-empty">{en?'Record not found.':'Δεν βρέθηκε η εγγραφή.'}</div></Page>
 if(!recordInScope)return <Page title={en?'Prevention Center':'Κέντρο Πρόληψης'}><div className="inline-empty">{en?'You do not have access to this record.':'Δεν έχετε πρόσβαση σε αυτή την εγγραφή.'}</div></Page>

 const Icon=icons[recordType]||ShieldCheck
 const fmtDate=value=>value?new Intl.DateTimeFormat(locale).format(new Date(`${value}T12:00:00`)):'—'
 const wasteCategory=record?.wasteType||record?.type
 const recordTitle=creating
  ? recordType==='waste'?(en?'New waste measurement':'Νέα μέτρηση αποβλήτων'):(en?'New WHO hand hygiene observation':'Νέα παρατήρηση Υγιεινής Χεριών WHO')
  : editing
   ? recordType==='waste'?`${en?'Edit waste measurement':'Επεξεργασία μέτρησης αποβλήτων'} · ${fmtDate(record?.date)}`:`${en?'Edit WHO hand hygiene observation':'Επεξεργασία παρατήρησης Υγιεινής Χεριών WHO'} · ${fmtDate(record?.date)}`
   : recordType==='handHygiene'?`${en?'WHO hand hygiene observation':'Παρατήρηση Υγιεινής Χεριών WHO'} · ${fmtDate(record?.date)}`
   : recordType==='waste'?`${en?'Waste measurement':'Μέτρηση αποβλήτων'} · ${fmtDate(record?.date)}`
   : recordType==='antiseptics'?`${en?'Antiseptic consumption':'Κατανάλωση αντισηπτικού'} · ${record?.period||''}`
   : `${record?.templateName||record?.bundle} · ${record?.date||record?.period||''}`
 const subtitle=recordType==='handHygiene'?(en?'WHO 5 Moments · Prevention & Infection Control':'WHO 5 Moments · Πρόληψη & Έλεγχος Λοιμώξεων'):recordType==='waste'?(en?'Waste management · Prevention & Infection Control':'Διαχείριση αποβλήτων · Πρόληψη & Έλεγχος Λοιμώξεων'):undefined
 const recordStatus=!record?null:recordType==='waste'?<span className={`waste-category-badge ${wasteCategoryTone(wasteCategory)}`}>{en?(record.typeEn||wasteCategory):wasteCategory}</span>:recordType==='antiseptics'?<span className={`antiseptic-abhr-badge ${record.indicatorEligible!==false&&isAbhrProduct(record)?'active':'informative'}`}>{record.indicatorEligible!==false&&isAbhrProduct(record)?(en?'ABHR · included in indicator':'ABHR · στον δείκτη'):(en?'Outside ABHR indicator':'Εκτός δείκτη ABHR')}</span>:recordType==='bundles'?<span className={`bundle-all-badge ${record.allOrNone?'passed':'failed'}`}>{record.allOrNone?'All-or-none ✓':'All-or-none ✕'}</span>:null

 async function saveHandHygiene(updated){
  try{
   const saved=await saveHandHygieneSession(tenant.id,updated,{existingId:creating?null:record.id})
   if(saved)setRecord(saved)
   notify(creating?(en?'Observation saved.':'Η παρατήρηση αποθηκεύτηκε.'):(en?'Changes saved.':'Οι αλλαγές αποθηκεύτηκαν.'),'success')
   navigate(saved?.id?`/prevention/handHygiene/${saved.id}?fromTab=handHygiene`:'/prevention?tab=handHygiene',{replace:true})
  }catch(error){notifyError(error,'save',{operation:creating?'hand_hygiene_create':'hand_hygiene_record_update'});throw error}
 }
 async function saveWaste(updated){
  try{
   const saved=await saveWasteMeasurement(tenant.id,updated,{existingId:creating?null:record.id})
   if(saved)setRecord(saved)
   notify(creating?(en?'Waste measurement saved.':'Η μέτρηση αποβλήτων αποθηκεύτηκε.'):(en?'Changes saved.':'Οι αλλαγές αποθηκεύτηκαν.'),'success')
   navigate(saved?.id?`/prevention/waste/${saved.id}?fromTab=waste`:'/prevention?tab=waste',{replace:true})
  }catch(error){notifyError(error,'save',{operation:creating?'waste_create':'waste_record_update'});throw error}
 }

 async function deleteCurrent(){
  const ok=await confirm({title:en?'Delete record':'Διαγραφή εγγραφής',message:en?'The record will be permanently deleted. Continue?':'Η εγγραφή θα διαγραφεί οριστικά. Θέλετε να συνεχίσετε;',confirmLabel:en?'Delete':'Διαγραφή',danger:true})
  if(!ok)return
  try{
   await deleters[recordType]?.(tenant.id,record.id)
   notify(en?'Record deleted.':'Η εγγραφή διαγράφηκε.','success')
   navigate(`/prevention?tab=${recordType}`,{replace:true})
  }catch(error){notifyError(error,'delete',{operation:`${recordType}_record_delete`})}
 }

 const recordActions=!creating&&!editing?<>
  <PrintExportActions onExport={()=>downloadRecordJson(record,{filename:record.id})}/>
  {canEditRecord&&supportsPageEditor&&<ActionButton label={en?'Edit':'Επεξεργασία'} tone="edit" onClick={()=>navigate(`/prevention/${recordType}/${record.id}?edit=1`)}><Pencil size={16}/><span>{en?'Edit':'Επεξεργασία'}</span></ActionButton>}
  <ActionButton label={en?'Delete':'Διαγραφή'} tone="danger" onClick={deleteCurrent}><Trash2 size={16}/><span>{en?'Delete':'Διαγραφή'}</span></ActionButton>
 </>:null
 const backToList=()=>navigate(`/prevention?tab=${recordType}`)
 const backToRecord=()=>navigate(`/prevention/${recordType}/${record.id}?fromTab=${recordType}`)

 return <Page fill>
  <EntityRecordShell
   className="prevention-record-shell workspace-fill"
   avatar={<Icon size={19}/>} title={recordTitle} subtitle={subtitle} status={recordStatus}
   recordNavigation={creating||editing?null:recordNavigation}
   headerActions={recordActions}
   tabs={[]}
   onBack={creating?backToList:editing?backToRecord:undefined}
  >
   {(creating||editing)
    ? <div className="record-section prevention-record-card prevention-page-editor-card">{recordType==='handHygiene'?<WhoHandHygieneEditor departments={handDepartments} initialRecord={editing?record:null} fixedDepartment={departmentScoped?ownDepartment:''} onCancel={creating?backToList:backToRecord} onSave={saveHandHygiene}/>:<WasteEntryEditor departments={wasteSupport.departments} wasteTypes={wasteSupport.wasteTypes} initialRecord={editing?record:null} fixedDepartment={departmentScoped?ownDepartment:''} findPatientDays={(departmentId,date)=>findWastePatientDays(tenant.id,departmentId,date)} onCancel={creating?backToList:backToRecord} onSave={saveWaste}/>}</div>
    : <div className="record-section prevention-record-card">{recordType==='handHygiene'?<HandHygieneDetails record={record} language={language}/>:recordType==='waste'?<WasteDetails record={record} fmtDate={fmtDate} language={language} locale={locale}/>:recordType==='antiseptics'?<AntisepticDetails record={record} language={language} locale={locale}/>:<BundleDetails record={record} language={language}/>}</div>
   }
  </EntityRecordShell>
 </Page>
}

function HandHygieneDetails({record,language}){
 const en=language==='en'
 const items=record.whoObservations||[]
 const stats=record.whoStats||{opportunities:record.observations||0,compliant:record.compliant||0,compliance:record.rate||0,handRub:items.filter(item=>item.action==='HR').length,handWash:items.filter(item=>item.action==='HW').length,missed:items.filter(item=>item.action==='MISSED').length,professionals:items.reduce((sum,item)=>sum+(Number(item.professionalsCount)||1),0)}
 const session=record.session||{}
 return <div className="who-record-workspace who-record-mirrors-entry">
  <section className="who-session-grid who-record-readonly-grid">
   <label><span>{en?'Date':'Ημερομηνία'}</span><input value={record.date||session.date||''} readOnly/></label>
   <label><span>{en?'Department':'Τμήμα'}</span><input value={record.departmentEl||session.department||'—'} readOnly/></label>
   <label><span>{en?'Observer':'Παρατηρητής'}</span><input value={record.observer||session.observer||'—'} readOnly/></label>
   <label><span>{en?'Start':'Έναρξη'}</span><input value={session.startTime||'—'} readOnly/></label>
   <label><span>{en?'End':'Λήξη'}</span><input value={session.endTime||'—'} readOnly/></label>
  </section>
  <section className="who-live-summary">
   <div><span>{en?'Opportunities':'Ευκαιρίες'}</span><strong>{stats.opportunities}</strong></div>
   <div><span>{en?'Professionals':'Επαγγελματίες'}</span><strong>{stats.professionals}</strong></div>
   <div><span>HR</span><strong>{stats.handRub||0}</strong></div>
   <div><span>HW</span><strong>{stats.handWash||0}</strong></div>
   <div><span>Missed</span><strong>{stats.missed||0}</strong></div>
   <div className="who-compliance"><span>{en?'Compliance':'Συμμόρφωση'}</span><strong>{stats.compliance}%</strong></div>
  </section>
  <div className="who-record-saved-list">{items.map((item,index)=><section className="who-opportunity-editor who-record-saved-opportunity" key={item.id||index}>
   <div className="who-section-title"><div><strong>{en?`Opportunity ${index+1}`:`Ευκαιρία ${index+1}`}</strong><small>{en?'Recorded hand-hygiene opportunity':'Καταγεγραμμένη ευκαιρία υγιεινής χεριών'}</small></div></div>
   <div className="who-opportunity-grid">
    <label><span>{en?'Number of professionals':'Αριθμός επαγγελματιών'}</span><input value={item.professionalsCount||1} readOnly/></label>
    <label><span>{en?'Professional category':'Επαγγελματική κατηγορία'}</span><select value={item.professionalCategory||''} disabled>{WHO_PROFESSIONS.map(([el,enLabel])=><option key={el} value={el}>{en?enLabel:el}</option>)}</select></label>
    <label className="who-span-2"><span>WHO Moment</span><select value={item.moment||''} disabled>{WHO_MOMENTS.map(option=><option key={option.id} value={option.id}>{en?option.labelEn:option.label}</option>)}</select></label>
    <div className="who-span-2 who-action-field"><span>{en?'Action':'Ενέργεια'}</span><div className="who-action-options" aria-readonly="true"><button type="button" tabIndex={-1} className={`who-action-option ${item.action==='HR'?'selected':''}`}><span className="who-action-check">{item.action==='HR'?'✓':''}</span><span><strong>{en?'Alcohol-based hand rub':'Αλκοολούχο αντισηπτικό'}</strong><small>Hand Rub (HR)</small></span></button><button type="button" tabIndex={-1} className={`who-action-option ${item.action==='HW'?'selected':''}`}><span className="who-action-check">{item.action==='HW'?'✓':''}</span><span><strong>{en?'Hand wash with soap & water':'Πλύσιμο με σαπούνι & νερό'}</strong><small>Hand Wash (HW)</small></span></button><button type="button" tabIndex={-1} className={`who-action-option ${item.action==='MISSED'?'selected danger':''}`}><span className="who-action-check">{item.action==='MISSED'?'✓':''}</span><span><strong>{en?'Not performed':'Δεν πραγματοποιήθηκε'}</strong><small>Missed</small></span></button></div></div>
    <label className="who-gloves-card who-readonly-choice"><input type="checkbox" checked={Boolean(item.gloves)} readOnly/><span><strong>{en?'Glove use':'Χρήση γαντιών'}</strong><small>Gloves</small></span></label>
    <label className="who-note-field"><span>{en?'Note':'Σημείωση'}</span><input value={item.notes||''} placeholder={en?'No note':'Χωρίς σημείωση'} readOnly/></label>
   </div>
  </section>)}</div>
 </div>
}

function WasteDetails({record,fmtDate,language,locale}){
 const en=language==='en';const category=en?(record.typeEn||record.wasteType||record.type):(record.wasteType||record.type)
 return <div className="waste-record-view"><section className="waste-record-primary"><div className="waste-record-section-heading"><div><strong>{en?'Record details':'Στοιχεία καταγραφής'}</strong></div><span className={`waste-category-badge ${wasteCategoryTone(record.wasteType||record.type)}`}>{category}</span></div><div className="waste-record-measurements"><div><span>{en?'Weight':'Βάρος'}</span><strong>{Number(record.weight).toLocaleString(locale)} <small>kg</small></strong></div><div><span>{en?'Containers':'Περιέκτες'}</span><strong>{record.containers}</strong></div><div><span>{en?'Patient-days':'Νοσηλευτικές ημέρες'}</span><strong>{record.patientDays||'—'}</strong></div><div className="waste-record-indicator"><span>{en?'Indicator':'Δείκτης'}</span><strong>{record.indicator!=null?Number(record.indicator).toLocaleString(locale):'—'}</strong><small>{en?'kg / 1,000 patient-days':'kg / 1.000 νοσηλευτικές ημέρες'}</small></div></div><div className="waste-record-meta-line"><span><b>{en?'Date':'Ημερομηνία'}</b>{fmtDate(record.date)}</span><span><b>{en?'Department':'Τμήμα'}</b>{record.departmentEl}</span><span><b>{en?'Responsible':'Υπεύθυνος'}</b>{record.responsible||'—'}</span></div></section><section className="waste-record-trace"><div className="waste-record-section-heading"><div><strong>{en?'Document & collection':'Παραστατικό & συλλογή'}</strong></div></div><div className="waste-trace-grid"><div><span>{en?'Document number':'Αριθμός παραστατικού'}</span><strong>{record.documentNumber||'—'}</strong></div><div><span>{en?'Collection company':'Εταιρεία συλλογής'}</span><strong>{record.collectionCompany||'—'}</strong></div>{record.patientDaysSource==='library'&&<div><span>{en?'Patient-days source':'Πηγή νοσηλευτικών ημερών'}</span><strong>{en?'Library':'Βιβλιοθήκη'}</strong></div>}</div></section>{record.notes&&<div className="record-note-card"><span>{en?'Notes':'Σημειώσεις'}</span><p>{record.notes}</p></div>}</div>
}

function AntisepticDetails({record,language,locale}){
 const en=language==='en';const eligible=record.indicatorEligible!==false&&isAbhrProduct(record)
 return <div className="antiseptic-record-view"><section className="antiseptic-record-primary"><div className="antiseptic-record-heading"><div><strong>{en?'Period details':'Στοιχεία περιόδου'}</strong></div><span className={`antiseptic-abhr-badge ${eligible?'active':'informative'}`}>{eligible?(en?'ABHR · Indicator active':'ABHR · Δείκτης ενεργός'):(en?'Outside ABHR indicator':'Εκτός δείκτη ABHR')}</span></div><div className="antiseptic-record-measurements"><div><span>{en?'Consumption':'Κατανάλωση'}</span><strong>{Number(record.litres).toLocaleString(locale)} <small>L</small></strong></div><div><span>{en?'Patient-days':'Νοσηλευτικές ημέρες'}</span><strong>{record.patientDays||'—'}</strong></div><div className="antiseptic-record-indicator"><span>{en?'ABHR indicator':'Δείκτης ABHR'}</span><strong>{record.indicator!=null?Number(record.indicator).toLocaleString(locale):'—'}</strong><small>{en?'L / 1,000 patient-days':'L / 1.000 νοσηλευτικές ημέρες'}</small></div></div><div className="antiseptic-record-meta-line"><span><b>{en?'Period':'Περίοδος'}</b>{record.period||'—'}</span><span><b>{en?'Department':'Τμήμα'}</b>{record.departmentEl||'—'}</span><span><b>{en?'Product':'Προϊόν'}</b>{en?(record.productEn||record.product):record.product}</span></div></section><section className="antiseptic-record-trace"><div className="antiseptic-record-heading"><div><strong>{en?'Data source & traceability':'Πηγή δεδομένων & ιχνηλασιμότητα'}</strong></div></div><div className="antiseptic-trace-grid"><div><span>{en?'Source / method':'Πηγή / μέθοδος'}</span><strong>{antisepticMethodLabel(record.method,language)}</strong></div><div><span>{en?'Reference / document':'Αναφορά / παραστατικό'}</span><strong>{record.referenceNumber||'—'}</strong></div><div><span>{en?'Responsible':'Υπεύθυνος'}</span><strong>{record.responsible||'—'}</strong></div></div></section>{record.notes&&<div className="record-note-card"><span>{en?'Notes':'Σημειώσεις'}</span><p>{record.notes}</p></div>}</div>
}

function BundleDetails({record,language}){
 const en=language==='en';const template=record.templateSnapshot||{};const elements=template.elements||[];const findings=record.findings||elements.filter(([id])=>record.answers?.[id]==='no').map(([id,label])=>({id,label,note:record.answerNotes?.[id]||''}))
 return <div className="bundle-record-view"><section className="bundle-record-summary"><div className="bundle-record-heading"><div><strong>{record.templateName||template.name||record.bundle} · {record.templateTitle||template.title||''}</strong><small>{record.templateSource||template.source||''} · v{record.templateVersion||template.version||'1.0'}</small></div><span className={`bundle-all-badge ${record.allOrNone?'passed':'failed'}`}>{record.allOrNone?'All-or-none ✓':'All-or-none ✕'}</span></div><div className="bundle-record-kpis"><div><span>Score</span><strong>{record.score==null?'—':`${record.score}%`}</strong></div><div><span>{en?'Applicable':'Εφαρμόσιμα'}</span><strong>{record.applicableCount??'—'}</strong></div><div><span>{en?'Deviations':'Αποκλίσεις'}</span><strong>{record.failedCount??findings.length}</strong></div><div><span>{en?'Date':'Ημερομηνία'}</span><strong>{record.date||record.period||'—'}</strong></div></div><div className="bundle-record-meta"><span><b>{en?'Department':'Τμήμα'}</b>{record.departmentEl||'—'}</span><span><b>{en?'Shift':'Βάρδια'}</b>{record.shift||'—'}</span><span><b>{en?'Patient':'Ασθενής'}</b>{record.patientRef||'—'}</span><span><b>{en?'Device':'Συσκευή'}</b>{record.deviceRef||'—'}</span><span><b>{en?'Responsible':'Υπεύθυνος'}</b>{record.owner||'—'}</span></div></section><section className="bundle-record-elements"><div className="bundle-record-heading"><div><strong>{en?'Bundle results':'Αποτελέσματα Bundle'}</strong></div></div><div className="bundle-detail-list">{elements.map(([id,label],index)=>{const value=record.answers?.[id];return <div className={`bundle-detail-row ${value==='no'?'failed':value==='yes'?'passed':'na'}`} key={id}><span className="bundle-detail-index">{index+1}</span><strong>{label}</strong><span className="bundle-detail-answer">{value==='yes'?(en?'Yes':'Ναι'):value==='no'?(en?'No':'Όχι'):value==='na'?(en?'N/A':'Μ/Ε'):'—'}</span>{value==='no'&&record.answerNotes?.[id]&&<small>{record.answerNotes[id]}</small>}</div>})}</div></section>{findings.length>0&&<section className="bundle-record-findings"><div className="bundle-record-heading"><div><strong>{en?'Items for follow-up':'Σημεία για follow-up'}</strong></div></div>{findings.map(item=><div className="bundle-record-finding" key={item.id}><strong>{item.label}</strong><span>{item.note||(en?'Investigation / corrective action required.':'Απαιτείται διερεύνηση / διορθωτική ενέργεια.')}</span></div>)}</section>}{record.generalNotes&&<div className="record-note-card"><span>{en?'Notes':'Σημειώσεις'}</span><p>{record.generalNotes}</p></div>}</div>
}
