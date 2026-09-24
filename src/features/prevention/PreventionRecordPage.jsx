import { useEffect,useState } from 'react'
import { ClipboardCheck,Droplets,Pencil,Recycle,ShieldCheck,Trash2 } from 'lucide-react'
import { useNavigate,useParams,useSearchParams } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { PrintExportActions } from '../../design-system/PrintExportActions'
import { downloadRecordJson } from '../../core/export/recordExport'
import { ActionButton } from '../../design-system/ActionButton'
import { Button } from '../../design-system/Button'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { WHO_MOMENTS,WHO_PROFESSIONS,WhoHandHygieneEditor } from './WhoHandHygieneEditor'
import { WasteEntryEditor } from './WasteEntryEditor'
import { AntisepticEntryEditor } from './AntisepticEntryEditor'
import { BundleExecutionEditor } from './BundleExecutionEditor'
import { BundleFollowUpDialog } from './BundleFollowUpDialog'
import { deleteHandHygieneSession,loadHandHygieneDepartments,loadHandHygieneSessions,saveHandHygieneSession } from './handHygieneCloudService'
import { deleteWasteMeasurement,findWastePatientDays,loadWasteMeasurements,loadWasteSupportData,saveWasteMeasurement } from './wasteCloudService'
import { deleteAntisepticRecord,findPatientDaysForPeriod,loadAntisepticRecords,loadAntisepticSupportData,saveAntisepticRecord } from './antisepticCloudService'
import { deleteBundleAssessment,loadBundleAssessments,loadBundleSupportData,saveBundleAssessment,saveBundleFollowUp } from './bundleCloudService'
import { useTenant } from '../../core/tenant/TenantContext'
import { useRecordSequenceNavigation } from '../../core/navigation/useRecordSequenceNavigation'
import { wasteCategoryTone } from './wasteVisuals'
import { antisepticMethodLabel,isAbhrProduct } from './AntisepticEntryModal'
import { CAPABILITIES,ROLES,can } from '../../core/permissions/roles'

const icons={handHygiene:ShieldCheck,waste:Recycle,antiseptics:Droplets,bundles:ClipboardCheck}
const loaders={handHygiene:loadHandHygieneSessions,waste:loadWasteMeasurements,antiseptics:loadAntisepticRecords,bundles:loadBundleAssessments}
const deleters={handHygiene:deleteHandHygieneSession,waste:deleteWasteMeasurement,antiseptics:deleteAntisepticRecord,bundles:deleteBundleAssessment}
const editCapabilities={handHygiene:CAPABILITIES.RECORD_HAND_HYGIENE,waste:CAPABILITIES.RECORD_WASTE,antiseptics:CAPABILITIES.RECORD_ANTISEPTIC,bundles:CAPABILITIES.RECORD_PREVENTION_BUNDLE}
const normalizeWhoMoments=item=>{
 const values=Array.isArray(item?.moments)?item.moments.filter(Boolean):[]
 if(values.length)return [...new Set(values)]
 return item?.moment?[item.moment]:[]
}
const observationWeight=item=>Math.max(1,Number(item?.professionalsCount)||1)

