import { useMemo,useState } from 'react'
import { Archive,BookOpenCheck,FileClock,Paperclip,Pencil } from 'lucide-react'
import { useNavigate,useParams } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { Button } from '../../design-system/Button'
import { ObserverDialog,DialogActions } from '../../design-system/ObserverDialog'
import { AttachmentField } from '../../design-system/AttachmentField'
import { ManualDateField } from '../../design-system/ManualDateField'
import { PrintExportActions } from '../../design-system/PrintExportActions'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { downloadRecordJson } from '../../core/export/recordExport'
import { useTenant } from '../../core/tenant/TenantContext'
import { can,CAPABILITIES } from '../../core/permissions/roles'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useAuditActor } from '../../core/audit/useAuditActor'
import { createDocumentRevision,loadDocuments,saveDocuments } from './documentStore'
import { useLanguage } from '../../core/i18n/LanguageContext'

const labels={
 el:{types:{policy:'Πολιτική',procedure:'Διαδικασία',instruction:'Οδηγία',form:'Έντυπο',protocol:'Πρωτόκολλο',other:'Άλλο'},statuses:{draft:'Πρόχειρο',review:'Σε έλεγχο',approved:'Εγκεκριμένο',published:'Δημοσιευμένο',superseded:'Αντικαταστάθηκε',archived:'Αρχειοθετημένο'}},
 en:{types:{policy:'Policy',procedure:'Procedure',instruction:'Instruction',form:'Form',protocol:'Protocol',other:'Other'},statuses:{draft:'Draft',review:'In review',approved:'Approved',published:'Published',superseded:'Superseded',archived:'Archived'}}
}

