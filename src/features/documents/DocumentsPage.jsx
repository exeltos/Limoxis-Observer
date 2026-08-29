import { useMemo,useState } from 'react'
import { BookOpenCheck,FileCheck2,FileClock,Files } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { RecordActions } from '../../design-system/RecordActions'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { ObserverDialog,DialogActions } from '../../design-system/ObserverDialog'
import { ManualDateField } from '../../design-system/ManualDateField'
import { AttachmentField } from '../../design-system/AttachmentField'
import { UI_ACTIONS } from '../../core/actions/actionPolicy'
import { useTenant } from '../../core/tenant/TenantContext'
import { can,CAPABILITIES } from '../../core/permissions/roles'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useAuditActor } from '../../core/audit/useAuditActor'
import { loadDocuments,nextDocumentId,saveDocuments } from './documentStore'
import { demoLibrarySeed } from '../management/managementData'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { MetricCard } from '../../design-system/MetricCard'

const labels={
 el:{types:{policy:'Πολιτική',procedure:'Διαδικασία',instruction:'Οδηγία',form:'Έντυπο',protocol:'Πρωτόκολλο',other:'Άλλο'},statuses:{draft:'Πρόχειρο',published:'Δημοσιευμένο',archived:'Αρχειοθετημένο'}},
 en:{types:{policy:'Policy',procedure:'Procedure',instruction:'Instruction',form:'Form',protocol:'Protocol',other:'Other'},statuses:{draft:'Draft',published:'Published',archived:'Archived'}}
}