export function PreventionRecordPage(){
 const {recordType,recordId}=useParams()
 const navigate=useNavigate()
 const [searchParams]=useSearchParams()
 const {locale,language}=useLanguage()
 const en=language==='en'
 const {notifyError,notify,confirm}=useFeedback()
 const {canAccessRecord,tenant,role,membership}=useTenant()
 const supportsPageEditor=['handHygiene','waste','antiseptics','bundles'].includes(recordType)
 const creating=supportsPageEditor&&recordId==='new'
 const editing=supportsPageEditor&&!creating&&searchParams.get('edit')==='1'
 const [record,setRecord]=useState(null)
 const [loading,setLoading]=useState(!creating)
 const [handDepartments,setHandDepartments]=useState([])
 const [wasteSupport,setWasteSupport]=useState({departments:[],wasteTypes:[]})
 const [antisepticSupport,setAntisepticSupport]=useState({departments:[],products:[]})
 const [bundleSupport,setBundleSupport]=useState({departments:[],templates:[]})
 const [bundleFollowUpItem,setBundleFollowUpItem]=useState(null)
 const recordNavigation=useRecordSequenceNavigation({registry:`prevention-${recordType}`,currentId:recordId,pathForId:id=>`/prevention/${recordType}/${id}?fromTab=${recordType}`})
 const addOns=membership?.capabilities??[]
 const custom=membership?.customCapabilities??[]
 const ownDepartment=membership?.previewDepartment||membership?.departmentName||membership?.department||''
 const departmentScoped=[ROLES.DEPARTMENT_MANAGER,ROLES.DEPARTMENT_USER,ROLES.LINK_NURSE].includes(role)
 const recordCapability=editCapabilities[recordType]
 const broadPreventionView=can(role,CAPABILITIES.VIEW_PREVENTION,[],custom)
 const recordTypeAccess=Boolean(recordCapability)&&(broadPreventionView||can(role,recordCapability,addOns,custom))
 const canEditRecord=Boolean(recordCapability)&&can(role,recordCapability,addOns,custom)

 useEffect(()=>{
  if(!recordTypeAccess){setRecord(null);setLoading(false);return}
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
 },[creating,editing,recordType,recordId,tenant?.id,recordTypeAccess,notifyError])

 useEffect(()=>{
  if(!tenant?.id||!recordTypeAccess)return
  let active=true
  if(recordType==='handHygiene')loadHandHygieneDepartments(tenant.id).then(rows=>{if(active)setHandDepartments(rows)}).catch(error=>notifyError(error,'load',{operation:'hand_hygiene_departments_load'}))
  if(recordType==='waste')loadWasteSupportData(tenant.id).then(data=>{if(active)setWasteSupport(data)}).catch(error=>notifyError(error,'load',{operation:'waste_support_load'}))
  if(recordType==='antiseptics')loadAntisepticSupportData(tenant.id).then(data=>{if(active)setAntisepticSupport(data)}).catch(error=>notifyError(error,'load',{operation:'antiseptic_support_load'}))
  if(recordType==='bundles')loadBundleSupportData(tenant.id).then(data=>{if(active)setBundleSupport(data)}).catch(error=>notifyError(error,'load',{operation:'bundle_support_load'}))
  return()=>{active=false}
 },[recordType,tenant?.id,recordTypeAccess,notifyError])

 if(!recordTypeAccess)return <Page title={en?'Prevention Center':'Κέντρο Πρόληψης'}><div className="inline-empty">{en?'You do not have access to this Prevention area.':'Δεν έχετε πρόσβαση σε αυτή την ενότητα της Πρόληψης.'}</div></Page>
 if(creating&&!canEditRecord)return <Page title={en?'Prevention Center':'Κέντρο Πρόληψης'}><div className="inline-empty">{en?'You do not have permission to create this record.':'Δεν έχετε δικαίωμα δημιουργίας αυτής της εγγραφής.'}</div></Page>
 const recordInScope=creating||!record||canAccessRecord({...record,department:record.departmentEl||record.department})
 if(loading)return <Page title={en?'Prevention Center':'Κέντρο Πρόληψης'}><div className="inline-empty">{en?'Loading record…':'Φόρτωση εγγραφής…'}</div></Page>
 if(!creating&&!record)return <Page title={en?'Prevention Center':'Κέντρο Πρόληψης'}><div className="inline-empty">{en?'Record not found.':'Δεν βρέθηκε η εγγραφή.'}</div></Page>
 if(!recordInScope)return <Page title={en?'Prevention Center':'Κέντρο Πρόληψης'}><div className="inline-empty">{en?'You do not have access to this record.':'Δεν έχετε πρόσβαση σε αυτή την εγγραφή.'}</div></Page>

 const Icon=icons[recordType]||ShieldCheck
 const fmtDate=value=>value?new Intl.DateTimeFormat(locale).format(new Date(`${value}T12:00:00`)):'—'
 const wasteCategory=record?.wasteType||record?.type
 const recordTitle=creating
  ? recordType==='waste'?(en?'New waste measurement':'Νέα μέτρηση αποβλήτων')
   :recordType==='antiseptics'?(en?'New antiseptic consumption':'Νέα κατανάλωση αντισηπτικού')
   :recordType==='bundles'?(en?'New Bundle assessment':'Νέα αξιολόγηση Bundle')
   :(en?'New WHO hand hygiene observation':'Νέα παρατήρηση Υγιεινής Χεριών WHO')
  : editing
   ? recordType==='waste'?`${en?'Edit waste measurement':'Επεξεργασία μέτρησης αποβλήτων'} · ${fmtDate(record?.date)}`
    :recordType==='antiseptics'?`${en?'Edit antiseptic consumption':'Επεξεργασία κατανάλωσης αντισηπτικού'} · ${record?.period||''}`
    :recordType==='bundles'?`${en?'Edit Bundle assessment':'Επεξεργασία αξιολόγησης Bundle'} · ${record?.date||record?.period||''}`
    :`${en?'Edit WHO hand hygiene observation':'Επεξεργασία παρατήρησης Υγιεινής Χεριών WHO'} · ${fmtDate(record?.date)}`
   : recordType==='handHygiene'?`${en?'WHO hand hygiene observation':'Παρατήρηση Υγιεινής Χεριών WHO'} · ${fmtDate(record?.date)}`
   : recordType==='waste'?`${en?'Waste measurement':'Μέτρηση αποβλήτων'} · ${fmtDate(record?.date)}`
   : recordType==='antiseptics'?`${en?'Antiseptic consumption':'Κατανάλωση αντισηπτικού'} · ${record?.period||''}`
   : `${record?.templateName||record?.bundle} · ${record?.date||record?.period||''}`
 const subtitle=recordType==='handHygiene'?(en?'WHO 5 Moments · Prevention & Infection Control':'WHO 5 Moments · Πρόληψη & Έλεγχος Λοιμώξεων')
  :recordType==='waste'?(en?'Waste management · Prevention & Infection Control':'Διαχείριση αποβλήτων · Πρόληψη & Έλεγχος Λοιμώξεων')
  :recordType==='antiseptics'?(en?'Monthly antiseptic consumption · Prevention & Infection Control':'Μηνιαία κατανάλωση αντισηπτικών · Πρόληψη & Έλεγχος Λοιμώξεων')
  :recordType==='bundles'?(en?'Prevention Bundle assessment · all-or-none compliance':'Αξιολόγηση Bundle Πρόληψης · all-or-none συμμόρφωση')
  :undefined
 const recordStatus=!record?null:recordType==='waste'?<span className={`waste-category-badge ${wasteCategoryTone(wasteCategory)}`}>{en?(record.typeEn||wasteCategory):wasteCategory}</span>:recordType==='antiseptics'?<span className={`antiseptic-abhr-badge ${record.indicatorEligible!==false&&isAbhrProduct(record)?'active':'informative'}`}>{record.indicatorEligible!==false&&isAbhrProduct(record)?(en?'ABHR · included in indicator':'ABHR · στον δείκτη'):(en?'Outside ABHR indicator':'Εκτός δείκτη ABHR')}</span>:recordType==='bundles'?<span className={`bundle-all-badge ${record.allOrNone?'passed':'failed'}`}>{record.allOrNone?'All-or-none ✓':'All-or-none ✕'}</span>:null

 async function saveHandHygiene(updated){if(!canEditRecord)return;try{const saved=await saveHandHygieneSession(tenant.id,updated,{existingId:creating?null:record.id});if(saved)setRecord(saved);notify(creating?(en?'Observation saved.':'Η παρατήρηση αποθηκεύτηκε.'):(en?'Changes saved.':'Οι αλλαγές αποθηκεύτηκαν.'),'success');navigate(saved?.id?`/prevention/handHygiene/${saved.id}?fromTab=handHygiene`:'/prevention?tab=handHygiene',{replace:true})}catch(error){notifyError(error,'save',{operation:creating?'hand_hygiene_create':'hand_hygiene_record_update'});throw error}}
 async function saveWaste(updated){if(!canEditRecord)return;try{const saved=await saveWasteMeasurement(tenant.id,updated,{existingId:creating?null:record.id});if(saved)setRecord(saved);notify(creating?(en?'Waste measurement saved.':'Η μέτρηση αποβλήτων αποθηκεύτηκε.'):(en?'Changes saved.':'Οι αλλαγές αποθηκεύτηκαν.'),'success');navigate(saved?.id?`/prevention/waste/${saved.id}?fromTab=waste`:'/prevention?tab=waste',{replace:true})}catch(error){notifyError(error,'save',{operation:creating?'waste_create':'waste_record_update'});throw error}}
 async function saveAntiseptic(updated){if(!canEditRecord)return;try{const saved=await saveAntisepticRecord(tenant.id,updated,{existingId:creating?null:record.id});if(saved)setRecord(saved);notify(creating?(en?'Antiseptic consumption saved.':'Η κατανάλωση αντισηπτικού αποθηκεύτηκε.'):(en?'Changes saved.':'Οι αλλαγές αποθηκεύτηκαν.'),'success');navigate(saved?.id?`/prevention/antiseptics/${saved.id}?fromTab=antiseptics`:'/prevention?tab=antiseptics',{replace:true})}catch(error){notifyError(error,'save',{operation:creating?'antiseptic_create':'antiseptic_record_update'});throw error}}
 async function saveBundle(updated){if(!canEditRecord)return;try{const saved=await saveBundleAssessment(tenant.id,updated,{existingId:creating?null:record.id});if(saved)setRecord(saved);notify(creating?(en?'Bundle assessment saved.':'Η αξιολόγηση Bundle αποθηκεύτηκε.'):(en?'Changes saved.':'Οι αλλαγές αποθηκεύτηκαν.'),'success');navigate(saved?.id?`/prevention/bundles/${saved.id}?fromTab=bundles`:'/prevention?tab=bundles',{replace:true})}catch(error){notifyError(error,'save',{operation:creating?'bundle_create':'bundle_record_update'});throw error}}
 async function saveBundleFollowUpRecord(followUp){if(!canEditRecord||!bundleFollowUpItem)return;try{const saved=await saveBundleFollowUp(tenant.id,record.id,bundleFollowUpItem.id,followUp);if(saved)setRecord(saved);setBundleFollowUpItem(null);notify(en?'Follow-up saved.':'Ο επανέλεγχος αποθηκεύτηκε.','success')}catch(error){notifyError(error,'save',{operation:'bundle_followup_save'});throw error}}

 async function deleteCurrent(){
  if(!canEditRecord)return
  const ok=await confirm({title:en?'Delete record':'Διαγραφή εγγραφής',message:en?'The record will be permanently deleted. Continue?':'Η εγγραφή θα διαγραφεί οριστικά. Θέλετε να συνεχίσετε;',confirmLabel:en?'Delete':'Διαγραφή',danger:true})
  if(!ok)return
  try{await deleters[recordType]?.(tenant.id,record.id);notify(en?'Record deleted.':'Η εγγραφή διαγράφηκε.','success');navigate(`/prevention?tab=${recordType}`,{replace:true})}catch(error){notifyError(error,'delete',{operation:`${recordType}_record_delete`})}
 }
 const recordActions=<>{!creating&&!editing&&canEditRecord&&<>{supportsPageEditor&&<ActionButton label={en?'Edit':'Επεξεργασία'} tone="edit" onClick={()=>navigate(`/prevention/${recordType}/${record.id}?edit=1`,{replace:true})}><Pencil size={16}/><span>{en?'Edit':'Επεξεργασία'}</span></ActionButton>}<ActionButton label={en?'Delete':'Διαγραφή'} tone="danger" onClick={deleteCurrent}><Trash2 size={16}/><span>{en?'Delete':'Διαγραφή'}</span></ActionButton></>}{!creating&&<PrintExportActions onExport={()=>downloadRecordJson(record,{filename:record?.id})}/>}</>
 const backToList=()=>navigate(`/prevention?tab=${recordType}`,{replace:true})
 const backToRecord=()=>navigate(`/prevention/${recordType}/${record.id}?fromTab=${recordType}`,{replace:true})
 let editor=null
 if(recordType==='handHygiene')editor=<WhoHandHygieneEditor departments={handDepartments} initialRecord={editing?record:null} fixedDepartment={departmentScoped?ownDepartment:''} onCancel={creating?backToList:backToRecord} onSave={saveHandHygiene}/>
 else if(recordType==='waste')editor=<WasteEntryEditor departments={wasteSupport.departments} wasteTypes={wasteSupport.wasteTypes} initialRecord={editing?record:null} fixedDepartment={departmentScoped?ownDepartment:''} findPatientDays={(departmentId,from,to)=>findWastePatientDays(tenant.id,departmentId,from,to)} onCancel={creating?backToList:backToRecord} onSave={saveWaste}/>
 else if(recordType==='antiseptics')editor=<AntisepticEntryEditor departments={antisepticSupport.departments} products={antisepticSupport.products} initialRecord={editing?record:null} fixedDepartment={departmentScoped?ownDepartment:''} findPatientDays={(departmentId,from,to)=>findPatientDaysForPeriod(tenant.id,departmentId,from,to)} onCancel={creating?backToList:backToRecord} onSave={saveAntiseptic}/>
 else if(recordType==='bundles')editor=<BundleExecutionEditor departments={bundleSupport.departments} templates={bundleSupport.templates} initialRecord={editing?record:null} fixedDepartment={departmentScoped?ownDepartment:''} onCancel={creating?backToList:backToRecord} onSave={saveBundle}/>

 return <Page fill><EntityRecordShell className="prevention-record-shell workspace-fill" avatar={<Icon size={19}/>} title={recordTitle} subtitle={subtitle} status={recordStatus} recordNavigation={creating||editing?null:recordNavigation} headerActions={recordActions} tabs={[]} onBack={creating?backToList:editing?backToRecord:backToList}>
  {(creating||editing)?<div className="record-section prevention-record-card prevention-page-editor-card">{editor}</div>:<div className="record-section prevention-record-card">{recordType==='handHygiene'?<HandHygieneDetails record={record} language={language}/>:recordType==='waste'?<WasteEntryEditor readOnly departments={wasteSupport.departments} wasteTypes={wasteSupport.wasteTypes} initialRecord={record}/>:recordType==='antiseptics'?<AntisepticDetails record={record} language={language} locale={locale}/>:<BundleDetails record={record} language={language} canEdit={canEditRecord} onFollowUp={setBundleFollowUpItem}/>}</div>}
 </EntityRecordShell>{bundleFollowUpItem&&<BundleFollowUpDialog item={bundleFollowUpItem} value={record?.followUps?.[bundleFollowUpItem.id]} onClose={()=>setBundleFollowUpItem(null)} onSave={saveBundleFollowUpRecord}/>}</Page>
}