export function DocumentRecordPage(){
 const {documentId}=useParams(),navigate=useNavigate(),actor=useAuditActor(),{notify,confirm}=useFeedback(),{role,membership}=useTenant(),{language}=useLanguage();const en=language==='en',typeLabels=labels[language].types,statusLabels=labels[language].statuses
 const [rows,setRows]=useState(loadDocuments),[tab,setTab]=useState('overview'),[editOpen,setEditOpen]=useState(false)
 const record=rows.find(x=>x.id===documentId)
 const addOns=membership?.capabilities??[],custom=membership?.customCapabilities??[]
 const canManage=can(role,CAPABILITIES.MANAGE_DOCUMENTS,addOns,custom)
 const canSubmitReview=can(role,CAPABILITIES.SUBMIT_DOCUMENT_REVIEW,addOns,custom)
 const canApprove=can(role,CAPABILITIES.APPROVE_DOCUMENT,addOns,custom)
 const canPublish=can(role,CAPABILITIES.PUBLISH_DOCUMENT,addOns,custom)
 const canSupersede=can(role,CAPABILITIES.SUPERSEDE_DOCUMENT,addOns,custom)
 const canArchive=can(role,CAPABILITIES.ARCHIVE_DOCUMENT,addOns,custom)
 if(!record)return <Page title={en?'Documents':'Έγγραφα'}><div className="inline-empty">{en?'Document not found.':'Το έγγραφο δεν βρέθηκε.'}</div></Page>
 function persist(next){const all=rows.map(x=>x.id===record.id?next:x);setRows(all);saveDocuments(all)}
 function audit(next,action,reason){const now=new Date().toISOString();return {...next,updatedAt:now,updatedBy:actor.name,updatedById:actor.id,history:[{at:now,actor:actor.name,actorId:actor.id,action,reason},...(next.history||record.history||[])]}}
 function saveEdit(data){persist(audit({...record,...data},'Επεξεργασία στοιχείων εγγράφου',data.version?`Έκδοση ${data.version}`:''));setEditOpen(false);notify(en?'Document updated.':'Το έγγραφο ενημερώθηκε.','success')}
 async function submitReview(){
  if(record.status!=='draft'||!canSubmitReview)return
  const ok=await confirm({title:en?'Submit for review':'Υποβολή για έλεγχο',message:en?'Editing will be locked while the document is reviewed. Continue?':'Η επεξεργασία θα κλειδώσει όσο το έγγραφο βρίσκεται σε έλεγχο. Θέλετε να συνεχίσετε;',confirmLabel:en?'Submit':'Υποβολή'})
  if(!ok)return
  persist(audit({...record,status:'review',reviewSubmittedAt:new Date().toISOString(),reviewSubmittedBy:actor.name,reviewSubmittedById:actor.id},'Υποβολή εγγράφου για έλεγχο',`Έκδοση ${record.version}`))
  notify(en?'Document submitted for review.':'Το έγγραφο υποβλήθηκε για έλεγχο.','success')
 }
 async function approve(){
  if(record.status!=='review'||!canApprove)return
  const ok=await confirm({title:en?'Approve document':'Έγκριση εγγράφου',message:en?'The reviewed version will be approved for publication. Continue?':'Η ελεγμένη έκδοση θα εγκριθεί για δημοσίευση. Θέλετε να συνεχίσετε;',confirmLabel:en?'Approve':'Έγκριση'})
  if(!ok)return
  persist(audit({...record,status:'approved',approvedAt:new Date().toISOString(),approvedBy:actor.name,approvedById:actor.id},'Έγκριση εγγράφου',`Έκδοση ${record.version}`))
  notify(en?'Document approved.':'Το έγγραφο εγκρίθηκε.','success')
 }
 async function publish(){if(record.status!=='approved'||!canPublish||(record.supersedesId&&!canSupersede))return;const ok=await confirm({title:en?'Publish document':'Δημοσίευση εγγράφου',message:en?'The current version will be marked as published and available for use. Continue?':'Η τρέχουσα έκδοση θα χαρακτηριστεί ως δημοσιευμένη και διαθέσιμη για χρήση. Θέλετε να συνεχίσετε;',confirmLabel:en?'Publish':'Δημοσίευση'});if(!ok)return;{
 const now=new Date().toISOString()
 const published=audit({...record,status:'published',publishedAt:now,publishedBy:actor.name,publishedById:actor.id},'Δημοσίευση εγγράφου',`Έκδοση ${record.version}`)
 let all=rows.map(x=>x.id===record.id?published:x)
 if(record.supersedesId){
  all=all.map(x=>x.id===record.supersedesId?{...x,status:'superseded',supersededAt:now,supersededBy:actor.name,supersededByActorId:actor.id,supersededById:record.id,updatedAt:now,updatedBy:actor.name,updatedById:actor.id,history:[{at:now,actor:actor.name,actorId:actor.id,action:'Αντικατάσταση από νέα έκδοση',reason:`${record.id} · Έκδοση ${record.version}`},...(x.history||[])]}:x)
 }
 setRows(all);saveDocuments(all)
 }notify(en?'Document published.':'Το έγγραφο δημοσιεύτηκε.','success')}
 async function archive(){const ok=await confirm({title:en?'Archive document':'Αρχειοθέτηση εγγράφου',message:en?'The document will no longer be active for current use. History will be preserved.':'Το έγγραφο θα πάψει να θεωρείται ενεργό για τρέχουσα χρήση. Το ιστορικό θα διατηρηθεί.',confirmLabel:en?'Archive':'Αρχειοθέτηση',danger:true});if(!ok)return;persist(audit({...record,status:'archived',archivedAt:new Date().toISOString(),archivedBy:actor.name,archivedById:actor.id},'Αρχειοθέτηση εγγράφου',`Έκδοση ${record.version}`));notify(en?'Document archived.':'Το έγγραφο αρχειοθετήθηκε.','success')}
 async function createRevision(){
  const ok=await confirm({title:en?'Create new revision':'Νέα αναθεώρηση',message:en?'A new draft version will be created. The published version will remain unchanged until the new revision is published.':'Θα δημιουργηθεί νέα πρόχειρη έκδοση. Η δημοσιευμένη έκδοση θα παραμείνει αμετάβλητη μέχρι να δημοσιευτεί η νέα αναθεώρηση.',confirmLabel:en?'Create revision':'Δημιουργία αναθεώρησης'})
  if(!ok)return
  const next=createDocumentRevision(record,{actor})
  const sourceEvent={at:new Date().toISOString(),actor:actor.name,actorId:actor.id,action:'Νέα αναθεώρηση',reason:`${record.version||'—'} → ${next.version} · ${next.id}`}
  const source={...record,supersededById:next.id,updatedAt:sourceEvent.at,updatedBy:actor.name,updatedById:actor.id,history:[sourceEvent,...(record.history||[])]}
  const all=rows.map(x=>x.id===record.id?source:x)
  saveDocuments([next,...all]);setRows([next,...all]);notify(en?'New draft revision created.':'Δημιουργήθηκε νέα πρόχειρη αναθεώρηση.','success');navigate(`/documents/${next.id}`)
 }
 function attachments(next){persist(audit({...record,attachments:next},'Ενημέρωση συνημμένων',`${next.length} συνημμένα`));notify(en?'Attachments updated.':'Τα συνημμένα ενημερώθηκαν.','success')}
 const tabs=[{id:'overview',label:en?'Overview':'Σύνοψη',icon:BookOpenCheck},{id:'files',label:en?'Files':'Αρχεία',icon:Paperclip},{id:'history',label:en?'History':'Ιστορικό',icon:FileClock}]
 return <Page fill><EntityRecordShell avatar={<BookOpenCheck size={19}/>} eyebrow={record.id} title={record.title} subtitle={`${typeLabels[record.type]||record.type} · ${en?'Version':'Έκδοση'} ${record.version||'—'}`} status={<span className={`status-badge ${record.status==='published'?'active':record.status==='draft'?'temporary':''}`}>{statusLabels[record.status]||record.status}</span>} onBack={()=>navigate('/documents')} headerActions={<>{canManage&&record.status==='draft'&&<button className="general-edit-button" onClick={()=>setEditOpen(true)}><Pencil size={15}/>{en?' Edit':' Επεξεργασία'}</button>}{canSupersede&&record.status==='published'&&<button className="general-edit-button" onClick={createRevision}><Pencil size={15}/>{en?' New revision':' Νέα αναθεώρηση'}</button>}{canSubmitReview&&record.status==='draft'&&<Button onClick={submitReview}>{en?'Submit for review':'Υποβολή για έλεγχο'}</Button>}{canApprove&&record.status==='review'&&<Button onClick={approve}>{en?'Approve':'Έγκριση'}</Button>}{canPublish&&record.status==='approved'&&<Button onClick={publish}>{en?'Publish':'Δημοσίευση'}</Button>}{canArchive&&record.status==='published'&&<button className="entity-record-icon-button danger" onClick={archive} title={en?'Archive':'Αρχειοθέτηση'} aria-label={en?'Archive':'Αρχειοθέτηση'}><Archive size={15}/></button>}<PrintExportActions onExport={()=>downloadRecordJson(record,{filename:record.id})}/></>} tabs={tabs} activeTab={tab} onTabChange={setTab}>
  {tab==='overview'&&<section className="record-section"><div className="record-section-header"><div><span className="eyebrow">{en?'Documents':'Έγγραφα'}</span><h3>{en?'Basic details':'Βασικά στοιχεία'}</h3></div></div><div className="details-grid"><div><span>{en?'Type':'Τύπος'}</span><strong>{typeLabels[record.type]||'—'}</strong></div><div><span>{en?'Version':'Έκδοση'}</span><strong>{record.version||'—'}</strong></div><div><span>{en?'Owner':'Υπεύθυνος'}</span><strong>{record.owner||'—'}</strong></div><div><span>{en?'Department / scope':'Τμήμα / πεδίο εφαρμογής'}</span><strong>{record.department||'—'}</strong></div><div><span>{en?'Effective date':'Ημερομηνία ισχύος'}</span><strong>{record.effectiveDate||'—'}</strong></div><div><span>{en?'Review':'Επανεξέταση'}</span><strong>{record.reviewDate||'—'}</strong></div></div><div className="source-truth-note">{record.description||(en?'No description has been recorded.':'Δεν έχει καταχωρηθεί περιγραφή.')}</div></section>}
  {tab==='files'&&<section className="record-section"><div className="record-section-header"><div><span className="eyebrow">{en?'Documents':'Έγγραφα'}</span><h3>{en?'Files & attachments':'Αρχεία & συνημμένα'}</h3><p>{en?'Preview opens the file itself. Every addition or change is recorded in history.':'Η προβολή ανοίγει το ίδιο το αρχείο. Κάθε προσθήκη/μεταβολή καταγράφεται στο ιστορικό.'}</p></div></div><AttachmentField disabled={!canManage||record.status!=='draft'} value={record.attachments||[]} onChange={attachments}/></section>}
  {tab==='history'&&<DocumentHistory language={language} rows={record.history||[]}/>}
 </EntityRecordShell>{editOpen&&<DocumentEditDialog language={language} initial={record} onClose={()=>setEditOpen(false)} onSave={saveEdit}/>}</Page>
}

