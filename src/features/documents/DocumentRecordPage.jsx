import { useEffect,useMemo,useState } from 'react'
import { Archive,BookOpenCheck,FileClock,Paperclip,Pencil } from 'lucide-react'
import { useNavigate,useParams } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { Button } from '../../design-system/Button'
import { ObserverDialog,DialogActions } from '../../design-system/ObserverDialog'
import { AttachmentField } from '../../design-system/AttachmentField'
import { PrintExportActions } from '../../design-system/PrintExportActions'
import { downloadRecordJson } from '../../core/export/recordExport'
import { useTenant } from '../../core/tenant/TenantContext'
import { can,CAPABILITIES } from '../../core/permissions/roles'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useAuditActor } from '../../core/audit/useAuditActor'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useDocumentsData } from './useDocumentsData'
import { updateDocumentAsync,submitDocumentReviewAsync,approveDocumentAsync,publishDocumentAsync,archiveDocumentAsync,createDocumentRevisionAsync } from './documentService'
import { DocumentForm,DOCUMENT_TYPES,documentDraftIsValid } from './DocumentForm'
import { loadDepartments } from '../management/departmentsService'
import { RouteLoading } from '../../design-system/RouteLoading'

const labels={
 el:{types:DOCUMENT_TYPES.el,statuses:{draft:'Πρόχειρο',review:'Σε έλεγχο',approved:'Εγκεκριμένο',published:'Δημοσιευμένο',superseded:'Αντικαταστάθηκε',archived:'Αρχειοθετημένο'}},
 en:{types:DOCUMENT_TYPES.en,statuses:{draft:'Draft',review:'In review',approved:'Approved',published:'Published',superseded:'Superseded',archived:'Archived'}}
}