function HandHygieneDetails({record,language}){
 const en=language==='en';const items=record.whoObservations||[];const fallbackStats={opportunities:items.reduce((sum,item)=>sum+observationWeight(item),0)||record.observations||0,compliant:items.reduce((sum,item)=>sum+(['HR','HW'].includes(item.action)?observationWeight(item):0),0)||record.compliant||0,handRub:items.reduce((sum,item)=>sum+(item.action==='HR'?observationWeight(item):0),0),handWash:items.reduce((sum,item)=>sum+(item.action==='HW'?observationWeight(item):0),0),missed:items.reduce((sum,item)=>sum+(item.action==='MISSED'?observationWeight(item):0),0),professionals:items.reduce((sum,item)=>sum+observationWeight(item),0)}
 fallbackStats.compliance=fallbackStats.opportunities?Number(((fallbackStats.compliant/fallbackStats.opportunities)*100).toFixed(1)):record.rate||0
 const stats=record.whoStats||fallbackStats;const session=record.session||{}
 const actionLabel=item=>item.action==='HR'?(en?'Alcohol-based hand rub':'Αλκοολούχο αντισηπτικό'):item.action==='HW'?(en?'Hand wash with soap & water':'Πλύσιμο με σαπούνι & νερό'):(en?'Not performed':'Δεν πραγματοποιήθηκε')
 return <div className="who-record-workspace who-record-compact">
  <section className="who-record-session-bar">
   <div><span>{en?'Date':'Ημερομηνία'}</span><strong>{record.date||session.date||'—'}</strong></div>
   <div><span>{en?'Department':'Τμήμα'}</span><strong>{record.departmentEl||session.department||'—'}</strong></div>
   <div><span>{en?'Observer':'Παρατηρητής'}</span><strong>{record.observer||session.observer||'—'}</strong></div>
   <div><span>{en?'Time':'Ώρα'}</span><strong>{session.startTime||'—'} – {session.endTime||'—'}</strong></div>
  </section>
  <section className="who-record-kpis">
   <div className="who-record-compliance"><span>{en?'WHO compliance':'Συμμόρφωση WHO'}</span><strong>{stats.compliance}%</strong><small>{stats.compliant||0} / {stats.opportunities||0} {en?'compliant opportunities':'συμμορφούμενες ευκαιρίες'}</small></div>
   <div><span>{en?'Opportunities':'Ευκαιρίες'}</span><strong>{stats.opportunities}</strong></div>
   <div><span>{en?'Professionals':'Επαγγελματίες'}</span><strong>{stats.professionals}</strong></div>
   <div><span>{en?'Hand rub (HR)':'Αντισηπτικό (HR)'}</span><strong>{stats.handRub||0}</strong></div>
   <div><span>{en?'Hand wash (HW)':'Πλύσιμο (HW)'}</span><strong>{stats.handWash||0}</strong></div>
   <div className="who-record-missed"><span>{en?'Not performed':'Μη συμμορφούμενες'}</span><strong>{stats.missed||0}</strong></div>
  </section>
  <section className="who-record-opportunities">
   <div className="who-record-list-heading"><div><span className="eyebrow">{en?'WHO 5 MOMENTS':'WHO 5 ΣΤΙΓΜΕΣ'}</span><h3>{en?'Recorded opportunities':'Καταγεγραμμένες ευκαιρίες'}</h3></div><strong>{items.length}</strong></div>
   <div className="who-record-saved-list">{items.map((item,index)=>{const selectedMoments=normalizeWhoMoments(item);return <article className="who-record-opportunity-row" key={item.id||index}>
    <div className="who-record-opportunity-index"><span>{index+1}</span></div>
    <div className="who-record-profession"><span>{en?'Professional':'Επαγγελματίας'}</span><strong>{item.professionalsCount||1} × {(()=>{const p=WHO_PROFESSIONS.find(([el])=>el===item.professionalCategory);return p?(en?p[1]:p[0]):item.professionalCategory||'—'})()}</strong></div>
    <div className="who-record-moments"><span>{en?'WHO indication':'Ένδειξη WHO'}</span><div>{selectedMoments.map(id=>{const m=WHO_MOMENTS.find(x=>x.id===id);return <b key={id}><i>{id.replace('moment','')}</i>{m?(en?m.labelEn.replace(/^\d+\.\s*/,''):m.label.replace(/^\d+\.\s*/,'')):id}</b>})}</div></div>
    <div className="who-record-action"><span>{en?'Action':'Ενέργεια'}</span><strong className={item.action==='MISSED'?'missed':'compliant'}>{actionLabel(item)}</strong></div>
    <div className="who-record-gloves"><span>{en?'Gloves':'Γάντια'}</span><strong>{item.gloves?(en?'Yes':'Ναι'):(en?'No':'Όχι')}</strong></div>
    <div className="who-record-note"><span>{en?'Note':'Σημείωση'}</span><strong>{item.notes||'—'}</strong></div>
   </article>})}</div>
  </section>
 </div>
}