function DocumentEditDialog({initial,onClose,onSave,language}){
 const en=language==='en',typeLabels=labels[language].types
 const [v,setV]=useState({...initial}),set=(k,x)=>setV(s=>({...s,[k]:x}))
 return <ObserverDialog width="wide" eyebrow={en?'Documents':'Έγγραφα'} title={en?'Edit document':'Επεξεργασία εγγράφου'} subtitle={initial.id} onClose={onClose} footer={<DialogActions onCancel={onClose} disabled={!v.title?.trim()||!v.version?.trim()||!v.owner?.trim()} onSave={()=>onSave(v)}/>}>
  <div className="entry-grid compact"><label className="entry-span-2"><span>{en?'Title *':'Τίτλος *'}</span><input value={v.title} onChange={e=>set('title',e.target.value)}/></label><label><span>{en?'Type':'Τύπος'}</span><select value={v.type} onChange={e=>set('type',e.target.value)}>{Object.entries(typeLabels).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label><label><span>{en?'Version *':'Έκδοση *'}</span><input value={v.version} onChange={e=>set('version',e.target.value)}/></label><label><span>{en?'Owner *':'Υπεύθυνος *'}</span><input value={v.owner} onChange={e=>set('owner',e.target.value)}/></label><label><span>{en?'Department / scope':'Τμήμα / πεδίο εφαρμογής'}</span><input value={v.department||''} onChange={e=>set('department',e.target.value)}/></label><ManualDateField label={en?'Effective date':'Ημερομηνία ισχύος'} value={v.effectiveDate||''} onChange={x=>set('effectiveDate',x)} optional/><ManualDateField label={en?'Review':'Επανεξέταση'} value={v.reviewDate||''} onChange={x=>set('reviewDate',x)} optional/><label className="entry-span-2"><span>{en?'Description':'Περιγραφή'}</span><textarea rows="3" value={v.description||''} onChange={e=>set('description',e.target.value)}/></label></div>
 </ObserverDialog>
}

function DocumentHistory({rows,language}){
 const en=language==='en'
 const [query,setQuery]=useState(''),[action,setAction]=useState('all')
 const actions=[...new Set(rows.map(x=>x.action).filter(Boolean))]
 const filtered=useMemo(()=>rows.filter(x=>(action==='all'||x.action===action)&&`${x.action} ${x.actor} ${x.reason||''}`.toLowerCase().includes(query.toLowerCase())),[rows,query,action])
 return <section className="record-section"><div className="record-section-header"><div><span className="eyebrow">{en?'Documents':'Έγγραφα'}</span><h3>{en?'History':'Ιστορικό'}</h3><p>{en?'Complete history of versions, publications, files and changes.':'Πλήρης ιστορικότητα εκδόσεων, δημοσιεύσεων, αρχείων και μεταβολών.'}</p></div></div><FilterBar query={query} onQueryChange={setQuery} placeholder={en?'Search history...':'Αναζήτηση ιστορικού...'} activeAdvancedCount={action!=='all'?1:0} onClear={()=>{setQuery('');setAction('all')}}><FilterSelect label={en?'Action':'Ενέργεια'} value={action} onChange={setAction}><option value="all">{en?'All':'Όλες'}</option>{actions.map(x=><option key={x}>{x}</option>)}</FilterSelect></FilterBar><div className="scroll-table"><table className="data-table sticky-table"><thead><tr><th>{en?'Date / time':'Ημερομηνία / ώρα'}</th><th>{en?'Action':'Ενέργεια'}</th><th>{en?'User':'Χρήστης'}</th><th>{en?'Details':'Στοιχεία'}</th></tr></thead><tbody>{filtered.map((h,i)=><tr key={`${h.at}-${i}`}><td>{h.at?new Date(h.at).toLocaleString(en?'en-GB':'el-GR'):'—'}</td><td><strong>{h.action}</strong></td><td>{h.actor||'—'}</td><td>{h.reason||'—'}</td></tr>)}</tbody></table></div></section>
}