export function DocumentsPage(){
 const navigate=useNavigate(),actor=useAuditActor(),{notify}=useFeedback(),{role,membership}=useTenant(),{language}=useLanguage();const en=language==='en',typeLabels=labels[language].types,statusLabels=labels[language].statuses
 const [rows,setRows]=useState(loadDocuments),[query,setQuery]=useState(''),[status,setStatus]=useState('all'),[type,setType]=useState('all'),[createOpen,setCreateOpen]=useState(false)
 const addOns=membership?.capabilities??[],custom=membership?.customCapabilities??[]
 const canManage=can(role,CAPABILITIES.EDIT_RECORDS,addOns,custom)&&can(role,CAPABILITIES.ATTACH_FILES,addOns,custom)
 const filtered=useMemo(()=>rows.filter(x=>(status==='all'||x.status===status)&&(type==='all'||x.type===type)&&`${x.id} ${x.title} ${x.owner} ${x.department}`.toLowerCase().includes(query.toLowerCase())),[rows,query,status,type])
 const reviewDue=rows.filter(x=>x.reviewDate&&x.reviewDate<=new Date(Date.now()+30*86400000).toISOString().slice(0,10)&&x.status==='published').length
 function persist(next){setRows(next);saveDocuments(next)}
 function exportCsv(){const text=[[...(en?['Code','Title','Type','Version','Owner','Department','Status']:['Κωδικός','Τίτλος','Τύπος','Έκδοση','Υπεύθυνος','Τμήμα','Κατάσταση'])],...filtered.map(x=>[x.id,x.title,typeLabels[x.type],x.version,x.owner,x.department,statusLabels[x.status]])].map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+text],{type:'text/csv'}));a.download='documents.csv';a.click();URL.revokeObjectURL(a.href)}
 function action(a){if(a===UI_ACTIONS.CREATE){setCreateOpen(true);return}if(a===UI_ACTIONS.PRINT){window.print();return}if(a===UI_ACTIONS.EXPORT){exportCsv();notify(en?'Current list exported.':'Η τρέχουσα λίστα εξήχθη.','success')}}
 function create(data){
  const now=new Date().toISOString(),id=nextDocumentId(rows)
  const record={...data,id,status:'draft',createdAt:now,createdBy:actor.name,createdById:actor.id,updatedAt:now,updatedBy:actor.name,updatedById:actor.id,history:[{at:now,actor:actor.name,actorId:actor.id,action:'Δημιουργία εγγράφου',reason:`Έκδοση ${data.version||'0.1'}`}]}
  persist([record,...rows]);setCreateOpen(false);notify(en?'Document created.':'Το έγγραφο δημιουργήθηκε.','success');navigate(`/documents/${id}`)
 }
 return <Page fill title={en?'Documents':'Έγγραφα'} subtitle={en?'Central library of controlled documents, versions and distributions.':'Κεντρική βιβλιοθήκη ελεγχόμενων εγγράφων, εκδόσεων και κοινοποιήσεων.'} actions={<RecordActions actions={[...(canManage?[UI_ACTIONS.CREATE]:[]),UI_ACTIONS.PRINT,UI_ACTIONS.EXPORT]} resourceCapability={CAPABILITIES.VIEW_DOCUMENTS} actionCapabilities={{[UI_ACTIONS.CREATE]:CAPABILITIES.EDIT_RECORDS,[UI_ACTIONS.PRINT]:CAPABILITIES.PRINT_RECORDS,[UI_ACTIONS.EXPORT]:CAPABILITIES.EXPORT_RECORDS}} onAction={action}/>}>
  <div className="module-summary-strip"><Metric icon={Files} label={en?'Total':'Σύνολο'} value={rows.length}/><Metric icon={FileCheck2} label={en?'Published':'Δημοσιευμένα'} value={rows.filter(x=>x.status==='published').length}/><Metric icon={FileClock} label={en?'Drafts':'Πρόχειρα'} value={rows.filter(x=>x.status==='draft').length}/><Metric icon={BookOpenCheck} label={en?'Review ≤30 days':'Review ≤30 ημέρες'} value={reviewDue}/></div>
  <section className="surface registry-workspace workspace-column workspace-fill"><FilterBar query={query} onQueryChange={setQuery} placeholder={en?'Search document, owner or department...':'Αναζήτηση εγγράφου, υπευθύνου ή τμήματος...'} activeAdvancedCount={(status!=='all'?1:0)+(type!=='all'?1:0)} onClear={()=>{setQuery('');setStatus('all');setType('all')}}><FilterSelect label={en?'Type':'Τύπος'} value={type} onChange={setType}><option value="all">{en?'All':'Όλοι'}</option>{Object.entries(typeLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</FilterSelect><FilterSelect label={en?'Status':'Κατάσταση'} value={status} onChange={setStatus}><option value="all">{en?'All':'Όλες'}</option>{Object.entries(statusLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</FilterSelect></FilterBar>
   <div className="scroll-table"><table className="data-table sticky-table record-table-clickable"><thead><tr><th>{en?'Code':'Κωδικός'}</th><th>{en?'Document':'Έγγραφο'}</th><th>{en?'Type':'Τύπος'}</th><th>{en?'Version':'Έκδοση'}</th><th>{en?'Owner':'Υπεύθυνος'}</th><th>{en?'Department / audience':'Τμήμα / κοινό'}</th><th>Review</th><th>{en?'Status':'Κατάσταση'}</th></tr></thead><tbody>{filtered.map(x=><tr key={x.id} tabIndex={0} onClick={()=>navigate(`/documents/${x.id}`)} onKeyDown={e=>e.key==='Enter'&&navigate(`/documents/${x.id}`)}><td><strong>{x.id}</strong></td><td><strong>{x.title}</strong><small>{x.description||'—'}</small></td><td>{typeLabels[x.type]||x.type}</td><td>{x.version||'—'}</td><td>{x.owner||'—'}</td><td>{x.department||'—'}</td><td>{x.reviewDate||'—'}</td><td><span className={`status-badge ${x.status==='published'?'active':x.status==='draft'?'temporary':''}`}>{statusLabels[x.status]||x.status}</span></td></tr>)}</tbody></table>{filtered.length===0&&<div className="inline-empty">{en?'No documents found.':'Δεν βρέθηκαν έγγραφα.'}</div>}</div>
  </section>
  {createOpen&&<DocumentCreateDialog language={language} onClose={()=>setCreateOpen(false)} onSave={create}/>}
 </Page>
}

function Metric({icon:Icon,label,value}){return <MetricCard icon={Icon} value={value} label={label}/>}

function DocumentCreateDialog({onClose,onSave,language}){
 const en=language==='en',typeLabels=labels[language].types
 const departments=demoLibrarySeed.departments.map(([el])=>el)
 const [v,setV]=useState({title:'',type:'policy',version:'0.1',owner:'',department:en?'Whole hospital':'Όλο το νοσοκομείο',audience:'all',effectiveDate:'',reviewDate:'',description:'',attachments:[]})
 const set=(k,x)=>setV(s=>({...s,[k]:x}))
 const valid=v.title.trim()&&v.owner.trim()&&v.version.trim()
 return <ObserverDialog width="wide" eyebrow={en?'Documents':'Έγγραφα'} title={en?'New document':'Νέο έγγραφο'} subtitle={en?'Basic details, owner, version and initial file.':'Βασικά στοιχεία, υπεύθυνος, έκδοση και αρχικό αρχείο.'} onClose={onClose} footer={<DialogActions onCancel={onClose} disabled={!valid} onSave={()=>onSave(v)} saveLabel={en?'Save':'Αποθήκευση'}/>}>
  <div className="observer-form-section"><div className="observer-form-section-title"><div><strong>{en?'Document details':'Στοιχεία εγγράφου'}</strong><span>{en?'A new document is initially created as a draft.':'Το νέο έγγραφο δημιουργείται αρχικά ως πρόχειρο.'}</span></div></div><div className="entry-grid compact">
   <label className="entry-span-2"><span>{en?'Title *':'Τίτλος *'}</span><input value={v.title} onChange={e=>set('title',e.target.value)}/></label>
   <label><span>{en?'Type':'Τύπος'}</span><select value={v.type} onChange={e=>set('type',e.target.value)}>{Object.entries(typeLabels).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>
   <label><span>{en?'Version *':'Έκδοση *'}</span><input value={v.version} onChange={e=>set('version',e.target.value)} placeholder="π.χ. 1.0"/></label>
   <label><span>{en?'Document owner *':'Υπεύθυνος εγγράφου *'}</span><input value={v.owner} onChange={e=>set('owner',e.target.value)} placeholder={en?'Name / role / department':'Όνομα / ρόλος / τμήμα'}/></label>
   <label><span>{en?'Department / scope':'Τμήμα / πεδίο εφαρμογής'}</span><input list="document-departments" value={v.department} onChange={e=>set('department',e.target.value)}/><datalist id="document-departments"><option value={en?'Whole hospital':'Όλο το νοσοκομείο'}/>{departments.map(x=><option key={x} value={x}/>)}</datalist></label>
   <ManualDateField label={en?'Effective date':'Ημερομηνία ισχύος'} value={v.effectiveDate} onChange={x=>set('effectiveDate',x)} optional/><ManualDateField label={en?'Review date':'Ημερομηνία επανεξέτασης'} value={v.reviewDate} onChange={x=>set('reviewDate',x)} optional/>
   <label className="entry-span-2"><span>{en?'Description':'Περιγραφή'}</span><textarea rows="3" value={v.description} onChange={e=>set('description',e.target.value)}/></label>
  </div></div>
  <div className="observer-form-section"><div className="observer-form-section-title"><div><strong>{en?'File / evidence':'Αρχείο / τεκμήριο'}</strong><span>{en?'It can be added now or later from the document record.':'Μπορεί να προστεθεί τώρα ή αργότερα από την καρτέλα εγγράφου.'}</span></div></div><AttachmentField value={v.attachments} onChange={x=>set('attachments',x)}/></div>
 </ObserverDialog>
}