export function DocumentRecordPage(){
 const {documentId}=useParams(),navigate=useNavigate(),actor=useAuditActor(),{notify,confirm}=useFeedback(),{role,membership,tenant,isDemo}=useTenant(),{language}=useLanguage();const en=language==='en',typeLabels=labels[language].types,statusLabels=labels[language].statuses
 const {data:rows,loading,error,reload}=useDocumentsData()
 const [tab,setTab]=useState('overview'),[editOpen,setEditOpen]=useState(false),[busy,setBusy]=useState(false),[departments,setDepartments]=useState([])
 const record=useMemo(()=>rows.find(x=>x.id===documentId)||null,[rows,documentId])
 const addOns=membership?.capabilities??[],custom=membership?.customCapabilities??[]
 const canManage=can(role,CAPABILITIES.MANAGE_DOCUMENTS,addOns,custom)
 const canSubmitReview=can(role,CAPABILITIES.SUBMIT_DOCUMENT_REVIEW,addOns,custom)
 const canApprove=can(role,CAPABILITIES.APPROVE_DOCUMENT,addOns,custom)
 const canPublish=can(role,CAPABILITIES.PUBLISH_DOCUMENT,addOns,custom)
 const canSupersede=can(role,CAPABILITIES.SUPERSEDE_DOCUMENT,addOns,custom)
 const canArchive=can(role,CAPABILITIES.ARCHIVE_DOCUMENT,addOns,custom)
 const organizationId=tenant?.id||null
 useEffect(()=>{let active=true;if(!organizationId)return;loadDepartments(organizationId).then(data=>{if(active)setDepartments((data||[]).filter(x=>x.is_active!==false))}).catch(()=>{if(active)setDepartments([])});return()=>{active=false}},[organizationId])

 if(loading)return <RouteLoading/>
 if(error)return <Page title={en?'Documents':'Έγγραφα'}><div className="data-access-state error" role="alert"><span>{en?'Could not load the document.':'Δεν ήταν δυνατή η φόρτωση του εγγράφου.'}</span><button type="button" onClick={()=>reload().catch(()=>{})}>{en?'Retry':'Επανάληψη'}</button></div></Page>
 if(!record)return <Page title={en?'Documents':'Έγγραφα'}><div className="inline-empty">{en?'Document not found.':'Το έγγραφο δεν βρέθηκε.'}</div></Page>

 async function run(operation,successMessage){if(busy)return null;setBusy(true);try{const result=await operation();await reload();if(successMessage)notify(successMessage,'success');return result}catch{notify(en?'The action could not be completed.':'Η ενέργεια δεν ήταν δυνατό να ολοκληρωθεί.','danger');return null}finally{setBusy(false)}}
 async function saveEdit(data){const result=await run(()=>updateDocumentAsync(organizationId,record,data,actor),en?'Document updated.':'Το έγγραφο ενημερώθηκε.');if(result)setEditOpen(false)}
 async function submitReview(){if(record.status!=='draft'||!canSubmitReview)return;const ok=await confirm({title:en?'Submit for review':'Υποβολή για έλεγχο',message:en?'Editing will be locked while the document is reviewed. Continue?':'Η επεξεργασία θα κλειδώσει όσο το έγγραφο βρίσκεται σε έλεγχο. Θέλετε να συνεχίσετε;',confirmLabel:en?'Submit':'Υποβολή'});if(ok)await run(()=>submitDocumentReviewAsync(organizationId,record,actor),en?'Document submitted for review.':'Το έγγραφο υποβλήθηκε για έλεγχο.')}
 async function approve(){if(record.status!=='review'||!canApprove)return;const ok=await confirm({title:en?'Approve document':'Έγκριση εγγράφου',message:en?'The reviewed version will be approved for publication. Continue?':'Η ελεγμένη έκδοση θα εγκριθεί για δημοσίευση. Θέλετε να συνεχίσετε;',confirmLabel:en?'Approve':'Έγκριση'});if(ok)await run(()=>approveDocumentAsync(organizationId,record,actor),en?'Document approved.':'Το έγγραφο εγκρίθηκε.')}
 async function publish(){if(record.status!=='approved'||!canPublish)return;const ok=await confirm({title:en?'Publish document':'Δημοσίευση εγγράφου',message:en?'The approved version will become active for use. Continue?':'Η εγκεκριμένη έκδοση θα γίνει ενεργή για χρήση. Θέλετε να συνεχίσετε;',confirmLabel:en?'Publish':'Δημοσίευση'});if(ok)await run(()=>publishDocumentAsync(organizationId,record,actor),en?'Document published.':'Το έγγραφο δημοσιεύτηκε.')}
 async function archive(){if(record.status!=='published'||!canArchive)return;const ok=await confirm({title:en?'Archive document':'Αρχειοθέτηση εγγράφου',message:en?'The document will no longer be active for current use. History will be preserved.':'Το έγγραφο θα πάψει να θεωρείται ενεργό για τρέχουσα χρήση. Το ιστορικό θα διατηρηθεί.',confirmLabel:en?'Archive':'Αρχειοθέτηση',danger:true});if(ok)await run(()=>archiveDocumentAsync(organizationId,record,actor),en?'Document archived.':'Το έγγραφο αρχειοθετήθηκε.')}
 async function createRevision(){if(record.status!=='published'||!canSupersede)return;const ok=await confirm({title:en?'Create new revision':'Νέα αναθεώρηση',message:en?'A new draft version will be created. The published version stays active until the revision is published.':'Θα δημιουργηθεί νέα πρόχειρη έκδοση. Η δημοσιευμένη έκδοση παραμένει ενεργή μέχρι να δημοσιευτεί η αναθεώρηση.',confirmLabel:en?'Create revision':'Δημιουργία αναθεώρησης'});if(!ok)return;const next=await run(()=>createDocumentRevisionAsync(organizationId,record,actor,rows),en?'New draft revision created.':'Δημιουργήθηκε νέα πρόχειρη αναθεώρηση.');if(next)navigate(`/documents/${next.id}`)}
 async function attachments(next){if(!isDemo)return;await run(()=>updateDocumentAsync(organizationId,record,{attachments:next},actor),en?'Attachments updated.':'Τα συνημμένα ενημερώθηκαν.')}

 const tabs=[{id:'overview',label:en?'Overview':'Σύνοψη',icon:BookOpenCheck},{id:'files',label:en?'Files':'Αρχεία',icon:Paperclip},{id:'history',label:en?'History':'Ιστορικό',icon:FileClock}]
 return <Page fill><EntityRecordShell avatar={<BookOpenCheck size={19}/>} eyebrow={record.id} title={record.title} subtitle={`${typeLabels[record.type]||record.type} · ${en?'Version':'Έκδοση'} ${record.version||'—'}`} status={<span className={`status-badge ${record.status==='published'?'active':record.status==='draft'?'temporary':''}`}>{statusLabels[record.status]||record.status}</span>} onBack={()=>navigate('/documents')} headerActions={<>{canManage&&record.status==='draft'&&<button disabled={busy} className="general-edit-button edit" onClick={()=>setEditOpen(true)}><Pencil size={15}/>{en?' Edit':' Επεξεργασία'}</button>}{canSupersede&&record.status==='published'&&<button disabled={busy} className="general-edit-button edit" onClick={createRevision}><Pencil size={15}/>{en?' New revision':' Νέα αναθεώρηση'}</button>}{canSubmitReview&&record.status==='draft'&&<Button disabled={busy} onClick={submitReview}>{en?'Submit for review':'Υποβολή για έλεγχο'}</Button>}{canApprove&&record.status==='review'&&<Button disabled={busy} onClick={approve}>{en?'Approve':'Έγκριση'}</Button>}{canPublish&&record.status==='approved'&&<Button disabled={busy} onClick={publish}>{en?'Publish':'Δημοσίευση'}</Button>}{canArchive&&record.status==='published'&&<button disabled={busy} className="entity-record-icon-button danger" onClick={archive} title={en?'Archive':'Αρχειοθέτηση'} aria-label={en?'Archive':'Αρχειοθέτηση'}><Archive size={15}/></button>}<PrintExportActions onExport={()=>downloadRecordJson(record,{filename:record.id})}/></>} tabs={tabs} activeTab={tab} onTabChange={setTab}>
  {tab==='overview'&&<section className="record-section"><div className="record-section-header"><div><span className="eyebrow">{en?'Documents':'Έγγραφα'}</span><h3>{en?'Basic details':'Βασικά στοιχεία'}</h3></div></div><div className="details-grid"><div><span>{en?'Type':'Τύπος'}</span><strong>{typeLabels[record.type]||'—'}</strong></div><div><span>{en?'Version':'Έκδοση'}</span><strong>{record.version||'—'}</strong></div><div><span>{en?'Owner':'Υπεύθυνος'}</span><strong>{record.owner||record.ownerId||'—'}</strong></div><div><span>{en?'Department / scope':'Τμήμα / πεδίο εφαρμογής'}</span><strong>{record.department||'—'}</strong></div><div><span>{en?'Effective date':'Ημερομηνία ισχύος'}</span><strong>{record.effectiveDate||'—'}</strong></div><div><span>{en?'Review':'Επανεξέταση'}</span><strong>{record.reviewDate||'—'}</strong></div></div><div className="source-truth-note">{record.description||(en?'No description has been recorded.':'Δεν έχει καταχωρηθεί περιγραφή.')}</div></section>}
  {tab==='files'&&<section className="record-section"><div className="record-section-header"><div><span className="eyebrow">{en?'Documents':'Έγγραφα'}</span><h3>{en?'Files & attachments':'Αρχεία & συνημμένα'}</h3><p>{en?'Attachments are governed by the document lifecycle and the current role.':'Τα συνημμένα διέπονται από τον κύκλο ζωής του εγγράφου και τον τρέχοντα ρόλο.'}</p></div></div><AttachmentField disabled={!canManage||record.status!=='draft'} value={record.attachments||[]} onChange={attachments} organizationId={organizationId} entityType="controlled_document" entityId={record.dbId||record.id}/></section>}
  {tab==='history'&&<section className="record-section"><div className="record-section-header"><div><span className="eyebrow">{en?'Governance':'Διακυβέρνηση'}</span><h3>{en?'Lifecycle history':'Ιστορικό κύκλου ζωής'}</h3></div></div><div className="timeline-line"><strong>{en?'Created':'Δημιουργήθηκε'}</strong><span>{record.createdAt||'—'}</span></div><div className="timeline-line"><strong>{en?'Last updated':'Τελευταία ενημέρωση'}</strong><span>{record.updatedAt||'—'}</span></div>{record.publishedAt&&<div className="timeline-line"><strong>{en?'Published':'Δημοσιεύτηκε'}</strong><span>{record.publishedAt}</span></div>}{isDemo&&(record.history||[]).map((item,index)=><div key={`${item.at}-${index}`} className="timeline-line"><strong>{item.action}</strong><span>{item.at} · {item.actor}</span></div>)}</section>}
 </EntityRecordShell>{editOpen&&<DocumentEditDialog record={record} departments={departments} language={language} busy={busy} onClose={()=>setEditOpen(false)} onSave={saveEdit}/>}</Page>
}

function DocumentEditDialog({record,departments,onClose,onSave,language,busy}){
 const en=language==='en'
 const [v,setV]=useState({title:record.title||'',type:record.type||'policy',version:record.version||'0.1',departmentId:record.departmentId||null,audience:record.audience||'organization',effectiveDate:record.effectiveDate||'',reviewDate:record.reviewDate||'',description:record.description||''})
 const valid=documentDraftIsValid(v)
 return <ObserverDialog width="wide" eyebrow={en?'Documents':'Έγγραφα'} title={en?'Edit draft':'Επεξεργασία πρόχειρου'} subtitle={en?'Only draft documents can be edited.':'Μόνο τα πρόχειρα έγγραφα μπορούν να επεξεργαστούν.'} onClose={onClose} footer={<DialogActions onCancel={onClose} disabled={!valid||busy} onSave={()=>onSave(v)} saveLabel={busy?(en?'Saving…':'Αποθήκευση…'):(en?'Save':'Αποθήκευση')}/>}><div className="observer-form-section"><DocumentForm value={v} onChange={setV} language={language} departments={departments} showOwner={false}/></div></ObserverDialog>
}