function AntisepticDetails({record,language,locale}){
 const en=language==='en';const eligible=record.indicatorEligible!==false&&isAbhrProduct(record)
 const period=String(record.period||'—').replace(/^(\d{4})-(\d{2})$/,'$2/$1')
 return <div className="antiseptic-detail">
  <section className="antiseptic-detail-summary">
   <div className="antiseptic-detail-context">
    <div><span>{en?'Period':'Περίοδος'}</span><strong>{period}</strong></div>
    <div><span>{en?'Department':'Τμήμα'}</span><strong>{record.departmentEl||'—'}</strong></div>
    <div className="antiseptic-detail-product"><span>{en?'Product':'Προϊόν'}</span><strong>{en?(record.productEn||record.product):record.product}</strong></div>
    <span className={`antiseptic-detail-badge ${eligible?'active':'informative'}`}>{eligible?(en?'ABHR · Indicator active':'ABHR · Δείκτης ενεργός'):(en?'Outside ABHR indicator':'Εκτός δείκτη ABHR')}</span>
   </div>
   <div className="antiseptic-detail-kpis">
    <div><span>{en?'Consumption':'Κατανάλωση'}</span><strong>{Number(record.litres).toLocaleString(locale)} <small>L</small></strong></div>
    <div><span>{en?'Patient-days':'Νοσηλευτικές ημέρες'}</span><strong>{record.patientDays||'—'}</strong></div>
    <div className="primary"><span>{en?'ABHR indicator':'Δείκτης ABHR'}</span><strong>{record.indicator!=null?Number(record.indicator).toLocaleString(locale):'—'}</strong><small>{en?'L / 1,000 patient-days':'L / 1.000 νοσηλευτικές ημέρες'}</small></div>
   </div>
  </section>
  <section className="antiseptic-detail-trace">
   <header><strong>{en?'Data source & traceability':'Πηγή δεδομένων & ιχνηλασιμότητα'}</strong></header>
   <div>
    <section><span>{en?'Source / method':'Πηγή / μέθοδος'}</span><strong>{antisepticMethodLabel(record.method,language)}</strong></section>
    <section><span>{en?'Reference / document':'Αναφορά / παραστατικό'}</span><strong>{record.referenceNumber||'—'}</strong></section>
    <section><span>{en?'Responsible':'Υπεύθυνος'}</span><strong>{record.responsible||'—'}</strong></section>
   </div>
  </section>
  {record.notes&&<div className="record-note-card"><span>{en?'Notes':'Σημειώσεις'}</span><p>{record.notes}</p></div>}
 </div>
}

function BundleDetails({record,language,canEdit,onFollowUp}){
 const en=language==='en';const template=record.templateSnapshot||{};const elements=template.elements||[];const findings=record.findings||elements.filter(([id])=>record.answers?.[id]==='no').map(([id,label])=>({id,label,note:record.answerNotes?.[id]||''}))
 const followUpLabel=status=>status==='resolved'?(en?'Corrected':'Διορθώθηκε'):status==='open'?(en?'Still pending':'Παραμένει'):status==='not_applicable'?(en?'No longer applicable':'Δεν εφαρμόζεται πλέον'):(en?'Pending review':'Προς επανέλεγχο')
 return <div className="bundle-record-view"><section className="bundle-record-summary"><div className="bundle-record-heading"><div><strong>{record.templateName||template.name||record.bundle} · {record.templateTitle||template.title||''}</strong><small>{record.templateSource||template.source||''} · v{record.templateVersion||template.version||'1.0'}</small></div><span className={`bundle-all-badge ${record.allOrNone?'passed':'failed'}`}>{record.allOrNone?'All-or-none ✓':'All-or-none ✕'}</span></div><div className="bundle-record-kpis"><div><span>Score</span><strong>{record.score==null?'—':`${record.score}%`}</strong></div><div><span>{en?'Applicable':'Εφαρμόσιμα'}</span><strong>{record.applicableCount??'—'}</strong></div><div><span>{en?'Deviations':'Αποκλίσεις'}</span><strong>{record.failedCount??findings.length}</strong></div><div><span>{en?'Date':'Ημερομηνία'}</span><strong>{record.date||record.period||'—'}</strong></div></div><div className="bundle-record-meta"><span><b>{en?'Department':'Τμήμα'}</b>{record.departmentEl||'—'}</span><span><b>{en?'Shift':'Βάρδια'}</b>{record.shift||'—'}</span><span><b>{en?'Patient':'Ασθενής'}</b>{record.patientRef||'—'}</span><span><b>{en?'Device':'Συσκευή'}</b>{record.deviceRef||'—'}</span><span><b>{en?'Responsible':'Υπεύθυνος'}</b>{record.owner||'—'}</span></div></section><section className="bundle-record-elements"><div className="bundle-record-heading"><div><strong>{en?'Bundle results':'Αποτελέσματα δέσμης μέτρων'}</strong></div></div><div className="bundle-detail-list">{elements.map(([id,label],index)=>{const value=record.answers?.[id];return <div className={`bundle-detail-row ${value==='no'?'failed':value==='yes'?'passed':'na'}`} key={id}><span className="bundle-detail-index">{index+1}</span><strong>{label}</strong><span className="bundle-detail-answer">{value==='yes'?(en?'Yes':'Ναι'):value==='no'?(en?'No':'Όχι'):value==='na'?(en?'N/A':'Μ/Ε'):'—'}</span>{value==='no'&&record.answerNotes?.[id]&&<small>{record.answerNotes[id]}</small>}</div>})}</div></section>{findings.length>0&&<section className="bundle-record-findings"><div className="bundle-record-heading"><div><strong>{en?'Items for follow-up':'Σημεία για επανέλεγχο'}</strong><small>{en?'Review each deviation and record whether it was corrected, remains open or no longer applies.':'Επανελέγξτε κάθε απόκλιση και καταγράψτε αν διορθώθηκε, παραμένει ή δεν εφαρμόζεται πλέον.'}</small></div></div>{findings.map(item=>{const followUp=record.followUps?.[item.id];return <div className={`bundle-record-finding bundle-followup-${followUp?.status||'pending'}`} key={item.id}><div className="bundle-followup-copy"><strong>{item.label}</strong><span>{item.note||(en?'Investigation / corrective action required.':'Απαιτείται διερεύνηση / διορθωτική ενέργεια.')}</span>{followUp?.comment&&<small>{followUp.comment}</small>}</div><div className="bundle-followup-meta"><span className={`bundle-followup-status ${followUp?.status||'pending'}`}>{followUpLabel(followUp?.status)}</span>{followUp?.date&&<small>{en?'Review date':'Ημ. επανελέγχου'}: {followUp.date}</small>}{followUp?.reviewedBy&&<small>{en?'Reviewed by':'Επανέλεγχος από'}: {followUp.reviewedBy}</small>}{canEdit&&<Button variant="secondary" onClick={()=>onFollowUp?.(item)}>{followUp?(en?'Edit follow-up':'Επεξεργασία επανελέγχου'):(en?'Follow-up':'Επανέλεγχος')}</Button>}</div></div>})}</section>}{record.generalNotes&&<div className="record-note-card"><span>{en?'Notes':'Σημειώσεις'}</span><p>{record.generalNotes}</p></div>}</div>
}
